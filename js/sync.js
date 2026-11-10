/* Cloud upload to Google Sheets through a Google Apps Script web app (apps-script/Code.gs).
   Sessions are saved on the tablet first. Upload happens when internet is available,
   and again whenever ground truth is added, so the Sheet always holds the latest version. */
window.S = window.S || {};

S.sync = (() => {
  const st = () => S.settings.get();
  async function tableHash(tables) { return S.util.sha256(JSON.stringify(tables)); }

  async function needsUpload(s) {
    if (s.demo || !s.end) return false;
    if (!s.sync.synced_at) return true;
    return (await tableHash(S.flatten(s))) !== s.sync.hash;
  }

  async function post(body) {
    const res = await fetch(st().syncUrl, { method: 'POST', body: JSON.stringify(body) });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'Upload refused');
    return j;
  }

  async function session(s) {
    if (s.demo || !s.end) return false;
    if (!st().syncUrl) { s.sync.error = 'No cloud link set in Settings'; await S.store.saveSession(s); return false; }
    const tables = S.flatten(s);
    const hash = await tableHash(tables);
    if (s.sync.synced_at && s.sync.hash === hash) return true;
    try {
      await post({ key: st().syncKey, session_id: s.id, tables });
      s.sync.synced_at = new Date().toISOString();
      s.sync.hash = hash;
      s.sync.error = null;
      await S.store.saveSession(s);
      return true;
    } catch (e) {
      s.sync.error = navigator.onLine ? `Upload failed: ${e.message}` : 'No internet; will retry';
      await S.store.saveSession(s);
      return false;
    }
  }

  async function all() {
    await flushDeletes().catch(() => {});
    const list = await S.store.sessions();
    let ok = 0, fail = 0;
    for (const s of list) {
      if (!(await needsUpload(s))) continue;
      (await session(s)) ? ok++ : fail++;
    }
    for (const r of (await S.store.all('prep')) || []) {
      if (r.demo || !r.finished_at || r.synced_at) continue;
      (await prep(r)) ? ok++ : fail++;
    }
    return { ok, fail };
  }

  /* A finished Prep attempt goes to the Prep tab of the Sheet */
  async function prep(r) {
    if (r.demo || !st().syncUrl) return false;
    try {
      await post({ key: st().syncKey, session_id: r.id, tables: S.flattenPrep(r) });
      r.synced_at = new Date().toISOString();
      await S.store.put('prep', r);
      return true;
    } catch (e) { return false; }
  }

  async function pendingCount() {
    const list = await S.store.sessions();
    let n = 0;
    for (const s of list) if (await needsUpload(s)) n++;
    for (const r of (await S.store.all('prep')) || []) if (!r.demo && r.finished_at && !r.synced_at) n++;
    return n;
  }

  async function exportAll() {
    const url = `${st().syncUrl}?action=export&key=${encodeURIComponent(st().syncKey)}`;
    const res = await fetch(url);
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'Export refused');
    return j.tables;
  }

  async function photo(p) {
    const data = await new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(p.blob); });
    return post({ key: st().syncKey, type: 'photo', name: p.name, mime: p.blob.type || 'image/jpeg', data });
  }

  /* Deleting a session also removes its rows from the Sheet; if offline, it is retried later */
  const DEL_KEY = 'anatomy-station-pending-deletes';
  const pendingDeletes = () => { try { return JSON.parse(localStorage.getItem(DEL_KEY) || '[]'); } catch (e) { return []; } };
  const setDeletes = l => { try { localStorage.setItem(DEL_KEY, JSON.stringify(l)); } catch (e) { /* ignore */ } };
  async function remove(id) {
    setDeletes([...new Set([...pendingDeletes(), id])]);
    return flushDeletes();
  }
  async function flushDeletes() {
    if (!st().syncUrl) return false;
    for (const id of pendingDeletes()) {
      try { await post({ key: st().syncKey, type: 'delete', session_id: id }); setDeletes(pendingDeletes().filter(x => x !== id)); } catch (e) { return false; }
    }
    return true;
  }

  /* Retry in the background whenever the connection comes back */
  let timer = null;
  function startAuto() {
    window.addEventListener('online', () => all().catch(() => {}));
    clearInterval(timer);
    timer = setInterval(() => { if (navigator.onLine && st().syncUrl && !S.test.session) all().catch(() => {}); }, 120000);
  }

  return { session, prep, all, pendingCount, needsUpload, exportAll, photo, remove, startAuto };
})();
