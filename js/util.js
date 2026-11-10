/* Shared helpers, the pausable test clock, and local storage (IndexedDB). */
window.S = window.S || {};

S.util = (() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  /* Small DOM builder: h('button', {class:'btn', onclick: fn}, 'Save') */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const svgNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, ...children) {
    const el = document.createElementNS(svgNS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const realSleep = ms => new Promise(r => setTimeout(r, ms));
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const roundHalf = x => Math.round(x * 2) / 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  const sd = a => {
    if (a.length < 2) return NaN;
    const m = mean(a);
    return Math.sqrt(a.reduce((t, x) => t + (x - m) ** 2, 0) / (a.length - 1));
  };
  const median = a => quantile(a, 0.5);
  function quantile(a, q) {
    if (!a.length) return NaN;
    const b = a.slice().sort((x, y) => x - y);
    const pos = (b.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return b[lo] + (b[hi] - b[lo]) * (pos - lo);
  }
  /* Wilson 95% interval for a proportion */
  function wilson(k, n, z = 1.96) {
    if (!n) return [NaN, NaN];
    const p = k / n;
    const den = 1 + z * z / n;
    const c = (p + z * z / (2 * n)) / den;
    const r = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / den;
    return [Math.max(0, c - r), Math.min(1, c + r)];
  }
  function pearson(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 3) return NaN;
    const mx = mean(x), my = mean(y);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      sxy += (x[i] - mx) * (y[i] - my);
      sxx += (x[i] - mx) ** 2;
      syy += (y[i] - my) ** 2;
    }
    return sxy / Math.sqrt(sxx * syy);
  }
  const pct = (x, d = 1) => (Number.isFinite(x) ? (x * 100).toFixed(d) + '%' : 'n/a');
  const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  function stamp(d = new Date()) {
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }
  const rand4 = () => Math.random().toString(36).slice(2, 6);

  async function sha256(text) {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    /* Fallback when the page is not on a secure origin */
    let h1 = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h1 ^= text.charCodeAt(i); h1 = Math.imul(h1, 16777619); }
    return 'fnv' + (h1 >>> 0).toString(16);
  }

  function toCSV(rows) {
    if (!rows.length) return '';
    const cols = Array.from(rows.reduce((set, r) => { Object.keys(r).forEach(k => set.add(k)); return set; }, new Set()));
    const esc = v => {
      if (v === null || v === undefined) return '';
      const t = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    };
    return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
  }
  function download(name, text, type = 'text/csv') {
    const blob = text instanceof Blob ? text : new Blob([text], { type });
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  return { $, $$, h, s, realSleep, shuffle, roundHalf, clamp, mean, sd, median, quantile, wilson, pearson, pct, fmt, pad, stamp, rand4, sha256, toCSV, download };
})();

/* The test clock. Time stops while the operator pauses, and can run faster in simulator mode. */
S.Abort = class extends Error { constructor(m) { super(m || 'aborted'); this.name = 'Abort'; } };

S.run = {
  speed: 1,
  paused: false,
  aborted: false,
  _t0: performance.now(),
  _pausedTotal: 0,
  _pausedAt: 0,
  reset(speed) {
    this.speed = speed || 1;
    this.paused = false;
    this.aborted = false;
    this._t0 = performance.now();
    this._pausedTotal = 0;
    this._pausedAt = 0;
  },
  now() {
    const n = performance.now();
    const p = this._pausedTotal + (this.paused ? n - this._pausedAt : 0);
    return (n - this._t0 - p) * this.speed;
  },
  pause() {
    if (this.paused) return;
    this.paused = true;
    this._pausedAt = performance.now();
    if (S.audio) S.audio.pauseAll();
  },
  resume() {
    if (!this.paused) return;
    this._pausedTotal += performance.now() - this._pausedAt;
    this.paused = false;
    if (S.audio) S.audio.resumeAll();
  },
  abort() { this.aborted = true; if (S.audio) S.audio.stop(); },
  check() { if (this.aborted) throw new S.Abort(); },
  async wait(ms, onTick) {
    const start = this.now();
    while (this.now() - start < ms) {
      this.check();
      if (onTick) onTick(this.now() - start);
      await S.util.realSleep(Math.max(4, 40 / this.speed));
    }
    this.check();
  },
  /* Poll until pred() returns a truthy value, or until timeoutMs of test time passes. */
  async until(pred, timeoutMs, onTick) {
    const start = this.now();
    for (;;) {
      this.check();
      const el = this.now() - start;
      if (onTick) onTick(el);
      const v = pred(el);
      if (v) return { ok: true, value: v, elapsed: el };
      if (timeoutMs != null && el >= timeoutMs) return { ok: false, elapsed: el };
      await S.util.realSleep(Math.max(4, 40 / this.speed));
    }
  }
};

/* Local storage: every session is saved on the tablet first. */
S.store = (() => {
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('anatomy-station', 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        const make = (n, o) => { if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, o); };
        make('sessions', { keyPath: 'id' });
        make('kv');
        make('photos', { keyPath: 'id' });
        make('prep', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const os = t.objectStore(store);
      const r = fn(os);
      t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
      t.onerror = () => reject(t.error);
    });
  }
  return {
    put: (store, val, key) => tx(store, 'readwrite', os => (key === undefined ? os.put(val) : os.put(val, key))),
    get: (store, key) => tx(store, 'readonly', os => os.get(key)),
    del: (store, key) => tx(store, 'readwrite', os => os.delete(key)),
    all: (store) => tx(store, 'readonly', os => os.getAll()),
    saveSession: (s) => tx('sessions', 'readwrite', os => os.put(JSON.parse(JSON.stringify(s)))),
    sessions: async () => ((await tx('sessions', 'readonly', os => os.getAll())) || []).sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''))
  };
})();

/* Settings live in localStorage so they load instantly. */
S.settings = (() => {
  const KEY = 'anatomy-station-settings';
  let cache = null;
  function load() {
    if (cache) return cache;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { saved = {}; }
    cache = Object.assign({}, S.DEFAULT_SETTINGS, saved);
    return cache;
  }
  function save(patch) {
    cache = Object.assign(load(), patch);
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* storage blocked */ }
    return cache;
  }
  return { get: () => load(), save };
})();
