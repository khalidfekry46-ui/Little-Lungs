/* Illustrations drawn in code, in a soft 3D style: glossy gradients, a light highlight and a soft shadow.
   Verity, the breathing lungs (blue windpipe and airways), the organ pieces, the camera scene and the heartbeat.
   All motion stops when the device asks for reduced motion. */
window.S = window.S || {};

S.art = (() => {
  const { s, h } = S.util;

  /* Shared gradients and filters, added to the page once */
  function ensureDefs() {
    if (document.getElementById('ll-defs')) return;
    const stop = (o, c, op) => s('stop', { offset: o, 'stop-color': c, 'stop-opacity': op == null ? 1 : op });
    const rad = (id, stops, attrs = {}) => s('radialGradient', { id, cx: '38%', cy: '30%', r: '75%', ...attrs }, stops);
    const lin = (id, stops, attrs = {}) => s('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 0, ...attrs }, stops);
    const svg = s('svg', { id: 'll-defs', width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute;width:0;height:0;overflow:hidden' },
      s('defs', null,
        rad('g-lung', [stop(0, '#FBC3CF'), stop(0.55, '#F28A9E'), stop(1, '#E2566F')]),
        lin('g-lung-low', [stop(0, '#F0566F'), stop(1, '#D93D5A')], { x2: 0, y2: 1 }),
        lin('g-pipe', [stop(0, '#0F4F8A'), stop(0.35, '#2F86CF'), stop(0.55, '#4FA2E6'), stop(1, '#0F4F8A')]),
        rad('g-heart', [stop(0, '#FF8A95'), stop(0.5, '#E8344A'), stop(1, '#A8122A')]),
        lin('g-trachea', [stop(0, '#D9A273'), stop(0.45, '#F6D2AA'), stop(1, '#C88A5A')]),
        lin('g-dia', [stop(0, '#8E4A22'), stop(0.5, '#C47A45'), stop(1, '#8E4A22')], { x2: 0, y2: 1 }),
        lin('g-board', [stop(0, '#FBE4C8'), stop(1, '#EDCDA6')], { x2: 0, y2: 1 }),
        lin('g-metal', [stop(0, '#6E7A90'), stop(0.5, '#B9C3D3'), stop(1, '#6E7A90')]),
        lin('g-metal-h', [stop(0, '#C9D1DE'), stop(1, '#8792A6')], { x2: 0, y2: 1 }),
        lin('g-cam', [stop(0, '#2C3B57'), stop(1, '#121B2E')], { x2: 0, y2: 1 }),
        rad('g-lens', [stop(0, '#BFE3FF'), stop(0.45, '#3B8CFF'), stop(1, '#0B2E7A')], { cx: '40%', cy: '35%' }),
        lin('g-tray', [stop(0, '#F4F6FF'), stop(1, '#E3E8F8')], { x2: 0, y2: 1 }),
        rad('g-verity', [stop(0, '#FF8BF8'), stop(0.6, '#F21DE8'), stop(1, '#C40CBB')]),
        lin('g-hr-area', [stop(0, '#E5243B', 0.28), stop(1, '#E5243B', 0)], { x2: 0, y2: 1 }),
        rad('g-shine', [stop(0, '#FFFFFF', 0.75), stop(1, '#FFFFFF', 0)], { cx: '50%', cy: '50%', r: '50%' }),
        s('filter', { id: 'f-soft', x: '-20%', y: '-20%', width: '140%', height: '150%' },
          s('feDropShadow', { dx: 0, dy: 6, stdDeviation: 6, 'flood-color': '#1B2440', 'flood-opacity': 0.22 })),
        s('filter', { id: 'f-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' },
          s('feGaussianBlur', { stdDeviation: 3 })),
        /* One lung (the right lung, drawn on the viewer's left) and its lower, darker part */
        s('path', { id: 'lung-shape', d: 'M99 64 C75 66 36 108 21 180 C12 228 15 264 36 265 C60 264 99 255 126 258 C135 240 138 210 135 168 L132 114 C129 84 120 64 99 64 Z' }),
        s('clipPath', { id: 'clip-lung' }, s('use', { href: '#lung-shape' }))));
    document.body.appendChild(svg);
  }

  /* Verity: the pink assistant. She blinks, floats, and her mouth moves while a clip plays. Tap her to replay. */
  function verity(size = 'big') {
    ensureDefs();
    const svg = s('svg', { viewBox: '0 0 200 210', class: 'verity-svg', 'aria-hidden': 'true' },
      s('ellipse', { cx: 100, cy: 202, rx: 58, ry: 6, class: 'v-shadow' }),
      s('circle', { cx: 100, cy: 100, r: 92, class: 'v-face' }),
      s('ellipse', { cx: 70, cy: 48, rx: 34, ry: 20, fill: 'url(#g-shine)', transform: 'rotate(-28 70 48)' }),
      s('g', { class: 'v-eyes' },
        s('ellipse', { cx: 72, cy: 78, rx: 9, ry: 16, class: 'v-ink' }),
        s('ellipse', { cx: 128, cy: 78, rx: 9, ry: 16, class: 'v-ink' }),
        s('circle', { cx: 69, cy: 71, r: 3, fill: '#fff' }),
        s('circle', { cx: 125, cy: 71, r: 3, fill: '#fff' })),
      s('path', { d: 'M46 116 Q100 168 154 116', class: 'v-smile' }),
      s('path', { d: 'M40 112 q4 6 10 6 M160 112 q-4 6 -10 6', class: 'v-smile thin' }),
      s('ellipse', { cx: 100, cy: 136, rx: 26, ry: 14, class: 'v-mouth' }));
    return h('button', { type: 'button', class: `verity ${size}`, 'aria-label': 'Verity. Tap to hear the instruction again.', onclick: () => S.audio.replay() }, svg);
  }

  /* ---------- The lungs: pink lungs, blue ribbed windpipe and blue airways ---------- */
  const tree = [
    'M150 136 C128 136 108 148 96 160 C90 172 85 190 82 208',
    'M97 159 C88 151 76 140 63 132',
    'M101 155 C101 136 99 116 95 98',
    'M99 124 C93 116 89 109 84 102',
    'M88 177 C76 179 62 179 49 178',
    'M84 196 C74 204 64 211 54 216',
    'M82 207 C77 222 68 236 60 247',
    'M86 197 C92 210 98 222 104 233'
  ];
  function oneLung(mirror) {
    const g = s('g', { transform: mirror ? 'translate(300 0) scale(-1 1)' : null },
      s('use', { href: '#lung-shape', fill: 'url(#g-lung)' }),
      s('g', { 'clip-path': 'url(#clip-lung)' },
        s('path', { d: 'M0 214 L140 168 L140 300 L0 300 Z', fill: 'url(#g-lung-low)', opacity: 0.9 }),
        s('ellipse', { cx: 70, cy: 120, rx: 26, ry: 52, fill: 'url(#g-shine)', opacity: 0.55, transform: 'rotate(22 70 120)' })),
      s('use', { href: '#lung-shape', class: 'lung-edge' }),
      s('g', { class: 'airways' },
        tree.map((d, i) => s('path', { d, class: i === 0 ? 'aw main' : 'aw' })),
        tree.map((d, i) => s('path', { d, class: i === 0 ? 'aw-hi main' : 'aw-hi' }))));
    return g;
  }
  function lungsSvg(label = 'Lungs breathing in and out') {
    ensureDefs();
    const rings = [];
    for (let y = 44; y <= 116; y += 11) rings.push(s('path', { d: `M139 ${y} Q150 ${y + 3} 161 ${y}`, class: 'ring' }));
    return s('svg', { viewBox: '0 0 300 290', class: 'art lungs3d', role: 'img', 'aria-label': label },
      s('ellipse', { cx: 150, cy: 278, rx: 110, ry: 8, class: 'floor-shadow' }),
      s('g', { class: 'l-body', filter: 'url(#f-soft)' },
        s('g', { class: 'l-lungs' }, oneLung(false), oneLung(true)),
        s('g', { class: 'l-pipe' },
          s('rect', { x: 138, y: 26, width: 24, height: 104, rx: 11, fill: 'url(#g-pipe)' }),
          rings,
          s('rect', { x: 143, y: 30, width: 4, height: 90, rx: 2, fill: '#fff', opacity: 0.35 }))));
  }

  /* Breathing lungs. Free-running, or paced by the test with pace('in') / pace('out'). */
  function breathing({ small } = {}) {
    const wrap = h('div', { class: `art-wrap breathing auto ${small ? 'small' : ''}` }, lungsSvg());
    wrap.pace = phase => {
      wrap.classList.remove('auto');
      wrap.classList.toggle('in', phase === 'in');
      wrap.classList.toggle('out', phase !== 'in');
    };
    wrap.free = () => { wrap.classList.remove('in', 'out'); wrap.classList.add('auto'); };
    return wrap;
  }

  /* ---------- Organ pieces for the tray ---------- */
  const heartPath = 'M24 44 C6 30 0 22 0 13 C0 5 6 0 13 0 C18 0 22 3 24 7 C26 3 30 0 35 0 C42 0 48 5 48 13 C48 22 42 30 24 44 Z';
  const piece = {
    lung: (x, y, sc, flip) => s('g', { transform: `translate(${x} ${y}) scale(${flip ? -sc : sc} ${sc})` },
      s('path', { d: 'M22 0 C8 2 0 26 0 50 C0 66 8 74 20 72 C28 70 32 64 32 56 L32 10 C32 3 28 0 22 0 Z', fill: 'url(#g-lung)' }),
      s('ellipse', { cx: 12, cy: 26, rx: 6, ry: 14, fill: 'url(#g-shine)', opacity: 0.8 })),
    heart: (x, y, sc) => s('g', { transform: `translate(${x} ${y}) scale(${sc})` },
      s('path', { d: heartPath, fill: 'url(#g-heart)' }),
      s('ellipse', { cx: 13, cy: 11, rx: 7, ry: 5, fill: 'url(#g-shine)', transform: 'rotate(-30 13 11)' })),
    windpipe: (x, y, sc) => s('g', { transform: `translate(${x} ${y}) scale(${sc})` },
      s('path', { d: 'M24 40 L8 60 M24 40 L40 60', stroke: '#D9A273', 'stroke-width': 11, 'stroke-linecap': 'round', fill: 'none' }),
      s('path', { d: 'M24 40 L8 60 M24 40 L40 60', stroke: '#F6D2AA', 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none', opacity: 0.8 }),
      s('rect', { x: 17, y: 0, width: 14, height: 46, rx: 7, fill: 'url(#g-trachea)' }),
      [8, 16, 24, 32].map(yy => s('path', { d: `M18 ${yy} Q24 ${yy + 2} 30 ${yy}`, stroke: '#C88A5A', 'stroke-width': 1.5, fill: 'none', opacity: 0.7 }))),
    diaphragm: (x, y, sc) => s('g', { transform: `translate(${x} ${y}) scale(${sc})` },
      s('path', { d: 'M0 30 Q50 -14 100 30 L100 40 Q50 2 0 40 Z', fill: 'url(#g-dia)' }),
      s('path', { d: 'M10 28 Q50 -2 90 28', stroke: '#E8A574', 'stroke-width': 2, fill: 'none', opacity: 0.8 }))
  };

  /* Five loose organs in a tray, and a camera on a stand looking at the empty board */
  function organsScan() {
    ensureDefs();
    const svg = s('svg', { viewBox: '0 0 560 380', class: 'art scan', role: 'img', 'aria-label': 'Five organ pieces in a tray beside an empty board while the camera scans it' },
      s('g', { filter: 'url(#f-soft)' },
        s('rect', { x: 24, y: 18, width: 124, height: 344, rx: 18, fill: 'url(#g-tray)', class: 'tray3d' }),
        piece.lung(66, 34, 1.05),
        piece.heart(60, 116, 1.1),
        piece.windpipe(62, 178, 1),
        piece.lung(98, 250, 1.05, true),
        piece.diaphragm(42, 322, 0.88)),
      s('ellipse', { cx: 380, cy: 362, rx: 170, ry: 6, class: 'floor-shadow' }),
      s('g', { filter: 'url(#f-soft)' },
        s('rect', { x: 196, y: 326, width: 344, height: 16, rx: 7, fill: 'url(#g-metal-h)' }),
        s('rect', { x: 222, y: 340, width: 14, height: 22, rx: 4, fill: 'url(#g-metal)' }),
        s('rect', { x: 500, y: 340, width: 14, height: 22, rx: 4, fill: 'url(#g-metal)' }),
        s('rect', { x: 226, y: 66, width: 10, height: 262, rx: 4, fill: 'url(#g-metal)' }),
        s('rect', { x: 300, y: 84, width: 208, height: 238, rx: 16, fill: 'url(#g-board)' }),
        [[310, 94], [482, 94], [310, 296], [482, 296]].map(([x, y]) => s('rect', { x, y, width: 16, height: 16, rx: 3, fill: '#1A2236' })),
        s('rect', { x: 196, y: 22, width: 72, height: 50, rx: 12, fill: 'url(#g-cam)' }),
        s('circle', { cx: 232, cy: 47, r: 15, fill: 'url(#g-lens)', class: 'lens' }),
        s('circle', { cx: 227, cy: 42, r: 4, fill: '#fff', opacity: 0.8 })),
      s('polygon', { points: '246,58 300,84 508,84 508,322 300,322 246,62', class: 'cone' }),
      s('rect', { x: 300, y: 84, width: 208, height: 4, rx: 2, class: 'scanline' }));
    return h('div', { class: 'art-wrap' }, svg);
  }

  function heartIcon(size = 60) {
    ensureDefs();
    return s('svg', { viewBox: '0 0 60 56', width: size, class: 'art', 'aria-hidden': 'true' },
      s('g', { class: 'hb-heart', filter: 'url(#f-soft)' }, piece.heart(6, 5, 1)));
  }

  function heartbeat() {
    ensureDefs();
    return h('div', { class: 'art-wrap heartbeat' },
      s('svg', { viewBox: '0 0 360 90', class: 'art beat', role: 'img', 'aria-label': 'A beating heart and a heart-rate trace' },
        s('g', { class: 'hb-heart', filter: 'url(#f-soft)' }, piece.heart(12, 20, 1.05)),
        s('polyline', { points: '80,50 130,50 145,50 155,20 168,80 180,40 190,50 240,50 255,50 265,20 278,80 290,40 300,50 350,50', class: 'hb-line' })));
  }

  /* Home page scene: Verity between breathing lungs and a beating heart */
  function homeScene() {
    return h('div', { class: 'home-scene' },
      h('div', { class: 'hs-lungs' }, breathing({ small: true })),
      verity('xl'),
      h('div', { class: 'hs-heart' }, heartIcon()));
  }

  return { ensureDefs, verity, organsScan, breathing, heartbeat, homeScene, heartIcon, lungsSvg };
})();
