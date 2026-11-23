/* Management > Board check: finds the 4 markers live, shows the straightened board with the 5 zones,
   and counts how often all 4 markers are found (Stage 1 test: at least 19 of the last 20 checks). */
window.S = window.S || {};

S.boardCheck = (() => {
  const { h } = S.util;
  const NAMES = { 31: 'Top left (31)', 115: 'Top right (115)', 261: 'Bottom left (261)', 161: 'Bottom right (161)' };
  const AI_NAME = { empty: 'Empty', right_lung: 'Right lung', left_lung: 'Left lung', heart: 'Heart', trachea: 'Windpipe', diaphragm: 'Diaphragm', flipped: 'Flipped', upside_down: 'Upside down', partial: 'Partial', hand: 'Hand' };
  const ZONE_COLOURS = { rlung: '#E5243B', llung: '#C2185B', windpipe: '#E08A00', heart: '#7B1FA2', diaphragm: '#1565C0' };

  function view() {
    const status = h('p', { class: 'camstatus muted', role: 'status' }, 'Start the camera, or test with a photo of the board.');
    const chips = h('div', { class: 'mchips' }, Object.entries(NAMES).map(([id, n]) => h('span', { class: 'mchip', 'data-id': id }, n)));
    const tally = h('p', { class: 'tally' });
    const live = h('div', { class: 'bc-live' });
    const flat = h('div', { class: 'bc-flat' });
    const crops = h('div', { class: 'bc-crops' });
    const work = document.createElement('canvas');
    let video = null, running = false, history = [], aiBusy = false, lastAiMs = null;
    const aiTime = h('p', { class: 'muted small' });

    const show = (found, ms) => {
      const ids = new Set(found.map(f => f.id));
      chips.querySelectorAll('.mchip').forEach(c => c.classList.toggle('ok', ids.has(Number(c.dataset.id))));
      tally.textContent = history.length ? `All 4 found in ${history.filter(Boolean).length} of the last ${history.length} checks${history.length >= 20 ? (history.filter(Boolean).length >= 19 ? ' (pass)' : ' (not yet: aim for 19 of 20)') : ''}.${ms != null ? ` Each check took ${Math.round(ms)} ms.` : ''}` : '';
    };

    /* Run detection on whatever is in the work canvas, draw the overlay, the flat board and the crops */
    function analyse(overlayOn) {
      const t0 = performance.now();
      const img = work.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, work.width, work.height);
      const found = S.aruco.detect(img);
      const ms = performance.now() - t0;
      history.push(found.length === 4); if (history.length > 20) history.shift();
      /* Overlay: green marker outlines and IDs */
      const ov = overlayOn;
      const ctx = ov.getContext('2d');
      ov.width = work.width; ov.height = work.height;
      ctx.drawImage(work, 0, 0);
      ctx.lineWidth = Math.max(3, work.width / 200);
      ctx.font = `bold ${Math.max(14, work.width / 40)}px system-ui, sans-serif`;
      for (const f of found) {
        ctx.strokeStyle = '#18C964'; ctx.beginPath();
        f.corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = '#18C964'; ctx.fillText(String(f.id), f.centre[0] + 4, f.centre[1] - 4);
      }
      show(found, ms);
      const layout = Object.assign({}, S.BOARD, { pxPerCm: 12 });
      const board = S.aruco.straighten(work, found, layout);
      if (!board) {
        status.className = 'camstatus bad';
        status.textContent = `${found.length} of 4 markers found. Make sure all 4 are in the picture, flat and not covered.`;
        return;
      }
      status.className = 'camstatus ok';
      status.textContent = 'All 4 markers found. The board is straightened below.';
      /* Zones on the flat board */
      const bctx = board.getContext('2d');
      bctx.lineWidth = 3; bctx.font = 'bold 16px system-ui, sans-serif';
      /* Cut the crops first, so the zone outlines drawn next don't show up in them */
      const ai = S.zoneAI.model;
      const zoneCanvases = [];
      const guessEls = [];
      const cropEls = Object.entries(S.BOARD.zones).map(([k, z]) => {
        const c = S.aruco.zoneCrop(board, z, 224, layout);
        zoneCanvases.push(c);
        const guess = h('span', { class: 'aiguess unsure' }, ai ? 'AI: ...' : '');
        guessEls.push(guess);
        return h('figure', null, c, h('figcaption', null, S.ORGAN_NAME[k] || k, guess));
      });
      /* The AI takes longer than one camera frame: run it only when it is free, on the newest crops */
      if (ai && !aiBusy) {
        aiBusy = true;
        const t1 = performance.now();
        S.zoneAI.predictMany(zoneCanvases).then(gs => {
          gs.forEach((g, i) => { guessEls[i].className = `aiguess ${g.conf < 0.6 ? 'unsure' : ''}`; guessEls[i].textContent = `AI: ${AI_NAME[g.name] || g.name} ${Math.round(g.conf * 100)}%`; });
          lastAiMs = performance.now() - t1;
          aiTime.textContent = `The AI took ${Math.round(lastAiMs)} ms for all 5 zones.`;
        }).catch(e => { aiTime.textContent = 'AI error: ' + (e && e.message); }).finally(() => { aiBusy = false; });
      } else if (ai) { guessEls.forEach(g => { g.textContent = 'AI: busy, next frame'; }); }
      for (const [k, z] of Object.entries(S.BOARD.zones)) {
        const [x, y] = board.toBoard(z.x, z.y);
        bctx.strokeStyle = ZONE_COLOURS[k] || '#000';
        bctx.strokeRect(x, y, z.w * layout.pxPerCm, z.h * layout.pxPerCm);
        bctx.fillStyle = ZONE_COLOURS[k] || '#000';
        bctx.fillText(S.ORGAN_NAME[k] || k, x + 4, y + 18);
      }
      flat.replaceChildren(board);
      crops.replaceChildren(...cropEls);
    }

    const overlay = h('canvas', { class: 'bc-overlay' });
    live.append(overlay);

    async function loop() {
      while (running && document.body.contains(overlay)) {
        if (video && video.videoWidth) {
          const k = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
          work.width = Math.round(video.videoWidth * k); work.height = Math.round(video.videoHeight * k);
          work.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0, work.width, work.height);
          analyse(overlay);
        }
        await S.util.realSleep(300);
      }
      if (!document.body.contains(overlay)) S.camera.stop();
    }

    const startBtn = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      status.className = 'camstatus muted'; status.textContent = 'Starting the camera...';
      const r = await S.camera.test(S.settings.get().cameraFacing || 'environment');
      if (!r.ok) { status.className = 'camstatus bad'; status.textContent = r.message; return; }
      video = r.video; history = []; running = true;
      loop();
    } }, 'Start camera');
    const stopBtn = h('button', { class: 'btn', type: 'button', onclick: () => { running = false; S.camera.stop(); status.className = 'camstatus muted'; status.textContent = 'Stopped. The last result stays on screen.'; } }, 'Pause');
    const file = h('input', { type: 'file', accept: 'image/*', id: 'bc-file', style: 'display:none', onchange: async () => {
      const f = file.files[0]; if (!f) return;
      running = false; S.camera.stop();
      const im = new Image();
      im.src = URL.createObjectURL(f);
      await im.decode();
      const k = Math.min(1, 1280 / Math.max(im.naturalWidth, im.naturalHeight));
      work.width = Math.round(im.naturalWidth * k); work.height = Math.round(im.naturalHeight * k);
      work.getContext('2d', { willReadFrequently: true }).drawImage(im, 0, 0, work.width, work.height);
      history = [];
      analyse(overlay);
      file.value = '';
    } });
    const fileBtn = h('button', { class: 'btn', type: 'button', onclick: () => file.click() }, 'Test with a photo');
    const saveBtn = h('button', { class: 'btn', type: 'button', onclick: () => {
      const c = flat.querySelector('canvas');
      if (!c) { S.ui.toast('Nothing to save yet.'); return; }
      c.toBlob(b => S.util.download(`board-straightened-${S.util.stamp()}.png`, b), 'image/png');
    } }, 'Save straightened board');

    const aiNote = h('p', { class: 'muted small' }, 'Loading the AI...');
    S.zoneAI.load().then(m => { aiNote.textContent = `${m.backbone === 'mobilenetv2' ? 'MobileNet AI' : 'Small fallback AI' + (m.fallbackReason ? ` (MobileNet could not start: ${m.fallbackReason})` : '')}, model from ${m.version}, trained on sessions ${(m.info.trained_on || []).filter(s => s < 90).join(', ')}${(m.info.trained_on || []).some(s => s >= 90) ? ' and the hand videos' : ''} (${Number(m.info.pictures).toLocaleString('en-US')} pictures).`; }).catch(() => { aiNote.textContent = 'No AI model yet.'; });
    return h('div', { class: 'boardcheck' },
      h('p', null, 'Hold the tablet where it will sit in the station. Every marker found turns green. The straightened board shows the 5 zones; each square underneath is what the AI will look at.'),
      h('div', { class: 'row wrap' }, startBtn, stopBtn, fileBtn, saveBtn, file),
      status, chips, tally,
      h('div', { class: 'bc-grid' },
        h('section', null, h('h2', null, 'Camera picture'), live),
        h('section', null, h('h2', null, 'Straightened board'), flat)),
      h('h2', null, 'What the AI sees in each zone'),
      aiNote,
      aiTime,
      crops);
  }

  return { view };
})();
