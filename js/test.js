/* The test itself: pages P01 to P22 in order, following the test protocol. */
window.S = window.S || {};

S.test = (() => {
  const { h, shuffle } = S.util;
  const T = S.TIMING;
  const P = S.PAGES;
  let session = null;
  let page = null;
  let abortReject = null;
  let abortPromise = null;
  let offs = [];
  let menuOpen = false;
  let breather = null;

  const now = () => S.run.now();
  const save = () => S.store.saveSession(session).catch(e => console.error('save failed', e));
  const log = (type, note) => session.operator.events.push({ t: new Date().toISOString(), type, note: note || '' });

  /* Any wait for a tap must also end if the operator ends the session */
  function guard(p) { return Promise.race([p, abortPromise]); }
  const playMain = clip => S.audio.play(clip, { main: true });

  /* A Next/Start button. With auto, a hidden 1-minute timer continues on its own. */
  function tapNext(label = 'Next', { auto = false } = {}) {
    let clicked = false;
    const btn = S.ui.button(label, () => { clicked = true; });
    page.controls.appendChild(btn);
    const waits = [S.run.until(() => clicked, auto ? T.autoMs : null)];
    return guard(Promise.race(waits)).then(r => { btn.remove(); if (auto && r && !r.ok) log('auto_continue', label); });
  }

  /* Plays a clip; a small Next button lets a quick student move on without waiting for it to end */
  async function playSkippable(clip) {
    let skipped = false;
    const btn = h('button', { class: 'btn skip', type: 'button', onclick: () => { skipped = true; S.audio.stop(); } }, 'Next');
    page.controls.appendChild(btn);
    await guard(Promise.race([playMain(clip), S.run.until(() => skipped, null)]));
    btn.remove();
  }

  /* An operator step: one button, PIN required. Cancelling the PIN keeps the same single button. */
  async function operatorGate(label, title, ready) {
    let clicked = false;
    const btn = S.ui.button(label, () => { clicked = true; });
    page.controls.appendChild(btn);
    for (;;) {
      await guard(S.run.until(() => clicked, null));
      clicked = false;
      if (ready && !ready()) { S.ui.toast('Sensors are not all ready yet.'); continue; }
      btn.disabled = true;
      const ok = await guard(S.ui.askPin(title));
      btn.disabled = false;
      if (ok) { btn.remove(); return true; }
    }
  }

  function task2Visual(extra) {
    breather = S.art.breathing();
    return h('div', { class: 'stack' }, extra || null, breather);
  }

  /* ---------- Session start and end ---------- */
  async function start(stationResult) {
    const st = S.settings.get();
    S.run.reset(st.visionMode === 'sim' || st.picoMode === 'sim' ? Number(st.simSpeed) || 1 : 1);
    abortPromise = new Promise((_, rej) => { abortReject = rej; });
    abortPromise.catch(() => {});
    session = S.newSession();
    session.station = stationResult;
    log('session_start');
    await save();
    let status = 'completed', note = '';
    try {
      await pWelcome();
      await pForm();
      await pConsent();
      await pWaitOperator();
      await pOverview();
      await task1();
      await task2();
      await pResults();
      const end = await pThanks();
      status = end.status;
      note = end.note;
    } catch (e) {
      if (e && e.name === 'Abort') { status = 'aborted'; note = session._abortNote || 'Ended early by the operator'; }
      else { console.error(e); status = 'problem'; note = 'App error: ' + (e && e.message); }
    } finally {
      offs.forEach(f => f());
      offs = [];
      S.audio.stop();
      if (S.ui.liveStop) S.ui.liveStop();
    }
    await finish(status, note);
  }

  async function finish(status, note) {
    session.ended_at = new Date().toISOString();
    session.duration_s = Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 1000);
    session.scores = S.score(session);
    session.end = { status, note };
    delete session._abortNote;
    log('session_end', status);
    await save();
    S.sync.session(session).catch(() => {});
    const done = session;
    session = null;
    S.admin.home(`Session ${done.student.code} saved (${status === 'completed' ? 'completed normally' : status === 'aborted' ? 'ended early' : 'had a problem'}).`);
  }

  /* Press-and-hold menu for the operator: pause, flag a problem, or end the session */
  async function operatorMenu() {
    if (!session || menuOpen) return;
    menuOpen = true;
    const ok = await S.ui.askPin('Operator menu');
    if (!ok) { menuOpen = false; return; }
    S.run.pause();
    log('paused');
    const fast = S.run.speed > 1;
    if (!fast) new Audio('audio/any_paused.mp3').play().catch(() => {});
    const note = h('textarea', { rows: 3, placeholder: 'What happened? (saved with the session)' });
    const m = S.ui.modal(h('div', null,
      h('h2', null, 'Test paused'),
      h('p', { class: 'muted' }, 'The timer is stopped. The student sees the paused message.'),
      h('label', { class: 'field' }, h('span', null, 'Note'), note),
      h('div', { class: 'row wrap end' },
        h('button', { class: 'btn', type: 'button', onclick: () => { if (note.value.trim()) log('problem_flag', note.value.trim()); S.ui.toast('Problem flagged'); } }, 'Flag a problem'),
        h('button', { class: 'btn danger', type: 'button', onclick: async () => {
          if (!(await S.ui.confirmBox('End this session now?', 'The session is saved as ended early and can be excluded from statistics.', 'End session', 'Keep going'))) return;
          session._abortNote = note.value.trim() || 'Ended early by the operator';
          m.close(); menuOpen = false;
          S.run.resume();
          S.run.abort();
          abortReject(new S.Abort());
        } }, 'End session now'),
        h('button', { class: 'btn primary', type: 'button', onclick: async () => {
          if (note.value.trim()) log('note', note.value.trim());
          m.close(); menuOpen = false;
          if (!fast) await new Promise(r => { const a = new Audio('audio/any_resumed.mp3'); a.onended = r; a.onerror = r; a.play().catch(r); });
          log('resumed');
          S.run.resume();
        } }, 'Resume test'))));
    const ov = h('div', { class: 'paused' }, S.art.verity('big'), h('p', null, S.TEXT.any_paused));
    document.body.appendChild(ov);
    const obs = new MutationObserver(() => { if (!document.body.contains(m.box)) { ov.remove(); obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
  }

  /* ---------- Before the test ---------- */
  async function pWelcome() {
    page = S.ui.studentPage({ code: 'P01', lead: P.P01.lead, text: P.P01.body, clip: 'p01_welcome_v2', center: true, verity: 'big' });
    playMain('p01_welcome_v2');
    await tapNext('Next', { auto: true });
  }

  async function pForm() {
    page = S.ui.studentPage({ code: 'P02', lead: S.TEXT.p02_form, clip: 'p02_form', verity: 'side' });
    playMain('p02_form');
    const f = (label, input) => h('label', { class: 'field' }, h('span', null, label), input);
    const name = h('input', { type: 'text', autocomplete: 'off', name: 'name', id: 'f-name' });
    const sid = h('input', { type: 'text', autocomplete: 'off', name: 'sid', inputmode: 'numeric', id: 'f-sid' });
    const grade = h('select', { name: 'grade', id: 'f-grade' }, h('option', { value: '' }, 'Choose'), ['G8', 'G9', 'G10', 'G11', 'G12'].map(g => h('option', { value: g }, g)));
    const cls = h('input', { type: 'text', autocomplete: 'off', name: 'class', id: 'f-class' });
    const age = h('input', { type: 'number', min: 10, max: 20, name: 'age', inputmode: 'numeric', id: 'f-age' });
    const prior = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Studied before' },
      ['yes', 'no'].map(v => h('label', null, h('input', { type: 'radio', name: 'prior', value: v }), h('span', null, v === 'yes' ? 'Yes' : 'No'))));
    const err = h('p', { class: 'error', role: 'alert' });
    const form = h('form', { class: 'sform', onsubmit: e => e.preventDefault() },
      f('Full name', name), f('Student ID', sid),
      h('div', { class: 'row2' }, f('Grade', grade), f('Class', cls), f('Age', age)),
      h('fieldset', { class: 'field' }, h('legend', null, 'Have you studied the respiratory system before?'), prior), err);
    page.controls.appendChild(form);
    if (S.settings.get().simAutoStudent && S.settings.get().visionMode === 'sim' && S.run.speed > 1) {
      name.value = 'Simulated student'; sid.value = String(1000 + Math.floor(Math.random() * 9000));
      grade.value = ['G8', 'G9', 'G10', 'G11', 'G12'][Math.floor(Math.random() * 5)]; cls.value = 'A'; age.value = 15;
      prior.querySelector('input[value="yes"]').checked = true;
    }
    for (;;) {
      await tapNext();
      const pr = form.querySelector('input[name="prior"]:checked');
      const ag = Number(age.value);
      if (!name.value.trim()) err.textContent = 'Enter your full name.';
      else if (!sid.value.trim()) err.textContent = 'Enter your student ID.';
      else if (!grade.value) err.textContent = 'Choose your grade.';
      else if (!ag || ag < 10 || ag > 20) err.textContent = 'Enter your age in years.';
      else if (!pr) err.textContent = 'Answer the question about the respiratory system.';
      else {
        const simFast = S.settings.get().simAutoStudent && S.settings.get().visionMode === 'sim' && S.run.speed > 1;
        if (!simFast) {
          /* The student's own password: the same one opens Prep and History */
          const id = sid.value.trim();
          const box = h('div');
          form.replaceWith(box);
          const known = await S.accounts.exists(id);
          page.setText(known ? 'Type your password.' : 'Choose your password.');
          await guard(S.accounts.passwordForm(box, id, { mode: known ? 'enter' : 'create', forgot: true, info: { name: name.value.trim(), grade: grade.value }, intro: `Student ID ${id}` }));
          log(known ? 'password_ok' : 'password_created');
        }
        Object.assign(session.student, { name: name.value.trim(), student_id: sid.value.trim(), grade: grade.value, class: cls.value.trim(), age: ag, prior: pr.value });
        session.student.key = await S.studentKey(sid.value);
        await save();
        return;
      }
    }
  }

  async function pConsent() {
    page = S.ui.studentPage({ code: 'P03', lead: S.TEXT.p03_consent, clip: 'p03_consent', verity: 'side' });
    playMain('p03_consent');
    page.controls.appendChild(h('ol', { class: 'statements' },
      h('li', null, "I'll solve this by myself, without help from any external source."),
      h('li', null, 'I understand that photos of the board and my hands may be saved to improve the system.')));
    await tapNext('I agree');
    session.consent = { pledge: true, photos: true, at: new Date().toISOString() };
    log('consent');
  }

  async function pWaitOperator() {
    page = S.ui.studentPage({ code: 'P04', lead: S.TEXT.p04_wait_operator, clip: 'p04_wait_operator', center: true, verity: 'big' });
    playMain('p04_wait_operator');
    await operatorGate('Operator: continue', 'Operator checklist');
    const items = [
      ['sound', 'Test sound heard clearly'], ['mount', 'Tablet firmly mounted'], ['pieces', 'All 5 pieces present in the tray'],
      ['form', 'Student form details correct'], ['alone', 'Student alone at the station']];
    const boxes = items.map(([k, label]) => { const c = h('input', { type: 'checkbox', value: k, id: `chk-${k}` }); return h('label', { class: 'check' }, c, h('span', null, label)); });
    await guard(new Promise(resolve => {
      const err = h('p', { class: 'error' });
      const m = S.ui.modal(h('div', null, h('h2', null, 'Operator checklist'),
        h('p', { class: 'muted' }, `Student ${session.student.code}, ${session.student.name}, ${session.student.grade}`),
        h('div', { class: 'checks' }, boxes), err,
        h('div', { class: 'row end' }, h('button', { class: 'btn primary', type: 'button', onclick: () => {
          if (boxes.some(b => !b.querySelector('input').checked)) { err.textContent = 'Tick every item before starting.'; return; }
          m.close(); resolve();
        } }, 'Start the test'))));
    }));
    session.operator.checklist = { all: true, at: new Date().toISOString() };
    log('checklist_done');
    await save();
  }

  async function pOverview() {
    page = S.ui.studentPage({ code: 'P05', lead: P.P05.lead, text: P.P05.body, clip: 'p05_overview_v3', center: true });
    playMain('p05_overview_v3');
    await tapNext('Start', { auto: true });
  }

  /* ---------- Task 1 ---------- */
  async function task1() {
    page = S.ui.studentPage({ code: 'P06', progress: 'Task 1 of 2', title: P.P06.title, text: P.P06.body, clip: 'p06_t1_directions', visual: S.art.organsScan() });
    playMain('p06_t1_directions');
    await tapNext('Start', { auto: true });
    let level = 2, streak = 0, firstCorrect = 0, highest = 2;
    const order = shuffle(S.ORGANS);
    for (let i = 0; i < order.length; i++) {
      highest = Math.max(highest, level);
      const it = { n: i + 1, organ: order[i], level, attempts: [], result: null, points: 0 };
      session.t1.items.push(it);
      await placementItem(it);
      if (it.result === 'first') {
        firstCorrect++;
        streak++;
        if (streak >= 2 && level < 3) { level++; streak = 0; }
      } else { level = Math.max(1, level - 1); streak = 0; }
      await save();
    }
    session.t1.highest_level = highest;
    session.t1.qualified = firstCorrect >= 4;
    if (session.t1.qualified) await fullBuild();
    page = S.ui.studentPage({ code: 'P10', progress: 'Task 1 of 2', lead: P.P10.lead, text: P.P10.body, clip: 'p10_t1_complete', center: true, verity: 'big' });
    playMain('p10_t1_complete');
    if (S.vision.kind === 'sim') S.vision.manual('clear');
    await operatorGate('Operator: start Task 2', 'Start Task 2');
    log('task2_ready');
  }

  function observe() {
    const o = S.vision.read();
    o.changedAt = Math.max(o.handClearAt || 0, (S.vision.lastChange || 0));
    return o;
  }

  async function waitPlacement(target, ms, since, total) {
    const thr = S.settings.get().confThreshold;
    let warned = false, nagged = false, handSince = null, firstHand = null;
    const r = await S.run.until(el => {
      const o = observe();
      const remaining = ms - el;
      S.ui.setTimer(page, remaining, total || ms);
      if (!warned && remaining <= 10000 && ms >= 20000) { warned = true; S.audio.cue('p07_10s_left'); }
      if (o.hand) { if (handSince == null) handSince = now(); if (firstHand == null) firstHand = now(); }
      else handSince = null;
      if (!nagged && handSince != null && now() - handSince > T.handNagMs && !S.boardEmpty(o.zones)) { nagged = true; S.audio.cue('p07_move_hand'); }
      if (o.hand || o.stableMs < T.stableMs || o.changedAt <= since) return null;
      const j = S.judge(target, o.zones, thr);
      return j ? { ...j, handClearAt: o.handClearAt, firstHand } : null;
    }, ms);
    if (!r.ok) return { timeout: true };
    return { ...r.value, verdictAt: now() };
  }

  /* After each placement the student has 10 seconds to put the piece back in the tray.
     The next prompt waits the full 10 seconds, and longer (up to 20 s) if the board is not empty yet. */
  async function waitReturn() {
    S.vision.onReturn();
    page.setText(S.TEXT.p07_return || 'Please return the piece to the tray.');
    const r = await S.run.until(el => {
      S.ui.setTimer(page, Math.max(0, T.returnMs - el), T.returnMs);
      if (el < T.returnMs) return null;
      const o = observe();
      return !o.hand && S.boardEmpty(o.zones);
    }, T.returnMs + 10000);
    S.ui.setTimer(page, null);
    if (!r.ok) log('board_not_empty', 'Board not cleared within 20 s');
  }

  function recordAttempt(it, a, res, attemptStart) {
    const rec = { a, timeout: !!res.timeout, t_start: attemptStart };
    if (res.timeout) { rec.ai_verdict = 'timeout'; }
    else {
      rec.ai_verdict = res.verdict === 'cant_verify' ? 'cant_verify' : res.verdict;
      rec.error = res.error; rec.seenZone = res.seenZone; rec.seenCls = res.seenCls; rec.conf = res.conf;
      rec.place_ms = res.handClearAt - attemptStart;
      rec.response_ms = res.verdictAt - res.handClearAt;
    }
    if (S.vision.kind === 'sim') {
      rec.gt = res.timeout ? 'timeout' : S.vision.truthVerdict(it.organ);
      rec.gt_source = 'sim';
    }
    it.attempts.push(rec);
    return rec;
  }

  async function placementItem(it) {
    const clip = `p07_${it.organ}_L${it.level}`;
    page = S.ui.studentPage({ code: 'P07', progress: `Task 1 of 2, piece ${it.n} of 5`, lead: S.PROMPTS[it.organ][it.level], clip });
    S.ui.simPanel.setTarget(it.organ);
    S.ui.setTimer(page, T.itemMs, T.itemMs);
    await playMain(clip);
    let since = now();
    S.vision.onPrompt(it.organ, it.level, 1);
    let res = await waitPlacement(it.organ, T.itemMs, since - 1);
    recordAttempt(it, 1, res, since);
    if (res.timeout) {
      it.result = 'timeout'; it.points = 0;
      S.ui.setTimer(page, null);
      page.setText(S.TEXT.p07_time_up);
      await playMain('p07_time_up');
      await waitReturn();
      return;
    }
    if (res.verdict === 'correct') {
      it.result = 'first'; it.points = it.level;
    } else {
      S.ui.setTimer(page, T.hintMs, T.hintMs);
      page.setText(S.HINTS[it.organ]);
      await playMain(`p07_hint_${it.organ}`);
      since = now();
      S.vision.onPrompt(it.organ, it.level, 2);
      res = await waitPlacement(it.organ, T.hintMs, since);
      recordAttempt(it, 2, res, since);
      if (res.timeout) {
        it.result = 'wrong'; it.points = 0;
        S.ui.setTimer(page, null);
        page.setText(S.TEXT.p07_time_up);
        await playMain('p07_time_up');
        await waitReturn();
        return;
      }
      if (res.verdict === 'correct') { it.result = 'hint'; it.points = it.level / 2; }
      else { it.result = 'wrong'; it.points = 0; }
    }
    S.ui.setTimer(page, null);
    page.setText(S.TEXT.p07_recorded);
    await playMain('p07_recorded');
    await waitReturn();
  }

  async function fullBuild() {
    page = S.ui.studentPage({ code: 'P08', progress: 'Task 1 of 2, full build', title: P.P08.title, text: P.P08.body, clip: 'p08_build_directions', visual: S.art.organsScan() });
    playMain('p08_build_directions');
    await tapNext('Start', { auto: true });
    page = S.ui.studentPage({ code: 'P09', progress: 'Task 1 of 2, full build', lead: 'Build the complete chest model.', text: 'Tap Done when you have finished.', clip: 'p08_build_directions' });
    const build = { pieces: [], timeout: false, points: 0 };
    session.t1.build = build;
    let doneTap = false;
    const doneBtn = S.ui.button('Done', () => { doneTap = true; doneBtn.disabled = true; });
    page.controls.appendChild(doneBtn);
    S.vision.onBuild();
    let warned = false;
    const auto = S.vision.kind === 'sim' && S.settings.get().simAutoStudent;
    const r = await S.run.until(el => {
      const rem = T.buildMs - el;
      S.ui.setTimer(page, rem, T.buildMs);
      if (!warned && rem <= 30000) { warned = true; S.audio.cue('p09_30s_left'); }
      if (doneTap) return true;
      if (auto) { const o = observe(); if (!o.hand && o.stableMs > 2000 && S.ORGANS.every(z => o.zones[z].cls !== 'empty')) return true; }
      return null;
    }, T.buildMs);
    doneBtn.remove();
    S.ui.setTimer(page, null);
    if (!r.ok) { build.timeout = true; page.setText(S.TEXT.p09_time_up); await playMain('p09_time_up'); }
    const markStart = now();
    await S.run.until(() => { const o = observe(); return !o.hand && o.stableMs >= T.stableMs; }, 5000);
    const o = observe();
    const thr = S.settings.get().confThreshold;
    build.response_ms = now() - Math.max(markStart, o.handClearAt || 0);
    S.ORGANS.forEach(org => {
      const z = o.zones[org] || { cls: 'empty', conf: 1 };
      const verdict = z.cls === org ? (z.conf >= thr ? 'correct' : 'cant_verify') : 'wrong';
      const p = { organ: org, ai_verdict: verdict, seenCls: z.cls, conf: z.conf };
      if (S.vision.kind === 'sim') {
        const t = S.vision.truth[org];
        p.gt = t && t.piece === org && !t.rotated ? 'correct' : 'wrong';
        p.gt_source = 'sim';
      }
      build.pieces.push(p);
    });
    const unsure = build.pieces.filter(p => p.ai_verdict === 'cant_verify');
    if (unsure.length) await confirmUnsure(unsure);
    build.points = build.pieces.filter(p => p.ai_verdict === 'correct').length;
    page.setText(S.TEXT.p09_recorded);
    await playSkippable('p09_recorded');
    await save();
  }

  async function confirmUnsure(pieces) {
    if (!(await guard(S.ui.askPin('Camera could not verify some pieces')))) return;
    for (const p of pieces) {
      const ok = await S.ui.confirmBox(`Is the ${S.ORGAN_NAME[p.organ].toLowerCase()} placed correctly?`, 'The camera could not see this piece clearly.', 'Correct', 'Wrong');
      p.ai_verdict = ok ? 'correct' : 'wrong';
      p.operator_confirmed = true;
      log('operator_confirmed_piece', `${p.organ}: ${p.ai_verdict}`);
    }
  }

  /* ---------- Task 2 ---------- */
  function startRecording() {
    const raw = session.raw;
    offs.push(S.pico.on('hr', d => { raw.hr.push({ t: Math.round(d.t), bpm: +d.bpm.toFixed(2), q: +d.q.toFixed(2), good: d.good }); }));
    offs.push(S.pico.on('servo', d => { if (Number.isFinite(d.latency_ms)) session.t2.servo.push(+d.latency_ms.toFixed(0)); }));
    let lastBelt = -1e9;
    offs.push(S.pico.on('belts', d => { if (d.t - lastBelt >= 95) { lastBelt = d.t; raw.belts.push({ t: Math.round(d.t), chest: +d.chest.toFixed(1), abd: +d.abd.toFixed(1) }); } }));
  }
  function markPhase(name, n) {
    const ph = session.raw.phases || (session.raw.phases = []);
    const t = Math.round(now());
    const last = ph[ph.length - 1];
    if (last && last.end == null) last.end = t;
    if (name) ph.push({ name, start: t, end: null, n: n || null });
  }

  async function task2() {
    page = S.ui.studentPage({ code: 'P11', progress: 'Task 2 of 2', title: P.P11.title, text: P.P11.body, clip: 'p11_t2_directions', visual: task2Visual(S.art.heartbeat()) });
    playMain('p11_t2_directions');
    await tapNext('Next', { auto: true });
    await sensorSetup();
    startRecording();
    await calibration();
    page = S.ui.studentPage({ code: 'P14', progress: 'Task 2 of 2', lead: P.P14.lead, text: P.P14.body, clip: 'p14_trial_directions', visual: task2Visual() });
    playMain('p14_trial_directions');
    await tapNext('Start', { auto: true });
    const order = shuffle(['diaphragmatic', 'thoracic']);
    for (let i = 0; i < order.length; i++) {
      const cmd = order[i];
      const t1 = await runTrial(i + 1, cmd, 1);
      await rest(i + 1);
      if (!t1.pass) {
        page = trialPage(i + 1, S.TEXT[`p15_retry_${cmd}`], `p15_retry_${cmd}`);
        await playMain(`p15_retry_${cmd}`);
        await runTrial(i + 1, cmd, 2);
        await rest(i + 1);
      }
      await save();
    }
    page = trialPage(order.length, S.TEXT.p15_trials_done, 'p15_trials_done');
    await playSkippable('p15_trials_done');
    await graphQuestions();
    await readingSection();
    page = S.ui.studentPage({ code: 'P20', progress: 'Task 2 of 2', text: P.P20.body, clip: 'p20_t2_complete', visual: task2Visual() });
    playMain('p20_t2_complete');
    await operatorGate('Operator: belts removed', 'Belts and clip removed');
    S.pico.simWear(false);
    S.pico.setMode('idle');
    log('belts_removed');
  }

  async function sensorSetup() {
    page = S.ui.studentPage({ code: 'P12', progress: 'Task 2 of 2', lead: S.TEXT.p12_setup, clip: 'p12_setup', verity: 'side', visual: task2Visual() });
    playMain('p12_setup');
    const rows = { hr: h('li'), chest: h('li'), abd: h('li') };
    page.controls.appendChild(h('ul', { class: 'sensors' }, rows.hr, rows.chest, rows.abd));
    let goodHr = 0, lastHr = 0;
    offs.push(S.pico.on('hr', d => { lastHr = now(); goodHr = d.good ? goodHr + 1 : 0; }));
    const draw = () => {
      const st = S.pico.status();
      const ok = (el, yes, label) => { el.className = yes ? 'ok' : ''; el.textContent = `${label}: ${yes ? 'ready' : 'waiting'}`; };
      ok(rows.hr, st.finger && goodHr >= 3 && now() - lastHr < 3000, 'Heart sensor');
      ok(rows.chest, st.beltsInRange, 'Chest belt');
      ok(rows.abd, st.beltsInRange, 'Belly belt');
      return st.finger && goodHr >= 3 && st.beltsInRange;
    };
    if (S.pico.kind === 'sim') {
      const simBtn = h('button', { class: 'btn', type: 'button', onclick: () => { S.pico.simWear(true); simBtn.remove(); } }, 'Simulator: put on belts and clip');
      page.controls.appendChild(simBtn);
      if (S.settings.get().simAutoStudent) setTimeout(() => { if (document.body.contains(simBtn)) simBtn.click(); }, 1500 / S.run.speed);
    }
    let fingerCued = false, beltCued = false;
    const t0 = now();
    await S.run.until(() => {
      const ok = draw();
      const st = S.pico.status();
      if (!fingerCued && now() - t0 > 15000 && st.finger && goodHr < 3) { fingerCued = true; S.audio.cue('p12_finger_retry'); }
      if (!beltCued && now() - t0 > 20000 && !st.beltsInRange) { beltCued = true; S.audio.cue('p12_belt_adjust'); }
      return ok;
    }, null);
    await operatorGate('Operator: fit confirmed', 'Confirm belts and clip fit', draw);
    log('fit_confirmed');
  }

  async function calibration() {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const live = S.ui.liveHr(session.raw.hr);
      S.ui.liveStop = live.stop;
      page = S.ui.studentPage({ code: 'P13', progress: 'Task 2 of 2', lead: S.TEXT.p13_calibration, clip: 'p13_calibration', visual: task2Visual(), extraLeft: live, layout: 'stacked' });
      S.pico.setMode('calibrate');
      S.pico.setMirror(true);
      S.pico.pace('rest', 0);
      await playMain('p13_calibration');
      const w = { name: 'rest', t0: Math.round(now()), t1: null };
      await S.run.wait(T.calibrationMs, el => S.ui.setTimer(page, T.calibrationMs - el, T.calibrationMs));
      w.t1 = Math.round(now());
      S.ui.setTimer(page, null);
      const st = S.graph.stats(S.graph.windowData(session, w));
      const belts = session.raw.belts.filter(p => p.t >= w.t0);
      session.t2.calib = { hr_mean: st.mean, hr_quality: st.quality, chest_base: S.util.mean(belts.map(b => b.chest)), abd_base: S.util.mean(belts.map(b => b.abd)), attempt };
      session.raw.windows.push(w);
      live.stop();
      if (st.quality >= 0.7 || attempt === 2) {
        page.setText(S.TEXT.p13_calibration_done);
        await playSkippable('p13_calibration_done');
        return;
      }
      page.setText(S.TEXT.p12_finger_retry);
      await playMain('p12_finger_retry');
      session.raw.windows.pop();
    }
  }

  function trialPage(n, text, clip, lead = true) {
    const live = S.ui.liveHr(session.raw.hr);
    S.ui.liveStop = live.stop;
    const p = S.ui.studentPage({ code: 'P15', progress: `Task 2 of 2, breathing trial ${n} of 2`, lead: lead ? text : null, text: lead ? null : text, clip, visual: task2Visual(), extraLeft: live, layout: 'stacked' });
    p.live = live;
    return p;
  }

  async function runTrial(n, command, attempt) {
    page = trialPage(n, S.TEXT[`p15_cmd_${command}`], `p15_cmd_${command}`);
    const pace = h('div', { class: 'pace', 'aria-live': 'polite' }, h('span', { class: 'word' }, ''), h('span', { class: 'count' }, ''));
    await playMain(`p15_cmd_${command}`);
    await countdownGo();
    page.controls.prepend(pace);
    const st = S.settings.get();
    S.pico.setMode('trial');
    S.pico.setMirror(!!st.mirrorDuringTrials);
    if (S.pico.kind === 'sim') {
      const p = attempt === 1 ? Math.min(0.97, st.simSkill + 0.12) : 0.8;
      S.pico.simPerform(Math.random() < p ? command : (command === 'diaphragmatic' ? 'thoracic' : 'diaphragmatic'));
    }
    const trial = { n, command, attempt, breaths: [], valid: 0, matched: 0, pass: false, points: 0 };
    session.t2.trials.push(trial);
    const w = { name: 'trial', n, command, attempt, t0: Math.round(now()), t1: null };
    const inbox = [];
    const off = S.pico.on('breath', d => inbox.push({ ...d, recv: now() }));
    let counted = 0, extras = 0, b = 0;
    const word = pace.querySelector('.word'), count = pace.querySelector('.count');
    while (counted < 4) {
      b++;
      for (const ph of ['in', 'out']) {
        S.pico.pace(ph, T.phaseMs, { breath: b });
        markPhase(ph, n);
        if (breather) breather.pace(ph);
        S.audio.cue(ph === 'in' ? 'p15_count_in' : 'p15_count_out');
        word.textContent = ph === 'in' ? 'In' : 'Out';
        await S.run.wait(T.phaseMs, el => { count.textContent = String(Math.min(4, 1 + Math.floor(el / 1000))); });
      }
      const outEnd = now();
      S.pico.pace('gap', 0, {});
      markPhase(null);
      word.textContent = ''; count.textContent = '';
      const got = await S.run.until(() => inbox.find(x => x.n === b), T.breathWaitMs);
      const ev = got.ok ? got.value : null;
      const rec = ev
        ? { b, label: ev.label, conf: ev.conf, chest_amp: ev.chest_amp, abd_amp: ev.abd_amp, rejected: !!ev.rejected, latency_ms: ev.recv - outEnd }
        : { b, label: 'unclear', rejected: true, missing: true, latency_ms: null };
      if (ev && S.pico.kind === 'sim') { rec.gt = ev.sim_truth; rec.gt_source = 'sim'; }
      trial.breaths.push(rec);
      if (!rec.rejected) { counted++; trial.valid++; if (rec.label === command) trial.matched++; }
      else if (extras < T.maxExtraBreaths) { extras++; await playMain('p15_repeat_breath'); S.audio.setMain(`p15_cmd_${command}`); }
      else counted++;
    }
    off();
    if (breather) breather.free();
    w.t1 = Math.round(now());
    session.raw.windows.push(w);
    trial.pass = trial.matched >= 3;
    trial.points = trial.pass ? (attempt === 1 ? 2 : 1) : 0;
    const hs = S.graph.stats(S.graph.windowData(session, w));
    trial.hr_mean = hs.mean;
    trial.rsa = hs.swing;
    S.pico.setMode('idle');
    S.pico.setMirror(true);
    if (page.live) page.live.stop();
    return trial;
  }

  /* 1, 2, 3, 4, 5 on screen and in Verity's voice, then a Go button the student taps to start breathing */
  async function countdownGo() {
    const num = h('div', { class: 'countdown', 'aria-live': 'assertive' });
    page.controls.prepend(num);
    for (let i = 1; i <= 5; i++) {
      num.textContent = String(i);
      num.classList.remove('pop'); void num.offsetWidth; num.classList.add('pop');
      S.audio.cue(`p21_num_${i}`);
      await S.run.wait(1000);
    }
    let tapped = false;
    const go = h('button', { class: 'btn go', type: 'button', onclick: () => { tapped = true; } }, 'Go');
    num.replaceWith(go);
    const sim = S.pico.kind === 'sim' && S.settings.get().simAutoStudent;
    const r = await guard(S.run.until(el => tapped || (sim && el > 900), T.autoMs));
    if (!r.ok) log('auto_continue', 'Go');
    S.audio.cue('p15_go');
    go.remove();
  }

  /* Rest stays compulsory: it prevents dizziness between trials */
  async function rest(n) {
    page = trialPage(n, S.TEXT.p15_rest, 'p15_rest', false);
    S.pico.pace('rest', 0);
    await playMain('p15_rest');
    await S.run.wait(T.restMs, el => S.ui.setTimer(page, T.restMs - el, T.restMs));
    S.ui.setTimer(page, null);
    if (page.live) page.live.stop();
  }

  /* Question page: choices show at once, the 20-second timer starts when the question has been read */
  async function askQuestion(q, code, progress, title, visual, extraLeft, layout) {
    page = S.ui.studentPage({ code, progress, title, text: q.text, clip: q.clip, visual, extraLeft, layout });
    let choice = null;
    S.ui.choose(page.controls, q.options).then(v => { choice = v; });
    const start = now();
    await guard(Promise.race([playMain(q.clip), S.run.until(() => choice !== null, null)]));
    let warned = false;
    await S.run.until(el => {
      const rem = T.questionMs - el;
      S.ui.setTimer(page, rem, T.questionMs);
      if (!warned && rem <= 5000) { warned = true; S.audio.cue('p17_5s_left'); }
      return choice !== null;
    }, T.questionMs);
    S.ui.setTimer(page, null);
    if (choice === null) page.controls.querySelectorAll('.choices button').forEach(b => (b.disabled = true));
    return { choice, time_ms: now() - start };
  }

  async function graphQuestions() {
    const g = S.graph.choose(session);
    session.t2.graph = { source: g.source, reason: g.reason };
    const ans = S.graph.answers(g.st);
    session.t2.graph.answers = ans;
    const clip = g.source === 'own' ? 'p16_graph_own' : 'p16_graph_backup';
    page = S.ui.studentPage({ code: 'P16', progress: 'Task 2 of 2, graph questions', text: S.TEXT[clip], clip, visual: S.graph.panels(g), layout: 'wide' });
    playMain(clip);
    await tapNext('Next', { auto: true });
    for (let i = 0; i < S.GRAPH_QUESTIONS.length; i++) {
      const q = S.GRAPH_QUESTIONS[i];
      if (S.vision.kind === 'sim' && S.settings.get().simAutoStudent) autoAnswer(q, ans[q.id], 0.7);
      const r = await askQuestion(q, 'P17', 'Task 2 of 2, graph questions', `Question ${i + 1} of 3`, S.graph.panels(g, { compact: true }), null, 'wide');
      session.t2.answers.push({ qid: q.id, choice: r.choice, correct_answer: ans[q.id], correct: r.choice === ans[q.id], time_ms: r.time_ms, graph_source: g.source });
      await save();
    }
  }

  /* Reading: two URT-style passages, 5 minutes each. G8-G9 start at foundation, G10-G12 at intermediate.
     Doing well on passage 1 (all intermediate questions and at least one hard question correct) moves passage 2 up a level. */
  async function readingSection() {
    page = S.ui.studentPage({ code: 'P18', progress: 'Task 2 of 2, reading', lead: 'Reading passages.', text: S.TEXT.p18_reading_directions, clip: 'p18_reading_directions', visual: task2Visual() });
    playMain('p18_reading_directions');
    await tapNext('Start', { auto: true });
    const seen = (await S.store.sessions()).filter(x => x.id !== session.id && x.student.student_id === session.student.student_id)
      .flatMap(x => ((x.t2 && x.t2.reading && x.t2.reading.passages) || []).map(r => r.id));
    const R = { passages: [], raw: 0, max_path: 0, path: [], moved_up: false };
    session.t2.reading = R;
    let level = S.reading.startLevel(session.student.grade);
    const avoid = [...seen];
    for (let n = 1; n <= 2; n++) {
      const p = S.reading.pick('test', level, avoid);
      avoid.push(p.id);
      const article = h('div'), slot = h('div');
      page = S.ui.studentPage({ code: 'P19', progress: `Task 2 of 2, reading passage ${n} of 2 (${S.reading.LEVEL_NAME[level]})`, text: S.TEXT.p19_passage, clip: 'p19_passage', extraLeft: article, visual: slot });
      page.stage.classList.add('reading');
      page.article = article;
      page.visualSlot = slot;
      playMain('p19_passage');
      const r = await S.reading.runPassage(p, { page, ms: T.passageMs, onWarn: () => S.audio.cue('p19_1min_left'), guard });
      if (r.ended === 'timeout') await playMain('p19_time_up');
      const well = S.reading.doingWell(p, r.answers);
      R.passages.push({ n, id: p.id, level, points: S.reading.points(p, r.answers), max: S.reading.maxPoints(p), well, ended: r.ended, time_ms: r.time_ms, answers: r.answers });
      R.path.push(level);
      level = S.reading.nextLevel(level, well);
      await save();
    }
    R.raw = R.passages.reduce((t, x) => t + x.points, 0);
    R.max_path = R.passages.reduce((t, x) => t + x.max, 0);
    R.moved_up = R.path[1] !== R.path[0];
    await save();
  }

  /* Simulator: the pretend student taps an answer after a few seconds */
  function autoAnswer(q, right, p) {
    const pick = Math.random() < p ? right : q.options.map(o => o[0]).filter(v => v !== right)[0];
    const wait = (3000 + Math.random() * 6000) / S.run.speed + 600;
    setTimeout(() => {
      const btns = Array.from(document.querySelectorAll('.choices button'));
      const idx = q.options.findIndex(o => o[0] === pick);
      if (btns[idx] && !btns[idx].disabled) btns[idx].click();
    }, wait);
  }

  /* ---------- Results ---------- */
  async function pResults() {
    session.scores = S.score(session);
    const sc = session.scores;
    const own = session.t2.graph && session.t2.graph.source === 'own' ? S.graph.choose(session) : null;
    page = S.ui.studentPage({ code: 'P21', lead: S.TEXT.p21_results_intro, clip: 'p21_results_intro',
      visual: own && own.source === 'own' ? h('div', null, h('h2', { class: 'sub' }, 'Your heart rate and breathing'), S.graph.panels(own)) : null });
    page.controls.appendChild(S.report.summary(session));
    await playMain('p21_results_intro');
    await S.audio.sayScore(sc.total, sc.label_clip);
    await save();
    await tapNext('Finish', { auto: true });
  }

  async function pThanks() {
    page = S.ui.studentPage({ code: 'P22', lead: S.TEXT.p22_thank_you, clip: 'p22_thank_you', center: true, verity: 'big' });
    playMain('p22_thank_you');
    await operatorGate('Operator: end session', 'End session');
    return new Promise(resolve => {
      const note = h('textarea', { rows: 3, placeholder: 'Optional note' });
      const m = S.ui.modal(h('div', null, h('h2', null, 'How did this session go?'),
        h('label', { class: 'field' }, h('span', null, 'Note'), note),
        h('div', { class: 'row end' },
          h('button', { class: 'btn', type: 'button', onclick: () => { m.close(); resolve({ status: 'problem', note: note.value.trim() }); } }, 'Had a problem'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => { m.close(); resolve({ status: 'completed', note: note.value.trim() }); } }, 'Completed normally'))));
    });
  }

  return { start, operatorMenu, get session() { return session; } };
})();

/* The score summary used on the results page and in History */
S.report = {
  summary(session) {
    const { h } = S.util;
    const sc = session.scores || S.score(session);
    const trialsOk = new Set((session.t2.trials || []).filter(t => t.pass).map(t => t.n)).size;
    const graphOk = (session.t2.answers || []).filter(a => a.qid.startsWith('B') && a.correct).length;
    const rd = session.t2.reading || { passages: [] };
    const readOk = rd.passages.reduce((t, x) => t + x.answers.filter(a => a.correct).length, 0);
    const levels = rd.passages.map(x => S.reading.LEVEL_NAME[x.level]).join(', then ');
    return h('div', { class: 'results' },
      h('div', { class: 'total' }, h('span', { class: 'big' }, String(sc.total)), h('span', { class: 'of' }, 'out of 10'), h('span', { class: 'label' }, sc.label)),
      h('dl', { class: 'breakdown' },
        h('dt', null, 'Anatomy'), h('dd', null, `${sc.anatomy} out of 5`),
        h('dt', null, 'Highest level reached'), h('dd', null, `Level ${session.t1.highest_level}`),
        h('dt', null, 'Breathing'), h('dd', null, `${sc.breathing} out of 5`),
        h('dt', null, 'Breathing control'), h('dd', null, `${trialsOk} of 2 trials correct`),
        h('dt', null, 'Physiology understanding'), h('dd', null, `${graphOk} of 3 graph questions correct`),
        h('dt', null, 'Reading'), h('dd', null, rd.passages.length ? `${readOk} of ${rd.passages.length * 5} correct (${levels})` : 'Not taken')));
  }
};
