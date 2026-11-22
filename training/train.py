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
from common import ZONES, CATS, FEAT_LEN, features, mnet_features, MNET_MEAN, MNET_STD, read_session_zip, straighten  # noqa: E402
import synth  # noqa: E402


def derive(zone, cat, tags, piece=None):
    """One training name per zone, by priority: Hand > Partial > Flipped > Upside down > the piece > Empty.
    Works for every export: session 1 (name by priority), session 2 (piece name plus 'also' ticks) and later
    sessions (separate 'piece' column). The diaphragm with its other side up is correct, so it is never Flipped."""
    tags = set(tags)
    if piece:
        cat = {"two": "partial", "none": "empty"}.get(piece, PIECE_CAT_ANY.get(piece, cat))
    if cat == "hand":
        return "hand"
    if cat == "partial" or "partial" in tags or "slid" in tags:
        return "partial"
    if cat == "empty":
        return "empty"
    is_dia = cat == "diaphragm" or piece == "diaphragm" or (zone == "diaphragm" and cat in ("flipped", "upside_down") and "wrong_place" not in tags)
    if is_dia:
        return "upside_down" if ("upside_down" in tags or cat == "upside_down") else "diaphragm"
    if cat == "flipped" or "flipped" in tags:
        return "flipped"
    if cat == "upside_down" or "upside_down" in tags:
        return "upside_down"
    return cat


PIECE_CAT_ANY = {"rlung": "right_lung", "llung": "left_lung", "heart": "heart", "windpipe": "trachea", "diaphragm": "diaphragm"}


def excluded():
    """Lines in exclude.txt (# for notes): a photo ID leaves out the whole photo, "photo zone" leaves out one zone."""
    path = os.path.join(os.path.dirname(__file__), "exclude.txt")
    if not os.path.exists(path):
        return set()
    return {" ".join(ln.split("#")[0].split()) for ln in open(path) if ln.split("#")[0].strip()}


def corrections():
    """Label fixes from the team's review: (photo, zone) -> (piece, tags). See corrections.csv."""
    import csv
    path = os.path.join(os.path.dirname(__file__), "corrections.csv")
    if not os.path.exists(path):
        return {}
    lines = [ln for ln in open(path) if not ln.startswith("#")]
    return {(r["photo"], r["zone"]): (r["piece"], r["tags"].split()) for r in csv.DictReader(lines)}


def load(zdir):
    photos = []  # dicts: id, session, split, labels, tags, crops, frame
    skip = excluded()
    fix = corrections()
    for path in sorted(glob.glob(os.path.join(zdir, "*.zip"))):
        rows, frames, crops = read_session_zip(path)
        by = {}
        for x in rows:
            if x["photo"] in skip:
                continue
            d = by.setdefault(x["photo"], {"id": x["photo"], "session": int(x["session"]), "split": x["use_for"], "labels": {}, "tags": {}})
            if f'{x["photo"]} {x["zone"]}' in skip:
                d.setdefault("skip", set()).add(x["zone"])
                continue
            tags = (x.get("also") or "").split()
            piece = x.get("piece") or None
            if (x["photo"], x["zone"]) in fix:
                piece, tags = fix[(x["photo"], x["zone"])]
                tags = tags + (["wrong_place"] if piece in PIECE_CAT_ANY and piece != x["zone"] else [])
            cat = "hand" if piece == "hand" else x["category"]
            d["labels"][x["zone"]] = derive(x["zone"], cat, tags, piece)
            d["tags"][x["zone"]] = tags
        for pid, d in by.items():
            d["crops"] = {z: crops[(pid, z)] for z in ZONES if (pid, z) in crops and z in d["labels"]}
            d["frame"] = frames.get(pid)
            photos.append(d)
    return photos


BACKBONE = "hand"  # "hand": hand-made features (common.features); "mnet": MobileNetV2 features


def build(photos, synth_per_zone, seed):
    imgs, y, src = [], [], []
    r = np.random.default_rng(seed)
    for p in photos:
        for z in ZONES:
            # Hands videos (session 90+) give hundreds of near-identical hand pictures in one look;
            # keep 1 in 10 so the AI doesn't learn "this video's lighting = hand"
            if p["session"] >= 90 and p["labels"].get(z) == "hand" and r.random() > 0.1:
                continue
            if z in p["crops"]:
                imgs.append(p["crops"][z]); y.append(p["labels"][z]); src.append("real")
        if synth_per_zone and p["frame"] is not None:
            board = straighten(p["frame"])
            if board is None:
                continue
            for img, name, how in synth.make(board, p["labels"], p["tags"], r, per_zone=synth_per_zone):
                imgs.append(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)); y.append(name); src.append(how)
    if BACKBONE == "mnet":
        X = mnet_features(imgs) if imgs else np.zeros((0, 1280), np.float32)
    else:
        X = np.array([features(i) for i in imgs], np.float32)
    return X, np.array(y), np.array(src)


def fit(X, y, seed=0):
    mu, sd = X.mean(0), X.std(0) + 1e-4
    hidden, alpha = ((256,), 1.0) if BACKBONE == "mnet" else ((128,), 1e-3)
    clf = MLPClassifier(hidden_layer_sizes=hidden, alpha=alpha, batch_size=128, learning_rate_init=1e-3,
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
        "classes": list(clf.classes_), "feat_len": int(mu.shape[0]),
        "backbone": "mobilenetv2" if BACKBONE == "mnet" else "hand",
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
    ap.add_argument("--out", default=None)
    ap.add_argument("--backbone", choices=["hand", "mnet"], default="mnet", help="mnet: MobileNetV2 features (better); hand: the small fallback model")
    ap.add_argument("--xsess", action="store_true", help="hold out each session in turn, train on the rest (fair check)")
    ap.add_argument("--cv", action="store_true", help="only one session so far: hold out whole photos in turn")
    a = ap.parse_args()
    global BACKBONE
    BACKBONE = a.backbone
    if a.out is None:
        a.out = os.path.join(os.path.dirname(__file__), "..", "model", "zone-head.json" if BACKBONE == "mnet" else "zone-model.json")
    photos = load(a.zips)
    if excluded():
        print(f"Left out on purpose: {', '.join(sorted(excluded()))}")
    if corrections():
        print(f"Label fixes applied: {len(corrections())}")
    print(f"{len(photos)} photos from sessions {sorted(set(p['session'] for p in photos))}")
    train = [p for p in photos if p["split"] == "train"]
    val = [p for p in photos if p["split"] == "validation"]
    test = [p for p in photos if p["split"] == "test"]

    if a.xsess:
        sess = sorted(set(p["session"] for p in train if p["session"] < 90))
        for s in sess:
            tr = [p for p in train if p["session"] != s]
            te = [p for p in train if p["session"] == s]
            Xtr, ytr, _ = build(tr, a.synth, s)
            Xte, yte, _ = build(te, 0, 0)
            report(yte, predict(fit(Xtr, ytr), Xte)[0], f"Session {s} held out (trained on all the others)")

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
    if BACKBONE == "mnet":
        note_in = {"input": {"size": 224, "mean": MNET_MEAN, "std": MNET_STD}, "backbone_file": "model/mobilenet-feat.onnx"}
    else:
        note_in = {}
    note = {**note_in, "trained_on": sorted(set(p["session"] for p in train)), "pictures": int(len(y)), "real_pictures": int((src == "real").sum())}
    export(m, a.out, note)
    same = (predict_q(a.out, X[:2000]) == predict(m, X[:2000])[0]).mean()
    print(f"Byte model agrees with the full model on {same:.3%} of training pictures")


if __name__ == "__main__":
    main()
