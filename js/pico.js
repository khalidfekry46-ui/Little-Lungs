/* Pico W link. Two interchangeable versions:
   - PicoSim: generates realistic belt, heart-rate and breath data so the app runs without hardware.
   - PicoWS: talks to the real Pico W with the JSON messages in docs/pico-protocol.md.
   The rest of the app only uses the methods below, so swapping is one setting. */
window.S = window.S || {};

S.Emitter = class {
  constructor() { this._l = {}; }
  on(ev, fn) { (this._l[ev] = this._l[ev] || new Set()).add(fn); return () => this._l[ev].delete(fn); }
  emit(ev, data) { (this._l[ev] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); }
};

class PicoSim extends S.Emitter {
  constructor() {
    super();
    this.kind = 'sim';
    this.fw = 'sim-1.0';
    this.connected = false;
    this.finger = false;
    this.beltsOn = false;
    this.mode = 'idle';
    this.mirror = false;
    this.phase = { name: 'rest', start: 0, dur: 4000 };
    this.perform = 'rest';
    this.student = this.newStudent();
    this.lastSample = 0;
    this.servoLog = [];
    this.timer = null;
  }
  newStudent() {
    return { baseHr: 68 + Math.random() * 20, chestBase: 410 + Math.random() * 60, abdBase: 520 + Math.random() * 80 };
  }
  async connect() {
    this.connected = true;
    this.lastSample = S.run.now();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 50);
    this.emit('status', this.status());
    return true;
  }
  async ping() { await S.util.realSleep(60); return this.connected ? { fw: this.fw, rtt: 20 + Math.random() * 30 } : null; }
  status() {
    return { hrSensor: true, finger: this.finger, chest: this.beltsOn ? this.student.chestBase : 0, abd: this.beltsOn ? this.student.abdBase : 0, beltsInRange: this.beltsOn };
  }
  /* Simulator only: what the operator does physically */
  simWear(on) { this.beltsOn = on; this.finger = on; if (on) this.student = this.newStudent(); this.emit('status', this.status()); }
  setMode(m) { this.mode = m; }
  setMirror(on) { this.mirror = on; }
  lungDemo() { /* the real Pico runs the servo through 4 slow breaths */ }
  /* The tablet tells the Pico when each paced breath starts and ends */
  pace(name, dur, meta = {}) {
    const now = S.run.now();
    const prev = this.phase;
    this.phase = { name, start: now, dur, meta };
    if (prev.name === 'out' && prev.meta && prev.meta.breath && this.mode === 'trial') this.emitBreath(prev, now);
  }
  /* Simulator only: how the pretend student actually breathes in this trial */
  simPerform(type) { this.perform = type; }
  breathWave(t) {
    const p = this.phase;
    const x = S.util.clamp((t - p.start) / p.dur, 0, 1);
    if (p.name === 'in') return 0.5 - 0.5 * Math.cos(Math.PI * x);
    if (p.name === 'out') return 0.5 + 0.5 * Math.cos(Math.PI * x);
    if (p.name === 'gap') return 0;
    return 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 4200);
  }
  amps() {
    if (this.phase.name === 'rest' || this.mode !== 'trial') return { c: 0.35, a: 0.4, rsa: 2.5, depth: 0.45 };
    if (this.perform === 'diaphragmatic') return { c: 0.25, a: 1.0, rsa: 7.5, depth: 1 };
    if (this.perform === 'thoracic') return { c: 1.0, a: 0.2, rsa: 3.2, depth: 0.85 };
    return { c: 0.4, a: 0.4, rsa: 2.5, depth: 0.5 };
  }
  tick() {
    if (!this.connected || S.run.paused) return;
    const now = S.run.now();
    for (let t = this.lastSample + 100; t <= now; t += 100) {
      this.lastSample = t;
      if (!this.beltsOn) continue;
      const w = this.breathWave(t);
      const a = this.amps();
      const n = () => (Math.random() - 0.5) * 6;
      const chest = this.student.chestBase + 80 * a.c * w + n();
      const abd = this.student.abdBase + 90 * a.a * w + n();
      this.emit('belts', { t, chest, abd });
      /* Heart rate rises while breathing in and falls while breathing out, with a short lag */
      const wl = this.breathWave(t - 600);
      let q = 0.95 + Math.random() * 0.05;
      if (Math.random() < 0.01) q = 0.3;
      const bpm = this.student.baseHr + a.rsa * (wl - 0.5) + (Math.random() - 0.5) * 1.2;
      if (t % 500 < 100) this.emit('hr', { t, bpm, q, good: q >= 0.7 && this.finger });
      /* The real Pico reports how long the servo took to follow the belly belt */
      if (this.mirror && t % 5000 < 100) this.emit('servo', { t, latency_ms: 60 + Math.random() * 140 });
    }
  }
  emitBreath(outPhase, endT) {
    const s = S.settings.get();
    const truth = this.perform;
    let label = truth;
    if (Math.random() < s.simAiError) label = Math.random() < 0.5 ? (truth === 'diaphragmatic' ? 'thoracic' : 'diaphragmatic') : 'unclear';
    const rejected = Math.random() < 0.04;
    const a = this.amps();
    const procMs = 120 + Math.random() * 380;
    setTimeout(() => {
      this.emit('breath', {
        n: outPhase.meta.breath, label: rejected ? 'unclear' : label, conf: 0.7 + Math.random() * 0.29,
        chest_amp: +(80 * a.c).toFixed(1), abd_amp: +(90 * a.a).toFixed(1), rejected,
        t_end: endT, sim_truth: truth
      });
    }, procMs / S.run.speed);
  }
  disconnect() { clearInterval(this.timer); this.connected = false; }
}

class PicoWS extends S.Emitter {
  constructor(url) {
    super();
    this.kind = 'live';
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.fw = null;
    this._status = { hrSensor: false, finger: false, chest: 0, abd: 0, beltsInRange: false };
    this._pong = null;
    this._lastOutEnd = null;
  }
  connect() {
    return new Promise(resolve => {
      try { this.ws = new WebSocket(this.url); } catch (e) { resolve(false); return; }
      const t = setTimeout(() => resolve(false), 4000);
      this.ws.onopen = () => { clearTimeout(t); this.connected = true; resolve(true); };
      this.ws.onclose = () => { this.connected = false; this.emit('status', this._status); };
      this.ws.onerror = () => { clearTimeout(t); resolve(false); };
      this.ws.onmessage = ev => this.onMessage(ev.data);
    });
  }
  send(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }
  onMessage(raw) {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    const now = S.run.now();
    if (m.type === 'hello' || m.type === 'pong') { this.fw = m.fw; if (this._pong) this._pong(m); }
    else if (m.type === 'status') { this._status = { hrSensor: !!m.hr_ok, finger: !!m.finger, chest: m.chest, abd: m.abd, beltsInRange: !!m.belts_ok }; this.emit('status', this._status); }
    else if (m.type === 'hr') this.emit('hr', { t: now, bpm: m.bpm, q: m.q, good: m.q >= 0.7 });
    else if (m.type === 'belts') this.emit('belts', { t: now, chest: m.c, abd: m.a });
    else if (m.type === 'breath') this.emit('breath', { n: m.n, label: m.label, conf: m.conf, chest_amp: m.chest_amp, abd_amp: m.abd_amp, rejected: !!m.rejected, t_end: this._lastOutEnd });
    else if (m.type === 'servo') this.emit('servo', { t: now, latency_ms: m.latency_ms });
  }
  ping() {
    return new Promise(resolve => {
      const sent = performance.now();
      const t = setTimeout(() => { this._pong = null; resolve(null); }, 3000);
      this._pong = m => { clearTimeout(t); this._pong = null; resolve({ fw: m.fw, rtt: performance.now() - sent }); };
      this.send({ type: 'ping' });
    });
  }
  status() { return this._status; }
  setMode(mode) { this.send({ type: 'mode', mode }); }
  setMirror(on) { this.send({ type: 'mirror', on }); }
  lungDemo() { this.send({ type: 'demo' }); }
  pace(name, dur, meta = {}) {
    if (name !== 'out' && this._phase === 'out') this._lastOutEnd = S.run.now();
    this._phase = name;
    this.send({ type: 'pace', phase: name, dur_ms: dur, breath: meta.breath || null });
  }
  simWear() {}
  simPerform() {}
  disconnect() { if (this.ws) this.ws.close(); }
}

S.pico = null;
S.makePico = function () {
  if (S.pico) S.pico.disconnect();
  const st = S.settings.get();
  S.pico = st.picoMode === 'live' ? new PicoWS(st.picoUrl) : new PicoSim();
  return S.pico;
};
