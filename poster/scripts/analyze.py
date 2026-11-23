import sys, json, time, pickle, numpy as np, cv2, collections, math, base64
sys.path.insert(0, '/home/claude/little-lungs/training')
import train, synth
from common import ZONES, CATS, straighten, mnet_features, features
OUT = '/home/claude/poster/data/'
ph = train.load('/home/claude/ll-data/zips')
r = np.random.default_rng(123)
recs = []  # dict(session, photo, zone, label, src, img)
for p in ph:
    for z in ZONES:
        if z in p['crops']:
            recs.append(dict(s=p['session'], photo=p['id'], zone=z, y=p['labels'][z], src='real', img=p['crops'][z]))
    if p['session'] <= 4 and p['frame'] is not None:
        b = straighten(p['frame'])
        if b is None: continue
        for img, name, how in synth.make(b, p['labels'], p['tags'], r, per_zone=16):
            recs.append(dict(s=p['session'], photo=p['id'], zone=None, y=name, src=how, img=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
print(len(recs), 'pictures', flush=True)
t = time.time(); FM = mnet_features([x['img'] for x in recs]); tm = time.time() - t
t = time.time(); FH = np.array([features(x['img']) for x in recs], np.float32); th = time.time() - t
print(f'mnet {tm/len(recs)*1000:.1f} ms/pic, hand {th/len(recs)*1000:.2f} ms/pic', flush=True)
meta = [{k: v for k, v in x.items() if k != 'img'} for x in recs]
s5img = {(x['photo'], x['zone']): x['img'] for x in recs if x['s'] == 5}
np.savez_compressed(OUT + 'feats.npz', FM=FM, FH=FH)
pickle.dump(dict(meta=meta, s5img=s5img, timing=dict(mnet_ms=tm / len(recs) * 1000, hand_ms=th / len(recs) * 1000)), open(OUT + 'meta.pkl', 'wb'))
