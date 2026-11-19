"""Shared pieces of the Little Lungs training pipeline.

Mirrors the app exactly where it matters:
- board layout (js/aruco.js S.BOARD): marker centres and zone boxes in cm from the TOP LEFT marker centre
- zone crop: the zone box scaled to fit a 224 x 224 square on grey (#808080), like S.aruco.zoneCrop
- features: the same numbers js/zoneai.js computes in the browser (keep the two in step)
"""
import json
import os
import zipfile
import io
import csv
import numpy as np
import cv2

BOARD = {
    "markers": {31: (0.0, 0.0), 115: (28.6, 0.0), 161: (28.6, 39.5), 261: (0.0, 39.5)},
    "view": (-6.0, -8.0, 34.6, 44.0),  # x0, y0, x1, y1 in cm
    "zones": {
        "rlung": (-2.5, 2.8, 15.0, 29.1),
        "windpipe": (10.8, -6.0, 8.3, 25.2),
        "heart": (10.1, 17.0, 10.0, 14.8),
        "llung": (16.9, 3.7, 11.5, 29.5),
        "diaphragm": (-2.2, 27.8, 29.4, 9.2),
    },
}
ZONES = ["rlung", "windpipe", "heart", "llung", "diaphragm"]
CATS = ["empty", "right_lung", "left_lung", "heart", "trachea", "diaphragm", "flipped", "upside_down", "partial", "hand"]
PIECE_CAT = {"rlung": "right_lung", "llung": "left_lung", "heart": "heart", "windpipe": "trachea", "diaphragm": "diaphragm"}
PX = 12  # straightened board resolution, px per cm (the app saves crops from a 12 px/cm board)
CROP = 224

_det = cv2.aruco.ArucoDetector(cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_ARUCO_ORIGINAL))


def centre(q):
    """Where the diagonals of a quad cross (same as the app)."""
    p1, p2, p3, p4 = q
    d1, d2 = p3 - p1, p4 - p2
    den = d1[0] * d2[1] - d1[1] * d2[0]
    if abs(den) < 1e-9:
        return (p1 + p3) / 2
    t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den
    return p1 + t * d1


def find_markers(bgr):
    c, ids, _ = _det.detectMarkers(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY))
    if ids is None:
        return {}
    return {int(i): centre(q[0].astype(np.float64)) for q, i in zip(c, ids.flatten()) if int(i) in BOARD["markers"]}


def straighten(bgr, found=None, px=PX):
    """Board seen from straight above, px per cm, covering BOARD['view']. None if a marker is missing."""
    found = found if found is not None else find_markers(bgr)
    ids = list(BOARD["markers"])
    if not all(i in found for i in ids):
        return None
    src = np.float32([BOARD["markers"][i] for i in ids])
    dst = np.float32([found[i] for i in ids])
    H = cv2.getPerspectiveTransform(src, dst)  # cm -> image px
    x0, y0, x1, y1 = BOARD["view"]
    W, Hh = round((x1 - x0) * px), round((y1 - y0) * px)
    T = np.array([[1 / px, 0, x0 + 0.5 / px], [0, 1 / px, y0 + 0.5 / px], [0, 0, 1]])
    M = H @ T  # board px -> image px
    return cv2.warpPerspective(bgr, M, (W, Hh), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderValue=(128, 128, 128))


def zone_rect_px(z, px=PX, shift=(0.0, 0.0)):
    x, y, w, h = BOARD["zones"][z]
    x0, y0 = BOARD["view"][:2]
    return ((x - x0 + shift[0]) * px, (y - y0 + shift[1]) * px, w * px, h * px)


def zone_crop(board, z, px=PX, shift=(0.0, 0.0), size=CROP):
    """Same as S.aruco.zoneCrop: zone box scaled to fit the square, centred, grey around it."""
    sx, sy, sw, sh = zone_rect_px(z, px, shift)
    k = size / max(sw, sh)
    out = np.full((size, size, 3), 128, np.uint8)
    dw, dh = sw * k, sh * k
    ox, oy = (size - dw) / 2, (size - dh) / 2
    # affine map from board px to crop px
    A = np.float32([[k, 0, ox - sx * k], [0, k, oy - sy * k]])
    warped = cv2.warpAffine(board, A, (size, size), flags=cv2.INTER_AREA if k < 1 else cv2.INTER_LINEAR, borderValue=(128, 128, 128))
    x0i, y0i = int(round(ox)), int(round(oy))
    x1i, y1i = int(round(ox + dw)), int(round(oy + dh))
    out[y0i:y1i, x0i:x1i] = warped[y0i:y1i, x0i:x1i]
    return out


# ---------------- Features (must match js/zoneai.js) ----------------
G = 56          # crop is reduced to 56 x 56 by 4 x 4 block averages
CELL = 8        # HOG cells of 8 x 8 -> 7 x 7 cells
BINS = 9
COLOR_GRID = 14  # 14 x 14 colour means (blocks of 4 x 4 on the 56 grid)


def features(rgb224):
    """rgb224: uint8 array (224, 224, 3) in RGB order. Returns float32 vector."""
    a = rgb224.astype(np.float32).reshape(G, 4, G, 4, 3).mean(axis=(1, 3))  # 56 x 56 x 3
    gray = (a[..., 0] * 77 + a[..., 1] * 150 + a[..., 2] * 29) / 256.0
    gx = np.zeros_like(gray); gy = np.zeros_like(gray)
    gx[:, 1:-1] = gray[:, 2:] - gray[:, :-2]
    gy[1:-1, :] = gray[2:, :] - gray[:-2, :]
    mag = np.sqrt(gx * gx + gy * gy)
    ang = np.arctan2(gy, gx)
    ang = np.where(ang < 0, ang + np.pi, ang)
    b = np.minimum((ang / np.pi * BINS).astype(np.int32), BINS - 1)
    nc = G // CELL
    hog = np.zeros((nc, nc, BINS), np.float32)
    for i in range(nc):
        for j in range(nc):
            m = mag[i * CELL:(i + 1) * CELL, j * CELL:(j + 1) * CELL].ravel()
            bb = b[i * CELL:(i + 1) * CELL, j * CELL:(j + 1) * CELL].ravel()
            hog[i, j] = np.bincount(bb, weights=m, minlength=BINS)
    cellsum = hog.sum(axis=2)
    hogn = hog / (np.sqrt((hog * hog).sum(axis=2, keepdims=True)) + 1.0)
    energy = cellsum / (cellsum.sum() + 1.0)
    col = a.reshape(COLOR_GRID, 4, COLOR_GRID, 4, 3).mean(axis=(1, 3)) / 255.0
    s = col.sum(axis=2, keepdims=True) + 1e-3
    chroma = col[..., :2] / s  # r and g share of brightness: robust to light level
    return np.concatenate([hogn.ravel(), energy.ravel(), col.ravel(), chroma.ravel()]).astype(np.float32)


FEAT_LEN = 7 * 7 * BINS + 7 * 7 + COLOR_GRID * COLOR_GRID * 3 + COLOR_GRID * COLOR_GRID * 2


# ---------------- Reading session zips from the app ----------------
def read_session_zip(path):
    """Returns (rows, frames, crops): rows = labels.csv rows; frames = {photo: bgr}; crops = {(photo, zone): rgb224}."""
    z = zipfile.ZipFile(path)
    rows = list(csv.DictReader(io.StringIO(z.read("labels.csv").decode("utf-8"))))
    frames, crops = {}, {}
    for n in z.namelist():
        if not n.endswith(".jpg"):
            continue
        buf = np.frombuffer(z.read(n), np.uint8)
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        base = n.rsplit("/", 1)[-1][:-4]
        if n.startswith("frames/"):
            frames[base] = img
        else:
            photo, zone = base.rsplit("-", 1)
            crops[(photo, zone)] = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    return rows, frames, crops


# ---------------- MobileNetV2 features (must match js/zoneai.js) ----------------
# A network already trained on millions of photos (ImageNet). Only its last part is replaced:
# each zone picture becomes 1280 numbers, and the small network in train.py learns from those.
MNET_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "model", "mobilenet-feat.onnx")
MNET_MEAN = [0.485, 0.456, 0.406]
MNET_STD = [0.229, 0.224, 0.225]
_mnet = None


def mnet_features(rgb_list):
    """rgb_list: uint8 arrays (224, 224, 3) RGB. Returns float32 (n, 1280)."""
    global _mnet
    if _mnet is None:
        import onnxruntime as ort
        so = ort.SessionOptions(); so.log_severity_level = 3
        _mnet = ort.InferenceSession(MNET_PATH, so)
    m, s = np.float32(MNET_MEAN), np.float32(MNET_STD)
    out = np.zeros((len(rgb_list), 1280), np.float32)
    for i, img in enumerate(rgb_list):
        x = ((img.astype(np.float32) / 255 - m) / s).transpose(2, 0, 1)[None]
        out[i] = _mnet.run(None, {"input": x})[0].reshape(-1)
    return out
