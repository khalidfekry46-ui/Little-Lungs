/* Screens, the operator PIN pad, and the heart-rate charts. */
window.S = window.S || {};

S.ui = (() => {
  const { h, s, $ } = S.util;
  const root = () => document.getElementById('app');

  const icon = {
    replay: () => s('svg', { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
      s('path', { d: 'M4 10h3l5-4v12l-5-4H4z' }), s('path', { d: 'M16 9a4 4 0 0 1 0 6' }), s('path', { d: 'M18.5 6.5a8 8 0 0 1 0 11' })),
    check: () => s('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, s('path', { d: 'M5 12l5 5L20 7' }))
  };

  /* ---------- Student page frame ----------
     title and lead are bold, body (text) is regular. center puts everything in the middle.
     verity: 'big' shows her above the words, 'side' beside them. visual fills a right-hand column. */
  let stage = null;
  let unMain = null;
  function copyBlock({ title, lead, text }) {
    return h('div', { class: 'copy' },
      title ? h('h1', { class: 'ptitle' }, title) : null,
      lead ? h('p', { class: 'lead' }, lead) : null,
      text ? h('p', { class: 'body' }, text) : null);
  }
  function studentPage({ code, progress, title, lead, text, clip, visual, center, verity, extraLeft, layout }) {
    if (unMain) unMain();
    const replayBtn = h('button', { class: 'replay', type: 'button', onclick: () => S.audio.replay(), 'aria-label': 'Replay the instruction' }, icon.replay(), h('span', null, 'Replay'));
    const clock = h('div', { class: 'clock', 'aria-live': 'off' });
    const bar = h('i');
    const brand = h('div', { class: 'brand' }, 'Little Lungs');
    holdToOpen(brand);
    let copy = copyBlock({ title, lead, text });
    const v = verity ? S.art.verity(verity === 'big' ? 'big' : 'side') : null;
    const words = verity === 'side' ? h('div', { class: 'with-verity' }, v, copy) : h('div', null, verity === 'big' ? v : null, copy);
    const stacked = layout === 'stacked';
    const left = h('div', { class: 'left' }, words, h('div', { class: 'controls' }), stacked ? null : (extraLeft || null));
    const body = stacked
      ? [left, h('div', { class: 'duo' }, extraLeft || h('div'), visual ? h('aside', { class: 'visual' }, visual) : null)]
      : [left, visual ? h('aside', { class: 'visual' }, visual) : null];
    stage = h('div', { class: 'stage' },
      h('div', { class: 'timebar' }, bar),
      h('header', { class: 'sbar' }, brand, h('div', { class: 'progress' }, progress || ''), clock, replayBtn),
      h('main', { class: 'sheet' }, body),
      h('footer', { class: 'folio' }, code || ''));
    if (stacked) stage.classList.add('stacked');
    else if (visual) stage.classList.add('split');
    if (layout === 'wide') stage.classList.add('wide-visual');
    if (center) stage.classList.add('center');
    replayBtn.disabled = !S.audio.lastMain;
    unMain = S.audio.onMain(name => { replayBtn.disabled = !name; });
    if (clip) S.audio.setMain(clip);
    const r = root();
    r.replaceChildren(stage);
    r.dataset.view = 'student';
    simPanel.mount();
    const pageObj = {
      stage, clock, bar, controls: $('.controls', stage),
      setText: (t, regular) => { const n = copyBlock(regular ? { text: t } : { lead: t }); copy.replaceWith(n); copy = n; }
    };
    return pageObj;
  }
  function setTimer(page, remainingMs, totalMs) {
    if (!page) return;
    if (remainingMs == null) { page.clock.textContent = ''; page.bar.style.width = '0'; return; }
    const sec = Math.max(0, Math.ceil(remainingMs / 1000));
    page.clock.textContent = `${Math.floor(sec / 60)}:${S.util.pad(sec % 60)}`;
    page.bar.style.width = `${S.util.clamp(remainingMs / totalMs, 0, 1) * 100}%`;
    page.stage.classList.toggle('low', remainingMs <= 10000);
  }

  /* Press and hold the station name for 3 seconds to open the operator menu */
  function holdToOpen(el) {
    let t = null;
    const startHold = e => { e.preventDefault(); clearTimeout(t); t = setTimeout(() => { if (S.test && S.test.operatorMenu) S.test.operatorMenu(); }, 3000); };
    const cancel = () => clearTimeout(t);
    el.addEventListener('pointerdown', startHold);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, cancel));
  }

  /* Wait for one tap on any of the given buttons; resolves with the button's value */
  function choose(container, options, { className = 'choice', columns } = {}) {
    return new Promise(resolve => {
      const wrap = h('div', { class: `choices ${columns ? 'cols-' + columns : ''}` });
      options.forEach(([value, label]) => {
        wrap.appendChild(h('button', { class: className, type: 'button', onclick: () => { wrap.querySelectorAll('button').forEach(b => (b.disabled = true)); resolve(value); } }, label));
      });
      container.appendChild(wrap);
    });
  }
  function button(label, onclick, cls = 'btn primary') { return h('button', { class: cls, type: 'button', onclick }, label); }

  /* ---------- Modal + PIN ---------- */
  function modal(content, { wide } = {}) {
    const box = h('div', { class: `modal ${wide ? 'wide' : ''}`, role: 'dialog', 'aria-modal': 'true' }, content);
    const back = h('div', { class: 'backdrop' }, box);
    document.body.appendChild(back);
    return { close: () => back.remove(), box };
  }

  /* Two PINs: a 4-digit operator PIN for the test, a 6-digit PIN for Management */
  const PINS = { operator: { key: 'anatomy-station-pin', len: 4 }, manage: { key: 'anatomy-station-mpin', len: 6 } };
  const pinState = { fails: 0, lockedUntil: 0 };
  function pinSaved(kind = 'operator') { try { return JSON.parse(localStorage.getItem(PINS[kind].key) || 'null'); } catch (e) { return null; } }
  async function setPin(pin, kind) {
    const salt = S.util.rand4() + S.util.rand4();
    localStorage.setItem(PINS[kind].key, JSON.stringify({ salt, hash: await S.util.sha256(salt + pin) }));
  }
  async function checkPin(pin, kind) {
    const p = pinSaved(kind);
    if (!p) return false;
    return (await S.util.sha256(p.salt + pin)) === p.hash;
  }

  function pinPad(title, { verify = true, allowCancel = true, kind = 'operator' } = {}) {
    const LEN = PINS[kind].len;
    return new Promise(resolve => {
      let entry = '';
      const dots = h('div', { class: 'pindots', 'aria-live': 'polite' });
      const msg = h('p', { class: 'pinmsg' }, '');
      const draw = () => { dots.replaceChildren(...Array.from({ length: LEN }, (_, i) => h('span', { class: i < entry.length ? 'on' : '' }))); };
      const finish = async () => {
        if (!verify) { m.close(); resolve(entry); return; }
        if (Date.now() < pinState.lockedUntil) { entry = ''; draw(); return; }
        if (await checkPin(entry, kind)) { pinState.fails = 0; m.close(); resolve(true); return; }
        pinState.fails++;
        entry = '';
        draw();
        if (pinState.fails >= 5) {
          pinState.lockedUntil = Date.now() + 60000;
          pinState.fails = 0;
          msg.textContent = 'Too many wrong PINs. Try again in 1 minute.';
        } else msg.textContent = `Wrong PIN. ${5 - pinState.fails} tries left.`;
      };
      const key = d => () => {
        if (Date.now() < pinState.lockedUntil) { msg.textContent = 'Locked for a minute after 5 wrong PINs.'; return; }
        msg.textContent = '';
        if (d === 'del') entry = entry.slice(0, -1);
        else if (entry.length < LEN) entry += d;
        draw();
        if (entry.length === LEN) setTimeout(finish, 120);
      };
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'cancel', '0', 'del'].map(k => {
        if (k === 'cancel') return allowCancel ? h('button', { class: 'key ghost', type: 'button', onclick: () => { m.close(); resolve(false); } }, 'Cancel') : h('span');
        if (k === 'del') return h('button', { class: 'key ghost', type: 'button', onclick: key('del'), 'aria-label': 'Delete' }, 'Delete');
        return h('button', { class: 'key', type: 'button', onclick: key(k) }, k);
      });
      const m = modal(h('div', { class: 'pin' }, h('h2', null, title), h('p', { class: 'muted' }, kind === 'manage' ? 'Management PIN (6 digits)' : 'Operator PIN (4 digits)'), dots, msg, h('div', { class: 'keypad' }, keys)));
      draw();
    });
  }
  const askPin = (title = 'Operator only') => pinPad(title);
  const askManagePin = (title = 'Management') => pinPad(title, { kind: 'manage' });

  async function setupPin(first = true, kind = 'operator') {
    const n = PINS[kind].len;
    const name = kind === 'manage' ? 'Management PIN' : 'operator PIN';
    for (;;) {
      const a = await pinPad(first ? `Choose a ${n}-digit ${name}` : `New ${n}-digit ${name}`, { verify: false, allowCancel: !first, kind });
      if (a === false) return false;
      const b = await pinPad('Enter the same PIN again', { verify: false, allowCancel: !first, kind });
      if (b === false) return false;
      if (a === b) { await setPin(a, kind); toast('PIN saved'); return true; }
      toast('The two PINs did not match. Try again.');
    }
  }

  function confirmBox(title, text, yes = 'Yes', no = 'No') {
    return new Promise(resolve => {
      const m = modal(h('div', null, h('h2', null, title), text ? h('p', null, text) : null,
        h('div', { class: 'row end' },
          h('button', { class: 'btn', type: 'button', onclick: () => { m.close(); resolve(false); } }, no),
          h('button', { class: 'btn primary', type: 'button', onclick: () => { m.close(); resolve(true); } }, yes))));
    });
  }

  function toast(text) {
    const t = h('div', { class: 'toast', role: 'status' }, text);
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3200);
  }

  /* ---------- Charts ---------- */
  /* One panel: heart rate as a line, breathing as a shaded wave underneath, breathing-in phases banded */
  function traceChart(win, { title, hrMin, hrMax, width = 640, height = 190, showBands = true } = {}) {
    const pad = { l: 44, r: 12, t: 28, b: 28 };
    const W = width - pad.l - pad.r, Hh = height - pad.t - pad.b;
    const t0 = win.t0, t1 = win.t1, span = Math.max(1, t1 - t0);
    const X = t => pad.l + ((t - t0) / span) * W;
    const hrTop = pad.t, hrH = Hh * 0.62;
    const brTop = pad.t + Hh * 0.68, brH = Hh * 0.32;
    const lo = hrMin, hi = hrMax;
    const Y = b => hrTop + hrH - ((b - lo) / (hi - lo)) * hrH;
    const breath = win.belts.map(p => p.chest + p.abd);
    const bmin = Math.min(...breath), bmax = Math.max(...breath);
    const BY = v => brTop + brH - ((v - bmin) / Math.max(1, bmax - bmin)) * brH;
    const hrPts = win.hr.map(p => `${X(p.t).toFixed(1)},${Y(p.bpm).toFixed(1)}`).join(' ');
    const brPath = win.belts.length ? `M${X(win.belts[0].t)},${brTop + brH} ` + win.belts.map((p, i) => `L${X(p.t).toFixed(1)},${BY(breath[i]).toFixed(1)}`).join(' ') + ` L${X(win.belts[win.belts.length - 1].t)},${brTop + brH} Z` : '';
    const ticks = [];
    const step = (hi - lo) <= 20 ? 5 : 10;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    const bands = showBands ? (win.phases || []).filter(p => p.name === 'in').map(p => s('rect', { x: X(Math.max(p.start, t0)), y: pad.t - 4, width: Math.max(0, X(Math.min(p.end, t1)) - X(Math.max(p.start, t0))), height: Hh + 4, class: 'band' })) : [];
    const secs = [];
    for (let sec = 0; sec * 1000 <= span; sec += 10) secs.push(sec);
    return s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'trace', role: 'img', 'aria-label': title || 'Heart rate and breathing' },
      s('text', { x: pad.l, y: 16, class: 'ctitle' }, title || ''),
      bands,
      ticks.map(v => [s('line', { x1: pad.l, x2: pad.l + W, y1: Y(v), y2: Y(v), class: 'grid' }), s('text', { x: pad.l - 8, y: Y(v) + 4, class: 'tick', 'text-anchor': 'end' }, v)]),
      s('path', { d: brPath, class: 'breath' }),
      s('polyline', { points: hrPts, class: 'hr' }),
      secs.map(sec => s('text', { x: X(t0 + sec * 1000), y: height - 8, class: 'tick', 'text-anchor': 'middle' }, `${sec} s`)));
  }

  function legend(withBands = true) {
    return h('div', { class: 'legend' },
      h('span', { class: 'k hr' }, 'Heart rate (beats per minute)'),
      h('span', { class: 'k breath' }, 'Breathing (belts)'),
      withBands ? h('span', { class: 'k band' }, 'Breathing in') : null);
  }

  /* Live heart-rate card shown during Task 2: big number and a large filled trace of the last 30 seconds */
  function liveHr(seed) {
    S.art.ensureDefs();
    const num = h('strong', { class: 'bpm' }, '--');
    const area = s('path', { class: 'area', d: '' });
    const line = s('polyline', { class: 'hr', points: '' });
    const svg = s('svg', { viewBox: '0 0 600 200', class: 'strip', 'aria-hidden': 'true', preserveAspectRatio: 'none' }, area, line);
    const box = h('div', { class: 'livehr big' },
      h('span', { class: 'lbl' }, 'Your heart rate'),
      h('div', null, num, h('span', { class: 'unit' }, ' beats per minute')), svg);
    const pts = (seed || []).filter(p => p.good).slice(-60).map(p => ({ t: p.t, bpm: p.bpm }));
    const draw = tNow => {
      if (pts.length < 2) return;
      const lo = Math.min(...pts.map(p => p.bpm)) - 4, hi = Math.max(...pts.map(p => p.bpm)) + 4;
      const xy = pts.map(p => [600 - (tNow - p.t) / 50, 190 - ((p.bpm - lo) / (hi - lo)) * 170]);
      line.setAttribute('points', xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
      area.setAttribute('d', `M${xy[0][0].toFixed(1)},200 ` + xy.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ` L${xy[xy.length - 1][0].toFixed(1)},200 Z`);
    };
    if (pts.length) { num.textContent = Math.round(pts[pts.length - 1].bpm); draw(pts[pts.length - 1].t); }
    const off = S.pico.on('hr', d => {
      if (!d.good) return;
      pts.push(d);
      while (pts.length && pts[0].t < d.t - 30000) pts.shift();
      num.textContent = Math.round(d.bpm);
      draw(d.t);
    });
    box.stop = off;
    return box;
  }

  /* ---------- Simulator panel (only in simulator mode) ---------- */
  const simPanel = {
    el: null,
    target: null,
    mount() {
      const st = S.settings.get();
      if (st.visionMode !== 'sim' && st.picoMode !== 'sim') { if (this.el) this.el.remove(); this.el = null; return; }
      if (this.el && document.body.contains(this.el)) return;
      const btn = (label, fn) => h('button', { type: 'button', class: 'mini', onclick: fn }, label);
      const auto = h('input', { type: 'checkbox', id: 'simauto' });
      auto.checked = st.simAutoStudent;
      auto.addEventListener('change', () => S.settings.save({ simAutoStudent: auto.checked }));
      const body = h('div', { class: 'simbody' },
        h('label', { class: 'row' }, auto, ' Pretend student answers on their own'),
        h('div', { class: 'row wrap' },
          btn('Place correct', () => S.vision && S.vision.manual('correct', this.target)),
          btn('Place wrong', () => S.vision && S.vision.manual('wrong', this.target)),
          btn('Clear board', () => S.vision && S.vision.manual('clear')),
          btn('Build all', () => S.vision && S.vision.manual('build'))),
        h('p', { class: 'muted small' }, 'Simulator mode. Results are marked simulated and left out of statistics.'));
      const toggle = h('button', { type: 'button', class: 'simtoggle', onclick: () => this.el.classList.toggle('open') }, 'Simulator');
      this.el = h('aside', { class: 'simpanel' }, toggle, body);
      document.body.appendChild(this.el);
    },
    setTarget(t) { this.target = t; }
  };

  return { studentPage, setTimer, choose, button, modal, askPin, askManagePin, setupPin, pinSaved, confirmBox, toast, traceChart, legend, liveHr, simPanel, icon, root };
})();
