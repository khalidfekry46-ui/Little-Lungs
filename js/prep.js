/* Prep: six practice passages (2 foundation, 2 intermediate, 2 advanced), different from the test passages.
   After each passage the student sees which answers were wrong and the correct answer, with no explanation.
   The app records whether the student goes back to the passage to investigate, so Statistics can compare
   students who investigated their mistakes with those who did not, and with students who did no prep. */
window.S = window.S || {};

S.prep = (() => {
  const { h } = S.util;
  let who = null; /* { student_id, name, grade, key } for this visit */

  const clear = () => { who = null; };
  const frame = (content) => S.admin.mainFrame('prep', h('main', { class: 'opmain' }, content));

  function open() { if (!who) identify(); else list(); }

  async function identify() {
    const box = h('div');
    frame(box);
    const r = await S.accounts.signIn(box, { title: 'Prep', text: 'Practise reading passages about breathing and the heart before your test. Each passage has five questions and five minutes. Afterwards you see which answers were wrong and the right answers. Sign in with your student ID and password.', needInfo: true });
    if (!r) return;
    who = { student_id: r.student_id, name: r.rec.name || '', grade: r.rec.grade || '', key: r.key };
    if (!who.grade) {
      const wrap = h('div', null, h('h2', null, 'Which grade are you in?'));
      const m = S.ui.modal(wrap);
      who.grade = await S.ui.choose(wrap, ['G8', 'G9', 'G10', 'G11', 'G12'].map(g => [g, g]), { columns: 5 });
      m.close();
      const rec = r.rec; rec.grade = who.grade;
      await S.store.put('kv', rec, `acct:${r.key}`);
    }
    list();
  }

  async function attemptsFor(key) {
    return ((await S.store.all('prep')) || []).filter(r => r.student_key === key && r.finished_at).sort((a, b) => a.finished_at.localeCompare(b.finished_at));
  }

  async function list() {
    const mine = await attemptsFor(who.key);
    const groups = S.reading.LEVELS.map(level => {
      const cards = S.reading.pool('prep', level).map(p => {
        const tries = mine.filter(r => r.passage_id === p.id);
        const last = tries[tries.length - 1];
        return h('div', { class: 'prepcard' },
          h('h3', null, p.title),
          h('p', { class: 'muted' }, last ? `Best score ${Math.max(...tries.map(t => t.score))} of 5. Tried ${tries.length} time${tries.length > 1 ? 's' : ''}.` : 'Not tried yet.'),
          h('div', { class: 'row wrap' },
            h('button', { class: `btn ${last ? '' : 'primary'}`, type: 'button', onclick: () => run(p) }, last ? 'Try again' : 'Start'),
            last ? h('button', { class: 'btn', type: 'button', onclick: () => review(last) }, 'See my last results') : null));
      });
      return h('section', null, h('h2', null, S.reading.LEVEL_NAME[level]), h('div', { class: 'prepgrid' }, cards));
    });
    frame(h('div', null,
      h('h1', null, 'Prep'),
      h('p', null, `${who.name || 'Student ' + who.student_id}, ${who.grade}. Choose any passage. Each has five questions and five minutes.`),
      groups,
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => { clear(); identify(); } }, 'Sign out'))));
  }

  async function run(p) {
    if (S.test.session) { S.ui.toast('Finish the current test first.'); return; }
    const st = S.settings.get();
    S.run.reset(st.visionMode === 'sim' || st.picoMode === 'sim' ? Number(st.simSpeed) || 1 : 1);
    const article = h('div'), slot = h('div');
    const page = S.ui.studentPage({ code: 'Prep', progress: `Prep: ${S.reading.LEVEL_NAME[p.level]}`, text: 'Read the passage, then answer the five questions.', extraLeft: article, visual: slot });
    page.stage.classList.add('reading');
    page.article = article;
    page.visualSlot = slot;
    const started = new Date().toISOString();
    const r = await S.reading.runPassage(p, { page, ms: S.TIMING.passageMs });
    const rec = {
      id: `PREP-${st.deviceCode}-${S.util.stamp()}-${S.util.rand4()}`, student_key: who.key, student_id: who.student_id, name: who.name, grade: who.grade,
      device_code: st.deviceCode, passage_id: p.id, level: p.level, started_at: started, finished_at: new Date().toISOString(), ended: r.ended,
      answers: r.answers, score: r.answers.filter(a => a.correct).length, points: S.reading.points(p, r.answers),
      review: { ms: 0, looks: [], self_report: '' }, demo: false, synced_at: null
    };
    rec.askReport = true;
    await S.store.put('prep', rec);
    review(rec);
  }

  /* Results: right or wrong and the correct answer, no explanation */
  function review(rec) {
    const p = S.reading.byId(rec.passage_id);
    const opened = performance.now();
    const L = S.reading.LETTERS;
    const items = p.questions.map((q, i) => {
      const a = rec.answers[i];
      return h('li', { class: `ritem ${a.correct ? 'right' : 'wrong'}` },
        h('p', { class: 'rq' }, h('strong', null, `Question ${i + 1}. `), q.q),
        h('p', null, h('span', { class: `tag ${a.correct ? 'ok' : 'no'}` }, a.correct ? 'Correct' : 'Wrong'), ' Your answer: ', a.choice == null ? 'no answer' : `${L[a.choice]}. ${q.o[a.choice]}`),
        a.correct ? null : h('p', null, 'Correct answer: ', h('strong', null, `${L[q.a]}. ${q.o[q.a]}`)),
        a.correct ? null : h('button', { class: 'btn small', type: 'button', onclick: () => lookAgain(rec, i, opened) }, 'Look at the passage again'));
    });
    const wrong = rec.answers.filter(a => !a.correct).length;
    frame(h('div', null,
      h('h1', null, `${p.title}: ${rec.score} of 5`),
      h('p', { class: 'muted' }, `${S.reading.LEVEL_NAME[p.level]} practice${rec.ended === 'timeout' ? ', time ran out' : ''}.`),
      h('ol', { class: 'rlist' }, items),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => finishReview(rec, opened, wrong) }, 'Finish'))));
  }

  function lookAgain(rec, i, opened) {
    const p = S.reading.byId(rec.passage_id);
    const q = p.questions[i];
    const a = rec.answers[i];
    const L = S.reading.LETTERS;
    rec.review.ms += Math.round(performance.now() - opened);
    const t0 = performance.now();
    frame(h('div', { class: 'lookagain' },
      h('div', { class: 'row wrap' }, h('button', { class: 'btn', type: 'button', onclick: async () => {
        rec.review.looks.push({ q: i + 1, ms: Math.round(performance.now() - t0) });
        await S.store.put('prep', rec);
        review(rec);
      } }, 'Back to my results')),
      h('div', { class: 'lookgrid' },
        S.reading.passageArticle(p),
        h('div', { class: 'qpanel' },
          h('h2', { class: 'qtitle' }, `Question ${i + 1}`),
          h('p', { class: 'qtext' }, q.q),
          h('div', { class: 'choices' }, q.o.map((text, k) => h('div', { class: `choice letter static ${k === q.a ? 'right' : ''} ${k === a.choice && k !== q.a ? 'wrong' : ''}` },
            h('span', { class: 'let' }, L[k]), h('span', null, text), k === q.a ? h('span', { class: 'tag ok' }, 'Correct answer') : (k === a.choice ? h('span', { class: 'tag no' }, 'Your answer') : null))))))));
  }

  function finishReview(rec, opened, wrong) {
    rec.review.ms += Math.round(performance.now() - opened);
    const done = async report => {
      if (report) rec.review.self_report = report;
      delete rec.askReport;
      await S.store.put('prep', rec);
      if (!rec.demo) S.sync.prep(rec).catch(() => {});
      list();
    };
    if (!rec.askReport || rec.review.self_report) { done(null); return; }
    if (!wrong) { done('no_mistakes'); return; }
    const m = S.ui.modal(h('div', null,
      h('h2', null, 'One quick question'),
      h('p', null, 'Did you work out why each correct answer is right?'),
      h('div', { class: 'choices' },
        [['all', 'Yes, for every mistake'], ['some', 'For some mistakes'], ['no', 'No']].map(([v, l]) => h('button', { class: 'choice', type: 'button', onclick: () => { m.close(); done(v); } }, l)))));
  }

  return { open, clear, attemptsFor };
})();
