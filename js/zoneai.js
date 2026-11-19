/* The zone AI: looks at one 224 x 224 zone picture and names it (one of 10 categories).
   Features and network must match training/common.py and training/train.py exactly.
   The model file (model/zone-model.json) is made by training/train.py and stored offline with the app. */
window.S = window.S || {};

S.zoneAI = (() => {
  let model = null, loading = null;
  const G = 56, CELL = 8, BINS = 9, CG = 14;

  function b64ToInt8(s) {
    const bin = atob(s), out = new Int8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = (bin.charCodeAt(i) << 24) >> 24;
    return out;
  }
  function deq(w) {
    const q = b64ToInt8(w.data), M = new Float32Array(w.rows * w.cols);
    for (let r = 0; r < w.rows; r++) { const s = w.scale[r]; for (let c = 0; c < w.cols; c++) M[r * w.cols + c] = q[r * w.cols + c] * s; }
    return { M, rows: w.rows, cols: w.cols };
  }

  async function load(url = 'model/zone-model.json') {
    if (model) return model;
    if (loading) return loading;
    loading = (async () => {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error('No AI model file yet');
      const d = await res.json();
      model = { classes: d.classes, version: d.version, info: d, mu: Float32Array.from(d.mu), sd: Float32Array.from(d.sd),
        W1: deq(d.W1), b1: Float32Array.from(d.b1), W2: deq(d.W2), b2: Float32Array.from(d.b2) };
      return model;
    })();
    try { return await loading; } finally { loading = null; }
  }

  /* Same numbers as training/common.py features() */
  function features(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const px = ctx.getImageData(0, 0, 224, 224).data;
    const a = new Float32Array(G * G * 3);
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
      let r = 0, g = 0, b = 0;
      for (let di = 0; di < 4; di++) for (let dj = 0; dj < 4; dj++) {
        const k = ((i * 4 + di) * 224 + (j * 4 + dj)) * 4;
        r += px[k]; g += px[k + 1]; b += px[k + 2];
      }
      const o = (i * G + j) * 3;
      a[o] = r / 16; a[o + 1] = g / 16; a[o + 2] = b / 16;
    }
    const gray = new Float32Array(G * G);
    for (let i = 0; i < G * G; i++) gray[i] = (a[i * 3] * 77 + a[i * 3 + 1] * 150 + a[i * 3 + 2] * 29) / 256;
    const nc = G / CELL;
    const hog = new Float32Array(nc * nc * BINS);
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
      const gx = j > 0 && j < G - 1 ? gray[i * G + j + 1] - gray[i * G + j - 1] : 0;
      const gy = i > 0 && i < G - 1 ? gray[(i + 1) * G + j] - gray[(i - 1) * G + j] : 0;
      const mag = Math.sqrt(gx * gx + gy * gy);
      let ang = Math.atan2(gy, gx); if (ang < 0) ang += Math.PI;
      const bin = Math.min(Math.floor(ang / Math.PI * BINS), BINS - 1);
      hog[((Math.floor(i / CELL)) * nc + Math.floor(j / CELL)) * BINS + bin] += mag;
    }
    const out = [];
    const cellsum = new Float32Array(nc * nc);
    let total = 0;
    for (let c = 0; c < nc * nc; c++) {
      let s = 0, s2 = 0;
      for (let k = 0; k < BINS; k++) { const v = hog[c * BINS + k]; s += v; s2 += v * v; }
      cellsum[c] = s; total += s;
      const n = Math.sqrt(s2) + 1;
      for (let k = 0; k < BINS; k++) out.push(hog[c * BINS + k] / n);
    }
    for (let c = 0; c < nc * nc; c++) out.push(cellsum[c] / (total + 1));
    const col = new Float32Array(CG * CG * 3);
    for (let i = 0; i < CG; i++) for (let j = 0; j < CG; j++) for (let ch = 0; ch < 3; ch++) {
      let s = 0;
      for (let di = 0; di < 4; di++) for (let dj = 0; dj < 4; dj++) s += a[((i * 4 + di) * G + (j * 4 + dj)) * 3 + ch];
      col[(i * CG + j) * 3 + ch] = s / 16 / 255;
    }
    for (let i = 0; i < col.length; i++) out.push(col[i]);
    for (let c = 0; c < CG * CG; c++) {
      const s = col[c * 3] + col[c * 3 + 1] + col[c * 3 + 2] + 1e-3;
      out.push(col[c * 3] / s, col[c * 3 + 1] / s);
    }
    return Float32Array.from(out);
  }

  /* Returns { name, conf, probs:{name: p} } */
  function predict(canvas) {
    if (!model) throw new Error('Model not loaded');
    const f = features(canvas);
    const { W1, b1, W2, b2, mu, sd } = model;
    const z = new Float32Array(f.length);
    for (let i = 0; i < f.length; i++) z[i] = (f[i] - mu[i]) / sd[i];
    const hdn = new Float32Array(W1.rows);
    for (let r = 0; r < W1.rows; r++) {
      let s = b1[r]; const o = r * W1.cols;
      for (let c = 0; c < W1.cols; c++) s += W1.M[o + c] * z[c];
      hdn[r] = s > 0 ? s : 0;
    }
    const logit = new Float32Array(W2.rows);
    let mx = -Infinity;
    for (let r = 0; r < W2.rows; r++) {
      let s = b2[r]; const o = r * W2.cols;
      for (let c = 0; c < W2.cols; c++) s += W2.M[o + c] * hdn[c];
      logit[r] = s; if (s > mx) mx = s;
    }
    let sum = 0;
    const p = Array.from(logit, v => { const e = Math.exp(v - mx); sum += e; return e; });
    const probs = {};
    let best = 0;
    p.forEach((v, i) => { probs[model.classes[i]] = v / sum; if (v > p[best]) best = i; });
    return { name: model.classes[best], conf: p[best] / sum, probs };
  }

  return { load, predict, features, get model() { return model; } };
})();
