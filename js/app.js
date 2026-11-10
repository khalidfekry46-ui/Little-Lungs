/* Start-up: offline support, PIN setup on first run, then the operator sign-in. */
window.S = window.S || {};

(async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.get('speed')) S.settings.save({ simSpeed: Number(params.get('speed')) });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode unavailable here */ });
  }
  /* Keep the tablet screen on during a session where the browser allows it */
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && S.test.session && navigator.wakeLock) { try { await navigator.wakeLock.request('screen'); } catch (e) { /* not allowed */ } }
  });
  document.addEventListener('pointerdown', () => S.audio.unlock(), { once: true });
  window.addEventListener('beforeunload', e => { if (S.test.session) { e.preventDefault(); e.returnValue = ''; } });

  S.sync.startAuto();
  if (!S.ui.pinSaved()) {
    const r = S.ui.root();
    r.dataset.view = 'lock';
    r.replaceChildren(S.util.h('div', { class: 'lock' },
      S.art.verity('big'),
      S.util.h('h1', null, 'Little Lungs'),
      S.util.h('p', null, 'First start on this device. Choose two PINs: a 4-digit operator PIN to unlock the app and confirm test steps, and a 6-digit Management PIN for results and settings. Only the operator should know them.'),
      S.ui.button('Choose the PINs', async () => {
        S.audio.unlock();
        if (!(await S.ui.setupPin(true, 'operator'))) return;
        if (!(await S.ui.setupPin(true, 'manage'))) return;
        S.admin.home('PINs saved. Open Management > Settings before the first session.');
      })));
    return;
  }
  S.admin.lock();
})();
