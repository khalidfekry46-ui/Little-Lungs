/* URT-style reading: the passage reader, the adaptive rules and the scoring.
   Used by Task 2 (two passages, 5 minutes each) and by the Prep tab. */
window.S = window.S || {};

S.reading = (() => {
  const { h, shuffle } = S.util;
  const LEVELS = ['foundation', 'intermediate', 'advanced'];
  const LEVEL_NAME = { foundation: 'Foundation', intermediate: 'Intermediate', advanced: 'Advanced' };
  const LETTERS = ['A', 'B', 'C', 'D'];

  const byId = id => S.PASSAGES.find(p => p.id === id);
  const pool = (set, level) => S.PASSAGES.filter(p => p.set === set && p.level === level);

  /* G8 and G9 start at foundation; G10 to G12 start at intermediate */
  function startLevel(grade) { return grade === 'G8' || grade === 'G9' ? 'foundation' : 'intermediate'; }

  /* Doing well = every intermediate question correct and at least one hard question correct */
  function doingWell(passage, answers) {
    const qs = passage.questions;
    const ok = i => answers[i] && answers[i].choice === qs[i].a;
    const inter = qs.map((q, i) => (q.d === 'I' ? ok(i) : true)).every(Boolean);
    const hard = qs.some((q, i) => q.d === 'H' && ok(i));
    return inter && hard;
  }
  function nextLevel(level, well) {
    if (!well) return level;
    return LEVELS[Math.min(LEVELS.length - 1, LEVELS.indexOf(level) + 1)];
  }
  /* A passage the student has not seen before, if possible */
  function pick(set, level, avoid = []) {
    const all = pool(set, level);
    const fresh = all.filter(p => !avoid.includes(p.id));
    const list = fresh.length ? fresh : all.filter(p => p.id !== avoid[avoid.length - 1]);
    return shuffle(list.length ? list : all)[0];
  }
  function points(passage, answers) {
    return passage.questions.reduce((t, q, i) => t + (answers[i] && answers[i].choice === q.a ? S.READING_POINTS[q.d] : 0), 0);
  }
  function maxPoints(passage) { return passage.questions.reduce((t, q) => t + S.READING_POINTS[q.d], 0); }

  function passageArticle(p, { highlight } = {}) {
    const paras = x => (x || []).map(t => h('p', null, t));
    const table = p.table ? h('div', { class: 'tablewrap' }, h('table', { class: 'data passage-table' },
      h('thead', null, h('tr', null, p.table.head.map(c => h('th', null, c)))),
      h('tbody', null, p.table.rows.map(r => h('tr', null, r.map(c => h('td', null, c))))))) : null;
    return h('article', { class: `passage ${highlight ? 'look' : ''}`, 'aria-label': `Passage: ${p.title}` },
      h('h2', null, p.title), paras(p.text), table, paras(p.after));
  }

  /* The question panel. Answers can be changed until the student finishes or time runs out. */
  function questionPanel(p, state, { onFinish, review } = {}) {
    const panel = h('div', { class: 'qpanel' });
    let cur = 0;
    let shownAt = S.run.now();
    const tick = () => { const n = S.run.now(); state[cur].time_ms += n - shownAt; shownAt = n; };
    const draw = () => {
      const q = p.questions[cur];
      const a = state[cur];
      const dots = h('div', { class: 'qdots', role: 'tablist', 'aria-label': 'Questions' },
        p.questions.map((_, i) => h('button', { type: 'button', class: `qdot ${i === cur ? 'cur' : ''} ${state[i].choice != null ? 'done' : ''}`, 'aria-label': `Question ${i + 1}${state[i].choice != null ? ', answered' : ''}`, onclick: () => go(i) }, String(i + 1))));
      const opts = h('div', { class: 'choices' }, q.o.map((text, k) => h('button', {
        type: 'button', class: `choice letter ${a.choice === k ? 'on' : ''}`, 'aria-pressed': a.choice === k ? 'true' : 'false',
        onclick: () => {
          if (a.choice !== k) {
            if (a.choice != null) a.changes++;
            else a.first_ms = S.run.now() - state.start;
            a.choice = k;
          }
          draw();
        }
      }, h('span', { class: 'let' }, LETTERS[k]), h('span', null, text))));
      panel.replaceChildren(
        dots,
        h('h2', { class: 'qtitle' }, `Question ${cur + 1} of ${p.questions.length}`),
        h('p', { class: 'qtext' }, q.q),
        opts,
        h('div', { class: 'row wrap qnav' },
          h('button', { class: 'btn', type: 'button', disabled: cur === 0, onclick: () => go(cur - 1) }, 'Previous'),
          cur < p.questions.length - 1 ? h('button', { class: 'btn', type: 'button', onclick: () => go(cur + 1) }, 'Next question') : null,
          h('button', { class: 'btn primary', type: 'button', onclick: finish }, 'Finish passage')));
    };
    const go = i => { tick(); cur = i; draw(); };
    const finish = async () => {
      const missing = state.filter(x => x.choice == null).length;
      if (missing && !(await S.ui.confirmBox(`Finish with ${missing} unanswered?`, 'Unanswered questions score zero. You can still go back while time remains.', 'Finish', 'Keep working'))) return;
      tick();
      onFinish('submit');
    };
    panel.stop = () => tick();
    panel.autoPick = (k, i) => { cur = i; state[i].choice = k; state[i].first_ms = S.run.now() - state.start; draw(); };
    draw();
    void review;
    return panel;
  }

  /* Runs one timed passage. Returns { answers, ended, time_ms }. */
  async function runPassage(p, { page, ms, onWarn, guard }) {
    const state = p.questions.map(() => ({ choice: null, changes: 0, time_ms: 0, first_ms: null }));
    state.start = S.run.now();
    let ended = null;
    const panel = questionPanel(p, state, { onFinish: how => { ended = how; } });
    page.visualSlot.replaceChildren(panel);
    page.article.replaceWith(page.article = passageArticle(p));
    if (S.settings.get().simAutoStudent && S.settings.get().visionMode === 'sim' && S.run.speed > 1) autoStudent(p, panel, () => { ended = 'submit'; });
    let warned = false;
    const wait = S.run.until(el => {
      const rem = ms - el;
      S.ui.setTimer(page, rem, ms);
      if (!warned && rem <= 60000) { warned = true; if (onWarn) onWarn(); }
      return ended;
    }, ms);
    const r = await (guard ? guard(wait) : wait);
    panel.stop();
    S.ui.setTimer(page, null);
    return { answers: state.map((a, i) => ({ q: i + 1, id: p.questions[i].id, d: p.questions[i].d, choice: a.choice, correct: a.choice === p.questions[i].a, changes: a.changes, time_ms: Math.round(a.time_ms), first_ms: a.first_ms == null ? null : Math.round(a.first_ms) })), ended: r.ok ? 'submit' : 'timeout', time_ms: Math.round(S.run.now() - state.start) };
  }

  /* Simulator: the pretend student answers by difficulty, then finishes */
  function autoStudent(p, panel, done) {
    const skill = S.settings.get().simSkill;
    const pc = { E: Math.min(0.95, skill + 0.15), I: skill - 0.05, H: skill - 0.3 };
    let t = 0;
    p.questions.forEach((q, i) => {
      t += (6000 + Math.random() * 14000) / S.run.speed;
      setTimeout(() => {
        const k = Math.random() < pc[q.d] ? q.a : [0, 1, 2, 3].filter(x => x !== q.a)[Math.floor(Math.random() * 3)];
        panel.autoPick(k, i);
      }, t);
    });
    setTimeout(done, t + 800 / S.run.speed);
  }

  return { LEVELS, LEVEL_NAME, LETTERS, byId, pool, startLevel, doingWell, nextLevel, pick, points, maxPoints, passageArticle, questionPanel, runPassage };
})();
