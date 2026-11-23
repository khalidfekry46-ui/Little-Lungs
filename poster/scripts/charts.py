import json, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
R = json.load(open('/home/claude/poster/data/results.json'))
OUT = '/home/claude/poster/figures/'
plt.rcParams.update({'font.family': 'Liberation Serif', 'font.size': 20, 'axes.titlesize': 22, 'axes.labelsize': 20,
    'xtick.labelsize': 18, 'ytick.labelsize': 18, 'legend.fontsize': 17, 'axes.spines.top': False, 'axes.spines.right': False,
    'axes.edgecolor': '#5B6478', 'axes.linewidth': 1.2, 'xtick.color': '#2A3348', 'ytick.color': '#2A3348', 'axes.labelcolor': '#14213D',
    'savefig.dpi': 300, 'savefig.bbox': 'tight', 'savefig.pad_inches': 0.15})
NAVY, BLUE, PINK, GREY, LG, AMBER, GREEN = '#0B1F45', '#2F6FDB', '#E5486B', '#9AA3B5', '#D9DEE8', '#E7A24A', '#2E9D6B'
NAME = {'empty': 'Empty', 'right_lung': 'Right lung', 'left_lung': 'Left lung', 'heart': 'Heart', 'trachea': 'Windpipe', 'diaphragm': 'Diaphragm', 'flipped': 'Flipped', 'upside_down': 'Upside down', 'partial': 'Partial', 'hand': 'Hand'}
def save(fig, name):
    fig.savefig(OUT + name + '.png'); fig.savefig(OUT + name + '.svg'); plt.close(fig)
def wilson(k, n, z=1.96):
    import math
    p = k / n; den = 1 + z*z/n; c = (p + z*z/(2*n)) / den; h = z*math.sqrt(p*(1-p)/n + z*z/(4*n*n)) / den; return c - h, c + h
D5 = R['deployed_s5']

# ---- 1. Session 5 headline: accuracy with 95% CI against the two targets
rows = [('Exact name\n(10 categories)', D5['exact_k'], D5['n']),
        ('Correct-or-wrong\ndecision, every zone', D5['cw_k'], D5['cw_n']),
        ('Station rule: decides when\n≥ 80% sure (3% to operator)', [t for t in D5['threshold'] if t['thr'] == 0.8][0]['k'], [t for t in D5['threshold'] if t['thr'] == 0.8][0]['n'])]
fig, ax = plt.subplots(figsize=(10.5, 5.2))
for i, (lab, k, n) in enumerate(rows[::-1]):
    lo, hi = wilson(k, n); p = k / n
    col = BLUE if i == 1 else NAVY
    ax.plot([lo * 100, hi * 100], [i, i], color=col, lw=4, solid_capstyle='round')
    ax.plot(p * 100, i, 'o', ms=16, color=col, mec='white', mew=2.5, zorder=3)
    ax.text(hi * 100 + 0.35 if hi < 0.995 else lo * 100 - 0.35, i + 0.27, f'{p*100:.1f}%  ({k}/{n})', ha='left' if hi < 0.995 else 'right', va='center', fontsize=18, color=col, fontweight='bold')
ax.axvline(80, color=GREY, ls='--', lw=2); ax.text(80.2, 2.55, 'Challenge minimum 80%', fontsize=16, color='#5B6478', va='center')
ax.axvline(90, color=PINK, ls='--', lw=2); ax.text(90.2, 2.55, 'Team target 90%', fontsize=16, color=PINK, va='center')
ax.set_yticks(range(3)); ax.set_yticklabels([r[0] for r in rows[::-1]])
ax.set_xlim(78, 101); ax.set_ylim(-0.6, 2.85); ax.set_xlabel('Accuracy on unseen session 5 (%), dot = result, bar = 95% Wilson interval')
ax.spines['left'].set_visible(False); ax.tick_params(axis='y', length=0)
save(fig, 'fig_s5_accuracy')

# ---- 2. Confusion matrix (deployed model, session 5)
cm = np.array(D5['confusion']['matrix']); labs = [NAME[c] for c in D5['confusion']['labels']]
fig, ax = plt.subplots(figsize=(10.5, 9.2))
norm = cm / np.maximum(cm.sum(1, keepdims=True), 1)
from matplotlib.colors import LinearSegmentedColormap
cmap = LinearSegmentedColormap.from_list('b', ['#FFFFFF', '#C9D8F5', BLUE, NAVY])
ax.imshow(norm, cmap=cmap, vmin=0, vmax=1)
for i in range(len(labs)):
    for j in range(len(labs)):
        if cm[i, j]: ax.text(j, i, str(cm[i, j]), ha='center', va='center', fontsize=17, color='white' if norm[i, j] > 0.55 else (PINK if i != j else NAVY), fontweight='bold')
ax.set_xticks(range(len(labs))); ax.set_xticklabels(labs, rotation=40, ha='right'); ax.set_yticks(range(len(labs))); ax.set_yticklabels(labs)
ax.set_xlabel('Name given by the AI'); ax.set_ylabel('True name (team label)')
for s in ax.spines.values(): s.set_visible(False)
ax.set_xticks(np.arange(-.5, len(labs)), minor=True); ax.set_yticks(np.arange(-.5, len(labs)), minor=True); ax.grid(which='minor', color='#E4E8EF', lw=1); ax.tick_params(which='minor', length=0)
save(fig, 'fig_s5_confusion')

# ---- 3. Held-out sessions (MobileNet): three measures per session
H = R['heldout']; ss = ['1', '2', '3', '4']
fig, ax = plt.subplots(figsize=(10.5, 5.6))
w = 0.26; x = np.arange(4)
vals = [[H[s]['mnet']['exact'] for s in ss], [H[s]['mnet']['cw'] for s in ss], [H[s]['mnet']['sure'] for s in ss]]
cols = [LG, GREY, NAVY]; names = ['Exact name', 'Correct-or-wrong', 'Station rule (≥ 80% sure)']
for k in range(3):
    b = ax.bar(x + (k - 1) * w, np.array(vals[k]) * 100, w * 0.92, color=cols[k], label=names[k])
    for xi, v in zip(x + (k - 1) * w, vals[k]): ax.text(xi, v * 100 + 0.4, f'{v*100:.0f}', ha='center', fontsize=15, color='#2A3348')
ax.set_xticks(x); ax.set_xticklabels([f'Session {s}\n({H[s]["mnet"]["ask_rate"]*100:.0f}% asked)' for s in ss])
ax.set_ylim(70, 103); ax.set_ylabel('Accuracy (%)'); ax.axhline(90, color=PINK, ls='--', lw=1.8)
ax.legend(loc='lower center', bbox_to_anchor=(0.5, 1.0), ncol=3, frameon=False)
save(fig, 'fig_heldout_sessions')

# ---- 4. Learning curve on session 5
L = R['learning']; xs = [l['sessions'] for l in L]
fig, ax = plt.subplots(figsize=(10.5, 5.6))
ax.plot(xs, [l['mnet_exact'] * 100 for l in L], '-o', color=NAVY, lw=3, ms=11, label='MobileNetV2: exact name')
ax.plot(xs, [l['hand_exact'] * 100 for l in L], '--o', color=GREY, lw=3, ms=10, label='Hand-made features: exact name')
ax.plot(xs, [l['mnet_cw'] * 100 for l in L], '-s', color=BLUE, lw=3, ms=10, label='MobileNetV2: correct-or-wrong')
for l in L: ax.text(l['sessions'], l['mnet_exact'] * 100 - 2.4, f"{l['mnet_exact']*100:.1f}", ha='center', fontsize=15, color=NAVY)
ax.set_xticks(xs); ax.set_xticklabels([f"S1{'–'+str(s) if s > 1 else ''}\n{l['pictures']:,} pictures" for s, l in zip(xs, L)])
ax.set_xlabel('Training sessions used (all include the two hand videos)'); ax.set_ylabel('Accuracy on session 5 (%)'); ax.set_ylim(70, 102)
ax.axhline(90, color=PINK, ls='--', lw=1.8); ax.legend(loc='lower right', frameon=False)
save(fig, 'fig_learning_curve')

# ---- 5. Confidence threshold trade-off (deployed, session 5)
T = D5['threshold']
fig, ax = plt.subplots(figsize=(10.5, 5.4)); ax2 = ax.twinx()
th = [t['thr'] for t in T]
ax.plot(th, [t['acc'] * 100 for t in T], '-o', color=NAVY, lw=3, ms=10, label='Accuracy of the zones the AI decides')
ax2.bar(th, [t['ask_rate'] * 100 for t in T], width=0.028, color=AMBER, alpha=0.75, label='Zones sent to the operator')
ax.axvline(0.8, color=PINK, ls='--', lw=2); ax.text(0.805, 98.7, 'Chosen: 0.80', color=PINK, fontsize=17)
ax.set_xlabel('Confidence needed before the AI decides alone'); ax.set_ylabel('Accuracy (%)', color=NAVY); ax2.set_ylabel('Sent to operator (%)', color='#8A4B00')
ax.set_ylim(98, 100.3); ax2.set_ylim(0, 60); ax2.spines['right'].set_visible(True); ax2.spines['top'].set_visible(False)
h1, l1 = ax.get_legend_handles_labels(); h2, l2 = ax2.get_legend_handles_labels(); ax.legend(h1 + h2, l1 + l2, loc='upper left', frameon=False, fontsize=16)
ax.set_zorder(ax2.get_zorder() + 1); ax.patch.set_visible(False)
save(fig, 'fig_threshold_tradeoff')

# ---- 6. Per-class recall (deployed, session 5)
rc = D5['recall']; order = sorted(rc, key=lambda c: rc[c][0] / rc[c][1])
fig, ax = plt.subplots(figsize=(10.5, 6.2))
v = [rc[c][0] / rc[c][1] * 100 for c in order]
ax.barh(range(len(order)), v, color=[BLUE if x < 90 else NAVY for x in v], height=0.66)
for i, c in enumerate(order): ax.text(v[i] + 0.8, i, f'{rc[c][0]}/{rc[c][1]}', va='center', fontsize=16, color='#2A3348')
ax.set_yticks(range(len(order))); ax.set_yticklabels([NAME[c] for c in order]); ax.set_xlim(0, 112); ax.set_xticks([0, 25, 50, 75, 100])
ax.set_xlabel('Zones named correctly in session 5 (%)'); ax.spines['left'].set_visible(False); ax.tick_params(axis='y', length=0)
save(fig, 'fig_s5_by_category')

# ---- 7. Dataset composition (real zone pictures)
ds = R['dataset']; CATS = ['right_lung', 'left_lung', 'heart', 'trachea', 'diaphragm', 'empty', 'flipped', 'upside_down', 'partial', 'hand']
pal = ['#0B1F45', '#1F3A73', '#2F6FDB', '#6E9BE8', '#AFC6F2', '#D9DEE8', '#E5486B', '#F08AA2', '#E7A24A', '#2E9D6B']
groups = [('1', 'S1\ntrain'), ('2', 'S2\ntrain'), ('3', 'S3\ntrain'), ('4', 'S4\ntrain'), ('5', 'S5\ntest')]
fig, ax = plt.subplots(figsize=(10.5, 6.0))
bottom = np.zeros(len(groups))
for c, col in zip(CATS, pal):
    vals = np.array([ds[g]['classes'][c] for g, _ in groups]); ax.bar(range(len(groups)), vals, bottom=bottom, color=col, width=0.62, label=NAME[c], edgecolor='white', lw=0.8); bottom += vals
for i, (g, _) in enumerate(groups): ax.text(i, bottom[i] + 3, f"{ds[g]['photos']} photos\n{ds[g]['zone_pictures']} zones", ha='center', fontsize=14, color='#2A3348')
ax.set_xticks(range(len(groups))); ax.set_xticklabels([g[1] for g in groups]); ax.set_ylabel('Zone pictures'); ax.set_ylim(0, 260)
ax.legend(loc='upper left', bbox_to_anchor=(1.0, 1.0), frameon=False, fontsize=15)
save(fig, 'fig_dataset')

# ---- 8. t-SNE map of MobileNet features (session 5)
ts = R['tsne']; xy = np.array(ts['xy']); yy = np.array(ts['y'])
fig, ax = plt.subplots(figsize=(10.5, 8.0))
for c, col in zip(CATS, pal):
    m = yy == c
    if m.any(): ax.scatter(xy[m, 0], xy[m, 1], s=120, color=col, edgecolor='white', lw=1.2, label=NAME[c])
ax.set_xticks([]); ax.set_yticks([]); [s.set_visible(False) for s in ax.spines.values()]
ax.legend(loc='upper left', bbox_to_anchor=(1.0, 1.0), frameon=False, fontsize=16, markerscale=1.3)
save(fig, 'fig_tsne')
print('ok')
