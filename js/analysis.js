/* Statistics for the design requirements and the poster's results section.
   Works on the same flat tables whether they come from this tablet or from the Google Sheet. */
window.S = window.S || {};

S.analysis = (() => {
  const U = S.util;
  const bool = v => v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
  const num = v => (v === '' || v === null || v === undefined ? NaN : Number(v));
  const groupBy = (rows, key) => rows.reduce((m, r) => { const k = typeof key === 'function' ? key(r) : r[key]; (m[k] = m[k] || []).push(r); return m; }, {});

  function prop(k, n) { const ci = U.wilson(k, n); return { k, n, p: n ? k / n : NaN, lo: ci[0], hi: ci[1] }; }
  function dist(a) {
    const x = a.filter(Number.isFinite);
    return { n: x.length, mean: U.mean(x), sd: U.sd(x), median: U.median(x), p95: U.quantile(x, 0.95), min: Math.min(...x), max: Math.max(...x), values: x };
  }

  function compute(tables, { includeSimulated = false } = {}) {
    const T = S.TARGETS;
    const allSessions = tables.Sessions || [];
    const keep = allSessions.filter(s => bool(s.valid) && (includeSimulated || !bool(s.simulated)));
    const ids = new Set(keep.map(s => s.session_id));
    const completed = keep.filter(s => s.end_status === 'completed');
    const pick = name => (tables[name] || []).filter(r => ids.has(r.session_id));
    const placements = pick('Placements'), trials = pick('Trials'), breaths = pick('Breaths'), answers = pick('Answers');

    /* ---- Placement detection accuracy (AI verdict vs recorder) ---- */
    const pl = placements.filter(r => (r.gt_verdict === 'correct' || r.gt_verdict === 'wrong') && r.ai_verdict !== 'timeout');
    const aiOk = r => r.ai_verdict === 'correct';
    const cm = { tp: 0, fp: 0, fn: 0, tn: 0 };
    pl.forEach(r => { const a = aiOk(r), g = r.gt_verdict === 'correct'; if (a && g) cm.tp++; else if (a && !g) cm.fp++; else if (!a && g) cm.fn++; else cm.tn++; });
    const agree = r => aiOk(r) === (r.gt_verdict === 'correct');
    const placementAcc = prop(pl.filter(agree).length, pl.length);
    const byDevice = Object.entries(groupBy(pl, 'device_code')).map(([d, rows]) => ({ device: d, ...prop(rows.filter(agree).length, rows.length) }));
    const byOrgan = Object.entries(groupBy(pl, 'organ')).map(([o, rows]) => ({ organ: o, ...prop(rows.filter(agree).length, rows.length) }));
    const gtSources = groupBy(pl, 'gt_source');

    /* ---- Breath classification accuracy (Pico vs recorder) ---- */
    const L = ['diaphragmatic', 'thoracic', 'unclear'];
    const br = breaths.filter(r => L.includes(r.gt_label) && !bool(r.missing));
    const bcm = {};
    L.forEach(g => { bcm[g] = {}; L.forEach(a => { bcm[g][a] = 0; }); });
    br.forEach(r => { const a = L.includes(r.ai_label) ? r.ai_label : 'unclear'; bcm[r.gt_label][a]++; });
    const breathAcc = prop(br.filter(r => r.ai_label === r.gt_label).length, br.length);
    const clear = br.filter(r => r.gt_label !== 'unclear');
    const breathAccClear = prop(clear.filter(r => r.ai_label === r.gt_label).length, clear.length);
    const perClass = L.map(c => {
      const tp = bcm[c][c];
      const predicted = L.reduce((t, g) => t + bcm[g][c], 0);
      const actual = L.reduce((t, a) => t + bcm[c][a], 0);
      return { label: c, precision: predicted ? tp / predicted : NaN, recall: actual ? tp / actual : NaN, n: actual };
    });

    /* ---- Response times ---- */
    const resp = dist(placements.filter(r => r.part === '1A' && r.ai_verdict !== 'timeout').map(r => num(r.response_ms)));
    resp.within = resp.n ? resp.values.filter(v => v <= T.placementResponseMs).length / resp.n : NaN;
    const lat = dist(breaths.filter(r => !bool(r.missing)).map(r => num(r.latency_ms)));
    lat.within = lat.n ? lat.values.filter(v => v <= T.breathLatencyMs).length / lat.n : NaN;

    /* ---- Heart rate vs pulse oximeter ---- */
    const pairs = keep.map(s => ({ pico: num(s.hr_rest_bpm), ref: num(s.hr_ref_bpm), id: s.session_id })).filter(p => Number.isFinite(p.pico) && Number.isFinite(p.ref));
    const diffs = pairs.map(p => p.pico - p.ref);
    const hr = {
      n: pairs.length, pairs,
      mae: U.mean(diffs.map(Math.abs)), bias: U.mean(diffs), sd: U.sd(diffs),
      within: pairs.length ? diffs.filter(d => Math.abs(d) <= T.hrErrorBpm).length / pairs.length : NaN
    };
    hr.loa = [hr.bias - 1.96 * hr.sd, hr.bias + 1.96 * hr.sd];

    /* ---- Session length, servo response ---- */
    const len = dist(completed.map(s => num(s.duration_s) / 60));
    len.within = len.n ? len.values.filter(v => v <= T.sessionMinutes).length / len.n : NaN;
    const servo = dist(keep.map(s => num(s.servo_latency_ms)));
    servo.within = servo.n ? servo.values.filter(v => v <= T.servoLatencyMs).length / servo.n : NaN;

    /* ---- Students' results (poster) ---- */
    const totals = completed.map(s => num(s.total));
    const byGrade = ['G8', 'G9', 'G10', 'G11', 'G12'].map(g => {
      const rows = completed.filter(s => s.grade === g);
      return { grade: g, n: rows.length, total: dist(rows.map(s => num(s.total))), anatomy: dist(rows.map(s => num(s.anatomy_score))), breathing: dist(rows.map(s => num(s.breathing_score))) };
    });
    const byPrior = ['yes', 'no'].map(v => {
      const rows = completed.filter(s => s.prior_study === v);
      return { prior: v, n: rows.length, total: dist(rows.map(s => num(s.total))) };
    });
    const r_ab = U.pearson(completed.map(s => num(s.anatomy_score)), completed.map(s => num(s.breathing_score)));
    const histogram = [];
    for (let x = 0; x <= 10; x += 0.5) histogram.push({ score: x, n: totals.filter(t => t === x).length });

    const first = placements.filter(r => r.part === '1A' && Number(r.attempt) === 1);
    const difficulty = S.ORGANS.map(o => {
      const rows = first.filter(r => r.organ === o);
      const lv = [1, 2, 3].map(l => { const x = rows.filter(r => Number(r.level) === l); return prop(x.filter(r => r.item_result === 'first').length, x.length); });
      return { organ: o, all: prop(rows.filter(r => r.item_result === 'first').length, rows.length), levels: lv, timeToPlace: U.median(rows.map(r => num(r.time_to_place_ms)).filter(Number.isFinite)) / 1000 };
    });
    const errors = Object.entries(groupBy(placements.filter(r => r.part === '1A' && r.ai_verdict === 'wrong'), 'ai_error')).map(([e, rows]) => ({ error: e || 'other', n: rows.length })).sort((a, b) => b.n - a.n);
    const hinted = placements.filter(r => r.part === '1A' && Number(r.attempt) === 2);
    const hintSuccess = prop(hinted.filter(r => r.item_result === 'hint').length, hinted.length);
    const qualified = prop(completed.filter(s => bool(s.qualified_build)).length, completed.length);
    const levels = [1, 2, 3].map(l => ({ level: l, n: completed.filter(s => Number(s.highest_level) === l).length }));

    const firstTrials = trials.filter(t => Number(t.attempt) === 1);
    const trialPass = ['diaphragmatic', 'thoracic'].map(c => { const x = firstTrials.filter(t => t.command === c); return { command: c, ...prop(x.filter(t => bool(t.pass)).length, x.length) }; });
    const retries = trials.filter(t => Number(t.attempt) === 2);
    const retrySuccess = prop(retries.filter(t => bool(t.pass)).length, retries.length);
    const swing = ['diaphragmatic', 'thoracic'].map(c => ({ command: c, ...dist(trials.filter(t => t.command === c).map(t => num(t.hr_swing))) }));
    const questions = ['B1', 'B2', 'B3'].map(q => { const x = answers.filter(a => a.qid === q); return { qid: q, ...prop(x.filter(a => bool(a.correct)).length, x.length), unanswered: x.filter(a => !a.choice).length }; });
    const backupRate = prop(completed.filter(s => s.graph_source === 'backup').length, completed.length);

    /* ---- Reading (URT-style passages) ---- */
    const reading = pick('Reading');
    const rOk = r => bool(r.correct);
    const byDiff = ['E', 'I', 'H'].map(d => { const x = reading.filter(r => r.difficulty === d); return { d, ...prop(x.filter(rOk).length, x.length) }; });
    const byLevel = ['foundation', 'intermediate', 'advanced'].map(l => { const x = reading.filter(r => r.level === l); return { level: l, ...prop(x.filter(rOk).length, x.length) }; });
    const items = Object.entries(groupBy(reading, 'question_id')).map(([id, rows]) => ({ id, passage: rows[0].passage_id, level: rows[0].level, d: rows[0].difficulty, ...prop(rows.filter(rOk).length, rows.length), meanMs: U.mean(rows.map(r => num(r.time_ms)).filter(Number.isFinite)) }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const passagesSeen = Object.entries(groupBy(reading, r => `${r.session_id}|${r.passage_no}`)).map(([, rows]) => rows[0]);
    const timeouts = prop(passagesSeen.filter(r => r.ended === 'timeout').length, passagesSeen.length);
    const moveUp = [['G8-G9', ['G8', 'G9']], ['G10-G12', ['G10', 'G11', 'G12']]].map(([label, gs]) => {
      const x = completed.filter(s => gs.includes(s.grade) && s.reading_path);
      return { group: label, ...prop(x.filter(s => bool(s.reading_moved_up)).length, x.length) };
    });

    /* ---- Prep and test performance ---- */
    const prepRows = (tables.Prep || []).filter(r => includeSimulated || !bool(r.demo));
    const attempts = Object.values(groupBy(prepRows, 'session_id')).map(rows => ({
      key: rows[0].student_key, finished: String(rows[0].finished_at || ''), wrong: rows.filter(r => !bool(r.correct)).length,
      looked: rows.filter(r => !bool(r.correct) && bool(r.looked_again)).length, reviewMs: num(rows[0].review_ms) || 0, report: rows[0].self_report || '', score: rows.filter(r => bool(r.correct)).length
    }));
    const startOf = s => (s.started_at instanceof Date ? s.started_at.toISOString() : String(s.started_at || ''));
    const prepGroupOf = s => {
      const mine = attempts.filter(a => a.key && a.key === s.student_key && a.finished && a.finished < startOf(s));
      if (!mine.length) return { group: 'none', count: 0, report: '' };
      const wrong = mine.reduce((t, a) => t + a.wrong, 0), looked = mine.reduce((t, a) => t + a.looked, 0);
      const reports = mine.map(a => a.report).filter(Boolean);
      const group = wrong === 0 ? 'no_mistakes' : (looked >= Math.ceil(wrong / 2) ? 'investigated' : 'blind');
      return { group, count: mine.length, wrong, looked, report: reports[reports.length - 1] || '' };
    };
    const withReading = completed.filter(s => Number.isFinite(num(s.reading_correct)));
    const tagged = withReading.map(s => ({ s, g: prepGroupOf(s) }));
    const GROUPS = [['none', 'No prep'], ['blind', 'Prep, did not investigate mistakes'], ['investigated', 'Prep, investigated mistakes'], ['no_mistakes', 'Prep, made no mistakes']];
    const prepCompare = GROUPS.map(([g, label]) => {
      const x = tagged.filter(t => t.g.group === g).map(t => t.s);
      return { group: g, label, n: x.length, readPct: dist(x.map(s => num(s.reading_correct) * 10)), breathing: dist(x.map(s => num(s.breathing_score))), total: dist(x.map(s => num(s.total))), graph: dist(x.map(s => num(s.graph_correct))) };
    });
    const reportCompare = [['all', 'Said yes, for every mistake'], ['some', 'Said for some mistakes'], ['no', 'Said no']].map(([v, label]) => {
      const x = tagged.filter(t => t.g.report === v).map(t => t.s);
      return { report: v, label, n: x.length, readPct: dist(x.map(s => num(s.reading_correct) * 10)) };
    });
    const prepCount = tagged.map(t => t.g.count), readPctAll = tagged.map(t => num(t.s.reading_correct) * 10);
    const r_prep = U.pearson(prepCount, readPctAll);

    /* ---- Requirement summary ---- */
    const reqs = [
      { id: 'R1', name: 'Placement response time', value: resp.median, unit: 'ms', show: `${U.fmt(resp.median, 0)} ms median, ${U.fmt(resp.p95, 0)} ms 95th percentile`, target: `at most ${T.placementResponseMs} ms`, met: resp.n ? resp.p95 <= T.placementResponseMs : null, n: resp.n },
      { id: 'R1b', name: 'Breath label response time', show: `${U.fmt(lat.median, 0)} ms median, ${U.fmt(lat.p95, 0)} ms 95th percentile`, target: `at most ${T.breathLatencyMs} ms`, met: lat.n ? lat.p95 <= T.breathLatencyMs : null, n: lat.n },
      { id: 'R2', name: 'Placement detection accuracy', show: `${U.pct(placementAcc.p)} (95% CI ${U.pct(placementAcc.lo)} to ${U.pct(placementAcc.hi)})`, target: `at least ${U.pct(T.placementAccuracy, 0)}`, met: placementAcc.n ? placementAcc.p >= T.placementAccuracy : null, n: placementAcc.n },
      { id: 'R2b', name: 'Breath classification accuracy', show: `${U.pct(breathAcc.p)} (95% CI ${U.pct(breathAcc.lo)} to ${U.pct(breathAcc.hi)})`, target: `at least ${U.pct(T.breathAccuracy, 0)}`, met: breathAcc.n ? breathAcc.p >= T.breathAccuracy : null, n: breathAcc.n },
      { id: 'R3', name: 'Heart-rate accuracy vs oximeter', show: `${U.fmt(hr.mae)} bpm mean error, bias ${U.fmt(hr.bias)} bpm`, target: `within ${T.hrErrorBpm} bpm`, met: hr.n ? hr.mae <= T.hrErrorBpm : null, n: hr.n },
      { id: 'R4', name: 'Sessions uploaded to the cloud', show: '', target: '100%', met: null, n: 0 },
      { id: 'R5', name: 'Session length', show: `${U.fmt(len.median)} min median, ${U.fmt(len.max)} min longest`, target: `at most ${T.sessionMinutes} min`, met: len.n ? len.max <= T.sessionMinutes : null, n: len.n },
      { id: 'R6', name: 'Lung model response', show: `${U.fmt(servo.median, 0)} ms median`, target: `at most ${T.servoLatencyMs} ms (target not decided)`, met: servo.n ? servo.median <= T.servoLatencyMs : null, n: servo.n }
    ];

    return {
      counts: { sessions: allSessions.length, kept: keep.length, completed: completed.length, excludedSim: allSessions.filter(s => bool(s.simulated)).length, invalid: allSessions.filter(s => !bool(s.valid)).length },
      reqs, placementAcc, cm, byDevice, byOrgan, gtSources: Object.fromEntries(Object.entries(gtSources).map(([k, v]) => [k || 'none', v.length])),
      breathAcc, breathAccClear, bcm, perClass, resp, lat, hr, len, servo,
      reading: { byDiff, byLevel, items, timeouts, moveUp, n: passagesSeen.length }, prep: { compare: prepCompare, reports: reportCompare, r_prep, attempts: attempts.length },
      poster: { totals: dist(totals), byGrade, byPrior, r_ab, histogram, difficulty, errors, hintSuccess, qualified, levels, trialPass, retrySuccess, swing, questions, backupRate }
    };
  }

  /* One flat table of headline numbers, ready to paste into the poster or a spreadsheet */
  function summaryRows(m) {
    const rows = m.reqs.map(r => ({ section: 'Design requirement', item: `${r.id} ${r.name}`, value: r.show, target: r.target, result: r.met === null ? 'No data yet' : (r.met ? 'Met' : 'Not met'), n: r.n }));
    const P = m.poster;
    rows.push({ section: 'Students', item: 'Total score', value: `${U.fmt(P.totals.mean, 2)} mean, SD ${U.fmt(P.totals.sd, 2)}`, n: P.totals.n });
    P.byGrade.forEach(g => rows.push({ section: 'Students', item: `Total score ${g.grade}`, value: `${U.fmt(g.total.mean, 2)} mean, SD ${U.fmt(g.total.sd, 2)}`, n: g.n }));
    P.byPrior.forEach(g => rows.push({ section: 'Students', item: `Total score, studied before: ${g.prior}`, value: `${U.fmt(g.total.mean, 2)} mean, SD ${U.fmt(g.total.sd, 2)}`, n: g.n }));
    rows.push({ section: 'Students', item: 'Anatomy vs breathing correlation (r)', value: U.fmt(P.r_ab, 2), n: P.totals.n });
    P.difficulty.forEach(d => rows.push({ section: 'Task 1', item: `${S.ORGAN_NAME[d.organ]} first-try correct`, value: U.pct(d.all.p), n: d.all.n }));
    P.errors.forEach(e => rows.push({ section: 'Task 1', item: `Error: ${e.error.replace(/_/g, ' ')}`, value: e.n }));
    rows.push({ section: 'Task 1', item: 'Correct after hint', value: U.pct(P.hintSuccess.p), n: P.hintSuccess.n });
    rows.push({ section: 'Task 1', item: 'Qualified for full build', value: U.pct(P.qualified.p), n: P.qualified.n });
    P.trialPass.forEach(t => rows.push({ section: 'Task 2', item: `${t.command} passed on first try`, value: U.pct(t.p), n: t.n }));
    rows.push({ section: 'Task 2', item: 'Retry passed', value: U.pct(P.retrySuccess.p), n: P.retrySuccess.n });
    P.swing.forEach(t => rows.push({ section: 'Task 2', item: `Heart-rate swing, ${t.command}`, value: `${U.fmt(t.mean, 2)} bpm mean`, n: t.n }));
    P.questions.forEach(q => rows.push({ section: 'Task 2', item: `Question ${q.qid} correct`, value: U.pct(q.p), n: q.n }));
    rows.push({ section: 'Task 2', item: 'Backup graph used', value: U.pct(P.backupRate.p), n: P.backupRate.n });
    m.reading.byDiff.forEach(d => rows.push({ section: 'Reading', item: `${{ E: 'Easy', I: 'Intermediate', H: 'Hard' }[d.d]} questions correct`, value: U.pct(d.p), n: d.n }));
    m.reading.moveUp.forEach(g => rows.push({ section: 'Reading', item: `Moved up a level, ${g.group}`, value: U.pct(g.p), n: g.n }));
    m.prep.compare.forEach(g => rows.push({ section: 'Prep', item: `Reading % correct: ${g.label}`, value: `${U.fmt(g.readPct.mean, 1)} mean, SD ${U.fmt(g.readPct.sd, 1)}`, n: g.n }));
    m.prep.compare.forEach(g => rows.push({ section: 'Prep', item: `Breathing score: ${g.label}`, value: `${U.fmt(g.breathing.mean, 2)} mean`, n: g.n }));
    rows.push({ section: 'Prep', item: 'Prep passages done vs reading % correct (r)', value: U.fmt(m.prep.r_prep, 2), n: m.prep.compare.reduce((t, g) => t + g.n, 0) });
    return rows;
  }

  return { compute, summaryRows, bool, num };
})();
