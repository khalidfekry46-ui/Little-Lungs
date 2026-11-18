/* Management > Collect photos: guided training-photo sessions for the camera AI (Stage 3 of the training plan).
   Each session has 25 shots. For each shot the app says how to arrange the pieces; you tap Capture; the app
   straightens the board, cuts out the 5 zones and names each zone picture with its category. You check the
   names (especially for partial and hand shots), save, and move on. Everything stays on this device until you
   download the session as a zip. */
window.S = window.S || {};

/* ---------- Minimal zip writer (no compression: JPEGs are already compressed) ---------- */
S.zip = (() => {
  const table = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = d => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = table[(c ^ d[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  /* files: [{ name, data: Uint8Array }] -> Blob */
  function build(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    const d = new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(lh, name, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(ch, name);
      offset += 30 + name.length + size;
    }
    const cdSize = central.reduce((s, p) => s + p.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type: 'application/zip' });
  }
  return { build, crc32 };
})();

S.collect = (() => {
  const { h } = S.util;

  /* The 8 categories the AI learns (see the training plan) */
  const CATS = ['empty', 'right_lung', 'left_lung', 'heart', 'trachea', 'diaphragm', 'flipped', 'upside_down', 'partial', 'hand'];
  const CAT_NAME = { empty: 'Empty', right_lung: 'Right lung', left_lung: 'Left lung', heart: 'Heart', trachea: 'Windpipe', diaphragm: 'Diaphragm', flipped: 'Flipped (back side up)', upside_down: 'Upside down', partial: 'Partial / overlap', hand: 'Hand' };
  const PIECE_CAT = { rlung: 'right_lung', llung: 'left_lung', heart: 'heart', windpipe: 'trachea', diaphragm: 'diaphragm' };
  const ZONES = ['rlung', 'windpipe', 'heart', 'llung', 'diaphragm'];
  const ZN = k => S.ORGAN_NAME[k] || k;
  const ZONE_COLOURS = { rlung: '#E5243B', llung: '#C2185B', windpipe: '#E08A00', heart: '#7B1FA2', diaphragm: '#1565C0' };
  const SPLIT = n => (n <= 12 || n >= 17 ? 'train' : n <= 15 ? 'validation' : 'test');
  const ACTIVE_KEY = 'll-collect-active';

  /* Seeded random numbers, so a session's plan is the same every time it is opened */
  const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pickN = (r, arr, n) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  const allCorrect = () => Object.fromEntries(ZONES.map(z => [z, PIECE_CAT[z]]));

  /* What to change in each session, so the photos differ (lighting, camera position, room, hands).
     type: 'standard' (all kinds of photos), 'focus' (only hands and overlaps) or 'tricks' (only flipped and upside-down pieces). */
  const SCHEDULE = {
    1: { type: 'standard', lighting: 'Ceiling lights', camera: 'Normal height', tip: 'Ceiling lights on. Phone at a normal height, straight above the board.' },
    2: { type: 'standard', lighting: 'Ceiling lights', camera: 'A little higher', tip: 'Ceiling lights on. Hold the phone about 10 cm higher than last time.' },
    3: { type: 'standard', lighting: 'Ceiling lights', camera: 'A little lower', tip: 'Ceiling lights on. Hold the phone about 10 cm lower (all 4 markers must still show).' },
    4: { type: 'standard', lighting: 'Desk lamp from the left', camera: 'Normal height', tip: 'Main light off, a desk lamp or phone torch shining from the LEFT side.' },
    5: { type: 'standard', lighting: 'Desk lamp from the right', camera: 'Tilted a little', tip: 'Lamp from the RIGHT side. Tilt the phone a little (about 15 degrees).' },
    6: { type: 'standard', lighting: 'Desk lamp from above', camera: 'Moved to one side', tip: 'Lamp from above. Move the phone a little toward one side of the board.' },
    7: { type: 'standard', lighting: 'Dim room', camera: 'Normal height', tip: 'Dim room: main light off, only a weak light far away.' },
    8: { type: 'standard', lighting: 'Dim room', camera: 'A little higher', tip: 'Dim room again, phone a little higher.' },
    9: { type: 'standard', lighting: 'Mixed / changing', camera: 'Tilted a little', tip: 'Ceiling light AND a lamp from one side. Tilt the phone the other way this time.' },
    10: { type: 'standard', lighting: 'Ceiling lights', camera: 'Moved to one side', tip: 'Move the board to a DIFFERENT room or table. Ceiling lights.' },
    11: { type: 'standard', lighting: 'Mixed / changing', camera: 'A little lower', tip: 'Different room or table again. Let a shadow fall across part of the board.' },
    12: { type: 'standard', lighting: 'Daylight from a window', camera: 'Normal height', tip: 'Daylight if you can (otherwise any new light). Use hands and sleeves you have not used before.' },
    13: { type: 'standard', lighting: 'Daylight from a window', camera: 'On the holder', tip: 'VALIDATION. Another day, daylight, tablet on the holder.' },
    14: { type: 'standard', lighting: 'Ceiling lights', camera: 'On the holder', tip: 'VALIDATION. Ceiling lights, tablet on the holder, new hands.' },
    15: { type: 'standard', lighting: 'Desk lamp from the left', camera: 'On the holder', tip: 'VALIDATION. Lamp from one side, tablet on the holder.' },
    16: { type: 'standard', lighting: 'Mixed / changing', camera: 'On the holder', tip: 'FINAL TEST. The real station: MatePad on the holder, in the room where students will be tested. Use this session only once.' },
    17: { type: 'focus', lighting: 'Ceiling lights', camera: 'Normal height', tip: 'EXTRA TRAINING: hands and overlaps. Ceiling lights, normal height.' },
    18: { type: 'tricks', lighting: 'Desk lamp from the right', camera: 'Tilted a little', tip: 'EXTRA TRAINING: flipped and upside-down pieces. Lamp from the right, phone tilted.' },
    19: { type: 'standard', lighting: 'Daylight from a window', camera: 'A little higher', tip: 'EXTRA TRAINING. Daylight, a little higher, new hands.' },
    20: { type: 'focus', lighting: 'Dim room', camera: 'A little lower', tip: 'EXTRA TRAINING: hands and overlaps. Dim room, a little lower.' },
    21: { type: 'tricks', lighting: 'Ceiling lights', camera: 'A little higher', tip: 'EXTRA TRAINING: flipped and upside-down pieces. Ceiling lights, a little higher.' }
  };
  const schedule = n => SCHEDULE[n] || { type: ['standard', 'focus', 'tricks'][n % 3], lighting: 'Mixed / changing', camera: 'Moved to one side', tip: 'EXTRA TRAINING. Pick lighting and a camera position you have used least so far.' };

  const PARTIALS = [
    { text: 'Slide the heart halfway into the left lung’s box (it may lie on the lung’s edge).', set: { heart: 'partial', llung: 'partial' } },
    { text: 'Slide the right lung outward so about a third of it is outside its box.', set: { rlung: 'partial' } },
    { text: 'Slide the left lung outward so about a third of it is outside its box.', set: { llung: 'partial' } },
    { text: 'Push the diaphragm up so it overlaps the bottom of both lungs. Keep it off the corner markers.', set: { diaphragm: 'partial', rlung: 'partial', llung: 'partial' } },
    { text: 'Take the heart off, then slide the windpipe down so its lower half is in the heart’s box.', set: { windpipe: 'partial', heart: 'partial' } },
    { text: 'Slide the left lung toward the middle so it covers part of the heart’s box.', set: { llung: 'partial', heart: 'partial' } },
    { text: 'Put the heart across the right lung’s inner edge, half on the lung.', set: { heart: 'partial', rlung: 'partial' } },
    { text: 'Slide the windpipe sideways so half of it is over the right lung’s box.', set: { windpipe: 'partial', rlung: 'partial' } },
    { text: 'Slide the diaphragm to the right so one end sticks well out of its box.', set: { diaphragm: 'partial' } },
    { text: 'Put the heart low, half in the heart box and half on the diaphragm.', set: { heart: 'partial', diaphragm: 'partial' } }
  ];
  /* Decoy magnets: the 5 round magnet pairs that are NOT a correct spot. A piece snapped onto one sits several cm off,
     so its zone shows a Partial piece (and the zone it pushes into shows two pieces = Partial). */
  const DECOYS = [
    { text: 'Put the windpipe on the TOP round magnet pair (up in the neck) instead of its star magnets.', set: { windpipe: 'partial' } },
    { text: 'Put the right lung on the UPPER-LEFT round magnet pair instead of its diamond magnet. If it covers the top-left marker, move it until the marker is fully visible and tell your teammate.', set: { rlung: 'partial' } },
    { text: 'Put the heart on the MIDDLE round magnet pair (between the lungs) instead of its lower star magnets.', set: { heart: 'partial', windpipe: 'partial' } },
    { text: 'Put the left lung on the RIGHT round magnet pair (below its diamond) instead of its diamond magnet.', set: { llung: 'partial', diaphragm: 'partial' } },
    { text: 'Put the diaphragm on the BOTTOM-RIGHT round magnet pair instead of its round magnets in the middle. Keep it off the bottom-right marker.', set: { diaphragm: 'partial' } },
    { text: 'Put the left lung on the MIDDLE round magnet pair (between the lungs), and take the heart off the board.', set: { llung: 'partial', heart: 'partial', windpipe: 'partial' } },
    { text: 'Put the heart on the RIGHT round magnet pair (below the left lung\u2019s diamond).', set: { heart: 'partial', llung: 'partial' } }
  ];
  const decoyShot = d => ({ kind: 'partial', decoy: true, text: d.text + ' Everything else in its correct place.', labels: Object.assign(allCorrect(), d.set), check: ZONES.slice() });
  const HAND_PAIRS = [['rlung', 'heart'], ['heart', 'llung'], ['windpipe', 'heart'], ['rlung', 'diaphragm'], ['llung', 'diaphragm'], ['windpipe', 'rlung'], ['windpipe', 'llung'], ['heart', 'diaphragm']];
  const handShot = (pair, how) => ({ kind: 'hand', text: `${how} over the ${pair.map(ZN).join(' and ')} boxes, all pieces in place. Use a different hand or sleeve each time. Mark every zone the hand or sleeve covers as Hand.`, labels: Object.assign(allCorrect(), Object.fromEntries(pair.map(z => [z, 'hand']))), check: ZONES.slice() });
  const HOWS = ['Hold a hand flat', 'Hold a hand as if about to place a piece', 'Rest your fingertips', 'Hold a hand with a sleeve'];
  const partialShot = p => ({ kind: 'partial', text: p.text + ' Everything else in its correct place.', labels: Object.assign(allCorrect(), p.set), check: ZONES.slice() });

  /* Flipped = back side up (lungs and heart; flipping the diaphragm is allowed, the windpipe cannot flip).
     Upside down = turned round so its top points down (any piece). Both are wrong placements. */
  const FLIPS = [
    { text: 'Flip the RIGHT lung over (back side up) in its own place.', set: { rlung: 'flipped' } },
    { text: 'Flip the LEFT lung over (back side up) in its own place.', set: { llung: 'flipped' } },
    { text: 'Flip the heart over (back side up) in its own place.', set: { heart: 'flipped' } },
    { text: 'Flip BOTH lungs over (back side up), each in its own place.', set: { rlung: 'flipped', llung: 'flipped' } },
    { text: 'Flip the right lung over and put it in the LEFT lung’s place; take the left lung off the board.', set: { llung: 'flipped', rlung: 'empty' } },
    { text: 'Flip the left lung over and put it in the RIGHT lung’s place; take the right lung off the board.', set: { rlung: 'flipped', llung: 'empty' } },
    { text: 'Flip the heart and both lungs over (back side up), each in its own place.', set: { heart: 'flipped', rlung: 'flipped', llung: 'flipped' } },
    { text: 'Swap the lungs AND flip both over (back side up).', set: { rlung: 'flipped', llung: 'flipped' } }
  ];
  const UPSIDES = [
    { text: 'Turn the diaphragm upside down: curve facing up, the ^^^ shape facing down.', set: { diaphragm: 'upside_down' } },
    { text: 'Flip the diaphragm over AND turn it upside down (curve up, ^^^ down).', set: { diaphragm: 'upside_down' } },
    { text: 'Turn the windpipe upside down (its wide end at the top).', set: { windpipe: 'upside_down' } },
    { text: 'Turn the heart upside down in its own place.', set: { heart: 'upside_down' } },
    { text: 'Turn the right lung upside down (narrow tip at the bottom), as far inside its box as it fits.', set: { rlung: 'upside_down' }, check: ['rlung', 'heart', 'diaphragm'] },
    { text: 'Turn the left lung upside down (narrow tip at the bottom), as far inside its box as it fits.', set: { llung: 'upside_down' }, check: ['llung', 'heart', 'diaphragm'] },
    { text: 'Turn BOTH the windpipe and the diaphragm upside down.', set: { windpipe: 'upside_down', diaphragm: 'upside_down' } },
    { text: 'Flip the heart over AND turn it upside down.', set: { heart: 'flipped' } }
  ];
  const trickShot = (kind, x) => ({ kind, text: x.text + ' Everything else in its correct place.', labels: Object.assign(allCorrect(), x.set), check: x.check || [] });

  /* A mixed "tricks" photo: several pieces flipped or upside down at once, so every photo gives many examples */
  const TRICK_OPTS = {
    rlung: [['ok', 'in place, front side up'], ['flipped', 'FLIP it over (back side up)'], ['upside_down', 'turn it UPSIDE DOWN (front side up)'], ['flipped', 'flip it over AND turn it upside down']],
    llung: [['ok', 'in place, front side up'], ['flipped', 'FLIP it over (back side up)'], ['upside_down', 'turn it UPSIDE DOWN (front side up)'], ['flipped', 'flip it over AND turn it upside down']],
    heart: [['ok', 'in place, front side up'], ['flipped', 'FLIP it over (back side up)'], ['upside_down', 'turn it UPSIDE DOWN (front side up)'], ['flipped', 'flip it over AND turn it upside down']],
    windpipe: [['ok', 'in place'], ['upside_down', 'turn it UPSIDE DOWN (wide end at the top)']],
    diaphragm: [['ok', 'in place'], ['ok', 'OTHER side up, still the right way round (counts as correct)'], ['upside_down', 'turn it UPSIDE DOWN (curve up, ^^^ down)'], ['upside_down', 'other side up AND upside down']]
  };
  function trickCombo(r) {
    for (;;) {
      const pick = Object.fromEntries(ZONES.map(z => { const o = TRICK_OPTS[z]; return [z, o[Math.floor(r() * o.length)]]; }));
      const tricks = ZONES.filter(z => pick[z][0] !== 'ok');
      if (tricks.length < 3) continue;
      const labels = Object.fromEntries(ZONES.map(z => [z, pick[z][0] === 'ok' ? PIECE_CAT[z] : pick[z][0]]));
      const kind = tricks.some(z => pick[z][0] === 'flipped') ? 'flipped' : 'upside_down';
      const lungUp = ['rlung', 'llung'].filter(z => pick[z][0] === 'upside_down');
      return { kind, text: 'Each piece in its own place. ' + ZONES.map(z => `${ZN(z)}: ${pick[z][1]}.`).join(' '), labels, check: lungUp.length ? lungUp.concat(['heart', 'diaphragm']) : [] };
    }
  }
  /* Two overlaps at once in different parts of the board */
  function partialCombo(r) {
    for (;;) {
      const [a, b] = pickN(r, PARTIALS, 2);
      const za = Object.keys(a.set), zb = Object.keys(b.set);
      if (za.some(z => zb.includes(z))) continue;
      if (/heart off/.test(a.text + b.text)) continue;
      return { kind: 'partial', text: `${a.text.replace(/\.$/, '')}, AND ${b.text.charAt(0).toLowerCase() + b.text.slice(1)} Everything else in its correct place.`, labels: Object.assign(allCorrect(), a.set, b.set), check: ZONES.slice() };
    }
  }
  /* Two hands at once, each over two neighbouring zones */
  function twoHands(r) {
    for (;;) {
      const [a, b] = pickN(r, HAND_PAIRS, 2);
      if (a.some(z => b.includes(z))) continue;
      const zs = a.concat(b);
      return { kind: 'hand', text: `Two hands at once (one person or two): one hand over the ${a.map(ZN).join(' and ')} boxes, the other over the ${b.map(ZN).join(' and ')} boxes. All pieces in place. Mark every zone a hand or sleeve covers as Hand.`, labels: Object.assign(allCorrect(), Object.fromEntries(zs.map(z => [z, 'hand']))), check: ZONES.slice() };
    }
  }

  /* The 25-shot plan for a session.
     Standard: 5 correct (2 with the diaphragm's other side up), 3 empty, 4 wrong, 7 flipped or upside down, 3 partial, 3 hand.
     Focus: 12 hand, 13 partial. Tricks: 25 mixed flipped and upside-down photos. */
  function plan(session) {
    const r = rng(session * 7919 + 17);
    const type = schedule(session).type;
    const shots = [];
    const done = () => shots.map((s, i) => Object.assign(s, { n: i + 1 }));
    if (type === 'focus') {
      for (let i = 0; i < 6; i++) shots.push(twoHands(r));
      pickN(r, HAND_PAIRS, 6).forEach((pr, i) => shots.push(handShot(pr, HOWS[i % HOWS.length])));
      for (let i = 0; i < 8; i++) shots.push(partialCombo(r));
      pickN(r, DECOYS, 5).forEach(d => shots.push(decoyShot(d)));
      return done();
    }
    if (type === 'tricks') {
      for (let i = 0; i < 25; i++) shots.push(trickCombo(r));
      return done();
    }
    const moves = pickN(r, ['exactly in place', 'all shifted a little to the left', 'all shifted a little to the right', 'all shifted a little up', 'all shifted a little down',
      'each turned slightly clockwise', 'each turned slightly anticlockwise', 'placed a bit carelessly, each one slightly off'], 3);
    moves.forEach(m => shots.push({ kind: 'correct', text: `All 5 pieces in their correct places, ${m}. Keep every piece inside its box.`, labels: allCorrect(), check: [] }));
    ['exactly in place', 'each placed slightly off'].forEach(m => shots.push({ kind: 'correct', text: `All 5 pieces correct, ${m}, but with the diaphragm’s OTHER side up (still curve down, ^^^ up). This counts as correct.`, labels: allCorrect(), check: [] }));
    for (let i = 0; i < 2; i++) {
      const gone = pickN(r, ZONES, 1 + i * 2);
      const labels = allCorrect(); gone.forEach(z => { labels[z] = 'empty'; });
      shots.push({ kind: 'empty', text: `Take these off the board: ${gone.map(ZN).join(', ')}. Everything else in its correct place.`, labels, check: [] });
    }
    shots.push({ kind: 'empty', text: 'Empty board: take every piece off. Leave any loose magnets or discs where they are.', labels: Object.fromEntries(ZONES.map(z => [z, 'empty'])), check: [] });
    const wrong = [
      { text: 'Swap the two lungs: the right lung goes where the left lung belongs, and the left lung where the right lung belongs.', set: { rlung: 'left_lung', llung: 'right_lung' } },
      { text: 'Put the right lung in the LEFT lung’s place, and take the left lung off the board.', set: { rlung: 'empty', llung: 'right_lung' } },
      { text: 'Put the left lung in the RIGHT lung’s place, and take the right lung off the board.', set: { rlung: 'left_lung', llung: 'empty' } },
      { text: 'Swap the heart and the windpipe: the heart goes where the windpipe belongs (middle of its box), the windpipe where the heart belongs.', set: { windpipe: 'heart', heart: 'trachea' }, check: ['heart', 'windpipe'] },
      { text: 'Put the heart in the right lung’s place, and take the right lung off the board.', set: { rlung: 'heart', heart: 'empty' } },
      { text: 'Put the heart in the left lung’s place, and take the left lung off the board.', set: { llung: 'heart', heart: 'empty' } },
      { text: 'Put the windpipe in the left lung’s place, and take the left lung off the board.', set: { llung: 'trachea', windpipe: 'empty' }, check: ['llung'] }
    ];
    pickN(r, wrong, 3).forEach(w => shots.push({ kind: 'wrong', text: w.text + ' Everything else in its correct place.', labels: Object.assign(allCorrect(), w.set), check: w.check || [] }));
    pickN(r, FLIPS, 2).forEach(x => shots.push(trickShot('flipped', x)));
    pickN(r, UPSIDES, 1).forEach(x => shots.push(trickShot('upside_down', x)));
    for (let i = 0; i < 4; i++) shots.push(trickCombo(r));
    pickN(r, DECOYS, 2).forEach(d => shots.push(decoyShot(d)));
    for (let i = 0; i < 2; i++) shots.push(partialCombo(r));
    shots.push(twoHands(r));
    shots.push(handShot(pickN(r, HAND_PAIRS, 1)[0], HOWS[0]));
    shots.push({ kind: 'hand', text: 'Reach across the board as if placing a piece: arm and hand over the middle. Mark every zone the hand or sleeve covers as Hand.', labels: Object.assign(allCorrect(), { heart: 'hand', windpipe: 'hand' }), check: ZONES.slice() });
    return done();
  }

  const pad = n => String(n).padStart(2, '0');
  const shotId = (session, n) => `S${pad(session)}-${pad(n)}`;
  const getActive = () => { try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null'); } catch (e) { return null; } };
  const setActive = a => { try { if (a) localStorage.setItem(ACTIVE_KEY, JSON.stringify(a)); else localStorage.removeItem(ACTIVE_KEY); } catch (e) { /* blocked */ } };
  const allShots = async () => ((await S.store.all('training')) || []).sort((a, b) => a.id.localeCompare(b.id));
  const toBlob = (c, q = 0.92) => new Promise(r => c.toBlob(r, 'image/jpeg', q));

  /* ---------- Session list ---------- */
  async function view(container) {
    const active = getActive();
    if (active) return shoot(container, active);
    const shots = await allShots();
    const sessions = {};
    for (const s of shots) (sessions[s.session] = sessions[s.session] || []).push(s);
    const nums = Object.keys(sessions).map(Number).sort((a, b) => a - b);
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    const totals = Object.fromEntries(CATS.map(c => [c, { train: 0, validation: 0, test: 0 }]));
    for (const s of shots) for (const z of ZONES) if (s.labels[z]) totals[s.labels[z]][s.split]++;

    const num = h('input', { type: 'number', min: 1, max: 40, value: next, id: 'cs-num' });
    const split = h('select', { id: 'cs-split' }, ['train', 'validation', 'test'].map(v => h('option', { value: v, selected: v === SPLIT(next) ? true : null }, v)));
    const light = h('select', { id: 'cs-light' }, ['Ceiling lights', 'Daylight from a window', 'Desk lamp from the left', 'Desk lamp from the right', 'Desk lamp from above', 'Dim room', 'Mixed / changing', 'Other'].map(v => h('option', null, v)));
    const height = h('select', { id: 'cs-height' }, ['Normal height', 'A little higher', 'A little lower', 'Tilted a little', 'Moved to one side', 'On the holder'].map(v => h('option', null, v)));
    const tipBox = h('p', { class: 'cs-instr' });
    const applySchedule = () => {
      const n = Number(num.value) || 1, sc = schedule(n);
      split.value = SPLIT(n); light.value = sc.lighting; height.value = sc.camera;
      tipBox.textContent = `Session ${n}${sc.type === 'focus' ? ' (hands and overlaps only)' : sc.type === 'tricks' ? ' (flipped and upside-down pieces only)' : ''}: ${sc.tip}`;
    };
    num.addEventListener('input', applySchedule);
    applySchedule();
    const device = h('input', { type: 'text', id: 'cs-device', value: navigator.userAgent.includes('Android') ? 'Phone or tablet (Android)' : '', placeholder: 'e.g. MatePad, Samsung phone' });
    const hands = h('input', { type: 'text', id: 'cs-hands', placeholder: 'e.g. Omar, sleeve; Sara' });
    const note = h('input', { type: 'text', id: 'cs-note', placeholder: 'Anything unusual' });

    container.replaceChildren(
      h('p', null, 'Each session is 25 photos. The app tells you what to change for the session, how to arrange the pieces for each photo, and saves the 5 zone pictures already named. Sessions 1 to 12 and 17 onward are for training, 13 to 15 for checking (validation), and 16 is the final test day. Sessions 17 and 20 are hands-and-overlaps sessions; 18 and 21 are flipped-and-upside-down sessions.'),
      h('section', null, h('h2', null, 'Start a session'),
        h('form', { class: 'sform', onsubmit: e => {
          e.preventDefault();
          const n = Number(num.value);
          if (!(n >= 1)) { S.ui.toast('Choose a session number.'); return; }
          const a = { session: n, tip: schedule(n).tip, split: split.value, lighting: light.value, camera: height.value, device: device.value.trim(), hands: hands.value.trim(), note: note.value.trim(), started_at: new Date().toISOString() };
          setActive(a);
          shoot(container, a);
        } },
          tipBox,
          h('div', { class: 'formgrid' },
            h('label', { class: 'field' }, h('span', null, 'Session number'), num),
            h('label', { class: 'field' }, h('span', null, 'Use for'), split),
            h('label', { class: 'field' }, h('span', null, 'Lighting'), light),
            h('label', { class: 'field' }, h('span', null, 'Camera position'), height),
            h('label', { class: 'field' }, h('span', null, 'Device'), device),
            h('label', { class: 'field' }, h('span', null, 'Hands (who, sleeves)'), hands),
            h('label', { class: 'field' }, h('span', null, 'Note'), note)),
          h('p', { class: 'muted' }, 'Change the lighting and camera position from one session to the next. Do sessions on different days.'),
          h('div', null, h('button', { class: 'btn primary', type: 'submit' }, sessions[next] ? 'Continue session' : 'Start session')))),
      h('section', null, h('h2', null, 'Pictures collected'),
        h('div', { class: 'tablewrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', null, 'Category'), h('th', null, 'Train'), h('th', null, 'Validation'), h('th', null, 'Test'))),
          h('tbody', null, CATS.map(c => h('tr', { class: totals[c].train < 150 ? 'short' : '' }, h('td', null, CAT_NAME[c]), h('td', { class: 'num' }, totals[c].train), h('td', { class: 'num' }, totals[c].validation), h('td', { class: 'num' }, totals[c].test)))))),
        h('p', { class: 'muted' }, 'Aim for at least 150 training pictures in every category. Partial and Hand usually need an extra session.'),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn primary', type: 'button', disabled: shots.length ? null : true, onclick: () => exportAll('train') }, 'Download training pictures'),
          h('button', { class: 'btn', type: 'button', disabled: shots.length ? null : true, onclick: () => exportAll('validation') }, 'Download validation pictures'),
          h('button', { class: 'btn', type: 'button', disabled: shots.length ? null : true, onclick: () => exportAll('test') }, 'Download test pictures'))),
      h('section', null, h('h2', null, 'Sessions'),
        nums.length ? h('div', { class: 'tablewrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, ['Session', 'Use for', 'Photos', 'Lighting', 'Camera', ''].map(x => h('th', null, x)))),
          h('tbody', null, nums.map(n => {
            const list = sessions[n], f = list[0];
            return h('tr', null, h('td', null, `Session ${n}`), h('td', null, f.split), h('td', { class: 'num' }, `${list.length} / 25`), h('td', null, f.lighting), h('td', null, f.camera),
              h('td', null, h('div', { class: 'row wrap' },
                list.length < 25 ? h('button', { class: 'btn small', type: 'button', onclick: () => { const a = { session: n, split: f.split, lighting: f.lighting, camera: f.camera, device: f.device, hands: f.hands, note: f.note }; setActive(a); shoot(container, a); } }, 'Continue') : null,
                h('button', { class: 'btn small', type: 'button', onclick: () => exportSession(n) }, 'Download zip'),
                h('button', { class: 'btn small danger', type: 'button', onclick: async () => {
                  if (!(await S.ui.confirmBox(`Delete session ${n}?`, `Its ${list.length} photos will be removed from this device. Download the zip first if you need it.`, 'Delete', 'Cancel'))) return;
                  for (const s of list) await S.store.del('training', s.id);
                  view(container);
                } }, 'Delete'))));
          })))) : h('p', { class: 'muted' }, 'No sessions yet.')));
  }

  /* ---------- Shooting ---------- */
  async function shoot(container, a) {
    const shots = plan(a.session);
    const done = new Set((await allShots()).filter(s => s.session === a.session).map(s => s.n));
    let idx = shots.findIndex(s => !done.has(s.n));
    if (idx < 0) idx = shots.length; /* all 25 done: extras only */
    let extra = 0;

    const title = h('h2', { class: 'cs-title' });
    const instr = h('p', { class: 'cs-instr' });
    const status = h('p', { class: 'camstatus muted', role: 'status' }, 'Starting the camera...');
    const overlay = h('canvas', { class: 'bc-overlay' });
    const review = h('div', { class: 'cs-review' });
    const work = document.createElement('canvas');
    let video = null, lastFound = [], running = true, current = null;

    const captureBtn = h('button', { class: 'btn primary big', type: 'button', disabled: true, onclick: () => capture() }, 'Capture');
    const skipBtn = h('button', { class: 'btn', type: 'button', onclick: () => { if (idx < shots.length) { idx++; extra = 0; showShot(); } } }, 'Skip this shot');
    const extraKind = h('select', { class: 'inline' }, ['correct', 'empty', 'wrong', 'flipped', 'upside_down', 'partial', 'hand'].map(k => h('option', { value: k }, `Extra: ${k.replace('_', ' ')}`)));
    const extraBtn = h('button', { class: 'btn', type: 'button', onclick: () => { extra = 1; showShot(); } }, 'Add an extra photo');
    const endBtn = h('button', { class: 'btn', type: 'button', onclick: () => { running = false; S.camera.stop(); setActive(null); view(container); } }, 'Finish for now');

    function shotSpec() {
      if (extra) {
        const kind = extraKind.value;
        const base = shots.find(s => s.kind === kind) || shots[0];
        return { kind, n: 100 + Date.now() % 900, extra: true, text: `Extra ${kind} photo: arrange the pieces your own way for this kind, then set each zone’s name below to match what is really there.`, labels: Object.assign({}, base.labels), check: ZONES.slice() };
      }
      return shots[idx];
    }
    function showShot() {
      review.replaceChildren();
      const s = shotSpec();
      if (!s) {
        title.textContent = `Session ${a.session} (${a.split}): all 25 photos done`;
        instr.textContent = 'This session is complete. Add extra photos of any kind, or tap Finish for now.';
        captureBtn.disabled = true;
        return;
      }
      title.textContent = `Session ${a.session} (${a.split}) — ${s.extra ? 'extra photo' : `photo ${s.n} of 25`}: ${s.kind}`;
      instr.textContent = s.text;
      captureBtn.disabled = lastFound.length !== 4;
    }

    async function loop() {
      while (running && document.body.contains(overlay)) {
        if (video && video.videoWidth && !current) {
          const k = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
          work.width = Math.round(video.videoWidth * k); work.height = Math.round(video.videoHeight * k);
          const wctx = work.getContext('2d', { willReadFrequently: true });
          wctx.drawImage(video, 0, 0, work.width, work.height);
          lastFound = S.aruco.detect(wctx.getImageData(0, 0, work.width, work.height));
          overlay.width = work.width; overlay.height = work.height;
          const ctx = overlay.getContext('2d');
          ctx.drawImage(work, 0, 0);
          ctx.lineWidth = Math.max(3, work.width / 200); ctx.strokeStyle = '#18C964';
          for (const f of lastFound) { ctx.beginPath(); f.corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke(); }
          /* Draw the 5 zone boxes on the live picture, so you can see where each piece belongs */
          if (lastFound.length === 4) {
            const ids = Object.keys(S.BOARD.markers).map(Number);
            const by = Object.fromEntries(lastFound.map(f => [f.id, f.centre]));
            const Hm = S.aruco.homography(ids.map(i => S.BOARD.markers[i]), ids.map(i => by[i]));
            if (Hm) {
              ctx.font = `bold ${Math.max(13, work.width / 45)}px system-ui, sans-serif`;
              for (const [k, z] of Object.entries(S.BOARD.zones)) {
                const pts = [[z.x, z.y], [z.x + z.w, z.y], [z.x + z.w, z.y + z.h], [z.x, z.y + z.h]].map(([x, y]) => S.aruco.apply(Hm, x, y));
                ctx.strokeStyle = ZONE_COLOURS[k]; ctx.lineWidth = Math.max(2, work.width / 300);
                ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
                ctx.fillStyle = ZONE_COLOURS[k]; ctx.fillText(ZN(k), pts[0][0] + 4, pts[0][1] + Math.max(14, work.width / 40));
              }
              ctx.strokeStyle = '#18C964';
            }
          }
          const ok = lastFound.length === 4;
          status.className = `camstatus ${ok ? 'ok' : 'bad'}`;
          status.textContent = ok ? 'All 4 markers found. Arrange the pieces, move your hand away (unless this is a hand photo), then tap Capture.' : `${lastFound.length} of 4 markers found. Keep all 4 corner markers in view and uncovered.`;
          if (shotSpec()) captureBtn.disabled = !ok;
        }
        await S.util.realSleep(300);
      }
      if (!document.body.contains(overlay)) S.camera.stop();
    }

    /* Take the full-resolution frame, straighten it, cut the 5 zones */
    async function capture() {
      const s = shotSpec();
      if (!s || !video) return;
      const full = document.createElement('canvas');
      full.width = video.videoWidth; full.height = video.videoHeight;
      full.getContext('2d').drawImage(video, 0, 0);
      const k = full.width / work.width;
      /* Detect again on this exact frame (downscaled), then scale the marker centres up */
      const small = document.createElement('canvas');
      small.width = work.width; small.height = work.height;
      const sctx = small.getContext('2d', { willReadFrequently: true });
      sctx.drawImage(full, 0, 0, small.width, small.height);
      const found = S.aruco.detect(sctx.getImageData(0, 0, small.width, small.height)).map(f => ({ id: f.id, centre: [f.centre[0] * k, f.centre[1] * k], corners: f.corners.map(([x, y]) => [x * k, y * k]) }));
      const layout = Object.assign({}, S.BOARD, { pxPerCm: 12 });
      const board = S.aruco.straighten(full, found, layout);
      if (!board) { S.ui.toast('A marker was lost at the moment of capture. Hold still and try again.'); return; }
      current = { s, full, found, board, layout, labels: Object.assign({}, s.labels), crops: {} };
      for (const z of ZONES) current.crops[z] = S.aruco.zoneCrop(board, S.BOARD.zones[z], 224, layout);
      captureBtn.disabled = true;
      showReview();
    }

    function showReview() {
      const c = current;
      const figs = ZONES.map(z => {
        const sel = h('select', { 'data-zone': z, onchange: () => { c.labels[z] = sel.value; fig.classList.remove('check'); } }, CATS.map(cat => h('option', { value: cat, selected: c.labels[z] === cat ? true : null }, CAT_NAME[cat])));
        const fig = h('figure', { class: c.s.check.includes(z) ? 'check' : '' }, c.crops[z], h('figcaption', null, h('strong', null, `${ZN(z)} zone`), sel));
        return fig;
      });
      review.replaceChildren(
        h('h3', null, 'Check the names, then save'),
        h('p', { class: 'muted' }, c.s.check.length ? 'Zones with an orange frame need your eye. Hand: any part of a hand, finger or sleeve is over the zone. Partial: a piece is about a quarter or more outside its box, or two pieces share the box. Flipped: a lung or the heart with its back side up. Upside down: a piece turned so its top points down. The diaphragm with its other side up but the right way round is just Diaphragm. Otherwise name the piece that fills the zone, or Empty.' : 'Each zone is named from the arrangement. Change a name if the picture shows something else.'),
        h('div', { class: 'cs-crops' }, figs),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn primary big', type: 'button', onclick: save }, 'Save and next'),
          h('button', { class: 'btn', type: 'button', onclick: () => { current = null; review.replaceChildren(); showShot(); } }, 'Retake')));
      review.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function save() {
      const c = current;
      const n = c.s.extra ? c.s.n : c.s.n;
      const rec = {
        id: c.s.extra ? `${shotId(a.session, 99)}-${S.util.rand4()}` : shotId(a.session, n),
        session: a.session, n, split: a.split, kind: c.s.kind, extra: !!c.s.extra, instruction: c.s.text,
        labels: c.labels, planned: c.s.labels, lighting: a.lighting, camera: a.camera, device: a.device, hands: a.hands, note: a.note,
        markers: Object.fromEntries(c.found.map(f => [f.id, f.centre.map(v => Math.round(v * 10) / 10)])),
        frame_w: c.full.width, frame_h: c.full.height, created_at: new Date().toISOString(),
        frame: await toBlob(c.full, 0.85), crops: {}
      };
      for (const z of ZONES) rec.crops[z] = await toBlob(c.crops[z]);
      await S.store.put('training', rec);
      S.ui.toast('Saved.');
      current = null;
      if (!c.s.extra) idx = shots.findIndex((s, i) => i > idx && !done.has(s.n));
      done.add(n);
      if (idx < 0) idx = shots.length;
      extra = 0;
      showShot();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    container.replaceChildren(
      h('p', { class: 'cs-tip' }, h('strong', null, 'This session: '), schedule(a.session).tip, ` (Lighting: ${a.lighting}. Camera: ${a.camera}.)`),
      title, instr,
      h('div', { class: 'row wrap' }, captureBtn, skipBtn, extraKind, extraBtn, endBtn),
      status,
      h('div', { class: 'cs-live' }, overlay),
      review);
    showShot();
    const r = await S.camera.test(S.settings.get().cameraFacing || 'environment');
    if (!r.ok) { status.className = 'camstatus bad'; status.textContent = r.message; return; }
    video = r.video;
    loop();
  }

  /* ---------- Export ---------- */
  const bytes = async b => new Uint8Array(await b.arrayBuffer());
  const csvRow = vals => vals.map(v => { const t = v == null ? '' : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }).join(',');
  const HEAD = ['photo', 'session', 'use_for', 'kind', 'zone', 'category', 'changed_by_you', 'lighting', 'camera', 'device', 'hands', 'instruction'];
  const rows = s => ZONES.map(z => csvRow([s.id, s.session, s.split, s.kind, z, s.labels[z], s.labels[z] !== s.planned[z] ? 'yes' : '', s.lighting, s.camera, s.device, s.hands, s.instruction]));

  async function exportSession(n) {
    const list = (await allShots()).filter(s => s.session === n);
    if (!list.length) return;
    S.ui.toast('Making the zip...');
    const files = [];
    for (const s of list) {
      files.push({ name: `frames/${s.id}.jpg`, data: await bytes(s.frame) });
      for (const z of ZONES) files.push({ name: `crops/${s.labels[z]}/${s.id}-${z}.jpg`, data: await bytes(s.crops[z]) });
    }
    files.push({ name: 'labels.csv', data: new TextEncoder().encode([csvRow(HEAD), ...list.flatMap(rows)].join('\n')) });
    S.util.download(`LittleLungs-session${pad(n)}-${list[0].split}.zip`, S.zip.build(files));
  }

  /* One zip per use: a folder per category, ready to upload to Teachable Machine */
  async function exportAll(split) {
    const list = (await allShots()).filter(s => s.split === split);
    if (!list.length) { S.ui.toast(`No ${split} photos yet.`); return; }
    S.ui.toast('Making the zip...');
    const files = [];
    for (const s of list) for (const z of ZONES) files.push({ name: `${split}/${s.labels[z]}/${s.id}-${z}.jpg`, data: await bytes(s.crops[z]) });
    files.push({ name: `${split}/labels.csv`, data: new TextEncoder().encode([csvRow(HEAD), ...list.flatMap(rows)].join('\n')) });
    S.util.download(`LittleLungs-${split}-pictures.zip`, S.zip.build(files));
  }

  return { view, plan, CATS };
})();
