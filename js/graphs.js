/* Heart-rate and breathing graphs for questions B1 to B3, the results page and History. */
window.S = window.S || {};

S.graph = (() => {
  const { h, mean } = S.util;

  function windowData(session, w) {
    const r = session.raw || { hr: [], belts: [], phases: [] };
    return {
      t0: w.t0, t1: w.t1,
      hr: (r.hr || []).filter(p => p.t >= w.t0 && p.t <= w.t1 && p.good),
      allHr: (r.hr || []).filter(p => p.t >= w.t0 && p.t <= w.t1),
      belts: (r.belts || []).filter(p => p.t >= w.t0 && p.t <= w.t1),
      phases: (r.phases || []).filter(p => p.end != null && p.end > w.t0 && p.start < w.t1)
    };
  }
  function hrAt(win, t) {
    let best = null;
    for (const p of win.hr) { if (!best || Math.abs(p.t - t) < Math.abs(best.t - t)) best = p; }
    return best ? best.bpm : NaN;
  }
  function stats(win) {
    const bpm = win.hr.map(p => p.bpm);
    const quality = win.allHr.length ? win.allHr.filter(p => p.good).length / win.allHr.length : 0;
    const ins = win.phases.filter(p => p.name === 'in'), outs = win.phases.filter(p => p.name === 'out');
    const dIn = ins.map(p => hrAt(win, p.end) - hrAt(win, p.start)).filter(Number.isFinite);
    const dOut = outs.map(p => hrAt(win, p.end) - hrAt(win, p.start)).filter(Number.isFinite);
    const swings = ins.map(p => {
      const seg = win.hr.filter(x => x.t >= p.start && x.t <= p.start + 8000).map(x => x.bpm);
      return seg.length > 2 ? Math.max(...seg) - Math.min(...seg) : NaN;
    }).filter(Number.isFinite);
    return { mean: mean(bpm), quality, riseIn: mean(dIn), riseOut: mean(dOut), swing: swings.length ? mean(swings) : NaN };
  }

  /* The student's own graph, or the backup graph when the signal is not good enough */
  function choose(session) {
    const W = (session.raw && session.raw.windows) || [];
    const restW = W.find(w => w.name === 'rest');
    const dia = W.filter(w => w.command === 'diaphragmatic').pop();
    const tho = W.filter(w => w.command === 'thoracic').pop();
    const thr = S.settings.get().hrSwingThreshold;
    if (restW && dia && tho) {
      const wins = { rest: windowData(session, restW), dia: windowData(session, dia), tho: windowData(session, tho) };
      const st = { rest: stats(wins.rest), dia: stats(wins.dia), tho: stats(wins.tho) };
      const poor = ['rest', 'dia', 'tho'].find(k => !(st[k].quality >= 0.7));
      if (!poor && st.dia.swing >= thr) return { source: 'own', reason: '', wins, st };
      return { source: 'backup', reason: poor ? `Heart signal quality low (${poor})` : `Heart-rate swing below ${thr} beats per minute`, ...backup() };
    }
    return { source: 'backup', reason: 'Missing breathing windows', ...backup() };
  }

  function answers(st) {
    const B1 = st.dia.riseIn > 0.5 && st.dia.riseIn > st.dia.riseOut ? 'in' : (st.dia.riseOut > 0.5 ? 'out' : 'none');
    const d = st.dia.mean - st.rest.mean;
    const B2 = d > 3 ? 'higher' : (d < -3 ? 'lower' : 'same');
    const e = st.dia.swing - st.tho.swing;
    const B3 = e > 1 ? 'diaphragmatic' : (e < -1 ? 'thoracic' : 'none');
    return { B1, B2, B3 };
  }

  function panels(g, { compact } = {}) {
    const all = [...g.wins.rest.hr, ...g.wins.dia.hr, ...g.wins.tho.hr].map(p => p.bpm);
    const lo = Math.floor(Math.min(...all) - 2), hi = Math.ceil(Math.max(...all) + 2);
    const ht = compact ? 170 : 190;
    return h('div', { class: 'graphs' },
      S.ui.legend(),
      S.ui.traceChart(g.wins.rest, { title: 'Resting (normal breathing)', hrMin: lo, hrMax: hi, showBands: false, height: ht }),
      S.ui.traceChart(g.wins.dia, { title: 'Diaphragmatic breathing', hrMin: lo, hrMax: hi, height: ht }),
      S.ui.traceChart(g.wins.tho, { title: 'Thoracic breathing', hrMin: lo, hrMax: hi, height: ht }));
  }

  /* A fixed sample with known answers */
  function backup() {
    const mk = (kind, t0) => {
      const hr = [], belts = [], phases = [];
      const rsa = kind === 'rest' ? 2.2 : kind === 'dia' ? 7 : 3;
      const wave = t => {
        if (kind === 'rest') return 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 4200);
        const c = t % 8000;
        return c < 4000 ? 0.5 - 0.5 * Math.cos(Math.PI * c / 4000) : 0.5 + 0.5 * Math.cos(Math.PI * (c - 4000) / 4000);
      };
      const amp = kind === 'dia' ? [0.25, 1] : kind === 'tho' ? [1, 0.2] : [0.35, 0.4];
      for (let t = 0; t <= 32000; t += 100) {
        const w = wave(t);
        belts.push({ t: t0 + t, chest: 430 + 80 * amp[0] * w, abd: 540 + 90 * amp[1] * w });
        if (t % 500 === 0) hr.push({ t: t0 + t, bpm: 76 + rsa * (wave(Math.max(0, t - 600)) - 0.5), q: 1, good: true });
      }
      if (kind !== 'rest') for (let k = 0; k < 4; k++) { phases.push({ name: 'in', start: t0 + k * 8000, end: t0 + k * 8000 + 4000 }); phases.push({ name: 'out', start: t0 + k * 8000 + 4000, end: t0 + k * 8000 + 8000 }); }
      return { t0, t1: t0 + 32000, hr, allHr: hr, belts, phases };
    };
    const wins = { rest: mk('rest', 0), dia: mk('dia', 100000), tho: mk('tho', 200000) };
    return { wins, st: { rest: stats(wins.rest), dia: stats(wins.dia), tho: stats(wins.tho) } };
  }

  return { windowData, stats, choose, answers, panels, backup };
})();
