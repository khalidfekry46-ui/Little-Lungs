"""Make many extra training pictures from the real sessions, without changing what the pictures show.

Method ("moving window"): every real photo is straightened into a flat board picture. The app looks at each zone
through a fixed window. Here the window is moved, resized, turned and recoloured a little, which gives new,
realistic pictures of the same real pieces:
- small moves and colour changes            -> same name (more variety of light, position, camera)
- a big move so the piece sticks out        -> Partial
- a window the size of ANOTHER zone          -> the piece in the wrong box (named by the piece, or Partial if it sticks out)
- turned 180 degrees                         -> Upside down (and an upside-down piece turned back becomes correct)
Pictures are never mirrored: a mirrored right lung would look like a flipped piece.
"""
import numpy as np
import cv2
from common import BOARD, ZONES, PIECE_CAT, PX, CROP

MARGIN = 0.8  # cm between a piece and its zone box (zone boxes were drawn about this much larger than the pieces)


def piece_box(z):
    x, y, w, h = BOARD["zones"][z]
    if z == "windpipe":  # its zone box reaches up into the neck
        return (x + MARGIN, y + 1.5, w - 2 * MARGIN, h - 1.5 - MARGIN)
    return (x + MARGIN, y + MARGIN, w - 2 * MARGIN, h - 2 * MARGIN)


def zone_centre(z):
    x, y, w, h = BOARD["zones"][z]
    return (x + w / 2, y + h / 2)


def outside_fraction(box, centre, wh):
    """Share of a box (x, y, w, h) that falls outside a window of size wh centred at centre (axis aligned)."""
    bx, by, bw, bh = box
    wx0, wy0 = centre[0] - wh[0] / 2, centre[1] - wh[1] / 2
    ix = max(0.0, min(bx + bw, wx0 + wh[0]) - max(bx, wx0))
    iy = max(0.0, min(by + bh, wy0 + wh[1]) - max(by, wy0))
    return 1.0 - (ix * iy) / (bw * bh)


def intrusion(centre, wh, home_zone, pieces_present):
    """Largest share of the window covered by a piece that is not normally seen this much in home_zone's window."""
    worst = 0.0
    for q in pieces_present:
        if q == home_zone:
            continue
        qb = piece_box(q)
        def cover(c, s):
            wx0, wy0 = c[0] - s[0] / 2, c[1] - s[1] / 2
            ix = max(0.0, min(qb[0] + qb[2], wx0 + s[0]) - max(qb[0], wx0))
            iy = max(0.0, min(qb[1] + qb[3], wy0 + s[1]) - max(qb[1], wy0))
            return ix * iy / (s[0] * s[1])
        base = cover(zone_centre(home_zone), BOARD["zones"][home_zone][2:])
        worst = max(worst, cover(centre, wh) - base)
    return worst


def window_crop(board, centre, wh, angle=0.0, size=CROP, px=PX):
    """Like the app's zone crop, but for any window (centre and size in cm) and a small turn in degrees."""
    x0, y0 = BOARD["view"][:2]
    cx, cy = (centre[0] - x0) * px, (centre[1] - y0) * px
    sw, sh = wh[0] * px, wh[1] * px
    k = size / max(sw, sh)
    M = cv2.getRotationMatrix2D((cx, cy), angle, k)
    M[0, 2] += size / 2 - cx
    M[1, 2] += size / 2 - cy
    out = cv2.warpAffine(board, M, (size, size), flags=cv2.INTER_AREA if k < 1 else cv2.INTER_LINEAR, borderValue=(128, 128, 128))
    dw, dh = sw * k, sh * k
    x0i, y0i = int(round((size - dw) / 2)), int(round((size - dh) / 2))
    x1i, y1i = int(round((size + dw) / 2)), int(round((size + dh) / 2))
    mask = np.zeros((size, size), bool)
    mask[y0i:y1i, x0i:x1i] = True
    out[~mask] = 128
    return out, mask


def photometric(img, r, mask=None):
    """Random light changes: brightness, contrast, colour cast, gamma, blur, noise, JPEG."""
    f = img.astype(np.float32)
    f = f * r.uniform(0.75, 1.25) + r.uniform(-20, 20)
    f = (f - 128) * r.uniform(0.8, 1.2) + 128
    f *= np.array([r.uniform(0.9, 1.1), r.uniform(0.92, 1.08), r.uniform(0.9, 1.1)], np.float32)
    f = np.clip(f, 0, 255)
    g = r.uniform(0.8, 1.25)
    f = 255 * (f / 255) ** g
    if r.random() < 0.3:  # shadow across part of the picture
        h, w = f.shape[:2]
        xs = np.linspace(0, 1, w)[None, :, None]
        a = r.uniform(-1, 1)
        f *= np.clip(1 - r.uniform(0.1, 0.35) * (xs * a + (1 - a) / 2 > r.uniform(0.3, 0.7)), 0.6, 1)
    out = np.clip(f, 0, 255).astype(np.uint8)
    if r.random() < 0.35:
        out = cv2.GaussianBlur(out, (0, 0), r.uniform(0.5, 1.6))
    if r.random() < 0.3:
        out = np.clip(out.astype(np.int16) + r.normal(0, r.uniform(2, 7), out.shape).astype(np.int16), 0, 255).astype(np.uint8)
    if r.random() < 0.5:
        ok, enc = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, int(r.uniform(55, 92))])
        out = cv2.imdecode(enc, cv2.IMREAD_COLOR)
    if mask is not None:
        out[~mask] = 128  # the grey border around the zone stays exactly as the app makes it
    return out


def flip_name(label, piece_zone):
    """Name of a clean piece picture after turning it 180 degrees."""
    if label == "flipped":
        return "flipped"
    if label == "upside_down":
        return PIECE_CAT[piece_zone]
    return "upside_down"


def make(board, labels, tags, r, per_zone=12):
    """board: straightened BGR (PX px per cm). labels: zone -> name. tags: zone -> list of extra truths.
    Yields (rgb224, name, how) for one real photo."""
    present = [z for z in ZONES if labels[z] not in ("empty",)]
    for z in ZONES:
        lab = labels[z]
        t = set(tags.get(z, []))
        zc, zwh = zone_centre(z), BOARD["zones"][z][2:]
        clean_home = lab in (PIECE_CAT[z], "flipped", "upside_down") and "wrong_place" not in t and "partial" not in t and "slid" not in t
        for _ in range(per_zone):
            kind = r.random()
            if kind < 0.45 or not clean_home:
                # 1. small changes: same name
                c = (zc[0] + r.uniform(-0.6, 0.6), zc[1] + r.uniform(-0.6, 0.6))
                s = r.uniform(0.96, 1.04)
                img, mk = window_crop(board, c, (zwh[0] * s, zwh[1] * s), r.uniform(-3, 3))
                yield photometric(img, r, mk), lab, "jitter"
            elif kind < 0.65:
                # 2. big move: the piece sticks out of the box -> Partial
                for _try in range(6):
                    dx, dy = r.uniform(-0.5, 0.5) * zwh[0], r.uniform(-0.45, 0.45) * zwh[1]
                    c = (zc[0] + dx, zc[1] + dy)
                    out = outside_fraction(piece_box(z), c, zwh)
                    if 0.3 <= out <= 0.7:
                        img, mk = window_crop(board, c, zwh, r.uniform(-3, 3))
                        yield photometric(img, r, mk), "partial", "moved"
                        break
            elif kind < 0.85:
                # 3. the piece seen through another zone's box: piece in the wrong place
                z2 = ZONES[r.integers(len(ZONES))]
                if z2 == z:
                    continue
                wh2 = BOARD["zones"][z2][2:]
                pb = piece_box(z)
                c = (pb[0] + pb[2] / 2 + r.uniform(-0.5, 0.5), pb[1] + pb[3] / 2 + r.uniform(-0.5, 0.5))
                out = outside_fraction(pb, c, wh2)
                if out < 0.2:
                    name = lab
                elif out >= 0.3:
                    name = "partial"
                else:
                    continue
                img, mk = window_crop(board, c, wh2, r.uniform(-3, 3))
                yield photometric(img, r, mk), name, "other_box"
            else:
                # 4. turned 180 degrees: upside down (or back to correct)
                c = (zc[0] + r.uniform(-0.4, 0.4), zc[1] + r.uniform(-0.4, 0.4))
                img, mk = window_crop(board, c, zwh, 180 + r.uniform(-3, 3))
                yield photometric(img, r, mk), flip_name(lab, z), "turned"
