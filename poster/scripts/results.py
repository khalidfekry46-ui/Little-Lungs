import sys, json, pickle, numpy as np, collections, math, base64
sys.path.insert(0, '/home/claude/little-lungs/training')
import train
from sklearn.manifold import TSNE
from sklearn.metrics import confusion_matrix
D = '/home/claude/poster/data/'
F = np.load(D + 'feats.npz'); FM, FH = F['FM'], F['FH']
M = pickle.load(open(D + 'meta.pkl', 'rb')); meta = M['meta']
S = np.array([m['s'] for m in meta]); Y = np.array([m['y'] for m in meta]); real = np.array([m['src'] == 'real' for m in meta])
Z = np.array([m['zone'] or '' for m in meta]); PH = np.array([m['photo'] for m in meta])
rnd = np.random.default_rng(0).random(len(S)); vid = S >= 90
keep = ~vid | (Y != 'hand') | (rnd < 0.1)      # same rule as train.py: 1 in 10 video hand pictures
OWN = {'rlung': 'right_lung', 'llung': 'left_lung', 'heart': 'heart', 'windpipe': 'trachea', 'diaphragm': 'diaphragm'}
CATS = ['empty', 'right_lung', 'left_lung', 'heart', 'trachea', 'diaphragm', 'flipped', 'upside_down', 'partial', 'hand']
def wilson(k, n, z=1.96):
    p = k / n; den = 1 + z*z/n; c = (p + z*z/(2*n)) / den; h = z*math.sqrt(p*(1-p)/n + z*z/(4*n*n)) / den; return [c - h, c + h]
def fit(Fx, mask, backbone):
    train.BACKBONE = backbone; return train.fit(Fx[mask], Y[mask])
def evaluate(model, Fx, te, thr=0.8):
    clf, mu, sd = model
    P = clf.predict_proba((Fx[te] - mu) / sd); cls = list(clf.classes_)
    pr = np.array(cls)[P.argmax(1)]; y = Y[te]; z = Z[te]
    own = np.array([OWN[q] for q in z]); pown = P[np.arange(len(P)), [cls.index(o) for o in own]]
    g = y != 'hand'; truth = y == own; dec = pr == own
    sure = g & ((pown >= thr) | (pown <= 1 - thr))
    out = dict(n=int(len(y)), exact=float((pr == y).mean()), exact_k=int((pr == y).sum()),
               cw_k=int((truth[g] == dec[g]).sum()), cw_n=int(g.sum()),
               sure_k=int((truth[sure] == (pown[sure] >= thr)).sum()), sure_n=int(sure.sum()), asked=int((g & ~sure).sum()))
    out['cw'] = out['cw_k'] / out['cw_n']; out['cw_ci'] = wilson(out['cw_k'], out['cw_n'])
    out['sure'] = out['sure_k'] / max(1, out['sure_n']); out['sure_ci'] = wilson(out['sure_k'], max(1, out['sure_n'])); out['ask_rate'] = out['asked'] / out['cw_n']
    return out, P, pr, pown, cls
R = {}
# 1. dataset table
ds = {}
for s in sorted(set(S)):
    m = (S == s) & real
    ds[int(s)] = dict(photos=int(len(set(PH[m]))), zone_pictures=int(m.sum()), synthetic=int(((S == s) & ~real).sum()),
                      classes={c: int(((Y == c) & m).sum()) for c in CATS})
R['dataset'] = ds
R['training_pictures_final'] = int((keep & (S <= 4) | keep & vid).sum())
R['training_real_final'] = int(((S <= 4) & real).sum() + (vid & keep).sum())
# 2. held-out per session (train on other sessions 1-4 + video), MobileNet and hand features
R['heldout'] = {}
for s in (1, 2, 3, 4):
    tr = keep & (S != s) & (S != 5); te = (S == s) & real
    R['heldout'][s] = {'mnet': evaluate(fit(FM, tr, 'mnet'), FM, te)[0], 'hand': evaluate(fit(FH, tr, 'hand'), FH, te)[0]}
    print('heldout', s, R['heldout'][s]['mnet']['cw'], R['heldout'][s]['hand']['cw'], flush=True)
# 3. final test (session 5) with the deployed model, recomputed here for every view
te5 = (S == 5) & real
trF = keep & (S <= 4) | keep & vid
final = fit(FM, trF, 'mnet')
ev, P5, pr5, pown5, cls = evaluate(final, FM, te5)
R['s5_mnet'] = ev
R['s5_hand'] = evaluate(fit(FH, trF, 'hand'), FH, te5)[0]
y5 = Y[te5]
R['s5_confusion'] = dict(labels=CATS, matrix=confusion_matrix(y5, pr5, labels=CATS).tolist())
# threshold trade-off on S5 and pooled held-out
R['threshold'] = []
for thr in [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99]:
    e = evaluate(final, FM, te5, thr)[0]; R['threshold'].append(dict(thr=thr, acc=e['sure'], ask=e['ask_rate'], n=e['sure_n']))
# 4. learning curve on S5: cumulative sessions (+ videos from the start)
R['learning'] = []
for upto in (1, 2, 3, 4):
    tr = keep & (((S <= upto) & (S >= 1)) | vid)
    e = evaluate(fit(FM, tr, 'mnet'), FM, te5)[0]; eh = evaluate(fit(FH, tr, 'hand'), FH, te5)[0]
    R['learning'].append(dict(sessions=upto, pictures=int(tr.sum()), mnet_exact=e['exact'], mnet_cw=e['cw'], hand_exact=eh['exact'], hand_cw=eh['cw'], mnet_sure=e['sure'], ask=e['ask_rate']))
    print('learning', upto, e['exact'], e['cw'], eh['exact'], flush=True)
# 5. per-class recall on S5
R['s5_recall'] = {c: [int(((y5 == c) & (pr5 == c)).sum()), int((y5 == c).sum())] for c in CATS}
# 6. confidence distribution
R['s5_conf'] = dict(correct=P5.max(1)[pr5 == y5].tolist(), wrong=P5.max(1)[pr5 != y5].tolist())
# 7. t-SNE of S5 + held-out features
emb = TSNE(n_components=2, perplexity=25, random_state=0, init='pca').fit_transform(FM[te5])
R['tsne'] = dict(xy=emb.tolist(), y=y5.tolist())
R['timing'] = M['timing']
json.dump(R, open(D + 'results.json', 'w'), indent=1)
print(json.dumps({k: R[k] for k in ('s5_mnet', 's5_hand', 'learning', 'training_pictures_final', 'training_real_final')}, indent=1))
