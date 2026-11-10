/* Board camera. Two interchangeable versions:
   - VisionSim: a pretend student and a pretend AI, so Task 1 runs without the trained model.
   - VisionLive: the real camera. The marker finder and the trained model plug into read().
   Both return the same observation: { ready, hand, stableMs, handClearAt, zones: {organ: {cls, conf}} }
   cls is an organ id, 'rot:<organ>' for a rotated or flipped piece, or 'empty'. */
window.S = window.S || {};

S.judge = function (target, zones, thr) {
  const isLung = o => o === 'rlung' || o === 'llung';
  const z = zones[target] || { cls: 'empty', conf: 1 };
  const elsewhere = S.ORGANS.find(o => o !== target && zones[o] && (zones[o].cls === target || zones[o].cls === 'rot:' + target));
  if (z.cls === target && !elsewhere) {
    return { verdict: z.conf >= thr ? 'correct' : 'cant_verify', error: null, seenZone: target, seenCls: z.cls, conf: z.conf };
  }
  if (z.cls === 'rot:' + target) return { verdict: 'wrong', error: 'orientation', seenZone: target, seenCls: z.cls, conf: z.conf };
  if (elsewhere) {
    return { verdict: 'wrong', error: isLung(elsewhere) && isLung(target) ? 'left_right_swap' : 'wrong_zone', seenZone: elsewhere, seenCls: zones[elsewhere].cls, conf: zones[elsewhere].conf };
  }
  if (z.cls !== 'empty') {
    const other = z.cls.replace('rot:', '');
    return { verdict: 'wrong', error: isLung(other) && isLung(target) ? 'left_right_swap' : 'wrong_piece', seenZone: target, seenCls: z.cls, conf: z.conf };
  }
  return null; /* nothing relevant on the board yet */
};

S.boardEmpty = zones => S.ORGANS.every(o => !zones[o] || zones[o].cls === 'empty');

class VisionSim {
  constructor() {
    this.kind = 'sim';
    this.truth = {};          // what is really on the board: zone -> {piece, rotated}
    this.seen = {};           // what the pretend AI reports: zone -> {cls, conf}
    this.hand = false;
    this.lastChange = 0;
    this.handClearAt = 0;
    this.jobs = [];
    this.timer = setInterval(() => this.tick(), 40);
    S.ORGANS.forEach(o => { this.seen[o] = { cls: 'empty', conf: 0.99 }; });
  }
  async start() { return true; }
  async selfTest() { return { ok: true, detail: 'Simulated model' }; }
  async boardView() { return { markers: 4, tilt: 'ok', light: 'ok' }; }
  read() {
    const now = S.run.now();
    return {
      ready: true, hand: this.hand,
      stableMs: this.hand ? 0 : now - Math.max(this.lastChange, this.handClearAt),
      handClearAt: this.handClearAt,
      zones: JSON.parse(JSON.stringify(this.seen))
    };
  }
  /* Truth for the current board, used as simulated ground truth */
  truthVerdict(target) {
    const t = this.truth[target];
    const elsewhere = S.ORGANS.some(o => o !== target && this.truth[o] && this.truth[o].piece === target);
    return t && t.piece === target && !t.rotated && !elsewhere ? 'correct' : 'wrong';
  }
  schedule(delay, fn) { this.jobs.push({ at: S.run.now() + delay, fn }); }
  tick() {
    if (S.run.paused) return;
    const now = S.run.now();
    const due = this.jobs.filter(j => j.at <= now);
    this.jobs = this.jobs.filter(j => j.at > now);
    due.forEach(j => j.fn());
  }
  setHand(on) { this.hand = on; if (!on) this.handClearAt = S.run.now(); this.lastChange = S.run.now(); }
  put(zone, piece, rotated = false) {
    this.truth[zone] = { piece, rotated };
    const err = S.settings.get().simAiError;
    let cls = rotated ? 'rot:' + piece : piece;
    if (Math.random() < err) {
      const choices = ['empty', ...S.ORGANS.filter(o => o !== piece), 'rot:' + piece, piece].filter(c => c !== cls);
      cls = choices[Math.floor(Math.random() * choices.length)];
    }
    this.seen[zone] = { cls, conf: 0.8 + Math.random() * 0.19 };
    this.lastChange = S.run.now();
  }
  clear() {
    this.truth = {};
    S.ORGANS.forEach(o => { this.seen[o] = { cls: 'empty', conf: 0.99 }; });
    this.lastChange = S.run.now();
  }
  /* One pretend placement: hand comes in, piece goes down, hand leaves */
  act(zone, piece, rotated, thinkMs) {
    this.schedule(thinkMs, () => this.setHand(true));
    this.schedule(thinkMs + 1200, () => { this.clearPieces(); this.put(zone, piece, rotated); });
    this.schedule(thinkMs + 1700 + Math.random() * 700, () => this.setHand(false));
  }
  clearPieces() {
    this.truth = {};
    S.ORGANS.forEach(o => { this.seen[o] = { cls: 'empty', conf: 0.99 }; });
  }
  wrongMove(target) {
    const isLung = target === 'rlung' || target === 'llung';
    const r = Math.random();
    if (isLung && r < 0.55) {
      const other = target === 'rlung' ? 'llung' : 'rlung';
      return Math.random() < 0.5 ? { zone: target, piece: other } : { zone: other, piece: target };
    }
    if (r < 0.75) {
      const wrongPiece = S.ORGANS.filter(o => o !== target)[Math.floor(Math.random() * 4)];
      return { zone: target, piece: wrongPiece };
    }
    return { zone: target, piece: target, rotated: true };
  }
  /* Called by the test at each prompt: the pretend student answers on their own */
  onPrompt(target, level, attempt) {
    const s = S.settings.get();
    if (!s.simAutoStudent) return;
    if (Math.random() < 0.04) return; /* sometimes the student never places anything */
    const base = { 1: 0.92, 2: s.simSkill, 3: s.simSkill - 0.15 }[level];
    const p = attempt === 2 ? 0.75 : base;
    const think = 3000 + Math.random() * 9000;
    if (Math.random() < p) this.act(target, target, false, think);
    else { const m = this.wrongMove(target); this.act(m.zone, m.piece, !!m.rotated, think); }
  }
  onReturn() {
    if (!S.settings.get().simAutoStudent) return;
    this.schedule(800, () => this.setHand(true));
    this.schedule(1800, () => this.clear());
    this.schedule(2300, () => this.setHand(false));
  }
  onBuild() {
    if (!S.settings.get().simAutoStudent) return;
    let t = 2500;
    this.schedule(t, () => this.setHand(true));
    S.util.shuffle(S.ORGANS).forEach(o => {
      t += 6000 + Math.random() * 6000;
      const ok = Math.random() < 0.85;
      const rotated = !ok;
      this.schedule(t, () => { this.truth[o] = null; this.put(o, o, rotated); });
    });
    this.schedule(t + 900, () => this.setHand(false));
  }
  /* Manual buttons in the simulator panel */
  manual(action, target) {
    if (action === 'correct') this.act(target, target, false, 200);
    else if (action === 'wrong') { const m = this.wrongMove(target); this.act(m.zone, m.piece, !!m.rotated, 200); }
    else if (action === 'clear') { this.setHand(true); this.schedule(500, () => { this.clear(); this.setHand(false); }); }
    else if (action === 'build') { S.ORGANS.forEach(o => this.put(o, o, false)); this.setHand(false); }
  }
}

class VisionLive {
  constructor() {
    this.kind = 'live';
    this.stream = null;
    this.video = null;
    this.model = null; /* plug the trained model in here (see docs/what-is-waiting.md) */
  }
  stop() { if (this.stream) this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
  async start(facing) {
    if (this.stream) return true;
    this.error = null;
    const d = await S.camera.diagnose();
    if (!d.ok) { this.error = d.message; return false; }
    try {
      const f = facing || S.settings.get().cameraFacing || 'environment';
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: f, width: { ideal: 1920 } }, audio: false });
      this.video = document.createElement('video');
      this.video.playsInline = true;
      this.video.muted = true;
      this.video.srcObject = this.stream;
      await this.video.play();
      return true;
    } catch (e) { this.error = e && e.name === 'NotAllowedError' ? 'Camera permission was refused. Set Camera to Allow in the site settings.' : `The camera did not start (${e && e.name}).`; return false; }
  }
  async selfTest() {
    if (!this.model) return { ok: false, detail: 'Vision model not installed yet' };
    return { ok: true, detail: 'Model loaded' };
  }
  async boardView() { return { markers: 0, tilt: 'unknown', light: 'unknown', detail: 'Marker finder not installed yet' }; }
  read() { return { ready: false, hand: false, stableMs: 0, handClearAt: 0, zones: {} }; }
  truthVerdict() { return null; }
  onPrompt() {} onReturn() {} onBuild() {} manual() {}
  frame(canvas) {
    if (!this.video) return null;
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    canvas.getContext('2d').drawImage(this.video, 0, 0);
    return canvas;
  }
}

S.vision = null;
S.makeVision = function () {
  S.vision = S.settings.get().visionMode === 'live' ? new VisionLive() : new VisionSim();
  return S.vision;
};
S.VisionLive = VisionLive;

/* Camera access and a working check. Explains exactly why the camera cannot start. */
S.camera = (() => {
  const { h } = S.util;
  let stream = null;
  const stop = () => { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; };

  /* Reasons the browser may refuse before it ever shows a permission window */
  async function diagnose() {
    if (!window.isSecureContext) return { ok: false, why: 'insecure', message: 'The camera only works on a secure (https) page. Open the app from its https link, for example your GitHub Pages address.' };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return { ok: false, why: 'unsupported', message: 'This browser cannot use the camera. Use Chrome or the Huawei Browser, updated.' };
    const pol = document.permissionsPolicy || document.featurePolicy;
    let framed = false;
    try { framed = window.self !== window.top; } catch (e) { framed = true; }
    if (pol && pol.allowsFeature && !pol.allowsFeature('camera')) {
      return { ok: false, why: 'frame', message: framed
        ? 'This page is shown inside another website (for example the claude.ai preview), which does not let it use the camera, so no permission window can appear. Open the app from its own link (GitHub Pages) to use the camera.'
        : 'The website settings block the camera for this page.' };
    }
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const p = await navigator.permissions.query({ name: 'camera' });
        if (p.state === 'denied') return { ok: false, why: 'denied', message: 'Camera access was blocked earlier for this site. Tap the lock or tune icon next to the address, open Site settings, set Camera to Allow, then reload the page.' };
        return { ok: true, state: p.state, framed };
      }
    } catch (e) { /* some browsers cannot query camera permission */ }
    return { ok: true, state: 'unknown', framed };
  }

  /* Ask for the camera (this is what shows the permission window) and check that frames arrive */
  async function test(facing = 'environment') {
    const d = await diagnose();
    if (!d.ok) return d;
    stop();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 } }, audio: false });
    } catch (e) {
      const n = e && e.name;
      const blockedByFrame = d.framed && ['NotAllowedError', 'NotSupportedError', 'SecurityError'].includes(n);
      const message = blockedByFrame ? 'This page is shown inside another website (for example the claude.ai preview), which does not let it use the camera, so no permission window can appear. Open the app from its own link (GitHub Pages) to use the camera.'
        : n === 'NotAllowedError' ? (d.framed ? 'The camera was blocked by the page around this app. Open the app from its own link (GitHub Pages).' : 'Camera permission was refused. Tap the lock or tune icon next to the address, set Camera to Allow, then try again.')
        : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'No camera was found for that side. Try the other camera.'
        : n === 'NotReadableError' ? 'Another app is using the camera. Close it and try again.'
        : `The camera did not start (${n || 'unknown error'}).`;
      return { ok: false, why: n, message };
    }
    const video = h('video', { class: 'feed', playsinline: true, muted: true, autoplay: true });
    video.srcObject = stream;
    try { await video.play(); } catch (e) { /* autoplay of muted video is allowed */ }
    const t0 = performance.now();
    while (!(video.videoWidth > 0) && performance.now() - t0 < 4000) await S.util.realSleep(100);
    if (!(video.videoWidth > 0)) { stop(); return { ok: false, why: 'noframes', message: 'The camera opened but sent no picture. Close other camera apps and try again.' }; }
    const track = stream.getVideoTracks()[0];
    const set = track && track.getSettings ? track.getSettings() : {};
    return { ok: true, video, width: video.videoWidth, height: video.videoHeight, label: track ? track.label : '', facing: set.facingMode || facing, message: `Camera working: ${video.videoWidth} x ${video.videoHeight}${track && track.label ? `, ${track.label}` : ''}.` };
  }

  /* A panel with Allow buttons, a live preview and the result. onResult(r) is called after each try. */
  function panel({ onResult, compact } = {}) {
    const status = h('p', { class: 'camstatus muted', role: 'status' }, 'Tap a button. The browser asks for permission the first time: choose Allow.');
    const view = h('div', { class: `camera ${compact ? 'small' : ''}` });
    const run = async facing => {
      status.className = 'camstatus muted';
      status.textContent = 'Asking the browser for the camera...';
      view.replaceChildren();
      const r = await test(facing);
      status.className = `camstatus ${r.ok ? 'ok' : 'bad'}`;
      status.textContent = r.message;
      if (r.ok) view.replaceChildren(r.video);
      if (onResult) onResult(r);
      return r;
    };
    const el = h('div', { class: 'camtest' },
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => run('environment') }, 'Allow and test back camera'),
        h('button', { class: 'btn', type: 'button', onclick: () => run('user') }, 'Allow and test front camera'),
        h('button', { class: 'btn', type: 'button', onclick: () => { stop(); view.replaceChildren(); status.className = 'camstatus muted'; status.textContent = 'Camera stopped.'; } }, 'Stop camera')),
      status, view);
    el.run = run;
    return el;
  }

  return { diagnose, test, panel, stop };
})();
