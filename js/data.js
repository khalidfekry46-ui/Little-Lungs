/* Scoring, the session record, and the flat tables sent to Google Sheets and used for statistics. */
window.S = window.S || {};

S.ANATOMY_MAX = 18;   /* 2 + 2 + 3 + 3 + 3 in Part 1A, plus 5 in the full build */
S.BREATHING_MAX = 15; /* 2 trials x 2, plus 3 graph questions, plus reading scaled to 8 */

S.score = function (session) {
  const t1 = session.t1 || { items: [], build: null };
  const t2 = session.t2 || { trials: [], answers: [] };
  const aRaw = t1.items.reduce((t, i) => t + (i.points || 0), 0) + ((t1.build && t1.build.points) || 0);
  const trialPts = (t2.trials || []).reduce((t, tr) => t + (tr.points || 0), 0);
  const ansPts = (t2.answers || []).reduce((t, a) => t + (a.correct && String(a.qid).startsWith('B') ? 1 : 0), 0);
  const rd = t2.reading && t2.reading.passages ? t2.reading.passages.reduce((t, x) => t + x.points, 0) : 0;
  const readPts = S.READING_WEIGHT * rd / S.READING_MAX;
  const bRaw = +(trialPts + ansPts + readPts).toFixed(2);
  const anatomy = S.util.roundHalf(5 * aRaw / S.ANATOMY_MAX);
  const breathing = S.util.roundHalf(5 * bRaw / S.BREATHING_MAX);
  const total = anatomy + breathing;
  const lab = S.LABELS.find(l => total >= l[0]);
  return { anatomy_raw: aRaw, anatomy_max: S.ANATOMY_MAX, anatomy, reading_raw: rd, reading_points: +readPts.toFixed(2), breathing_raw: bRaw, breathing_max: S.BREATHING_MAX, breathing, total, label: lab[1], label_clip: lab[2] };
};

S.newSession = function () {
  const st = S.settings.get();
  const seq = st.nextSeq || 1;
  S.settings.save({ nextSeq: seq + 1 });
  const code = `${st.deviceCode}-${S.util.pad(seq, 3)}`;
  return {
    id: `${st.deviceCode}-${S.util.stamp()}-${S.util.rand4()}`,
    app_version: S.APP_VERSION,
    device: { code: st.deviceCode, label: st.deviceLabel, ua: navigator.userAgent, screen: `${screen.width}x${screen.height}` },
    mode: { pico: st.picoMode, vision: st.visionMode },
    demo: false,
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_s: null,
    student: { code, name: '', student_id: '', grade: '', class: '', age: '', prior: '' },
    consent: null,
    station: null,
    operator: { checklist: null, events: [] },
    t1: { items: [], build: null, qualified: false, highest_level: 2 },
    t2: { calib: {}, trials: [], graph: null, answers: [], servo: [] },
    scores: null,
    end: null,
    review: { valid: true, exclude_reason: '', hr_ref_bpm: null, placements_done: false, breaths_done: false, at: null },
    sync: { synced_at: null, hash: null, error: null },
    raw: { hr: [], belts: [], windows: [] }
  };
};

S.isSimulated = s => !!(s.demo || (s.mode && (s.mode.pico === 'sim' || s.mode.vision === 'sim')));

/* Flat rows, one table per kind. Names stay in Roster only. */
S.flatten = function (s) {
  const sc = s.scores || S.score(s);
  const dev = s.device || {};
  const base = { session_id: s.id, device_code: dev.code };
  const simulated = S.isSimulated(s);
  const roster = [{ session_id: s.id, student_code: s.student.code, name: s.student.name, student_id: s.student.student_id, grade: s.student.grade, class: s.student.class }];
  const servo = (s.t2.servo || []).filter(Number.isFinite);
  const sessions = [{
    ...base, student_code: s.student.code, grade: s.student.grade, age: s.student.age, prior_study: s.student.prior,
    device_label: dev.label, pico_mode: s.mode.pico, vision_mode: s.mode.vision, demo: !!s.demo, simulated,
    started_at: s.started_at, ended_at: s.ended_at, duration_s: s.duration_s,
    station_status: s.station && s.station.status, end_status: s.end && s.end.status, end_note: s.end && s.end.note,
    valid: s.review.valid !== false, exclude_reason: s.review.exclude_reason || '',
    anatomy_raw: sc.anatomy_raw, anatomy_score: sc.anatomy, breathing_raw: sc.breathing_raw, breathing_score: sc.breathing,
    total: sc.total, label: sc.label, highest_level: s.t1.highest_level, qualified_build: !!s.t1.qualified,
    graph_source: s.t2.graph && s.t2.graph.source, graph_reason: s.t2.graph && s.t2.graph.reason,
    hr_rest_bpm: s.t2.calib && s.t2.calib.hr_mean != null ? +s.t2.calib.hr_mean.toFixed(1) : null,
    hr_ref_bpm: s.review.hr_ref_bpm,
    servo_latency_ms: servo.length ? +S.util.median(servo).toFixed(0) : null,
    app_version: s.app_version
  }];
  const placements = [];
  (s.t1.items || []).forEach(it => {
    it.attempts.forEach(at => placements.push({
      ...base, simulated, part: '1A', item_no: it.n, organ: it.organ, level: it.level, attempt: at.a,
      ai_verdict: at.ai_verdict, ai_error: at.error || '', ai_zone: at.seenZone || '', ai_class: at.seenCls || '', ai_conf: at.conf != null ? +at.conf.toFixed(3) : null,
      time_to_place_ms: at.place_ms != null ? Math.round(at.place_ms) : null, response_ms: at.response_ms != null ? Math.round(at.response_ms) : null,
      timeout: !!at.timeout, hint_used: at.a === 2, item_result: it.result, item_points: it.points,
      gt_verdict: at.gt || '', gt_source: at.gt_source || ''
    }));
  });
  if (s.t1.build && s.t1.build.pieces) {
    s.t1.build.pieces.forEach((p, i) => placements.push({
      ...base, simulated, part: '1B', item_no: i + 1, organ: p.organ, level: '', attempt: 1,
      ai_verdict: p.ai_verdict, ai_error: '', ai_zone: p.organ, ai_class: p.seenCls || '', ai_conf: p.conf != null ? +p.conf.toFixed(3) : null,
      time_to_place_ms: null, response_ms: s.t1.build.response_ms != null ? Math.round(s.t1.build.response_ms) : null,
      timeout: !!s.t1.build.timeout, hint_used: false, item_result: p.ai_verdict, item_points: p.ai_verdict === 'correct' ? 1 : 0,
      gt_verdict: p.gt || '', gt_source: p.gt_source || ''
    }));
  }
  const trials = [], breaths = [];
  (s.t2.trials || []).forEach(tr => {
    trials.push({ ...base, simulated, trial_no: tr.n, command: tr.command, attempt: tr.attempt, valid_breaths: tr.valid, matched: tr.matched, pass: tr.pass, points: tr.points, hr_mean: tr.hr_mean != null ? +tr.hr_mean.toFixed(1) : null, hr_swing: tr.rsa != null ? +tr.rsa.toFixed(2) : null });
    tr.breaths.forEach(b => breaths.push({
      ...base, simulated, trial_no: tr.n, attempt: tr.attempt, command: tr.command, breath_no: b.b,
      ai_label: b.label, ai_conf: b.conf != null ? +b.conf.toFixed(3) : null, chest_amp: b.chest_amp, abd_amp: b.abd_amp,
      ratio: b.abd_amp && b.chest_amp ? +(b.abd_amp / b.chest_amp).toFixed(2) : null, rejected: !!b.rejected,
      latency_ms: b.latency_ms != null ? Math.round(b.latency_ms) : null, missing: !!b.missing,
      gt_label: b.gt || '', gt_source: b.gt_source || ''
    }));
  });
  const answers = (s.t2.answers || []).map(a => ({ ...base, simulated, qid: a.qid, choice: a.choice || '', correct_answer: a.correct_answer, correct: !!a.correct, time_ms: a.time_ms != null ? Math.round(a.time_ms) : null, graph_source: a.graph_source || '' }));
  const events = (s.operator.events || []).map(e => ({ ...base, t: e.t, type: e.type, note: e.note || '' }));
  const rdg = s.t2.reading || { passages: [] };
  const reading = [];
  rdg.passages.forEach(x => x.answers.forEach(a => reading.push({
    ...base, simulated, student_key: s.student.key || '', grade: s.student.grade, passage_no: x.n, passage_id: x.id, level: x.level,
    q_no: a.q, question_id: a.id, difficulty: a.d, choice: a.choice == null ? '' : 'ABCD'[a.choice], correct: !!a.correct,
    changes: a.changes, time_ms: a.time_ms, first_ms: a.first_ms, ended: x.ended, passage_points: x.points, did_well: !!x.well })));
  Object.assign(sessions[0], {
    student_key: s.student.key || '',
    reading_raw: rdg.passages.length ? rdg.passages.reduce((t, x) => t + x.points, 0) : null,
    reading_max_path: rdg.passages.length ? rdg.passages.reduce((t, x) => t + x.max, 0) : null,
    reading_correct: rdg.passages.length ? rdg.passages.reduce((t, x) => t + x.answers.filter(a => a.correct).length, 0) : null,
    reading_path: (rdg.path || []).join('>'), reading_moved_up: !!rdg.moved_up,
    graph_correct: (s.t2.answers || []).filter(a => String(a.qid).startsWith('B') && a.correct).length
  });
  return { Roster: roster, Sessions: sessions, Placements: placements, Trials: trials, Breaths: breaths, Answers: answers, Reading: reading, Events: events };
};

S.flattenAll = function (list) {
  const out = { Sessions: [], Placements: [], Trials: [], Breaths: [], Answers: [], Reading: [], Events: [] };
  list.forEach(s => {
    const f = S.flatten(s);
    Object.keys(out).forEach(k => out[k].push(...f[k]));
  });
  return out;
};

S.reviewStatus = function (s) {
  const pl = [];
  (s.t1.items || []).forEach(it => it.attempts.forEach(a => pl.push(a)));
  if (s.t1.build && s.t1.build.pieces) pl.push(...s.t1.build.pieces);
  const br = [];
  (s.t2.trials || []).forEach(t => t.breaths.forEach(b => { if (!b.missing) br.push(b); }));
  const done = x => x.gt && x.gt_source === 'recorder';
  return {
    placements: [pl.filter(done).length, pl.length],
    breaths: [br.filter(done).length, br.length],
    hr: s.review.hr_ref_bpm != null && s.review.hr_ref_bpm !== ''
  };
};

/* Prep (practice) attempts: one row per question, linked to the test only through the student key */
S.flattenPrep = function (r) {
  return { Prep: r.answers.map(a => ({
    session_id: r.id, student_key: r.student_key, grade: r.grade, device_code: r.device_code, demo: !!r.demo,
    passage_id: r.passage_id, level: r.level, started_at: r.started_at, finished_at: r.finished_at, ended: r.ended,
    q_no: a.q, question_id: a.id, difficulty: a.d, choice: a.choice == null ? '' : 'ABCD'[a.choice], correct: !!a.correct, time_ms: a.time_ms,
    score: r.score, wrong_count: r.answers.filter(x => !x.correct).length,
    looked_again: !!(r.review && r.review.looks && r.review.looks.some(l => l.q === a.q)),
    look_ms: r.review && r.review.looks ? r.review.looks.filter(l => l.q === a.q).reduce((t, l) => t + l.ms, 0) : 0,
    review_ms: r.review ? r.review.ms : 0, self_report: r.review ? r.review.self_report || '' : ''
  })) };
};
S.studentKey = async id => (await S.util.sha256('little-lungs:' + String(id).trim().toLowerCase())).slice(0, 12);
