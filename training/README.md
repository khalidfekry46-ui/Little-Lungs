# Training the zone AI

The app cuts each camera picture into 5 zone pictures (224 x 224). The zone AI names each one:
empty, right_lung, left_lung, heart, trachea, diaphragm, flipped, upside_down, partial, hand.

## Steps

1. Collect sessions in the app (Management > Collect photos) and download each session's zip.
2. Put the zips in one folder (they are not stored in this repository).
3. Run:

   ```
   python3 training/train.py --zips /path/to/zips --synth 12
   ```

   Add `--cv` to also print a held-out estimate when there is only one session.
4. The model is written to `model/zone-model.json`. Change `VERSION` in `sw.js` and upload.

## What the scripts do

- `common.py`: board layout, straightening, zone crops and the image features. The browser computes the same
  features in `js/zoneai.js`; keep the two in step (a parity test showed differences under 0.000001).
- `synth.py`: extra training pictures from the real training photos by moving, resizing, turning (180 degrees)
  and recolouring the zone window. Never mirrored, because a mirrored right lung would look like a flipped piece.
- `train.py`: features, then a small neural network (one hidden layer of 128) from scikit-learn. Weights are
  stored as bytes with a scale per row. Sessions marked validation (4) and test (5) are only scored, never trained on.

Accuracy claims must come from session 5 only.

## Models (since version 1.8.0)

- Main: `python3 train.py --zips DIR --synth 16` (default `--backbone mnet`). MobileNetV2
  (`model/mobilenet-feat.onnx`, ImageNet weights, classifier removed) turns each zone picture into 1280 numbers;
  a small network trained here names it. Saved to `model/zone-head.json`. The app runs MobileNet on the
  tablet's graphics chip with ONNX Runtime Web (`js/vendor/ort.min.js`, WebGL, no download needed).
- Fallback: `python3 train.py --zips DIR --synth 16 --backbone hand` -> `model/zone-model.json`.
  Used only if the graphics chip can't run MobileNet.
- Fair check: add `--xsess` (train on each session alone, test on the others).
- Bad photos: add the photo ID to `exclude.txt`.
