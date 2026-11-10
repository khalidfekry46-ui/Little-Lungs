/* Student passwords. Each student ID has one password, so classmates cannot open each other's History or Prep.
   - Matching uses the student ID only (names can be typed differently).
   - Rules: at least 8 characters, with a capital letter, a small letter, a number and one of @ # $ % &.
   - Stored on the tablet as a salted PBKDF2 hash (never the password itself).
   - 5 wrong tries lock that student ID for 1 minute; 10 lock it for 10 minutes.
   - The operator can reset a password (Management > Students, or "I forgot my password" plus the operator PIN). */
window.S = window.S || {};

S.accounts = (() => {
  const { h } = S.util;
  const ITER = 150000;
  const SPECIAL = '@#$%&';

  function problems(pw) {
    const out = [];
    if (pw.length < 8) out.push('at least 8 characters');
    if (!/[A-Z]/.test(pw)) out.push('a capital letter');
    if (!/[a-z]/.test(pw)) out.push('a small letter');
    if (!/[0-9]/.test(pw)) out.push('a number');
    if (!/[@#$%&]/.test(pw)) out.push(`one of ${SPECIAL.split('').join(' ')}`);
    if (/\s/.test(pw)) out.push('no spaces');
    return out;
  }

  const hex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  async function derive(pw, saltHex) {
    if (window.crypto && crypto.subtle) {
      const salt = new Uint8Array(saltHex.match(/../g).map(x => parseInt(x, 16)));
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
      return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, key, 256));
    }
    return S.util.sha256(saltHex + pw); /* only when the page is not on https */
  }
  const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)));
  const kvKey = key => `acct:${key}`;

  async function get(sid) { const key = await S.studentKey(sid); return { key, rec: await S.store.get('kv', kvKey(key)) }; }
  async function exists(sid) { return !!(await get(sid)).rec; }

  async function create(sid, pw, info = {}) {
    const key = await S.studentKey(sid);
    const salt = newSalt();
    const rec = { key, salt, hash: await derive(pw, salt), iter: ITER, created_at: new Date().toISOString(), fails: 0, lockedUntil: 0, grade: info.grade || '', name: info.name || '' };
    await S.store.put('kv', rec, kvKey(key));
    return rec;
  }

  /* Returns { ok } or { ok:false, reason, wait } */
  async function verify(sid, pw) {
    const { key, rec } = await get(sid);
    if (!rec) return { ok: false, reason: 'none' };
    if (Date.now() < rec.lockedUntil) return { ok: false, reason: 'locked', wait: Math.ceil((rec.lockedUntil - Date.now()) / 1000) };
    if ((await derive(pw, rec.salt)) === rec.hash) {
      rec.fails = 0; rec.lockedUntil = 0;
      await S.store.put('kv', rec, kvKey(key));
      return { ok: true, rec };
    }
    rec.fails = (rec.fails || 0) + 1;
    if (rec.fails % 5 === 0) rec.lockedUntil = Date.now() + (rec.fails >= 10 ? 600000 : 60000);
    await S.store.put('kv', rec, kvKey(key));
    return { ok: false, reason: 'wrong', left: 5 - (rec.fails % 5), locked: rec.lockedUntil > Date.now(), wait: Math.ceil((rec.lockedUntil - Date.now()) / 1000) };
  }

  async function reset(sid) { const key = await S.studentKey(sid); await S.store.del('kv', kvKey(key)); }
  async function list() {
    const all = await S.store.all('kv');
    return (all || []).filter(r => r && r.salt && r.hash && r.key);
  }

  /* Password input with a show/hide button */
  function pwInput(id, autocomplete) {
    const input = h('input', { type: 'password', id, autocomplete, autocapitalize: 'off', spellcheck: 'false' });
    const toggle = h('button', { type: 'button', class: 'btn small', onclick: () => { input.type = input.type === 'password' ? 'text' : 'password'; toggle.textContent = input.type === 'password' ? 'Show' : 'Hide'; } }, 'Show');
    return { input, el: h('div', { class: 'pwrow' }, input, toggle) };
  }

  function ruleList(pw) {
    const items = [['at least 8 characters', pw.length >= 8], ['a capital letter (A to Z)', /[A-Z]/.test(pw)], ['a small letter (a to z)', /[a-z]/.test(pw)], ['a number (0 to 9)', /[0-9]/.test(pw)], [`a symbol: ${SPECIAL.split('').join(' ')}`, /[@#$%&]/.test(pw)]];
    return h('ul', { class: 'pwrules' }, items.map(([t, ok]) => h('li', { class: ok ? 'ok' : '' }, t)));
  }

  /* Form shown inside a container. mode 'create' or 'enter'. Resolves true when done, false if cancelled. */
  function passwordForm(container, sid, { mode, info, onCancel, forgot, intro } = {}) {
    return new Promise(resolve => {
      const err = h('p', { class: 'error', role: 'alert' });
      const a = pwInput('pw-a', mode === 'create' ? 'new-password' : 'current-password');
      const b = pwInput('pw-b', 'new-password');
      const rules = h('div', null, ruleList(''));
      if (mode === 'create') a.input.addEventListener('input', () => rules.replaceChildren(ruleList(a.input.value)));
      const submit = async e => {
        e.preventDefault();
        err.textContent = '';
        const pw = a.input.value;
        if (mode === 'create') {
          const p = problems(pw);
          if (p.length) { err.textContent = `Your password needs ${p.join(', ')}.`; return; }
          if (pw !== b.input.value) { err.textContent = 'The two passwords are different. Type them again.'; return; }
          await create(sid, pw, info);
          resolve(true);
          return;
        }
        btn.disabled = true;
        const r = await verify(sid, pw);
        btn.disabled = false;
        if (r.ok) { resolve(true); return; }
        a.input.value = '';
        err.textContent = r.reason === 'locked' ? `Too many wrong passwords. Try again in ${r.wait} seconds.`
          : r.locked ? `Too many wrong passwords. Try again in ${r.wait >= 120 ? Math.round(r.wait / 60) + ' minutes' : r.wait + ' seconds'}.`
          : `Wrong password. ${r.left} ${r.left === 1 ? 'try' : 'tries'} left before a short lock.`;
      };
      const btn = h('button', { class: 'btn primary', type: 'submit' }, mode === 'create' ? 'Save my password' : 'Continue');
      container.replaceChildren(h('form', { class: 'sform narrow pwform', onsubmit: submit },
        intro ? h('p', null, intro) : null,
        mode === 'create' ? h('p', { class: 'muted' }, 'Choose a password only you know. You will use it for Prep and History, and in the test.') : null,
        h('label', { class: 'field' }, h('span', null, mode === 'create' ? 'New password' : 'Password'), a.el),
        mode === 'create' ? rules : null,
        mode === 'create' ? h('label', { class: 'field' }, h('span', null, 'Type it again'), b.el) : null,
        err,
        h('div', { class: 'row wrap' }, btn,
          mode === 'enter' && forgot ? h('button', { class: 'btn', type: 'button', onclick: async () => {
            if (!(await S.ui.askPin('Operator: reset this password'))) return;
            await reset(sid);
            S.ui.toast('Password cleared. Choose a new one.');
            resolve(passwordForm(container, sid, { mode: 'create', info, onCancel, forgot, intro: 'The operator cleared your old password.' }));
          } }, 'I forgot my password') : null,
          onCancel ? h('button', { class: 'btn', type: 'button', onclick: () => { onCancel(); resolve(false); } }, 'Back') : null)));
      setTimeout(() => a.input.focus(), 50);
    });
  }

  /* Student sign-in for Prep and History: student ID, then password (or create one the first time).
     Resolves { student_id, key, rec } or null. */
  function signIn(container, { title, text, needInfo }) {
    return new Promise(resolve => {
      const sid = h('input', { type: 'text', id: 'acct-sid', inputmode: 'numeric', autocomplete: 'off' });
      const name = h('input', { type: 'text', id: 'acct-name', autocomplete: 'off' });
      const grade = h('select', { id: 'acct-grade' }, h('option', { value: '' }, 'Choose'), ['G8', 'G9', 'G10', 'G11', 'G12'].map(g => h('option', { value: g }, g)));
      const err = h('p', { class: 'error', role: 'alert' });
      const step = h('div');
      const first = () => {
        step.replaceChildren(h('form', { class: 'sform narrow', onsubmit: async e => {
          e.preventDefault();
          const id = sid.value.trim();
          if (!id) { err.textContent = 'Enter your student ID.'; return; }
          err.textContent = '';
          const { key, rec } = await get(id);
          if (rec) {
            const ok = await passwordForm(step, id, { mode: 'enter', forgot: true, onCancel: first, info: { grade: rec.grade, name: rec.name }, intro: `Student ID ${id}` });
            if (ok) resolve({ student_id: id, key, rec: (await get(id)).rec });
            return;
          }
          /* Results already saved for this ID but no password: only the operator can let a new password be set */
          const hasData = (await S.store.sessions()).some(x => x.student && x.student.student_id === id && !x.demo) || ((await S.store.all('prep')) || []).some(r => r.student_key === key && !r.demo);
          if (hasData && !(await S.ui.askPin('Operator: allow a new password for this student ID'))) { err.textContent = 'Results already exist for this student ID. Ask the operator to set up your password.'; return; }
          /* First time: name and grade (for Prep), then a new password */
          step.replaceChildren(h('form', { class: 'sform narrow', onsubmit: async ev => {
            ev.preventDefault();
            if (needInfo && (!name.value.trim() || !grade.value)) { err2.textContent = 'Fill in your full name and grade.'; return; }
            const info = { name: name.value.trim(), grade: grade.value };
            const ok = await passwordForm(step, id, { mode: 'create', info, onCancel: first, intro: `Student ID ${id}: first time here.` });
            if (ok) resolve({ student_id: id, key, rec: (await get(id)).rec });
          } },
            h('p', null, `Student ID ${id} has no password yet. This is your first time, so set one up now.`),
            needInfo ? h('label', { class: 'field' }, h('span', null, 'Full name'), name) : null,
            needInfo ? h('label', { class: 'field' }, h('span', null, 'Grade'), grade) : null,
            (() => { err2 = h('p', { class: 'error', role: 'alert' }); return err2; })(),
            h('div', { class: 'row wrap' }, h('button', { class: 'btn primary', type: 'submit' }, 'Next'), h('button', { class: 'btn', type: 'button', onclick: first }, 'Back'))));
        } },
          h('label', { class: 'field' }, h('span', null, 'Student ID'), sid),
          err,
          h('div', null, h('button', { class: 'btn primary', type: 'submit' }, 'Next'))));
        setTimeout(() => sid.focus(), 50);
      };
      let err2 = null;
      container.replaceChildren(h('h1', null, title), text ? h('p', null, text) : null, step);
      first();
    });
  }

  return { problems, exists, create, verify, reset, list, signIn, passwordForm, get };
})();
