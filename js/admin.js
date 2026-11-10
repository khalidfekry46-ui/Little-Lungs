/* App pages: sign-in, student Home and History, station check, and Management (overview, review, statistics, board photos, settings). */
window.S = window.S || {};

S.admin = (() => {
  const { h, s, pct, fmt, toCSV, download } = S.util;
  const A = () => S.analysis;

  /* ---------- Frames ----------
     Student side: Home, History. Management (6-digit PIN) holds Overview, Review, Statistics, Board photos, Settings. */
  let manageOpen = false;

  function fullscreenButton() {
    const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
    const label = () => (fsEl() ? 'Exit full screen' : 'Full screen');
    const b = h('button', { type: 'button', class: 'btn small', onclick: async () => {
      try {
        if (fsEl()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else await (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement);
      } catch (e) { S.ui.toast('This browser blocked full screen. Use "Add to Home screen" to open the app full screen.'); }
      setTimeout(() => { b.textContent = label(); }, 300);
    } }, label());
    return b;
  }

  function mainFrame(active, content) {
    const tabs = [['home', 'Home', () => { manageOpen = false; home(); }], ['prep', 'Prep', () => { manageOpen = false; S.prep.open(); }], ['history', 'History', () => { manageOpen = false; history(); }], ['manage', 'Management', openManagement]];
    const el = h('div', { class: 'op' },
      h('header', { class: 'opbar' },
        h('div', { class: 'opbrand' }, h('strong', null, 'Little Lungs'), h('span', { class: 'muted' }, 'Smart Anatomy Test')),
        h('nav', { class: 'opnav', 'aria-label': 'Main' }, tabs.map(([k, label, fn]) => h('button', { type: 'button', class: k === active ? 'on' : '', 'aria-current': k === active ? 'page' : null, onclick: fn }, label))),
        h('div', { class: 'modes' }, fullscreenButton(), h('button', { type: 'button', class: 'btn small', onclick: () => { manageOpen = false; lock(); } }, 'Lock'))),
      content);
    const r = S.ui.root();
    r.replaceChildren(el);
    r.dataset.view = 'operator';
    if (S.ui.simPanel.el) { S.ui.simPanel.el.remove(); S.ui.simPanel.el = null; }
    window.scrollTo(0, 0);
    return el;
  }

  /* Management pages share a second row of tabs */
  function frame(title, content, active) {
    const nav = [['overview', 'Overview', overview], ['review', 'Review', reviewList], ['stats', 'Statistics', stats], ['photos', 'Board photos', photos], ['settings', 'Settings', settings]];
    const st = S.settings.get();
    const modes = [st.picoMode === 'sim' ? 'Pico: simulator' : 'Pico: live', st.visionMode === 'sim' ? 'Camera AI: simulator' : 'Camera AI: live'];
    return mainFrame('manage', h('div', null,
      h('div', { class: 'subbar' },
        h('nav', { class: 'opnav sub', 'aria-label': 'Management' }, nav.map(([k, label, fn]) => h('button', { type: 'button', class: k === active ? 'on' : '', 'aria-current': k === active ? 'page' : null, onclick: () => fn() }, label))),
        h('div', { class: 'modes' }, modes.map(m => h('span', { class: m.includes('simulator') ? 'mode sim' : 'mode live' }, m)))),
      h('main', { class: 'opmain' }, h('h1', null, title), content)));
  }

  async function openManagement() {
    if (!manageOpen) {
      if (!S.ui.pinSaved('manage')) {
        S.ui.toast('First time: choose the 6-digit Management PIN.');
        if (!(await S.ui.setupPin(true, 'manage'))) return;
      } else if (!(await S.ui.askManagePin('Management'))) return;
      manageOpen = true;
    }
    overview();
  }

  /* ---------- Sign-in ---------- */
  async function lock() {
    const r = S.ui.root();
    r.dataset.view = 'lock';
    const go = async () => { S.audio.unlock(); if (await S.ui.askPin('Unlock Little Lungs')) home(); };
    if (S.prep) S.prep.clear();
    r.replaceChildren(h('div', { class: 'lock' },
      S.art.verity('big'),
      h('h1', null, 'Little Lungs'),
      h('p', null, 'Smart Anatomy Test. Anatomy assembly and breathing for G8 to G12 students.'),
      S.ui.button('Unlock with operator PIN', go)));
  }

  /* ---------- Student home ---------- */
  function home(message) {
    manageOpen = false;
    const content = h('div', { class: 'shome' },
      h('section', { class: 'hero' },
        message ? h('p', { class: 'notice' }, message) : null,
        S.art.homeScene(),
        h('h1', null, 'Little Lungs'),
        h('p', { class: 'tag' }, 'Smart Anatomy Test'),
        h('button', { class: 'btn primary huge', type: 'button', onclick: () => stationCheck() }, 'Start the test'),
        h('p', { class: 'muted small' }, 'The operator runs a quick station check first.')),
      h('section', { class: 'about' },
        h('h2', null, 'About the test'),
        h('p', null, 'Little Lungs checks what you know about the chest and how you breathe. Verity, the pink assistant, reads every instruction aloud. Tap her or the Replay button to hear it again.'),
        h('div', { class: 'facts-grid' },
          h('div', null, h('h3', null, 'Task 1: Anatomy assembly'), h('p', null, 'Place the heart, windpipe, diaphragm and both lungs on the board, one at a time. The questions get harder as you answer correctly. A camera with artificial intelligence checks each piece.')),
          h('div', null, h('h3', null, 'Task 2: Breathing and heart rate'), h('p', null, 'Wear two stretch belts and a finger clip. Breathe the way you are asked, then read your own heart-rate graph and answer questions about breathing.')),
          h('div', null, h('h3', null, 'Your score'), h('p', null, 'Each task is scored out of 5, for a total out of 10. You can find your past results under History.')),
          h('div', null, h('h3', null, 'Time and safety'), h('p', null, 'About 22 minutes. If you feel dizzy during the breathing task, stop and tell the operator.')))),
      h('section', { class: 'about' },
        h('h2', null, 'Contact the project team'),
        h('p', null, 'Questions about Little Lungs or the capstone project:'),
        h('p', null, h('a', { href: `mailto:${S.CONTACT_EMAIL}`, class: 'mail' }, S.CONTACT_EMAIL))));
    mainFrame('home', content);
  }

  /* ---------- History: a student finds their own results ---------- */
  async function history() {
    const box = h('div');
    mainFrame('history', h('main', { class: 'opmain' }, box));
    const r = await S.accounts.signIn(box, { title: 'History', text: 'See your past tests and practice on this tablet. Sign in with your student ID and password.' });
    if (!r) return;
    historyList(r);
  }

  async function historyList(who) {
    const list = (await S.store.sessions()).filter(x => x.end && !x.demo && x.student && x.student.student_id === who.student_id);
    const preps = ((await S.store.all('prep')) || []).filter(r => r.student_key === who.key && r.finished_at && !r.demo).sort((x, y) => y.finished_at.localeCompare(x.finished_at));
    const back = () => historyList(who);
    mainFrame('history', h('main', { class: 'opmain' },
      h('div', { class: 'row wrap between' }, h('h1', null, 'History'), h('button', { class: 'btn', type: 'button', onclick: () => history() }, 'Sign out')),
      h('p', { class: 'muted' }, `Student ID ${who.student_id}`),
      h('h2', null, 'Tests'),
      list.length ? h('div', { class: 'tablewrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, ['Date', 'Total', 'Result', 'Anatomy', 'Breathing', ''].map(x => h('th', null, x)))),
        h('tbody', null, list.map(x => { const sc = x.scores || S.score(x); return h('tr', null,
          h('td', null, new Date(x.started_at).toLocaleString()), h('td', { class: 'num' }, `${sc.total} / 10`), h('td', null, sc.label),
          h('td', { class: 'num' }, `${sc.anatomy} / 5`), h('td', { class: 'num' }, `${sc.breathing} / 5`),
          h('td', null, h('button', { class: 'btn small', type: 'button', onclick: () => historyReport(x, back) }, 'View report'))); })))) : h('p', { class: 'muted' }, 'No tests on this tablet yet.'),
      h('h2', null, 'Prep practice'),
      preps.length ? h('div', { class: 'tablewrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, ['Date', 'Passage', 'Level', 'Score'].map(x => h('th', null, x)))),
        h('tbody', null, preps.map(r => h('tr', null, h('td', null, new Date(r.finished_at).toLocaleString()), h('td', null, (S.reading.byId(r.passage_id) || {}).title || r.passage_id),
          h('td', null, S.reading.LEVEL_NAME[r.level]), h('td', { class: 'num' }, `${r.score} / 5`)))))) : h('p', { class: 'muted' }, 'No practice yet. Try the Prep tab.')));
  }

  function historyReport(x, back) {
    const g = x.raw && x.raw.windows && x.raw.windows.length ? S.graph.choose(x) : null;
    const rd = (x.t2.reading && x.t2.reading.passages) || [];
    const readRows = rd.flatMap(pp => { const P = S.reading.byId(pp.id); return pp.answers.map(a => [`${P ? P.title : pp.id}, Q${a.q}`, a.choice == null ? 'No answer' : S.reading.LETTERS[a.choice], P ? S.reading.LETTERS[P.questions[a.q - 1].a] : '', a.correct ? 'Correct' : 'Wrong']); });
    const answers = (x.t2.answers || []).filter(a => String(a.qid).startsWith('B')).map(a => {
      const q = S.GRAPH_QUESTIONS.find(qq => qq.id === a.qid);
      const label = v => (q ? (q.options.find(o => o[0] === v) || [, v || 'No answer'])[1] : v);
      return [a.qid, label(a.choice), label(a.correct_answer), a.correct ? 'Correct' : 'Wrong'];
    });
    mainFrame('history', h('main', { class: 'opmain' },
      h('h1', null, `Report for ${x.student.name}`),
      h('p', { class: 'muted' }, `${x.student.grade}, ${new Date(x.started_at).toLocaleString()}`),
      S.report.summary(x),
      h('section', null, h('h2', null, 'Task 1 pieces'), h('div', { class: 'tablewrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, ['Piece', 'Organ', 'Level', 'Result', 'Points'].map(c => h('th', null, c)))),
        h('tbody', null, x.t1.items.map(it => h('tr', null, h('td', null, it.n), h('td', null, S.ORGAN_NAME[it.organ]), h('td', null, it.level),
          h('td', null, { first: 'Correct first try', hint: 'Correct after hint', wrong: 'Wrong', timeout: 'Time ran out' }[it.result] || it.result), h('td', { class: 'num' }, it.points))))))),
      h('section', null, h('h2', null, 'Task 2 answers'), h('div', { class: 'tablewrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, ['Question', 'Your answer', 'Correct answer', 'Result'].map(c => h('th', null, c)))),
        h('tbody', null, [...answers, ...readRows].map(r => h('tr', null, r.map(c => h('td', null, c)))))))),
      g ? h('section', null, h('h2', null, g.source === 'own' ? 'Your heart rate and breathing' : 'Sample graph used in your test'), S.graph.panels(g)) : null,
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => (back ? back() : history()) }, 'Back to History'))));
  }

  /* ---------- Management overview ---------- */
  async function overview() {
    const list = await S.store.sessions();
    const real = list.filter(x => !x.demo);
    const pending = await S.sync.pendingCount();
    const needGt = real.filter(x => x.end && S.isSimulated(x) === false).filter(x => { const r = S.reviewStatus(x); return r.placements[0] < r.placements[1] || r.breaths[0] < r.breaths[1] || !r.hr; }).length;
    const st = S.settings.get();
    const syncMsg = h('span', { class: 'muted' });
    const content = h('div', { class: 'home' },
      h('section', null,
        h('h2', null, 'On this tablet'),
        h('p', { class: 'muted' }, `${st.deviceLabel} (${st.deviceCode})`),
        h('dl', { class: 'facts' },
          h('dt', null, 'Sessions saved'), h('dd', null, String(real.length)),
          h('dt', null, 'Waiting to upload'), h('dd', null, String(pending)),
          h('dt', null, 'Waiting for ground truth'), h('dd', null, String(needGt)),
          h('dt', null, 'Practice (demo) sessions'), h('dd', null, String(list.length - real.length))),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn', type: 'button', onclick: async () => {
            if (!st.syncUrl) { syncMsg.textContent = 'Add the cloud link in Settings first.'; return; }
            syncMsg.textContent = 'Uploading...';
            const r = await S.sync.all();
            syncMsg.textContent = r.fail ? `${r.ok} uploaded, ${r.fail} still waiting. Check the internet connection.` : `${r.ok} uploaded. Everything is in the Sheet.`;
          } }, 'Upload results now'),
          h('a', { class: 'btn', href: 'recorder-sheet.html', target: '_blank', rel: 'noopener' }, 'Print recorder sheet'),
          syncMsg)),
      h('section', null,
        h('h2', null, 'Camera check'),
        h('p', { class: 'muted' }, 'Give the app camera access and check the picture on this device.'),
        S.camera.panel({ compact: true })),
      (st.picoMode === 'sim' || st.visionMode === 'sim') ? h('section', { class: 'simnote' },
        h('h2', null, 'Simulator mode is on'),
        h('p', null, 'Parts without hardware are simulated, so you can rehearse the whole test now. Sessions run in this mode are marked simulated and are left out of statistics. Switch each part to live in Settings when the Pico and the trained model are ready.')) : null);
    frame('Overview', content, 'overview');
  }

  /* ---------- Station self-check ---------- */
  async function stationCheck() {
    const listEl = h('ul', { class: 'checks-list' });
    const statusEl = h('div', { class: 'status' });
    const actions = h('div', { class: 'row' });
    mainFrame('home', h('main', { class: 'opmain' }, h('h1', null, 'Station check'), h('p', null, 'Operator: make sure the board is empty and the belts and finger clip are off.'), statusEl, listEl, actions));
    const checks = [];
    const add = (id, label, result, detail) => {
      checks.push({ id, label, result, detail });
      listEl.appendChild(h('li', { class: result }, h('span', { class: 'dot', 'aria-hidden': 'true' }), h('strong', null, label), h('span', { class: 'muted' }, detail || ''), h('span', { class: 'res' }, result === 'pass' ? 'Pass' : result === 'warn' ? 'Warning' : 'Fail')));
    };
    statusEl.textContent = 'Checking...';

    /* Tablet */
    try {
      if (navigator.getBattery) {
        const b = await navigator.getBattery();
        const lv = b.level;
        add('battery', 'Battery', b.charging || lv >= 0.3 ? 'pass' : lv >= 0.15 ? 'warn' : 'fail', `${Math.round(lv * 100)}%${b.charging ? ', charging' : ''}`);
      } else add('battery', 'Battery', 'warn', 'This browser cannot read the battery. Check it is above 30%.');
    } catch (e) { add('battery', 'Battery', 'warn', 'Could not read the battery.'); }
    try {
      const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
      if (est) { const free = (est.quota - est.usage) / 1e6; add('storage', 'Free storage for logs', free > 50 ? 'pass' : free > 5 ? 'warn' : 'fail', `${Math.round(free)} MB free`); }
      else add('storage', 'Free storage for logs', 'warn', 'Could not check storage.');
    } catch (e) { add('storage', 'Free storage for logs', 'warn', 'Could not check storage.'); }

    /* Camera and model */
    S.makeVision();
    statusEl.textContent = 'Checking the camera. If the browser asks, choose Allow.';
    const cam = await S.camera.test(S.settings.get().cameraFacing || 'environment');
    if (cam.ok) {
      const pv = h('div', { class: 'camera small' }, cam.video);
      listEl.before(pv);
      const sees = S.vision.kind === 'sim' ? true : await S.ui.confirmBox('Can you see the whole board in the camera preview?', 'All 4 black corner markers should be inside the picture.', 'Yes', 'No');
      S.camera.stop();
      pv.remove();
      add('camera', 'Camera', sees ? 'pass' : 'fail', sees ? cam.message : 'Move the tablet or stand until the whole board is in view.');
      if (S.vision.kind !== 'sim' && !(await S.vision.start())) add('camera2', 'Camera for the AI', 'fail', S.vision.error || 'The camera did not start.');
    } else add('camera', 'Camera', S.vision.kind === 'sim' ? 'warn' : 'fail', cam.message + (S.vision.kind === 'sim' ? ' (Simulator mode does not need it.)' : ''));
    const self = await S.vision.selfTest();
    add('model', 'AI model on reference photos', self.ok ? 'pass' : 'fail', self.detail);
    const view = await S.vision.boardView();
    add('markers', 'All 4 corner markers, tilt and distance', view.markers === 4 && view.tilt === 'ok' ? 'pass' : 'fail', view.detail || `${view.markers} of 4 markers found`);
    add('light', 'Lighting', view.light === 'ok' ? 'pass' : view.light === 'borderline' ? 'warn' : 'fail', view.light === 'ok' ? 'Good' : (view.detail || 'Not checked'));
    const o = S.vision.read();
    if (o.ready) {
      const busy = S.ORGANS.filter(z => o.zones[z] && o.zones[z].cls !== 'empty');
      add('empty', 'Board empty', busy.length ? 'fail' : 'pass', busy.length ? `Pieces found on: ${busy.map(z => S.ORGAN_NAME[z]).join(', ')}` : 'All 5 zones empty');
    } else add('empty', 'Board empty', 'fail', 'The camera AI is not ready');

    /* Pico */
    S.makePico();
    const connected = await S.pico.connect();
    const pong = connected ? await S.pico.ping() : null;
    add('pico', 'Pico W connection', pong ? (pong.rtt > 400 ? 'warn' : 'pass') : 'fail', pong ? `Firmware ${pong.fw}, ${Math.round(pong.rtt)} ms reply` : `No reply from ${S.settings.get().picoUrl}`);
    const ps = S.pico.status();
    add('hr', 'Heart sensor', !pong ? 'fail' : !ps.hrSensor ? 'fail' : ps.finger ? 'fail' : 'pass', !pong ? 'Pico not connected' : ps.finger ? 'Finger detected while idle. Remove the clip or check the sensor.' : 'Responds, no finger detected');

    /* Cloud */
    const st = S.settings.get();
    add('cloud', 'Cloud upload', st.syncUrl && navigator.onLine ? 'pass' : 'warn', !st.syncUrl ? 'No cloud link set. Results are saved here and can upload later.' : navigator.onLine ? 'Online' : 'Offline. Results will upload later.');

    /* Sound */
    statusEl.textContent = 'Playing the sound check...';
    S.audio.unlock();
    await new Promise(r => { const a = new Audio('audio/p00_sound_check.mp3'); a.onended = r; a.onerror = r; a.play().catch(r); });
    const heard = await S.ui.confirmBox('Did you hear the sound check clearly?', S.TEXT.p00_sound_check, 'Yes, heard it', 'No');
    add('sound', 'Sound check', heard ? 'pass' : 'fail', heard ? 'Operator heard the test sound' : 'Turn the volume up and check again');

    const status = checks.some(c => c.result === 'fail') ? 'red' : checks.some(c => c.result === 'warn') ? 'yellow' : 'green';
    const result = { status, checks, at: new Date().toISOString() };
    statusEl.className = `status ${status}`;
    statusEl.textContent = status === 'green' ? 'Green: ready to start.' : status === 'yellow' ? 'Yellow: you can start, but check the warnings.' : 'Red: fix the failed checks before starting.';
    actions.replaceChildren(
      h('button', { class: 'btn', type: 'button', onclick: () => home() }, 'Back'),
      h('button', { class: 'btn', type: 'button', onclick: stationCheck }, 'Run the check again'),
      h('button', { class: 'btn primary', type: 'button', disabled: status === 'red', onclick: () => S.test.start(result) }, 'Start the session'));
    try { localStorage.setItem('anatomy-station-last-check', JSON.stringify(result)); } catch (e) { /* ignore */ }
  }

  /* ---------- Ground-truth review ---------- */
  async function reviewList() {
    const list = (await S.store.sessions()).filter(x => x.end);
    const rows = list.map(x => {
      const r = S.reviewStatus(x);
      return h('tr', null,
        h('td', null, x.student.code), h('td', null, x.student.grade || ''), h('td', null, new Date(x.started_at).toLocaleString()),
        h('td', null, x.end.status === 'completed' ? 'Completed' : x.end.status === 'aborted' ? 'Ended early' : 'Had a problem'),
        h('td', { class: 'num' }, `${r.placements[0]}/${r.placements[1]}`), h('td', { class: 'num' }, `${r.breaths[0]}/${r.breaths[1]}`), h('td', null, r.hr ? 'Entered' : 'Missing'),
        h('td', null, x.demo ? 'Demo' : S.isSimulated(x) ? 'Simulated' : 'Live'),
        h('td', null, x.demo ? 'Not uploaded' : x.sync.synced_at ? 'Uploaded' : (x.sync.error || 'Waiting')),
        h('td', null, h('div', { class: 'row' },
          h('button', { class: 'btn small', type: 'button', onclick: () => reviewSession(x.id) }, 'Review'),
          h('button', { class: 'btn small danger', type: 'button', 'aria-label': `Delete session ${x.student.code}`, onclick: async () => {
            const up = !!x.sync.synced_at;
            if (!(await S.ui.confirmBox(`Delete session ${x.student.code}?`, `${x.student.name || 'This student'}, ${new Date(x.started_at).toLocaleString()}. It is removed from this tablet${up ? ' and from the Google Sheet' : ''}. This cannot be undone.`, 'Delete', 'Keep'))) return;
            await S.store.del('sessions', x.id);
            if (up) S.sync.remove(x.id).catch(() => {});
            S.ui.toast(`Session ${x.student.code} deleted`);
            reviewList();
          } }, 'Delete'))));
    });
    frame('Review sessions', h('div', null,
      h('p', null, 'Enter what the recorder wrote on the paper sheet. The AI results stay hidden until you have entered yours, so they cannot influence the ground truth.'),
      list.length ? h('div', { class: 'tablewrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, ['Student', 'Grade', 'Started', 'Ended', 'Placements entered', 'Breaths entered', 'Oximeter', 'Mode', 'Cloud', 'Actions'].map(t => h('th', null, t)))),
        h('tbody', null, rows))) : h('p', { class: 'empty' }, 'No finished sessions yet. Start a session from Home.')), 'review');
  }

  function seg(options, value, onChange) {
    const wrap = h('div', { class: 'seg small', role: 'radiogroup' });
    options.forEach(([v, label]) => {
      const b = h('button', { type: 'button', class: v === value ? 'on' : '', 'aria-pressed': v === value ? 'true' : 'false', onclick: () => { wrap.querySelectorAll('button').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); onChange(v); } }, label);
      wrap.appendChild(b);
    });
    return wrap;
  }

  async function reviewSession(id) {
    const x = await S.store.get('sessions', id);
    if (!x) return reviewList();
    let reveal = false;
    const aiCells = [];
    const aiCell = text => { const td = h('td', { class: 'ai hidden' }, text); aiCells.push(td); return td; };
    const srcNote = o => (o.gt_source === 'sim' ? h('span', { class: 'muted small' }, ' simulated') : null);
    const setGt = (o, v) => { o.gt = v; o.gt_source = 'recorder'; };

    const plRows = [];
    x.t1.items.forEach(it => it.attempts.forEach(a => {
      if (a.ai_verdict === 'timeout') { plRows.push(h('tr', null, h('td', null, `Piece ${it.n}`), h('td', null, S.ORGAN_NAME[it.organ]), h('td', null, `Level ${it.level}`), h('td', null, a.a === 1 ? 'First try' : 'After hint'), h('td', { colspan: 2 }, 'Time ran out, nothing to check'))); return; }
      plRows.push(h('tr', null, h('td', null, `Piece ${it.n}`), h('td', null, S.ORGAN_NAME[it.organ]), h('td', null, `Level ${it.level}`), h('td', null, a.a === 1 ? 'First try' : 'After hint'),
        h('td', null, seg([['correct', 'Correct'], ['wrong', 'Wrong']], a.gt_source === 'recorder' ? a.gt : (a.gt_source === 'sim' ? a.gt : null), v => setGt(a, v)), srcNote(a)),
        aiCell(`${a.ai_verdict}${a.error ? ', ' + a.error.replace(/_/g, ' ') : ''}`)));
    }));
    if (x.t1.build) x.t1.build.pieces.forEach(p => plRows.push(h('tr', null, h('td', null, 'Full build'), h('td', null, S.ORGAN_NAME[p.organ]), h('td', null, ''), h('td', null, ''),
      h('td', null, seg([['correct', 'Correct'], ['wrong', 'Wrong']], p.gt || null, v => setGt(p, v)), srcNote(p)), aiCell(p.ai_verdict))));

    const brRows = [];
    x.t2.trials.forEach(t => t.breaths.forEach(b => {
      if (b.missing) { brRows.push(h('tr', null, h('td', null, `Trial ${t.n}`), h('td', null, t.command), h('td', null, t.attempt === 1 ? 'First try' : 'Retry'), h('td', null, `Breath ${b.b}`), h('td', { colspan: 2 }, 'No signal from the Pico'))); return; }
      brRows.push(h('tr', null, h('td', null, `Trial ${t.n}`), h('td', null, t.command === 'diaphragmatic' ? 'Diaphragmatic' : 'Thoracic'), h('td', null, t.attempt === 1 ? 'First try' : 'Retry'), h('td', null, `Breath ${b.b}`),
        h('td', null, seg([['diaphragmatic', 'Diaphragmatic'], ['thoracic', 'Thoracic'], ['unclear', 'Unclear']], b.gt || null, v => setGt(b, v)), srcNote(b)),
        aiCell(`${b.label}${b.rejected ? ', rejected' : ''}`)));
    }));

    const hrIn = h('input', { type: 'number', min: 30, max: 220, value: x.review.hr_ref_bpm ?? '', inputmode: 'numeric' });
    const valid = h('input', { type: 'checkbox' });
    valid.checked = x.review.valid !== false;
    const reason = h('input', { type: 'text', value: x.review.exclude_reason || '', placeholder: 'Reason, if excluded' });
    const picoHr = h('span', { class: 'ai hidden' }, x.t2.calib && x.t2.calib.hr_mean ? `Pico resting heart rate: ${fmt(x.t2.calib.hr_mean)} bpm` : 'No Pico reading');
    aiCells.push(picoHr);
    const msg = h('span', { class: 'muted' });

    const saveBtn = S.ui.button('Save ground truth', async () => {
      x.review.hr_ref_bpm = hrIn.value === '' ? null : Number(hrIn.value);
      x.review.valid = valid.checked;
      x.review.exclude_reason = reason.value.trim();
      x.review.at = new Date().toISOString();
      const r = S.reviewStatus(x);
      x.review.placements_done = r.placements[0] === r.placements[1];
      x.review.breaths_done = r.breaths[0] === r.breaths[1];
      await S.store.saveSession(x);
      msg.textContent = 'Saved.';
      const up = await S.sync.session(x);
      msg.textContent = x.demo ? 'Saved. Demo sessions are never uploaded.' : up ? 'Saved and uploaded to the Sheet.' : `Saved here. ${x.sync.error || 'Upload will retry later.'}`;
    });
    const revealBtn = h('button', { class: 'btn', type: 'button', onclick: () => { reveal = !reveal; aiCells.forEach(c => c.classList.toggle('hidden', !reveal)); revealBtn.textContent = reveal ? 'Hide AI results' : 'Show AI results'; } }, 'Show AI results');
    const st = x.scores || S.score(x);
    frame(`Review ${x.student.code}`, h('div', { class: 'review' },
      h('p', null, `${x.student.grade}, started ${new Date(x.started_at).toLocaleString()} on ${x.device.label}. Score ${st.total} out of 10. ${x.end.note ? 'Note: ' + x.end.note : ''}`),
      h('section', null, h('h2', null, 'Task 1 placements'), h('p', { class: 'muted' }, 'Was the piece really placed correctly? Use what the recorder saw, not the screen.'),
        h('div', { class: 'tablewrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, ['Item', 'Organ asked', 'Level', 'Attempt', 'Recorder', 'AI'].map(t => h('th', null, t)))), h('tbody', null, plRows)))),
      h('section', null, h('h2', null, 'Task 2 breaths'), h('p', { class: 'muted' }, 'Which type of breathing did the student really do on each breath?'),
        h('div', { class: 'tablewrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, ['Trial', 'Command', 'Attempt', 'Breath', 'Recorder', 'AI'].map(t => h('th', null, t)))), h('tbody', null, brRows.length ? brRows : h('tr', null, h('td', { colspan: 6 }, 'No breathing trials in this session.')))))),
      h('section', null, h('h2', null, 'Heart rate reference'),
        h('label', { class: 'field inline' }, h('span', null, 'Pulse oximeter reading at the end of calibration (beats per minute)'), hrIn), picoHr),
      h('section', null, h('h2', null, 'Use in statistics'),
        h('label', { class: 'check' }, valid, h('span', null, 'Include this session in statistics')), h('label', { class: 'field' }, h('span', null, 'Reason for excluding'), reason)),
      h('div', { class: 'row wrap sticky' }, saveBtn, revealBtn,
        h('button', { class: 'btn', type: 'button', onclick: () => download(`${x.student.code}_${x.id}_raw.json`, JSON.stringify({ id: x.id, student_code: x.student.code, device: x.device, windows: x.raw.windows, phases: x.raw.phases, hr: x.raw.hr, belts: x.raw.belts }), 'application/json') }, 'Download raw signals'),
        h('button', { class: 'btn', type: 'button', onclick: reviewList }, 'Back to the list'), msg)), 'review');
  }

  /* ---------- Statistics ---------- */
  let statsSource = 'local';
  let includeSim = false;
  let lastTables = null;

  async function stats() {
    const body = h('div', { class: 'stats' });
    const srcSel = seg([['local', 'This tablet'], ['cloud', 'Google Sheet (all devices)']], statsSource, v => { statsSource = v; stats(); });
    const simBox = h('input', { type: 'checkbox' });
    simBox.checked = includeSim;
    simBox.addEventListener('change', () => { includeSim = simBox.checked; stats(); });
    frame('Statistics', h('div', null,
      h('div', { class: 'toolbar' }, srcSel, h('label', { class: 'check' }, simBox, h('span', null, 'Include simulated and demo sessions')),
        h('button', { class: 'btn small', type: 'button', onclick: async () => { await S.demo.generate(25); S.ui.toast('25 demo sessions added'); stats(); } }, 'Add 25 demo sessions'),
        h('button', { class: 'btn small', type: 'button', onclick: async () => { const n = await S.demo.clear(); S.ui.toast(`${n} demo sessions removed`); stats(); } }, 'Remove demo sessions')),
      body), 'stats');
    body.textContent = 'Loading...';
    let tables, syncInfo;
    try {
      if (statsSource === 'cloud') {
        tables = await S.sync.exportAll();
        const ids = (tables.Sessions || []).map(r => r.session_id);
        syncInfo = { mode: 'cloud', rows: ids.length, dupes: ids.length - new Set(ids).size };
      } else {
        const list = (await S.store.sessions()).filter(x => x.end);
        tables = S.flattenAll(list);
        tables.Prep = ((await S.store.all('prep')) || []).filter(r => r.finished_at).flatMap(r => S.flattenPrep(r).Prep);
        const eligible = list.filter(x => !x.demo && x.end);
        syncInfo = { mode: 'local', eligible: eligible.length, synced: eligible.filter(x => x.sync.synced_at).length };
      }
    } catch (e) {
      body.replaceChildren(h('p', { class: 'error' }, `Could not load data from the Google Sheet: ${e.message}. Check the cloud link and sync key in Settings, and the internet connection.`));
      return;
    }
    lastTables = tables;
    const m = A().compute(tables, { includeSimulated: includeSim });
    const r4 = m.reqs.find(r => r.id === 'R4');
    if (syncInfo.mode === 'local') { r4.show = `${syncInfo.synced} of ${syncInfo.eligible} sessions uploaded`; r4.met = syncInfo.eligible ? syncInfo.synced === syncInfo.eligible : null; r4.n = syncInfo.eligible; }
    else { r4.show = `${syncInfo.rows} sessions in the Sheet, ${syncInfo.dupes} duplicates`; r4.met = syncInfo.rows ? syncInfo.dupes === 0 : null; r4.n = syncInfo.rows; }
    body.replaceChildren(renderStats(m));
  }

  function propText(p) { return p.n ? `${pct(p.p)} (${p.k} of ${p.n})` : 'No data'; }
  function table(head, rows, cls = 'data') {
    return h('div', { class: 'tablewrap' }, h('table', { class: cls }, h('thead', null, h('tr', null, head.map(t => h('th', null, t)))), h('tbody', null, rows.map(r => h('tr', null, r.map((c, i) => h('td', { class: i > 0 && /^[\d.\-]/.test(String(c)) ? 'num' : null }, c)))))));
  }

  /* Bars for one measure across categories; hover any bar for its value */
  function barChart(items, { title, unit = '', max, height = 200, fmtV = v => String(v) } = {}) {
    const W = 640, pad = { l: 40, r: 12, t: 28, b: 30 };
    const iw = W - pad.l - pad.r, ih = height - pad.t - pad.b;
    const top = max || Math.max(1, ...items.map(i => i.v || 0));
    const bw = iw / items.length;
    const Y = v => pad.t + ih - (v / top) * ih;
    const ticks = [0, top / 2, top];
    return s('svg', { viewBox: `0 0 ${W} ${height}`, class: 'bars', role: 'img', 'aria-label': title },
      s('text', { x: pad.l, y: 16, class: 'ctitle' }, title),
      ticks.map(t => [s('line', { x1: pad.l, x2: W - pad.r, y1: Y(t), y2: Y(t), class: 'grid' }), s('text', { x: pad.l - 6, y: Y(t) + 4, class: 'tick', 'text-anchor': 'end' }, fmtV(t))]),
      items.map((it, i) => {
        const v = Number.isFinite(it.v) ? it.v : 0;
        const x = pad.l + i * bw + 2;
        const w = Math.max(2, bw - 4);
        const y = Y(v);
        const hgt = pad.t + ih - y;
        const r = Math.min(4, w / 2, hgt);
        const d = hgt > 0 ? `M${x},${pad.t + ih} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${pad.t + ih} Z` : '';
        return s('g', { class: 'barg' },
          s('rect', { x: pad.l + i * bw, y: pad.t, width: bw, height: ih, class: 'hit' }, s('title', null, `${it.label}: ${fmtV(v)}${unit}${it.note ? ', ' + it.note : ''}`)),
          d ? s('path', { d, class: 'bar' }) : null,
          s('text', { x: x + w / 2, y: height - 10, class: 'tick', 'text-anchor': 'middle' }, it.label));
      }));
  }

  /* Mean with a whisker for one standard deviation, one dot per group */
  function dotWhisker(groups, { title, max = 10 }) {
    const W = 640, H = 200, pad = { l: 40, r: 12, t: 28, b: 30 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const Y = v => pad.t + ih - (v / max) * ih;
    const bw = iw / groups.length;
    return s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bars', role: 'img', 'aria-label': title },
      s('text', { x: pad.l, y: 16, class: 'ctitle' }, title),
      [0, 5, 10].map(t => [s('line', { x1: pad.l, x2: W - pad.r, y1: Y(t), y2: Y(t), class: 'grid' }), s('text', { x: pad.l - 6, y: Y(t) + 4, class: 'tick', 'text-anchor': 'end' }, t)]),
      groups.map((g, i) => {
        const cx = pad.l + i * bw + bw / 2;
        const ok = Number.isFinite(g.mean);
        const sdv = Number.isFinite(g.sd) ? g.sd : 0;
        return s('g', null,
          s('rect', { x: pad.l + i * bw, y: pad.t, width: bw, height: ih, class: 'hit' }, s('title', null, ok ? `${g.label}: mean ${fmt(g.mean, 2)}, SD ${fmt(g.sd, 2)}, n = ${g.n}` : `${g.label}: no data`)),
          ok ? [s('line', { x1: cx, x2: cx, y1: Y(Math.min(max, g.mean + sdv)), y2: Y(Math.max(0, g.mean - sdv)), class: 'whisker' }), s('circle', { cx, cy: Y(g.mean), r: 6, class: 'dotm' })] : null,
          s('text', { x: cx, y: H - 10, class: 'tick', 'text-anchor': 'middle' }, `${g.label} (n=${g.n})`));
      }));
  }

  function renderStats(m) {
    const P = m.poster;
    const c = m.counts;
    const reqRows = m.reqs.map(r => h('tr', null, h('td', null, r.id), h('td', null, r.name), h('td', null, r.n ? r.show : 'No data yet'), h('td', null, r.target),
      h('td', { class: r.met === null ? 'res none' : r.met ? 'res met' : 'res miss' }, r.met === null ? 'No data' : r.met ? 'Met' : 'Not met'), h('td', { class: 'num' }, r.n)));
    const L = ['diaphragmatic', 'thoracic', 'unclear'];
    const exports = h('div', { class: 'row wrap' },
      ['Sessions', 'Placements', 'Trials', 'Breaths', 'Answers', 'Reading', 'Prep', 'Events'].map(t => h('button', { class: 'btn small', type: 'button', onclick: () => download(`anatomy-${t.toLowerCase()}.csv`, toCSV(lastTables[t] || [])) }, `${t}.csv`)),
      h('button', { class: 'btn small primary', type: 'button', onclick: () => download('anatomy-poster-summary.csv', toCSV(A().summaryRows(m))) }, 'Poster summary.csv'));

    return h('div', null,
      h('p', { class: 'muted' }, `${c.kept} sessions used (${c.completed} completed). ${c.excludedSim} simulated or demo sessions ${includeSim ? 'included' : 'left out'}, ${c.invalid} marked invalid.`),
      c.kept === 0 ? h('p', { class: 'notice' }, includeSim ? 'No sessions yet. Run a session or add demo sessions.' : 'No live sessions yet. Tick "Include simulated and demo sessions" to see how the statistics will look.') : null,

      h('section', null, h('h2', null, 'Design requirements'),
        h('p', { class: 'muted' }, 'These six are candidates; the final six are not decided yet. Accuracy uses the recorder’s ground truth, so enter it in Review first.'),
        h('div', { class: 'tablewrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, ['', 'Requirement', 'Measured', 'Target', 'Result', 'n'].map(t => h('th', null, t)))), h('tbody', null, reqRows)))),

      h('section', null, h('h2', null, 'Camera AI: placement detection'),
        h('p', null, `Accuracy ${propText(m.placementAcc)}. 95% confidence interval ${pct(m.placementAcc.lo)} to ${pct(m.placementAcc.hi)}. Ground truth from: ${Object.entries(m.gtSources).map(([k, v]) => `${k} ${v}`).join(', ') || 'none yet'}.`),
        table(['', 'Recorder: correct', 'Recorder: wrong'], [['AI said correct', m.cm.tp, m.cm.fp], ['AI said wrong', m.cm.fn, m.cm.tn]], 'data matrix'),
        h('div', { class: 'two' },
          table(['Device', 'Accuracy', 'n'], m.byDevice.map(d => [d.device, pct(d.p), d.n])),
          table(['Organ', 'Accuracy', 'n'], m.byOrgan.map(d => [S.ORGAN_NAME[d.organ] || d.organ, pct(d.p), d.n])))),

      h('section', null, h('h2', null, 'Pico AI: breath classification'),
        h('p', null, `Accuracy ${propText(m.breathAcc)}. On breaths the recorder judged clear: ${propText(m.breathAccClear)}.`),
        table(['Recorder \\ Pico', ...L.map(x => `Pico: ${x}`)], L.map(g => [`Recorder: ${g}`, ...L.map(a => m.bcm[g][a])]), 'data matrix'),
        table(['Class', 'Precision', 'Recall', 'n'], m.perClass.map(p => [p.label, pct(p.precision), pct(p.recall), p.n]))),

      h('section', null, h('h2', null, 'Response times'),
        table(['Measure', 'Median', '95th percentile', 'Longest', 'Within target', 'n'], [
          ['Hand leaves board to placement verdict', `${fmt(m.resp.median, 0)} ms`, `${fmt(m.resp.p95, 0)} ms`, `${fmt(m.resp.max, 0)} ms`, pct(m.resp.within), m.resp.n],
          ['Breath ends to breath label', `${fmt(m.lat.median, 0)} ms`, `${fmt(m.lat.p95, 0)} ms`, `${fmt(m.lat.max, 0)} ms`, pct(m.lat.within), m.lat.n],
          ['Lung model servo response', `${fmt(m.servo.median, 0)} ms`, `${fmt(m.servo.p95, 0)} ms`, `${fmt(m.servo.max, 0)} ms`, pct(m.servo.within), m.servo.n]]),
        m.resp.n ? barChart(histBins(m.resp.values, 250, 3000), { title: 'Placement response time (count of verdicts per 250 ms)', fmtV: v => fmt(v, 0) }) : null),

      h('section', null, h('h2', null, 'Heart rate vs pulse oximeter'),
        h('p', null, m.hr.n ? `Mean absolute error ${fmt(m.hr.mae)} bpm. Bias ${fmt(m.hr.bias)} bpm, limits of agreement ${fmt(m.hr.loa[0])} to ${fmt(m.hr.loa[1])} bpm. ${pct(m.hr.within)} of readings within ${S.TARGETS.hrErrorBpm} bpm (n = ${m.hr.n}).` : 'No oximeter readings entered yet. Add them in Review.')),

      h('section', null, h('h2', null, 'Students’ results'),
        h('p', null, `Total score ${fmt(P.totals.mean, 2)} out of 10 on average (SD ${fmt(P.totals.sd, 2)}, median ${fmt(P.totals.median, 1)}, n = ${P.totals.n}). Anatomy and breathing scores correlate at r = ${fmt(P.r_ab, 2)}.`),
        barChart(P.histogram.map(b => ({ label: b.score % 1 ? '' : String(b.score), v: b.n, note: `score ${b.score}` })), { title: 'Number of students at each total score', fmtV: v => fmt(v, 0) }),
        dotWhisker(P.byGrade.map(g => ({ label: g.grade, mean: g.total.mean, sd: g.total.sd, n: g.n })), { title: 'Total score by grade (mean, whisker = 1 SD)' }),
        table(['Group', 'Mean total', 'SD', 'n'], [...P.byGrade.map(g => [g.grade, fmt(g.total.mean, 2), fmt(g.total.sd, 2), g.n]), ...P.byPrior.map(g => [g.prior === 'yes' ? 'Studied before' : 'Not studied before', fmt(g.total.mean, 2), fmt(g.total.sd, 2), g.n])]),
        h('p', { class: 'muted' }, 'With 5 students per grade, describe these as pilot trends. Only large differences can be shown.')),

      h('section', null, h('h2', null, 'Task 1 details'),
        table(['Organ', 'First try correct', 'Level 1', 'Level 2', 'Level 3', 'Median time to place'], P.difficulty.map(d => [S.ORGAN_NAME[d.organ], propText(d.all), propText(d.levels[0]), propText(d.levels[1]), propText(d.levels[2]), `${fmt(d.timeToPlace)} s`])),
        h('div', { class: 'two' },
          table(['Most common errors', 'Count'], P.errors.map(e => [e.error.replace(/_/g, ' '), e.n])),
          table(['Measure', 'Result'], [['Correct after a hint', propText(P.hintSuccess)], ['Qualified for full build', propText(P.qualified)], ...P.levels.map(l => [`Highest level ${l.level}`, l.n])]))),

      h('section', null, h('h2', null, 'Task 2 details'),
        table(['Measure', 'Result'], [...P.trialPass.map(t => [`${t.command} passed on first try`, propText(t)]), ['Retry passed', propText(P.retrySuccess)], ...P.swing.map(t => [`Heart-rate swing, ${t.command}`, `${fmt(t.mean, 2)} bpm mean (n = ${t.n})`]), ['Backup graph used', propText(P.backupRate)]]),
        barChart(P.questions.map(q => ({ label: q.qid, v: Number.isFinite(q.p) ? q.p * 100 : 0, note: `${q.k} of ${q.n}` })), { title: 'Students answering each question correctly (%)', max: 100, fmtV: v => fmt(v, 0) })),

      h('section', null, h('h2', null, 'Reading passages'),
        h('p', null, `${m.reading.n} passages answered. ${propText(m.reading.timeouts)} ran out of time.`),
        h('div', { class: 'two' },
          table(['Difficulty', 'Correct'], m.reading.byDiff.map(d => [{ E: 'Easy', I: 'Intermediate', H: 'Hard' }[d.d], propText(d)])),
          table(['Passage level', 'Correct'], m.reading.byLevel.map(d => [S.reading.LEVEL_NAME[d.level], propText(d)]))),
        table(['Grade group', 'Moved up to a harder second passage'], m.reading.moveUp.map(g => [g.group, propText(g)])),
        h('details', null, h('summary', null, 'Every question (item analysis)'),
          h('p', { class: 'muted' }, 'Questions almost everyone gets right, or almost nobody does, are worth rewriting.'),
          table(['Question', 'Level', 'Difficulty', 'Correct', 'Mean time'], m.reading.items.map(it => [it.id, it.level, it.d, propText(it), `${fmt(it.meanMs / 1000, 0)} s`])))),

      h('section', null, h('h2', null, 'Prep and test performance'),
        h('p', null, 'Students are grouped by the Prep they finished before their test. "Investigated" means they looked at the passage again for at least half of their wrong answers.'),
        table(['Group', 'n', 'Reading % correct', 'Graph questions (of 3)', 'Breathing score (of 5)', 'Total (of 10)'], m.prep.compare.map(g => [g.label, g.n, `${fmt(g.readPct.mean, 1)} (SD ${fmt(g.readPct.sd, 1)})`, fmt(g.graph.mean, 2), fmt(g.breathing.mean, 2), fmt(g.total.mean, 2)])),
        dotWhisker(m.prep.compare.map(g => ({ label: { none: 'No prep', blind: 'Blind', investigated: 'Investigated', no_mistakes: 'No mistakes' }[g.group], mean: g.readPct.mean / 10, sd: g.readPct.sd / 10, n: g.n })), { title: 'Reading score by Prep group (correct answers out of 10, whisker = 1 SD)' }),
        table(['What students said after Prep', 'n', 'Reading % correct'], m.prep.reports.map(g => [g.label, g.n, fmt(g.readPct.mean, 1)])),
        h('p', null, `Number of Prep passages done and reading % correct: r = ${fmt(m.prep.r_prep, 2)}. ${m.prep.attempts} Prep attempts recorded.`),
        h('p', { class: 'muted' }, 'Students choose whether to do Prep, so differences may also come from motivation or ability. Report this as a comparison, not proof of cause, unless Prep is assigned randomly.')),

      h('section', null, h('h2', null, 'Export'), h('p', { class: 'muted' }, 'Download the tables for charts in the poster, or open the Google Sheet directly.'), exports));
  }
  function histBins(values, step, maxV) {
    const bins = [];
    for (let x = 0; x < maxV; x += step) bins.push({ label: x % 1000 === 0 ? `${x / 1000} s` : '', v: values.filter(v => v >= x && v < x + step).length, note: `${x} to ${x + step} ms` });
    bins.push({ label: '', v: values.filter(v => v >= maxV).length, note: `over ${maxV} ms` });
    return bins;
  }

  /* ---------- Board photos for training the camera AI ---------- */
  async function photos() {
    const st = S.settings.get();
    const cam = new S.VisionLive();
    let facing = st.cameraFacing || 'environment';
    const preview = h('div', { class: 'camera' }, h('p', { class: 'muted' }, 'Starting the camera...'));
    const light = h('select', null, ['daylight', 'classroom', 'dim', 'lamp'].map(v => h('option', { value: v }, v)));
    const tag = h('input', { type: 'text', placeholder: 'What is on the board, e.g. heart-ok llung-in-rlung-zone' });
    const listEl = h('p', { class: 'muted' });
    const refresh = async () => { const all = await S.store.all('photos'); listEl.textContent = `${all.length} photos saved on this tablet.`; };
    const capture = async () => {
      const c = document.createElement('canvas');
      if (!cam.frame(c)) { S.ui.toast('The camera is not ready.'); return; }
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      const name = `${st.deviceCode}_${S.util.stamp()}_${light.value}_${(tag.value.trim() || 'untagged').replace(/[^\w-]+/g, '-')}.jpg`;
      await S.store.put('photos', { id: name, name, blob, device: st.deviceLabel, at: new Date().toISOString(), light: light.value, tag: tag.value.trim() });
      S.ui.toast('Photo saved');
      refresh();
    };
    frame('Board photos', h('div', null,
      h('p', null, 'Collect training photos for the camera AI here, on each device you will test. Vary the lighting, angle and distance, and include wrong placements, rotated pieces and hands in view. Keep faces out of the frame.'),
      preview,
      h('div', { class: 'row wrap' }, h('label', { class: 'field inline' }, h('span', null, 'Lighting'), light), h('label', { class: 'field grow' }, h('span', null, 'Tag'), tag)),
      h('div', { class: 'row wrap' }, S.ui.button('Take photo', capture),
        h('button', { class: 'btn', type: 'button', onclick: async () => { const all = await S.store.all('photos'); for (const p of all) { download(p.name, p.blob); await S.util.realSleep(300); } } }, 'Download all'),
        h('button', { class: 'btn', type: 'button', onclick: async () => {
          if (!st.syncUrl) { S.ui.toast('Add the cloud link in Settings first.'); return; }
          const all = await S.store.all('photos'); let n = 0;
          for (const p of all) { try { await S.sync.photo(p); await S.store.del('photos', p.id); n++; } catch (e) { break; } }
          S.ui.toast(`${n} photos uploaded to Google Drive`); refresh();
        } }, 'Upload all to Google Drive'),
        h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (!(await S.ui.confirmBox('Delete all photos on this tablet?', 'Upload or download them first.', 'Delete', 'Cancel'))) return; for (const p of await S.store.all('photos')) await S.store.del('photos', p.id); refresh(); } }, 'Delete all')),
      listEl), 'photos');
    refresh();
    const startCam = async () => {
      if (await cam.start(facing)) { cam.video.className = 'feed'; preview.replaceChildren(cam.video); }
      else preview.replaceChildren(h('p', { class: 'error' }, cam.error || 'The camera did not start.'));
    };
    preview.after(h('div', { class: 'row' }, h('button', { class: 'btn small', type: 'button', onclick: () => { facing = facing === 'user' ? 'environment' : 'user'; cam.stop(); startCam(); } }, 'Switch front or back camera')));
    await startCam();
  }

  /* ---------- Settings ---------- */
  function settings() {
    const st = S.settings.get();
    const f = {};
    const field = (key, label, input, help) => { f[key] = input; return h('label', { class: 'field' }, h('span', null, label), input, help ? h('small', { class: 'muted' }, help) : null); };
    const text = (key, attrs = {}) => h('input', { type: 'text', value: st[key] ?? '', ...attrs });
    const numIn = (key, attrs = {}) => h('input', { type: 'number', value: st[key] ?? '', step: 'any', ...attrs });
    const select = (key, opts) => { const el = h('select', null, opts.map(([v, l]) => h('option', { value: v, selected: String(st[key]) === v ? true : null }, l))); return el; };
    const check = key => { const el = h('input', { type: 'checkbox' }); el.checked = !!st[key]; return el; };
    const msg = h('span', { class: 'muted' });
    const content = h('div', { class: 'settings' },
      h('section', null, h('h2', null, 'This device'),
        field('deviceLabel', 'Device name', text('deviceLabel'), 'Shown in the data, e.g. MatePad or Phone A.'),
        field('deviceCode', 'Short code', text('deviceCode', { maxlength: 4 }), '2 to 4 letters. Student codes start with it, e.g. MP-014.')),
      h('section', null, h('h2', null, 'Hardware'),
        field('picoMode', 'Pico W', select('picoMode', [['sim', 'Simulator'], ['live', 'Live Pico W']])),
        field('picoUrl', 'Pico W address', text('picoUrl'), 'WebSocket address of the Pico, e.g. ws://192.168.1.50:8080. See docs/pico-protocol.md.'),
        field('visionMode', 'Camera AI', select('visionMode', [['sim', 'Simulator'], ['live', 'Live camera and model']]), 'Live needs the trained model. Until then the station check stays red in live mode.'),
        field('mirrorDuringTrials', 'Lung model mirrors breathing during scored trials', check('mirrorDuringTrials'), 'Off by default, because it shows the student whether the belly is moving.')),
      h('section', null, h('h2', null, 'Camera'),
        field('cameraFacing', 'Camera that watches the board', select('cameraFacing', [['environment', 'Back camera'], ['user', 'Front camera']]), 'The app asks the browser for this camera when the test or Board photos starts.'),
        S.camera.panel({ compact: true })),
      h('section', null, h('h2', null, 'Student passwords'),
        h('p', { class: 'muted' }, 'Clear a student\u2019s password when they forget it. They choose a new one the next time they sign in.'),
        (() => {
          const sid = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: 'Student ID' });
          const out = h('span', { class: 'muted' });
          return h('div', { class: 'row wrap' }, sid,
            h('button', { class: 'btn', type: 'button', onclick: async () => {
              const id = sid.value.trim();
              if (!id) { out.textContent = 'Type a student ID.'; return; }
              if (!(await S.accounts.exists(id))) { out.textContent = `Student ID ${id} has no password on this tablet.`; return; }
              if (!(await S.ui.confirmBox(`Clear the password for student ID ${id}?`, 'Their results are kept.', 'Clear password', 'Cancel'))) return;
              await S.accounts.reset(id);
              out.textContent = `Password cleared for ${id}.`;
            } }, 'Clear password'), out);
        })(),
        h('p', { class: 'muted small' }, 'Passwords are stored on this tablet only, as a salted hash. A student signs in on each tablet they use.')),
      h('section', null, h('h2', null, 'Cloud'),
        field('syncUrl', 'Cloud link (Apps Script web app URL)', text('syncUrl', { placeholder: 'https://script.google.com/macros/s/.../exec' })),
        field('syncKey', 'Sync key', text('syncKey'), 'The same word you saved as SYNC_KEY in the Apps Script.')),
      h('section', null, h('h2', null, 'Thresholds'),
        field('confThreshold', 'Camera confidence needed for a verdict (0 to 1)', numIn('confThreshold', { min: 0, max: 1 })),
        field('hrSwingThreshold', 'Smallest heart-rate swing for the student’s own graph (bpm)', numIn('hrSwingThreshold', { min: 0 }))),
      h('section', null, h('h2', null, 'Simulator'),
        field('simAutoStudent', 'Pretend student answers on their own', check('simAutoStudent')),
        field('simSkill', 'Pretend student skill (0 to 1)', numIn('simSkill', { min: 0, max: 1 })),
        field('simAiError', 'Pretend AI error rate (0 to 1)', numIn('simAiError', { min: 0, max: 1 })),
        field('simSpeed', 'Speed', select('simSpeed', [['1', 'Real time, with sound'], ['5', '5 times faster, no sound'], ['20', '20 times faster, no sound']]))),
      h('div', { class: 'row wrap sticky' },
        S.ui.button('Save settings', () => {
          const patch = {};
          Object.entries(f).forEach(([k, el]) => { patch[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value.trim(); });
          patch.simSpeed = Number(patch.simSpeed);
          patch.deviceCode = (patch.deviceCode || 'ST').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'ST';
          S.settings.save(patch);
          msg.textContent = 'Saved.';
        }),
        h('button', { class: 'btn', type: 'button', onclick: async () => { if (await S.ui.askPin('Enter the current PIN')) await S.ui.setupPin(false); } }, 'Change PIN'),
        msg),
      h('p', { class: 'muted small' }, `App version ${S.APP_VERSION}.`));
    frame('Settings', content, 'settings');
  }

  return { mainFrame, home, lock, history, overview, stationCheck, reviewList, reviewSession, stats, photos, settings };
})();
