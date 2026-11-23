import sys, json, base64, numpy as np, cv2, zipfile, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
sys.path.insert(0, '/home/claude/little-lungs/training')
import common
from common import ZONES, mnet_features
plt.rcParams.update({'font.family': 'Liberation Serif', 'savefig.dpi': 300})
NAVY, BLUE, PINK, GREY = '#0B1F45', '#2F6FDB', '#E5486B', '#9AA3B5'
z = zipfile.ZipFile('/home/claude/ll-data/zips/LittleLungs-session05-test.zip')
PID = 'S05-24'
frame = cv2.imdecode(np.frombuffer(z.read(f'frames/{PID}.jpg'), np.uint8), 1)
det = cv2.aruco.ArucoDetector(cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_ARUCO_ORIGINAL))
corners, ids, _ = det.detectMarkers(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))
fr = frame.copy(); th = max(4, frame.shape[1] // 200)
for c, i in zip(corners, ids.flatten()):
    if int(i) in common.BOARD['markers']:
        cv2.polylines(fr, [c.astype(int)], True, (80, 220, 60), th * 2)
        p = c[0].mean(0).astype(int); cv2.putText(fr, str(int(i)), (p[0] - 40, p[1] - 60), cv2.FONT_HERSHEY_SIMPLEX, 2.2, (80, 220, 60), 6)
board = common.straighten(frame, px=20)
bd = board.copy()
ZC = {'rlung': (59, 36, 229), 'llung': (91, 24, 194), 'windpipe': (0, 138, 224), 'heart': (162, 31, 123), 'diaphragm': (192, 101, 21)}
for zn in ZONES:
    x, y, w, h = common.zone_rect_px(zn, px=20); cv2.rectangle(bd, (int(x), int(y)), (int(x + w), int(y + h)), ZC[zn], 6)
crops = [common.zone_crop(common.straighten(frame), zn) for zn in ZONES]  # 12 px/cm like the app
crops_rgb = [cv2.cvtColor(c, cv2.COLOR_BGR2RGB) for c in crops]
d = json.load(open('/home/claude/little-lungs/model/zone-head.json'))
def deq(w):
    q = np.frombuffer(base64.b64decode(w['data']), np.int8).reshape(w['rows'], w['cols']).astype(np.float32); return q * np.array(w['scale'], np.float32)[:, None]
X = mnet_features(crops_rgb); Zz = (X - np.array(d['mu'])) / np.array(d['sd'])
Hh = np.maximum(Zz @ deq(d['W1']).T + np.array(d['b1']), 0); O = Hh @ deq(d['W2']).T + np.array(d['b2'])
P = np.exp(O - O.max(1, keepdims=True)); P /= P.sum(1, keepdims=True); cls = d['classes']
NAME = {'empty': 'Empty', 'right_lung': 'Right lung', 'left_lung': 'Left lung', 'heart': 'Heart', 'trachea': 'Windpipe', 'diaphragm': 'Diaphragm', 'flipped': 'Flipped', 'upside_down': 'Upside down', 'partial': 'Partial', 'hand': 'Hand'}
ZN = {'rlung': 'Right lung zone', 'windpipe': 'Windpipe zone', 'heart': 'Heart zone', 'llung': 'Left lung zone', 'diaphragm': 'Diaphragm zone'}
preds = [(cls[int(p.argmax())], float(p.max())) for p in P]; print(preds)

fig = plt.figure(figsize=(16, 8.2))
def img_ax(rect, im, title, letter):
    ax = fig.add_axes(rect); ax.imshow(cv2.cvtColor(im, cv2.COLOR_BGR2RGB)); ax.set_xticks([]); ax.set_yticks([])
    for s in ax.spines.values(): s.set_color('#C9D0DC'); s.set_linewidth(1.5)
    return ax
k = 0.36
img_ax([0.0, 0.04, 0.19, 0.84], fr, 'Camera photo', 'A')
img_ax([0.245, 0.04, 0.175, 0.84], bd, 'Straightened board', 'B')
ax = fig.add_axes([0, 0, 1, 1], facecolor='none'); ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis('off')
for x0, x1 in ((0.19, 0.245), (0.42, 0.44), (0.585, 0.61), (0.79, 0.81)):
    ax.add_patch(FancyArrowPatch((x0 + 0.002, 0.5), (x1 - 0.002, 0.5), arrowstyle='-|>', mutation_scale=26, color=NAVY, lw=2.5))
ax.text(0.2175, 0.43, '4 markers\nfound,\nperspective\nremoved', ha='center', va='top', fontsize=11, color='#3B4A66')
for x, t in ((0.0, 'A  Camera photo'), (0.245, 'B  Straightened board'), (0.44, 'C  Zone pictures'), (0.61, 'D  The AI, once per zone'), (0.815, 'E  Result per zone')): ax.text(x, 0.935, t, fontsize=17, color=NAVY, fontweight='bold')
# crops column
for i, (zn, c) in enumerate(zip(ZONES, crops_rgb)):
    a = fig.add_axes([0.445, 0.75 - i * 0.165, 0.135, 0.155]); a.imshow(c); a.set_xticks([]); a.set_yticks([])
    for s in a.spines.values(): s.set_color('#C9D0DC')
    a.set_ylabel(ZN[zn].replace(' zone', ''), fontsize=11, color='#3B4A66')
# model block
blocks = [('MobileNetV2', 'pre-trained on 1.2 million\nImageNet photos (kept fixed)', NAVY, 'white'),
          ('1,280 numbers', 'that describe the picture', '#1F3A73', 'white'),
          ('256 neurons (ReLU)', 'trained on 11,704 Little\nLungs pictures', BLUE, 'white'),
          ('10 outputs (softmax)', 'one probability per category', '#AFC6F2', NAVY)]
for i, (t, s, fc, tc) in enumerate(blocks):
    y = 0.74 - i * 0.18
    ax.add_patch(FancyBboxPatch((0.615, y), 0.17, 0.135, boxstyle='round,pad=0.006,rounding_size=0.012', fc=fc, ec='none'))
    ax.text(0.7, y + 0.093, t, ha='center', va='center', fontsize=14.5, color=tc, fontweight='bold')
    ax.text(0.7, y + 0.04, s, ha='center', va='center', fontsize=11, color=tc)
    if i < 3: ax.add_patch(FancyArrowPatch((0.7, y - 0.002), (0.7, y - 0.043), arrowstyle='-|>', mutation_scale=16, color=NAVY, lw=1.8))
# output
for i, (zn, (n, p)) in enumerate(zip(ZONES, preds)):
    y = 0.80 - i * 0.165
    ok = (n == {'rlung': 'right_lung', 'llung': 'left_lung', 'heart': 'heart', 'windpipe': 'trachea', 'diaphragm': 'diaphragm'}[zn])
    col = '#2E9D6B' if ok else PINK
    ax.add_patch(FancyBboxPatch((0.815, y - 0.04), 0.18, 0.11, boxstyle='round,pad=0.004,rounding_size=0.01', fc='white', ec=col, lw=2.2))
    ax.text(0.825, y + 0.035, ZN[zn], fontsize=11.5, color='#3B4A66', va='center')
    ax.text(0.825, y - 0.008, f'{NAME[n]}  {p*100:.0f}%', fontsize=15, color=col, fontweight='bold', va='center')
fig.savefig('/home/claude/poster/figures/fig_ai_pipeline.png', bbox_inches='tight', pad_inches=0.1); fig.savefig('/home/claude/poster/figures/fig_ai_pipeline.svg', bbox_inches='tight', pad_inches=0.1)
