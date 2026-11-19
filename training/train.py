"""Train the zone classifier from the app's session zips and export it for the browser.

Usage:
  python3 train.py --zips DIR [--val 4] [--test 5] [--synth 12] [--out ../model/zone-model.json] [--cv]

Real pictures: the 224 x 224 zone crops the app saved (exactly what the app will see live).
Extra pictures: synth.py makes more from the real training photos only (never from validation or test photos).
Model: image features (common.features, also in js/zoneai.js) -> standardise -> small neural network (1 hidden layer).
"""
import argparse
import glob
import json
import os
import sys
import time
import numpy as np
import cv2
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import confusion_matrix

sys.path.insert(0, os.path.dirname(__file__))
from common import ZONES, CATS, FEAT_LEN, features, read_session_zip, straighten  # noqa: E402
import synth  # noqa: E402


def load(zdir):
    photos = []  # dicts: id, session, split, labels, tags, crops, frame
    for path in sorted(glob.glob(os.path.join(zdir, "*.zip"))):
        rows, frames, crops = read_session_zip(path)
        by = {}
        for x in rows:
            d = by.setdefault(x["photo"], {"id": x["photo"], "session": int(x["session"]), "split": x["use_for"], "labels": {}, "tags": {}})
            d["labels"][x["zone"]] = x["category"]
            d["tags"][x["zone"]] = (x.get("also") or "").split()
        for pid, d in by.items():
            d["crops"] = {z: crops[(pid, z)] for z in ZONES if (pid, z) in crops}
            d["frame"] = frames.get(pid)
            photos.append(d)
    return photos


def build(photos, synth_per_zone, seed):
    X, y, src = [], [], []
    r = np.random.default_rng(seed)
    for p in photos:
        for z in ZONES:
            if z in p["crops"]:
                X.append(features(p["crops"][z])); y.append(p["labels"][z]); src.append("real")
        if synth_per_zone and p["frame"] is not None:
            board = straighten(p["frame"])
            if board is None:
                continue
            for img, name, how in synth.make(board, p["labels"], p["tags"], r, per_zone=synth_per_zone):
                X.append(features(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))); y.append(name); src.append(how)
    return np.array(X, np.float32), np.array(y), np.array(src)


def fit(X, y, seed=0):
    mu, sd = X.mean(0), X.std(0) + 1e-4
    clf = MLPClassifier(hidden_layer_sizes=(128,), alpha=1e-3, batch_size=128, learning_rate_init=1e-3,
                        max_iter=80, early_stopping=True, validation_fraction=0.1, n_iter_no_change=8, random_state=seed)
    clf.fit((X - mu) / sd, y)
    return clf, mu, sd


def predict(model, X):
    clf, mu, sd = model
    return clf.predict((X - mu) / sd), clf.predict_proba((X - mu) / sd).max(1)


def report(y_true, y_pred, title):
    acc = (y_true == y_pred).mean()
    print(f"\n{title}: {len(y_true)} zone pictures, accuracy {acc:.3f}")
    labs = [c for c in CATS if c in set(y_true) | set(y_pred)]
    cm = confusion_matrix(y_true, y_pred, labels=labs)
    print("true \\ said  " + " ".join(f"{c[:6]:>6}" for c in labs))
    for c, row in zip(labs, cm):
        print(f"{c[:12]:<12} " + " ".join(f"{v:>6}" for v in row))
    return acc


def q8(M):
    """Weights as signed bytes with one scale per row (keeps the file small); base64 text."""
    import base64
    M = np.asarray(M, np.float32)
    s = np.abs(M).max(axis=1) / 127 + 1e-12
    q = np.clip(np.round(M / s[:, None]), -127, 127).astype(np.int8)
    return {"rows": M.shape[0], "cols": M.shape[1], "scale": np.round(s, 8).tolist(), "data": base64.b64encode(q.tobytes()).decode()}


def export(model, path, extra=None):
    clf, mu, sd = model
    W1, W2 = clf.coefs_
    b1, b2 = clf.intercepts_
    data = {
        "version": time.strftime("%Y-%m-%d %H:%M"),
        "classes": list(clf.classes_), "feat_len": FEAT_LEN,
        "mu": np.round(mu, 5).tolist(), "sd": np.round(sd, 5).tolist(),
        "W1": q8(W1.T), "b1": np.round(b1, 5).tolist(),
        "W2": q8(W2.T), "b2": np.round(b2, 5).tolist(),
    }
    if extra:
        data.update(extra)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"\nSaved {path} ({os.path.getsize(path) // 1024} KB)")


def predict_q(path, X):
    """Run the exported (byte) model exactly like the browser does, to check nothing was lost."""
    import base64
    d = json.load(open(path))
    def deq(w):
        q = np.frombuffer(base64.b64decode(w["data"]), np.int8).reshape(w["rows"], w["cols"]).astype(np.float32)
        return q * np.array(w["scale"], np.float32)[:, None]
    W1, W2 = deq(d["W1"]), deq(d["W2"])
    Z = (X - np.array(d["mu"], np.float32)) / np.array(d["sd"], np.float32)
    H = np.maximum(Z @ W1.T + np.array(d["b1"], np.float32), 0)
    O = H @ W2.T + np.array(d["b2"], np.float32)
    return np.array(d["classes"])[O.argmax(1)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zips", required=True)
    ap.add_argument("--synth", type=int, default=12)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "model", "zone-model.json"))
    ap.add_argument("--cv", action="store_true", help="only one session so far: hold out whole photos in turn")
    a = ap.parse_args()
    photos = load(a.zips)
    print(f"{len(photos)} photos from sessions {sorted(set(p['session'] for p in photos))}")
    train = [p for p in photos if p["split"] == "train"]
    val = [p for p in photos if p["split"] == "validation"]
    test = [p for p in photos if p["split"] == "test"]

    if a.cv:
        r = np.random.default_rng(0)
        ids = np.array([p["id"] for p in train]); r.shuffle(ids)
        folds = np.array_split(ids, 5)
        yt, yp = [], []
        for k, hold in enumerate(folds):
            tr = [p for p in train if p["id"] not in set(hold)]
            te = [p for p in train if p["id"] in set(hold)]
            Xtr, ytr, _ = build(tr, a.synth, k)
            Xte, yte, _ = build(te, 0, k)
            m = fit(Xtr, ytr, k)
            pred, _ = predict(m, Xte)
            yt += list(yte); yp += list(pred)
            print(f"fold {k + 1}: trained on {len(Xtr)} pictures ({len(tr)} photos), held-out photos {len(te)}: {(pred == yte).mean():.3f}")
        report(np.array(yt), np.array(yp), "Held-out photos (5 folds, same session: optimistic)")

    X, y, src = build(train, a.synth, 123)
    print(f"\nFinal training set: {len(y)} pictures ({(src == 'real').sum()} real, {(src != 'real').sum()} extra)")
    m = fit(X, y)
    for name, part in (("Validation (session 4)", val), ("Final test (session 5)", test)):
        if part:
            Xv, yv, _ = build(part, 0, 0)
            report(yv, predict(m, Xv)[0], name)
    note = {"trained_on": sorted(set(p["session"] for p in train)), "pictures": int(len(y)), "real_pictures": int((src == "real").sum())}
    export(m, a.out, note)
    same = (predict_q(a.out, X[:2000]) == predict(m, X[:2000])[0]).mean()
    print(f"Byte model agrees with the full model on {same:.3%} of training pictures")


if __name__ == "__main__":
    main()
