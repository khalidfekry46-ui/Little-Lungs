/* Practice data: makes complete pretend sessions so the statistics page and the poster charts
   can be built before real testing. Every row is marked demo and simulated, never uploaded,
   and left out of statistics unless "Include simulated sessions" is ticked. */
window.S = window.S || {};

S.demo = (() => {
  const R = Math.random;
  const pickOther = (arr, x) => { const o = arr.filter(a => a !== x); return o[Math.floor(R() * o.length)]; };

  function makeOne(i) {
    const s = S.newSession();
    s.demo = true;
    s.mode = { pico: 'sim', vision: 'sim' };
    const grade = ['G8', 'G9', 'G10', 'G11', 'G12'][i % 5];
    const gnum = Number(grade.slice(1));
    const prior = R() < (gnum - 7) / 6 ? 'yes' : 'no';
    const skill = 0.45 + (gnum - 8) * 0.07 + (prior === 'yes' ? 0.1 : 0) + (R() - 0.5) * 0.15;
    const start = new Date(Date.now() - (30 - i) * 3600e3);
    s.started_at = start.toISOString();
    s.student = { code: `DEMO-${S.util.pad(i + 1, 3)}`, name: `Demo student ${i + 1}`, student_id: String(5000 + i), grade, class: 'A', age: gnum + 6, prior };
    s.station = { status: 'green', checks: [] };
    const aiErr = 0.03;
    const truthToAi = g => (R() < aiErr ? (g === 'correct' ? 'wrong' : 'correct') : g);

    /* Task 1 */
    let level = 2, streak = 0, firstCorrect = 0, highest = 2;
    S.util.shuffle(S.ORGANS).forEach((organ, k) => {
      highest = Math.max(highest, level);
      const it = { n: k + 1, organ, level, attempts: [], result: null, points: 0 };
      const pOk = S.util.clamp(skill + (2 - level) * 0.15, 0.2, 0.97);
      const isLung = organ.includes('lung');
      const mk = (a, ok) => {
        const gt = ok ? 'correct' : 'wrong';
        const ai = truthToAi(gt);
        const err = ai === 'wrong' ? (isLung && R() < 0.6 ? 'left_right_swap' : (R() < 0.7 ? 'wrong_piece' : 'orientation')) : null;
        return { a, timeout: false, ai_verdict: ai, error: err, seenZone: organ, seenCls: ai === 'correct' ? organ : pickOther(S.ORGANS, organ), conf: 0.8 + R() * 0.19,
          place_ms: 4000 + R() * 12000, response_ms: 1000 + R() * 350 + (R() < 0.05 ? 900 : 0), gt, gt_source: 'sim' };
      };
      if (R() < 0.03) { it.attempts.push({ a: 1, timeout: true, ai_verdict: 'timeout', gt: 'timeout', gt_source: 'sim' }); it.result = 'timeout'; }
      else {
        const a1 = mk(1, R() < pOk);
        it.attempts.push(a1);
        if (a1.ai_verdict === 'correct') { it.result = 'first'; it.points = level; }
        else {
          const a2 = mk(2, R() < 0.7);
          it.attempts.push(a2);
          if (a2.ai_verdict === 'correct') { it.result = 'hint'; it.points = level / 2; } else { it.result = 'wrong'; }
        }
      }
      s.t1.items.push(it);
      if (it.result === 'first') { firstCorrect++; streak++; if (streak >= 2 && level < 3) { level++; streak = 0; } }
      else { level = Math.max(1, level - 1); streak = 0; }
    });
    s.t1.highest_level = highest;
    s.t1.qualified = firstCorrect >= 4;
    if (s.t1.qualified) {
      const pieces = S.ORGANS.map(o => { const gt = R() < 0.85 ? 'correct' : 'wrong'; const ai = truthToAi(gt); return { organ: o, ai_verdict: ai, seenCls: ai === 'correct' ? o : 'rot:' + o, conf: 0.8 + R() * 0.19, gt, gt_source: 'sim' }; });
      s.t1.build = { pieces, timeout: false, response_ms: 1100 + R() * 300, points: pieces.filter(p => p.ai_verdict === 'correct').length };
    }

    /* Task 2 */
    const baseHr = 68 + R() * 20;
    s.t2.calib = { hr_mean: baseHr, hr_quality: 0.97, attempt: 1 };
    S.util.shuffle(['diaphragmatic', 'thoracic']).forEach((cmd, k) => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        const does = R() < (attempt === 1 ? S.util.clamp(skill + 0.2, 0.3, 0.97) : 0.8) ? cmd : pickOther(['diaphragmatic', 'thoracic'], cmd);
        const breaths = [];
        let valid = 0, matched = 0;
        for (let b = 1; b <= 4; b++) {
          const label = R() < 0.03 ? pickOther(['diaphragmatic', 'thoracic', 'unclear'], does) : does;
          breaths.push({ b, label, conf: 0.7 + R() * 0.29, chest_amp: does === 'thoracic' ? 80 : 20, abd_amp: does === 'diaphragmatic' ? 90 : 18, rejected: false, latency_ms: 150 + R() * 450, gt: does, gt_source: 'sim' });
          valid++;
          if (label === cmd) matched++;
        }
        const pass = matched >= 3;
        s.t2.trials.push({ n: k + 1, command: cmd, attempt, breaths, valid, matched, pass, points: pass ? (attempt === 1 ? 2 : 1) : 0,
          hr_mean: baseHr + (R() - 0.5) * 3, rsa: (does === 'diaphragmatic' ? 6.5 : 3) + (R() - 0.5) * 1.5 });
        if (pass) break;
      }
    });
    const backup = R() < 0.12;
    s.t2.graph = { source: backup ? 'backup' : 'own', reason: backup ? 'Heart signal quality low (dia)' : '', answers: { B1: 'in', B2: 'same', B3: 'diaphragmatic' } };
    const ans = (qid, right, options, p) => { const choice = R() < p ? right : pickOther(options, right); return { qid, choice, correct_answer: right, correct: choice === right, time_ms: 4000 + R() * 11000, graph_source: qid[0] === 'B' ? s.t2.graph.source : undefined }; };
    s.t2.answers.push(ans('B1', 'in', ['in', 'out', 'none'], 0.45 + skill * 0.4));
    s.t2.answers.push(ans('B2', 'same', ['higher', 'lower', 'same'], 0.35 + skill * 0.4));
    s.t2.answers.push(ans('B3', 'diaphragmatic', ['diaphragmatic', 'thoracic', 'none'], 0.4 + skill * 0.45));
    /* Reading: the same adaptive rules as the real test */
    const pc = { E: S.util.clamp(skill + 0.2, 0.3, 0.97), I: S.util.clamp(skill, 0.2, 0.9), H: S.util.clamp(skill - 0.25, 0.1, 0.8) };
    const RD = { passages: [], path: [] };
    let rlevel = S.reading.startLevel(grade);
    const avoid = [];
    for (let n = 1; n <= 2; n++) {
      const p = S.reading.pick('test', rlevel, avoid);
      avoid.push(p.id);
      const answers = p.questions.map((q, k) => { const right = R() < pc[q.d]; const choice = right ? q.a : [0, 1, 2, 3].filter(x => x !== q.a)[Math.floor(R() * 3)];
        return { q: k + 1, id: q.id, d: q.d, choice, correct: right, changes: R() < 0.15 ? 1 : 0, time_ms: Math.round(15000 + R() * 40000), first_ms: null }; });
      const well = S.reading.doingWell(p, answers);
      RD.passages.push({ n, id: p.id, level: rlevel, points: S.reading.points(p, answers), max: S.reading.maxPoints(p), well, ended: R() < 0.08 ? 'timeout' : 'submit', time_ms: Math.round(150000 + R() * 150000), answers });
      RD.path.push(rlevel);
      rlevel = S.reading.nextLevel(rlevel, well);
    }
    RD.raw = RD.passages.reduce((x, y) => x + y.points, 0);
    RD.max_path = RD.passages.reduce((x, y) => x + y.max, 0);
    RD.moved_up = RD.path[1] !== RD.path[0];
    s.t2.reading = RD;
    s._skill = skill;
    s.t2.servo = [70 + R() * 120, 70 + R() * 120];

    s.scores = S.score(s);
    s.ended_at = new Date(start.getTime() + (18 + R() * 5) * 60e3).toISOString();
    s.duration_s = Math.round((new Date(s.ended_at) - start) / 1000);
    s.end = { status: 'completed', note: '' };
    s.review.hr_ref_bpm = +(baseHr + (R() - 0.5) * 5).toFixed(0);
    return s;
  }

  /* Practice attempts before the test. Demo data has no built-in Prep effect: Prep does not change the pretend skill. */
  async function makePrep(s) {
    if (R() < 0.4) return;
    const key = s.student.key;
    const tries = 1 + Math.floor(R() * 3);
    const investigates = R() < 0.5;
    const passages = S.util.shuffle(S.PASSAGES.filter(p => p.set === 'prep')).slice(0, tries);
    for (let k = 0; k < passages.length; k++) {
      const p = passages[k];
      const fin = new Date(new Date(s.started_at).getTime() - (k + 1) * 86400e3);
      const answers = p.questions.map((q, j) => { const right = R() < s._skill + (q.d === 'E' ? 0.2 : q.d === 'H' ? -0.25 : 0); return { q: j + 1, id: q.id, d: q.d, choice: right ? q.a : (q.a + 1) % 4, correct: right, time_ms: 20000 }; });
      const wrong = answers.filter(a => !a.correct);
      const looks = investigates ? wrong.map(a => ({ q: a.q, ms: Math.round(15000 + R() * 40000) })) : (R() < 0.3 && wrong.length ? [{ q: wrong[0].q, ms: 4000 }] : []);
      await S.store.put('prep', { id: `PREP-DEMO-${s.student.code}-${k}`, student_key: key, student_id: s.student.student_id, name: s.student.name, grade: s.student.grade, device_code: 'DEMO',
        passage_id: p.id, level: p.level, started_at: fin.toISOString(), finished_at: fin.toISOString(), ended: 'submit', answers, score: answers.filter(a => a.correct).length, points: S.reading.points(p, answers),
        review: { ms: investigates ? 60000 : 8000, looks, self_report: wrong.length ? (investigates ? (R() < 0.7 ? 'all' : 'some') : (R() < 0.5 ? 'no' : 'some')) : 'no_mistakes' }, demo: true, synced_at: null });
    }
  }

  async function generate(n = 25) {
    const seq = S.settings.get().nextSeq;
    for (let i = 0; i < n; i++) {
      const s = makeOne(i);
      s.student.key = await S.studentKey(s.student.student_id);
      await makePrep(s);
      delete s._skill;
      s.scores = S.score(s);
      await S.store.saveSession(s);
    }
    S.settings.save({ nextSeq: seq });
    return n;
  }
  async function clear() {
    const list = await S.store.sessions();
    let n = 0;
    for (const s of list) if (s.demo) { await S.store.del('sessions', s.id); n++; }
    for (const r of (await S.store.all('prep')) || []) if (r.demo) await S.store.del('prep', r.id);
    return n;
  }
  return { generate, clear };
})();
