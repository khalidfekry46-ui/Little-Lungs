/* Finds the 4 Little Lungs board markers (ArUco "original" dictionary, IDs 31, 115, 161, 261) in a camera frame,
   then straightens the board using the marker centres. Written for these 4 markers only, so it needs no library
   and works offline.
   Steps: grey image -> local threshold -> dark blobs -> 4 corners per blob -> read the 7 x 7 grid -> match the code. */
window.S = window.S || {};

S.aruco = (() => {
  /* Inner 5 x 5 pattern of each marker, row by row from the top, 1 = white (from OpenCV's dictionary) */
  const CODES = {
    31: '1000010000101110111001110',
    115: '1000010111011101000001110',
    161: '1000001001010011000010111',
    261: '1011110000100001011110111'
  };
  const grid = s => [0, 1, 2, 3, 4].map(r => s.slice(r * 5, r * 5 + 5).split('').map(Number));
  const rot = g => g[0].map((_, c) => g.map(row => row[c]).reverse()); /* 90 degrees clockwise */
  const VARIANTS = Object.entries(CODES).map(([id, s]) => {
    const out = []; let g = grid(s);
    for (let k = 0; k < 4; k++) { out.push(g); g = rot(g); }
    return { id: Number(id), rots: out };
  });

  /* 4-point homography: maps src[i] -> dst[i]. Returns a 3x3 matrix as a flat array of 9. */
  function homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    /* Gaussian elimination with partial pivoting */
    const n = 8;
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (Math.abs(A[p][c]) < 1e-12) return null;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = A[r][c] / A[c][c];
        if (!f) continue;
        for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
        b[r] -= f * b[c];
      }
    }
    const h = b.map((v, i) => v / A[i][i]);
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  }
  const apply = (H, x, y) => { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; };

  /* Grey image from RGBA ImageData */
  function toGray(img) {
    const { data, width: w, height: hgt } = img;
    const g = new Uint8Array(w * hgt);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
    return g;
  }

  /* Dark pixels: darker than the local average by C. Uses an integral image so the window size is free. */
  function threshold(g, w, hgt, win, C) {
    const I = new Float64Array((w + 1) * (hgt + 1));
    for (let y = 0; y < hgt; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; }
    }
    const m = new Uint8Array(w * hgt);
    const r = win >> 1;
    for (let y = 0; y < hgt; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(hgt, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        const s = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
        const mean = s / ((x1 - x0) * (y1 - y0));
        m[y * w + x] = g[y * w + x] < mean - C ? 1 : 0;
      }
    }
    return m;
  }

  /* Connected dark blobs (4-connected), with their pixel lists */
  function blobs(m, w, hgt, minSide, maxSide) {
    const lab = new Int32Array(w * hgt);
    const out = [];
    const stack = new Int32Array(w * hgt);
    let next = 1;
    for (let i = 0; i < m.length; i++) {
      if (!m[i] || lab[i]) continue;
      let sp = 0; stack[sp++] = i; lab[i] = next;
      const px = [];
      let minx = w, maxx = 0, miny = hgt, maxy = 0;
      while (sp) {
        const p = stack[--sp];
        px.push(p);
        const x = p % w, y = (p - x) / w;
        if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
        if (x > 0 && m[p - 1] && !lab[p - 1]) { lab[p - 1] = next; stack[sp++] = p - 1; }
        if (x < w - 1 && m[p + 1] && !lab[p + 1]) { lab[p + 1] = next; stack[sp++] = p + 1; }
        if (y > 0 && m[p - w] && !lab[p - w]) { lab[p - w] = next; stack[sp++] = p - w; }
        if (y < hgt - 1 && m[p + w] && !lab[p + w]) { lab[p + w] = next; stack[sp++] = p + w; }
      }
      const bw = maxx - minx + 1, bh = maxy - miny + 1;
      if (bw >= minSide && bh >= minSide && bw <= maxSide && bh <= maxSide && px.length > minSide * minSide * 0.3) out.push({ px, minx, maxx, miny, maxy });
      next++;
    }
    return out;
  }

  /* Four corners of a blob: farthest point from the centre, farthest from that, then the farthest on each side of their line */
  function corners(b, w) {
    let cx = 0, cy = 0;
    const n = b.px.length;
    for (const p of b.px) { cx += p % w; cy += (p / w) | 0; }
    cx /= n; cy /= n;
    const xy = p => [p % w, (p / w) | 0];
    let a = null, best = -1;
    for (const p of b.px) { const [x, y] = xy(p); const d = (x - cx) ** 2 + (y - cy) ** 2; if (d > best) { best = d; a = [x, y]; } }
    let c = null; best = -1;
    for (const p of b.px) { const [x, y] = xy(p); const d = (x - a[0]) ** 2 + (y - a[1]) ** 2; if (d > best) { best = d; c = [x, y]; } }
    let bP = null, dP = null, bMax = 0, dMin = 0;
    const ux = c[0] - a[0], uy = c[1] - a[1];
    for (const p of b.px) {
      const [x, y] = xy(p);
      const s = ux * (y - a[1]) - uy * (x - a[0]);
      if (s > bMax) { bMax = s; bP = [x, y]; }
      if (s < dMin) { dMin = s; dP = [x, y]; }
    }
    if (!bP || !dP) return null;
    /* Order a, b, c, d around the centre, then push each corner half a pixel outward */
    const q = [a, bP, c, dP].sort((p, r) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(r[1] - cy, r[0] - cx));
    return q.map(([x, y]) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [x + 0.5 + dx / l * 0.5, y + 0.5 + dy / l * 0.5]; });
  }

  const area = q => Math.abs(q.reduce((s, p, i) => { const r = q[(i + 1) % 4]; return s + p[0] * r[1] - r[0] * p[1]; }, 0)) / 2;

  /* Read the 7 x 7 cells inside a quad and match against the 4 codes */
  function decode(g, w, hgt, q) {
    const H = homography([[0, 0], [7, 0], [7, 7], [0, 7]], q);
    if (!H) return null;
    const cell = [];
    for (let r = 0; r < 7; r++) {
      const row = [];
      for (let c = 0; c < 7; c++) {
        let s = 0, k = 0;
        for (const fy of [0.3, 0.5, 0.7]) for (const fx of [0.3, 0.5, 0.7]) {
          const [x, y] = apply(H, c + fx, r + fy);
          const xi = Math.round(x), yi = Math.round(y);
          if (xi < 0 || yi < 0 || xi >= w || yi >= hgt) return null;
          s += g[yi * w + xi]; k++;
        }
        row.push(s / k);
      }
      cell.push(row);
    }
    const flat = cell.flat();
    const lo = Math.min(...flat), hi = Math.max(...flat);
    if (hi - lo < 30) return null; /* no contrast: not a marker */
    const t = (lo + hi) / 2;
    let borderWhite = 0;
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if ((i === 0 || j === 0 || i === 6 || j === 6) && cell[i][j] > t) borderWhite++;
    if (borderWhite > 3) return null;
    const bits = [1, 2, 3, 4, 5].map(i => [1, 2, 3, 4, 5].map(j => (cell[i][j] > t ? 1 : 0)));
    let best = null;
    for (const v of VARIANTS) for (let k = 0; k < 4; k++) {
      let d = 0;
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (bits[i][j] !== v.rots[k][i][j]) d++;
      if (!best || d < best.d) best = { id: v.id, d, k };
    }
    return best && best.d <= 2 ? best : null;
  }

  /* Centre of a quad = where its diagonals cross */
  function centre(q) {
    const [p1, p2, p3, p4] = q;
    const d1x = p3[0] - p1[0], d1y = p3[1] - p1[1], d2x = p4[0] - p2[0], d2y = p4[1] - p2[1];
    const den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-9) return [(p1[0] + p3[0]) / 2, (p1[1] + p3[1]) / 2];
    const t = ((p2[0] - p1[0]) * d2y - (p2[1] - p1[1]) * d2x) / den;
    return [p1[0] + t * d1x, p1[1] + t * d1y];
  }

  /* Detect markers in ImageData. Returns [{id, corners:[[x,y]x4], centre:[x,y], dist}] in that image's pixels. */
  function detect(img) {
    const w = img.width, hgt = img.height;
    const g = toGray(img);
    const short = Math.min(w, hgt);
    const found = {};
    /* Two window sizes help with both small and large markers */
    for (const win of [Math.max(9, (short / 25) | 1), Math.max(15, (short / 10) | 1)]) {
      const m = threshold(g, w, hgt, win | 1, 7);
      for (const b of blobs(m, w, hgt, Math.max(8, short / 60), short * 0.6)) {
        const q = corners(b, w);
        if (!q) continue;
        const A = area(q);
        const fill = b.px.length / A;
        if (A < 64 || fill < 0.35 || fill > 1.05) continue;
        const sides = q.map((p, i) => Math.hypot(q[(i + 1) % 4][0] - p[0], q[(i + 1) % 4][1] - p[1]));
        if (Math.min(...sides) / Math.max(...sides) < 0.3) continue;
        const r = decode(g, w, hgt, q);
        if (!r) continue;
        const prev = found[r.id];
        if (!prev || r.d < prev.dist || (r.d === prev.dist && A > prev.area)) found[r.id] = { id: r.id, corners: q, centre: centre(q), dist: r.d, area: A };
      }
      if (Object.keys(found).length === 4) break;
    }
    return Object.values(found);
  }

  return { detect, homography, apply, CODES };
})();

/* The board layout, in cm, measured from the centre of the TOP LEFT marker (ID 31).
   Marker centres: measured by the team (28.6 cm across, 39.5 cm down).
   Zones: first draft taken from a photo of the finished board; adjust after the Board check. */
S.BOARD = {
  markers: { 31: [0, 0], 115: [28.6, 0], 161: [28.6, 39.5], 261: [0, 39.5] },
  view: { x0: -6, y0: -8, x1: 34.6, y1: 44 },
  pxPerCm: 10,
  zones: {
    rlung: { x: -2.5, y: 2.8, w: 15.0, h: 29.1 },
    windpipe: { x: 10.8, y: -6.0, w: 8.3, h: 25.2 },
    heart: { x: 10.1, y: 17.0, w: 10.0, h: 14.8 },
    llung: { x: 16.9, y: 3.7, w: 11.5, h: 29.5 },
    diaphragm: { x: -2.2, y: 27.8, w: 29.4, h: 9.2 }
  }
};

/* Straighten a frame: returns a canvas of the board seen from straight above, or null if a marker is missing */
S.aruco.straighten = function (srcCanvas, found, layout = S.BOARD) {
  const ids = Object.keys(layout.markers).map(Number);
  const byId = Object.fromEntries(found.map(f => [f.id, f]));
  if (!ids.every(i => byId[i])) return null;
  const Hb2i = S.aruco.homography(ids.map(i => layout.markers[i]), ids.map(i => byId[i].centre));
  if (!Hb2i) return null;
  const { x0, y0, x1, y1 } = layout.view;
  const s = layout.pxPerCm;
  const W = Math.round((x1 - x0) * s), Hh = Math.round((y1 - y0) * s);
  const sw = srcCanvas.width, sh = srcCanvas.height;
  const src = srcCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, sw, sh).data;
  const out = document.createElement('canvas');
  out.width = W; out.height = Hh;
  const octx = out.getContext('2d');
  const od = octx.createImageData(W, Hh);
  for (let y = 0; y < Hh; y++) {
    for (let x = 0; x < W; x++) {
      const [u, v] = S.aruco.apply(Hb2i, x0 + (x + 0.5) / s, y0 + (y + 0.5) / s);
      const xi = u | 0, yi = v | 0, o = (y * W + x) * 4;
      if (xi >= 0 && yi >= 0 && xi < sw && yi < sh) {
        const k = (yi * sw + xi) * 4;
        od.data[o] = src[k]; od.data[o + 1] = src[k + 1]; od.data[o + 2] = src[k + 2]; od.data[o + 3] = 255;
      } else od.data[o + 3] = 0;
    }
  }
  octx.putImageData(od, 0, 0);
  out.toBoard = (cx, cy) => [(cx - x0) * s, (cy - y0) * s];
  return out;
};

/* Cut one zone out of a straightened board, as a square picture (what the AI will see) */
S.aruco.zoneCrop = function (board, zone, size = 224, layout = S.BOARD) {
  const s = layout.pxPerCm;
  const sx = (zone.x - layout.view.x0) * s, sy = (zone.y - layout.view.y0) * s, sw = zone.w * s, sh = zone.h * s;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  const k = size / Math.max(sw, sh);
  ctx.drawImage(board, sx, sy, sw, sh, (size - sw * k) / 2, (size - sh * k) / 2, sw * k, sh * k);
  return c;
};
