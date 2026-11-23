/* Board camera. Two interchangeable versions:
   - VisionSim: a pretend student and a pretend AI, so Task 1 runs without the trained model.
   - VisionLive: the real camera. The marker finder and the trained model plug into read().
   Both return the same observation: { ready, hand, stableMs, handClearAt, zones: {organ: {cls, conf}} }
   cls is an organ id, 'rot:<organ>' for a rotated or flipped piece, or 'empty'. */
window.S = window.S || {};

S.judge = function (target, zones, thr, opt = {}) {
  const isLung = o => o === 'rlung' || o === 'llung';
  const z = zones[target] || { cls: 'empty', conf: 1 };
  /* opt.base: what each zone showed when the prompt started (a piece left on the board is not a new answer).
     opt.long: the board has been still with no hand for several seconds, so the student has let go. */
  const changed = o => !opt.base || !zones[o] || zones[o].cls !== opt.base[o];
  /* A piece half outside its box, or a hand: maybe still adjusting, keep waiting.
     If the student has let go and it is still half outside, it is answered: the position is wrong. */
  if (z.cls === 'hand') return null;
  if (z.cls === 'partial') return opt.long ? { verdict: 'wrong', error: 'position', seenZone: target, seenCls: z.cls, conf: z.conf } : null;
  /* Live camera: pOwn = how sure the AI is that the target piece is in its zone, the right way up.
     Sure it is (>= thr): judge as usual. Sure it is not (<= 1 - thr): judge as usual. In between: ask the operator. */
  if (z.pOwn != null && z.pOwn > 1 - thr && z.pOwn < thr) return { verdict: 'cant_verify', error: null, seenZone: target, seenCls: z.cls, conf: z.conf };
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
  /* The target zone is empty but something new is on the board somewhere else:
     another piece, or a piece lying across zones. That is the student's answer, and it is wrong. */
  const other = S.ORGANS.find(o => o !== target && zones[o] && zones[o].cls !== 'empty' && zones[o].cls !== 'hand' && changed(o));
  if (other && (zones[other].cls !== 'partial' || opt.long)) {
    return { verdict: 'wrong', error: zones[other].cls === 'partial' ? 'wrong_zone' : 'wrong_piece', seenZone: other, seenCls: zones[other].cls, conf: zones[other].conf };
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
  preview() { return null; }
  notReadyReason() { return 'The simulated camera is not ready.'; }
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

/* Live camera: finds the 4 markers about 4 times a second, straightens the board, and watches for movement.
   The AI only names the zones once the board has been still for a moment, so a moving hand or sleeve is never
   judged. If the AI sees a hand resting on a zone, or a marker gets covered, the observation says hand = true:
   the test then waits and asks the student to move their hand away, instead of marking anything wrong. */
const OWN_CAT = { rlung: 'right_lung', llung: 'left_lung', heart: 'heart', windpipe: 'trachea', diaphragm: 'diaphragm' };
const AI_TO_CLS = { right_lung: 'rlung', left_lung: 'llung', heart: 'heart', trachea: 'windpipe', diaphragm: 'diaphragm', empty: 'empty', partial: 'partial', hand: 'hand' };
class VisionLive {
  constructor() {
    this.kind = 'live';
    this.stream = null;
    this.video = null;
    this.running = false;
    this.work = document.createElement('canvas');
    this.prev = null;            /* small grey board from the last frame, to spot movement */
    this.lastChange = 0;         /* last time something moved on the board */
    this.handClearAt = 0;
    this.hand = false;
    this.markersHidden = false;
    this.seenBoard = false;
    this.found = 0;
    this.light = null;
    this.zones = Object.fromEntries(S.ORGANS.map(o => [o, { cls: 'empty', conf: 0 }]));
    this.aiFrameAt = -1;         /* when the frame the AI last looked at was taken */
    this.foundList = [];
    this.lastPos = {};           /* last place each corner marker was seen, to show a covered one */
    this.hiddenSince = null;     /* since when a corner marker has been hidden */
    this.aiBusy = false;
    this.aiHand = false;
    this.settleMs = 700;         /* still this long before the AI looks */
  }
  stop() { this.running = false; if (this.stream) this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
  async start(facing) {
    if (this.stream) return true;
    this.error = null;
    const d = await S.camera.diagnose();
    if (!d.ok) { this.error = d.message; return false; }
    try {
      const f = facing || S.settings.get().cameraFacing || 'environment';
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: f, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      this.video = document.createElement('video');
      this.video.playsInline = true;
      this.video.muted = true;
      this.video.srcObject = this.stream;
      await this.video.play();
    } catch (e) { this.error = e && e.name === 'NotAllowedError' ? 'Camera permission was refused. Set Camera to Allow in the site settings.' : `The camera did not start (${e && e.name}).`; return false; }
    S.zoneAI.load().catch(() => {});
    this.running = true;
    this.loop();
    return true;
  }
  async loop() {
    while (this.running) {
      try { this.tick(); } catch (e) { console.warn('[vision]', e); }
      await S.util.realSleep(250);
    }
  }
  setHand(on) {
    if (this.hand && !on) this.handClearAt = S.run.now();
    if (on !== this.hand) this.lastChange = S.run.now();
    this.hand = on;
  }
  tick() {
    const v = this.video;
    if (!v || !v.videoWidth) return;
    const now = S.run.now();
    const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    this.work.width = Math.round(v.videoWidth * k); this.work.height = Math.round(v.videoHeight * k);
    const ctx = this.work.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(v, 0, 0, this.work.width, this.work.height);
    const found = S.aruco.detect(ctx.getImageData(0, 0, this.work.width, this.work.height));
    this.found = found.length;
    this.foundList = found;
    this.workW = this.work.width; this.workH = this.work.height;
    found.forEach(f => { this.lastPos[f.id] = f.corners; });
    if (found.length < 4 && this.seenBoard) { if (this.hiddenSince == null) this.hiddenSince = now; }
    else this.hiddenSince = null;
    if (found.length < 4) {
      /* A marker that was visible is now covered: almost always a hand or arm */
      this.markersHidden = this.seenBoard;
      this.setHand(this.markersHidden || this.aiHand);
      this.prev = null;
      return;
    }
    this.seenBoard = true;
    this.markersHidden = false;
    /* Movement: compare a small straightened board with the last one */
    const small = Object.assign({}, S.BOARD, { pxPerCm: 3 });
    const sb = S.aruco.straighten(this.work, found, small);
    if (!sb) return;
    const px = sb.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, sb.width, sb.height).data;
    const g = new Float32Array(px.length / 4);
    let sum = 0;
    for (let i = 0; i < g.length; i++) { g[i] = (px[i * 4] * 77 + px[i * 4 + 1] * 150 + px[i * 4 + 2] * 29) / 256; sum += g[i]; }
    this.light = sum / g.length;
    if (this.prev && this.prev.length === g.length) {
      let md = 0;
      for (let i = 0; i < g.length; i++) md += g[i] - this.prev[i];
      md /= g.length; /* whole-picture brightness shift (camera exposure), not movement */
      /* Compare 2 cm squares, not single pixels: camera noise and the tiny wobble of the marker
         corners change single pixels along every edge, even when nothing moves. A square only
         counts as changed when its average brightness changes by more than 12 of 255. */
      const W = sb.width, H = sb.height, C = 6;
      let cells = 0, busy = 0;
      for (let y = 0; y + C <= H; y += C) for (let x = 0; x + C <= W; x += C) {
        let a = 0;
        for (let yy = y; yy < y + C; yy++) for (let xx = x; xx < x + C; xx++) { const j = yy * W + xx; a += g[j] - this.prev[j] - md; }
        cells++;
        if (Math.abs(a / (C * C)) > 12) busy++;
      }
      this.movedPct = cells ? 100 * busy / cells : 0;
      if (busy / cells > 0.015) this.lastChange = now;
    } else this.lastChange = now;
    this.prev = g;
    this.setHand(this.aiHand);
    /* Still long enough, and the AI has not looked since the last change: let it look now */
    if (!this.aiBusy && S.zoneAI.model && now - this.lastChange >= this.settleMs && this.aiFrameAt < this.lastChange + this.settleMs) {
      const layout = Object.assign({}, S.BOARD, { pxPerCm: 12 });
      const board = S.aruco.straighten(this.work, found, layout);
      if (!board) return;
      const crops = S.ORGANS.map(o => S.aruco.zoneCrop(board, S.BOARD.zones[o], 224, layout));
      const frameAt = now, changeAt = this.lastChange;
      this.aiBusy = true;
      const aiT0 = performance.now();
      S.zoneAI.predictMany(crops).then(gs => {
        this.aiMs = performance.now() - aiT0;
        this.aiError = null;
        if (this.lastChange !== changeAt) { this.aiDiscarded = (this.aiDiscarded || 0) + 1; return; } /* the board moved while the AI was looking: throw it away */
        const zones = {};
        let hand = false;
        S.ORGANS.forEach((o, i) => {
          const r = gs[i];
          const cls = r.name === 'flipped' || r.name === 'upside_down' ? 'rot:' + o : AI_TO_CLS[r.name] || 'empty';
          zones[o] = { cls, conf: r.conf, ai: r.name, pOwn: r.probs[OWN_CAT[o]] || 0 };
          if (r.name === 'hand' && r.conf >= 0.5) hand = true;
        });
        this.zones = zones;
        this.aiHand = hand;
        this.aiFrameAt = frameAt;
        this.setHand(hand || this.markersHidden);
      }).catch(e => { this.aiError = (e && e.message) || String(e); console.warn('[vision] AI', e); }).finally(() => { this.aiBusy = false; });
    }
  }
  async selfTest() {
    try {
      const m = await S.zoneAI.load();
      const c = document.createElement('canvas'); c.width = c.height = 224;
      const x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 224, 224);
      const t0 = performance.now();
      await S.zoneAI.predict(c);
      const ms = Math.round(performance.now() - t0);
      return { ok: true, detail: `${m.backbone === 'mobilenetv2' ? 'MobileNet AI' : 'Small fallback AI'} loaded (${ms} ms per zone)` };
    } catch (e) { return { ok: false, detail: 'The AI model did not load: ' + (e && e.message) }; }
  }
  /* Waits up to 20 s for the markers and a first AI reading (the first reading is slow while the AI warms up) */
  async boardView() {
    const t0 = performance.now();
    while (performance.now() - t0 < 20000 && !(this.found === 4 && this.aiFrameAt >= 0) && !this.aiError) await S.util.realSleep(200);
    const L = this.light;
    const light = L == null ? 'unknown' : L >= 70 && L <= 210 ? 'ok' : L >= 45 && L <= 230 ? 'borderline' : 'bad';
    return { markers: this.found, tilt: this.found === 4 ? 'ok' : 'unknown', light,
      detail: this.found === 4 ? (light === 'ok' ? null : `Board brightness ${Math.round(L)} of 255: ${L < 70 ? 'too dark' : 'too bright'}`) : `${this.found} of 4 markers found` };
  }
  /* Live camera picture with the 4 corner markers outlined: green = seen, red = covered.
     Shows nothing about the organ zones, so it gives the student no hints. */
  preview({ caption = true } = {}) {
    const h = S.util.h;
    const box = h('figure', { class: 'cam-preview' });
    const cv = h('canvas', { 'aria-label': 'Live camera view of the board' });
    const cap = h('figcaption');
    box.append(cv);
    if (caption) box.append(cap);
    const ids = Object.keys(S.BOARD.markers).map(Number);
    const draw = () => {
      if (!box.isConnected && box._started) return;
      box._started = true;
      const v = this.video;
      if (v && v.videoWidth) {
        const W = 640, k = W / v.videoWidth;
        cv.width = W; cv.height = Math.round(v.videoHeight * k);
        const c = cv.getContext('2d');
        c.drawImage(v, 0, 0, cv.width, cv.height);
        const sx = cv.width / (this.workW || cv.width), sy = cv.height / (this.workH || cv.height);
        const seen = new Set((this.foundList || []).map(f => f.id));
        c.lineWidth = 4;
        ids.forEach(id => {
          const q = this.lastPos[id];
          if (!q) return;
          const ok = seen.has(id);
          c.strokeStyle = ok ? '#1f9d55' : '#d93025';
          c.beginPath(); q.forEach(([x, y], i) => (i ? c.lineTo(x * sx, y * sy) : c.moveTo(x * sx, y * sy))); c.closePath(); c.stroke();
          if (!ok) { c.fillStyle = 'rgba(217,48,37,0.35)'; c.fill(); }
        });
        const n = seen.size;
        cap.textContent = n === 4 ? 'All 4 black corner squares can be seen.' : `${4 - n} of the 4 black corner squares ${4 - n === 1 ? 'is' : 'are'} covered or out of view.`;
        box.classList.toggle('bad', n < 4);
      } else cap.textContent = 'Starting the camera...';
      setTimeout(draw, 150);
    };
    setTimeout(draw, 0);
    return box;
  }
  /* Why there is no AI reading yet, in words for the operator */
  notReadyReason() {
    if (this.found !== 4) return `Only ${this.found || 0} of 4 corner markers are visible, so the AI cannot look at the zones.`;
    if (!S.zoneAI.model) return 'The AI model has not finished loading.';
    if (this.aiError) return 'The AI stopped with an error: ' + this.aiError;
    if (this.aiBusy) return 'The AI is still looking at the board for the first time. Tap Run the check again in a few seconds.';
    if (this.aiDiscarded) return `The board kept changing while the AI looked (${this.aiDiscarded} times, ${Math.round(this.aiMs || 0)} ms per look). Keep hands, shadows and the tablet still, then run the check again.`;
    if (S.run.now() - this.lastChange < this.settleMs) return 'The camera keeps seeing movement on the board (people, shadows, flickering light or a wobbling stand). Keep it still, then run the check again.';
    return 'The camera AI has not looked at the board yet.';
  }
  read() {
    const now = S.run.now();
    const fresh = this.aiFrameAt >= this.lastChange + this.settleMs;
    return {
      ready: this.seenBoard && this.aiFrameAt >= 0,
      hand: this.hand,
      stableMs: this.hand || !fresh ? 0 : now - Math.max(this.lastChange, this.handClearAt),
      handClearAt: this.handClearAt,
      zones: JSON.parse(JSON.stringify(this.zones))
    };
  }
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
  if (S.vision && S.vision.kind === 'live') S.vision.stop();
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
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
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
