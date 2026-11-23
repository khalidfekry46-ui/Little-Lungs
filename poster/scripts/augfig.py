import sys, numpy as np, cv2, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
sys.path.insert(0, '/home/claude/little-lungs/training')
import common, synth, train
plt.rcParams.update({'font.family': 'Liberation Serif', 'savefig.dpi': 300})
NAVY, PINK, GREEN = '#0B1F45', '#E5486B', '#2E9D6B'
ph = {p['id']: p for p in train.load('/home/claude/ll-data/zips') if p['session'] == 4}
p = ph['S04-10']; b = common.straighten(p['frame']); r = np.random.default_rng(4)
z = 'heart'; zc = synth.zone_centre(z); wh = common.BOARD['zones'][z][2:]
ex = [('Real zone picture', 'Heart', cv2.cvtColor(common.zone_crop(b, z), cv2.COLOR_BGR2RGB))]
img, mk = synth.window_crop(b, (zc[0] + 0.4, zc[1] - 0.3), (wh[0] * 1.03, wh[1] * 1.03), 2.5); ex.append(('Shifted, new lighting', 'Heart', cv2.cvtColor(synth.photometric(img, np.random.default_rng(7), mk), cv2.COLOR_BGR2RGB)))
img, mk = synth.window_crop(b, (zc[0] + 0.45 * wh[0], zc[1] + 0.1), wh, -2); ex.append(('Window moved', 'Partial', cv2.cvtColor(synth.photometric(img, np.random.default_rng(3), mk), cv2.COLOR_BGR2RGB)))
img, mk = synth.window_crop(b, zc, wh, 180); ex.append(('Turned 180°', 'Upside down', cv2.cvtColor(synth.photometric(img, np.random.default_rng(5), mk), cv2.COLOR_BGR2RGB)))
z2 = 'llung'; pb = synth.piece_box(z2); img, mk = synth.window_crop(b, (pb[0] + pb[2] / 2, pb[1] + pb[3] / 2), common.BOARD['zones']['heart'][2:], 0); ex.append(("Another piece in\nthe heart window", 'Partial', cv2.cvtColor(synth.photometric(img, np.random.default_rng(9), mk), cv2.COLOR_BGR2RGB)))
fig, axs = plt.subplots(1, 5, figsize=(16, 4.6))
for i, (a, (t, lab, im)) in enumerate(zip(axs, ex)):
    a.imshow(im); a.set_xticks([]); a.set_yticks([])
    for s in a.spines.values(): s.set_color(NAVY if i == 0 else '#C9D0DC'); s.set_linewidth(3 if i == 0 else 1.5)
    a.set_title(t, fontsize=15, color='#3B4A66', pad=8)
    a.text(0.5, -0.09, f'Label: {lab}', transform=a.transAxes, ha='center', va='top', fontsize=17, fontweight='bold', color=NAVY if lab == 'Heart' else PINK)
fig.subplots_adjust(wspace=0.08)
fig.savefig('/home/claude/poster/figures/fig_augmentation.png', bbox_inches='tight', pad_inches=0.1); fig.savefig('/home/claude/poster/figures/fig_augmentation.svg', bbox_inches='tight', pad_inches=0.1)

# hand video auto-labelling
cap = cv2.VideoCapture('/home/claude/ll-data/videos/Without_sleeve.mp4'); fps = cap.get(5)
def grab(t):
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000); ok, f = cap.read(); return f
ref = common.straighten(grab(0.5)); cur = None
for t in (10, 12, 14, 16, 20, 25, 30):
    f = grab(t); bb = common.straighten(f)
    if bb is not None: cur = bb; break
g0 = cv2.GaussianBlur(cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY), (5, 5), 0).astype(int); g1 = cv2.GaussianBlur(cv2.cvtColor(cur, cv2.COLOR_BGR2GRAY), (5, 5), 0).astype(int)
dmap = (np.abs(g1 - g0) > 30).astype(np.uint8) * 255
heat = cur.copy(); heat[dmap > 0] = (0.35 * heat[dmap > 0] + 0.65 * np.array([107, 72, 229])).astype(np.uint8)
labs = {}
for zn in common.ZONES:
    x, y, w, h = [int(round(v)) for v in common.zone_rect_px(zn)]
    frac = (dmap[max(y, 0):y + h, max(x, 0):x + w] > 0).mean(); labs[zn] = 'Hand' if frac > 0.08 else ('Piece' if frac < 0.01 else 'Unsure')
    col = (107, 72, 229) if labs[zn] == 'Hand' else ((107, 157, 46) if labs[zn] == 'Piece' else (74, 162, 231))
    cv2.rectangle(heat, (x, y), (x + w, y + h), col, 4); txt = f'{labs[zn]} {frac*100:.0f}%'; (tw, th_), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, 0.85, 2); tx, ty = max(x, 4) + 6, max(y, 4) + 8 + th_; cv2.rectangle(heat, (tx - 4, ty - th_ - 6), (tx + tw + 4, ty + 6), (255, 255, 255), -1); cv2.putText(heat, txt, (tx, ty), cv2.FONT_HERSHEY_SIMPLEX, 0.85, col, 2)
fig, axs = plt.subplots(1, 3, figsize=(13, 6.2))
for a, im, t in zip(axs, [ref, cur, heat], ['First second: hands off (reference)', 'Later frame: hand over the board', 'Changed pixels and zone labels']):
    a.imshow(cv2.cvtColor(im, cv2.COLOR_BGR2RGB)); a.set_xticks([]); a.set_yticks([]); a.set_title(t, fontsize=15, color=NAVY, pad=8)
    for s in a.spines.values(): s.set_color('#C9D0DC')
fig.subplots_adjust(wspace=0.05)
fig.savefig('/home/claude/poster/figures/fig_hand_video_labelling.png', bbox_inches='tight', pad_inches=0.1)
print(labs)
