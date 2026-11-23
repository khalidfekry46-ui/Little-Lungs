import sys, json, pickle, base64, numpy as np, math
from sklearn.metrics import confusion_matrix
D = '/home/claude/poster/data/'
F = np.load(D + 'feats.npz'); FM = F['FM']; meta = pickle.load(open(D + 'meta.pkl', 'rb'))['meta']
d = json.load(open('/home/claude/little-lungs/model/zone-head.json'))
def deq(w):
    q = np.frombuffer(base64.b64decode(w['data']), np.int8).reshape(w['rows'], w['cols']).astype(np.float32); return q * np.array(w['scale'], np.float32)[:, None]
W1, W2 = deq(d['W1']), deq(d['W2']); cls = list(d['classes'])
idx = [i for i, m in enumerate(meta) if m['s'] == 5 and m['src'] == 'real']
X = FM[idx]; Zs = [meta[i]['zone'] for i in idx]; ids = [meta[i]['photo'] for i in idx]
y = np.array(['trachea' if (meta[i]['photo'], meta[i]['zone']) == ('S05-24', 'windpipe') else meta[i]['y'] for i in idx])
Zz = (X - np.array(d['mu'], np.float32)) / np.array(d['sd'], np.float32)
H = np.maximum(Zz @ W1.T + np.array(d['b1'], np.float32), 0); O = H @ W2.T + np.array(d['b2'], np.float32)
P = np.exp(O - O.max(1, keepdims=True)); P /= P.sum(1, keepdims=True)
pr = np.array(cls)[P.argmax(1)]
OWN = {'rlung': 'right_lung', 'llung': 'left_lung', 'heart': 'heart', 'windpipe': 'trachea', 'diaphragm': 'diaphragm'}
own = np.array([OWN[z] for z in Zs]); pown = P[np.arange(len(P)), [cls.index(o) for o in own]]
g = y != 'hand'; truth = y == own
def wilson(k, n, z=1.96):
    p = k / n; den = 1 + z*z/n; c = (p + z*z/(2*n)) / den; h = z*math.sqrt(p*(1-p)/n + z*z/(4*n*n)) / den; return [c - h, c + h]
CATS = ['empty', 'right_lung', 'left_lung', 'heart', 'trachea', 'diaphragm', 'flipped', 'upside_down', 'partial', 'hand']
out = dict(exact_k=int((pr == y).sum()), n=len(y), cw_k=int((truth[g] == (pr == own)[g]).sum()), cw_n=int(g.sum()))
out['cw_ci'] = wilson(out['cw_k'], out['cw_n'])
thr = []
for t in [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99]:
    sure = g & ((pown >= t) | (pown <= 1 - t)); k = int((truth[sure] == (pown[sure] >= t)).sum()); n = int(sure.sum())
    thr.append(dict(thr=t, k=k, n=n, acc=k / n, ask=int(g.sum() - n), ask_rate=(g.sum() - n) / g.sum(), ci=wilson(k, n)))
out['threshold'] = thr
out['confusion'] = dict(labels=CATS, matrix=confusion_matrix(y, pr, labels=CATS).tolist())
out['recall'] = {c: [int(((y == c) & (pr == c)).sum()), int((y == c).sum())] for c in CATS}
out['errors'] = [dict(photo=ids[i], zone=Zs[i], true=y[i], ai=pr[i], conf=float(P[i].max()), pown=float(pown[i])) for i in range(len(y)) if pr[i] != y[i]]
out['hand_fp'] = int(((pr == 'hand') & (y != 'hand')).sum())
out['conf_correct'] = P.max(1)[pr == y].tolist(); out['conf_wrong'] = P.max(1)[pr != y].tolist()
R = json.load(open(D + 'results.json')); R['deployed_s5'] = out; json.dump(R, open(D + 'results.json', 'w'), indent=1)
print({k: out[k] for k in ('exact_k', 'n', 'cw_k', 'cw_n', 'cw_ci', 'hand_fp')}); print([(t['thr'], t['k'], t['n'], t['ask']) for t in thr]); print(out['recall'])
for e in out['errors']: print(e)
