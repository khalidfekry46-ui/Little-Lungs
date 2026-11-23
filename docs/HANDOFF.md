# Little Lungs: hand-off notes (state on 24 Nov 2026, build 1.9.4)

Read this first if you are a person or another AI picking up the project. It says what exists, how it fits
together, what was decided and why, and what is still open. Details live in the files it points to.

## 1. The project in one paragraph

Little Lungs: Smart Anatomy Test is a G12 STEM capstone (Group 29336: Khalid Walid / Khaled Waleed Fekry,
Hamza Ahmed, Mahmoud Mohamed Ali). A Huawei MatePad 11.5 PaperMatte runs a web app (GitHub Pages, works offline)
that tests students in two tasks. **Task 1 (anatomy):** the student places 5 painted organ pieces (right lung,
left lung, heart, windpipe, diaphragm) on a plywood board with 4 ArUco corner markers; the tablet camera and an
on-device AI judge each placement. **Task 2 (breathing):** two belts with slide potentiometers (chest and abdomen),
a heart-rate sensor and a servo-driven lung model, run by a Raspberry Pi Pico W, check paced diaphragmatic vs
thoracic breathing; then graph questions and an adaptive reading section. Results are saved on the tablet and
uploaded to a Google Sheet.

- Live app: https://khalidfekry46-ui.github.io/Little-Lungs/
- Repository: https://github.com/khalidfekry46-ui/Little-Lungs (branch `main`; Pages deploys on every push)

## 2. Rules the team asked for

- Write to the team in plain English. Explain the reason behind every step (they must understand and defend
  every decision in front of judges). Poster text is written by the team in their own voice (G11 AutoRoot poster
  style); help with guides and drafts only when asked.
- Student passwords: at least 8 characters, with a capital, a small letter, a number and one of @ # $ % &.
  Results are matched by student ID.
- Hardware: do not ask the team to re-flash MicroPython, re-check the step-down's 4.987 V, re-add the MAX30102
  or re-explain VSYS back-feeding unless a specific test needs it. Before connecting the Pico to a laptop by USB,
  unplug the step-down OUT+ to VSYS wire.
- After any change to app files: bump `VERSION` in `sw.js` **and** `S.BUILD` in `js/config.js` (keep them equal),
  then push. The unlock screen shows the build. Tablets update with Management > Settings > App updates >
  Get the latest version (keeps all saved data). Never tell them to "clear site data": that deletes unsent sessions.

## 3. Repository map

| Path | What |
| --- | --- |
| `index.html`, `css/app.css`, `js/*.js` | The app (plain JavaScript, no build step). `README.md` has the per-file table |
| `js/config.js` | All sentences, timings (`S.TIMING`), settings defaults, `S.BUILD` |
| `js/test.js` | The test pages P01 to P22; Task 1 placement loop (`waitPlacement`, `placementItem`, `fullBuild`) |
| `js/vision.js` | `S.judge` (rules), `VisionSim`, `VisionLive` (camera loop, stillness, AI calls, live preview) |
| `js/aruco.js` | ArUco marker finder, homography, `S.BOARD` layout in cm (marker IDs 31, 115, 161, 261) |
| `js/zoneai.js` | Loads MobileNetV2 (ONNX Runtime Web, WebGL) + trained head; falls back to the small model |
| `js/collect.js` | Management > Collect photos (training data sessions) |
| `js/board.js` | Management > Board check |
| `js/pico.js` | `PicoSim`, `PicoWS` (bench), `PicoBLE` (the real link, Web Bluetooth) |
| `js/sync.js` | Upload to Google Sheets: full upload at session end, live upload every 10 s |
| `js/data.js` | Scoring, `S.flatten` (tables for the Sheet incl. per-second `Sensors`) |
| `apps-script/Code.gs` | Google Apps Script receiver (paste into the Sheet's Apps Script, deploy a NEW version after edits) |
| `model/` | `mobilenet-feat.onnx` (8.8 MB, classifier removed, batch 1), `zone-head.json` (deployed head), `zone-model.json` (fallback) |
| `training/` | Python training pipeline (`train.py`, `common.py`, `synth.py`), `corrections.csv` (51 label fixes), `exclude.txt` |
| `pico/main.py` | Pico W firmware (MicroPython, Bluetooth) |
| `poster/` | Scripts and `results.json` behind every poster figure |
| `docs/pico-protocol.md` | Pico <-> tablet messages and the data path |
| `docs/what-is-waiting.md` | Older plan of open items (partly superseded by this file) |

## 4. Camera AI (Task 1)

**Pipeline:** find the 4 ArUco markers -> straighten the board (homography, 12 px/cm) -> cut 5 zone crops
(224 x 224, grey padding) -> MobileNetV2 turns each crop into 1280 numbers -> small network (one hidden layer
of 256, int8 weights) names it as one of 10 categories: empty, right_lung, left_lung, heart, trachea, diaphragm,
flipped, upside_down, partial, hand. Labelling priority when several apply: hand > partial > flipped >
upside down > piece > empty.

**Data:** sessions 1 to 4 (training, ~40 photos each, mixed placements), session 5 (40 photos, test only, never
trained on), two hand videos (sessions 91 and 92, auto-labelled with a reference frame + temporal median; 1 in 10
hand frames used). 16 synthetic "moving window" pictures per real zone picture. Deployed head trained on
sessions [1, 2, 3, 4, 91, 92], 11,704 pictures (1,467 real), 2026-11-23.

**Session 5 results (held-out test):**
- Exact category: 183/200 = 91.5%.
- Correct vs wrong placement: 180/182 = 98.9% (95% Wilson CI 96.1 to 99.7%).
- Station rule (decide only when P(own piece) >= 0.8 or <= 0.2, otherwise ask the operator): 176/176 = 100%,
  6 zones sent to the operator.
- Hands: 13/18 detected, no false hands.
- Leave-one-session-out (sessions 1 to 4): exact 97.6, 90.7, 83.8, 91.5%; correct-or-wrong 99.1, 99.0, 94.9, 93.4%.
- Learning curve on session 5: MobileNet exact 79.5% -> 90.0% as sessions are added; hand-made features 86.5%.

**Retrain:** `python3 training/train.py --zips DIR --synth 16` (MobileNet head -> `model/zone-head.json`);
`--xsess` for leave-one-session-out; `--backbone hand` for the fallback. Fix labels in `training/corrections.csv`
(photo, zone, piece, tags, name, was); leave photos or single zones out with `training/exclude.txt`. Needs
Python with numpy, scikit-learn, Pillow, onnxruntime. Accuracy claims come from session 5 only.

**Live checking rules (vision.js + test.js):**
- Camera checked every 250 ms. Movement = more than 1.5% of 2 cm squares change average brightness by more than
  12/255 (after removing overall exposure change). Measured on the team's video: still board 0 to 0.8%, hand 2 to 29%.
  (The earlier per-pixel rule saw 1.5 to 3.6% "movement" on a still board, so the AI never ran.)
- AI looks after 0.7 s still; a verdict needs 1.5 s still and no hand. A hidden marker or an AI "hand" = hand.
- `S.judge`: correct / wrong (orientation, wrong_zone, left_right_swap, wrong_piece, position) / cant_verify
  (operator decides). A new piece anywhere counts as the answer; pieces on the board at the prompt are ignored;
  "partial" waits until the board has been still 4 s (`letGoMs`), then is judged.
- A corner marker covered for 3 s: on-screen + spoken reminder (device voice) every 12 s, and the student's
  clock stops until all 4 are visible.
- Live camera view (markers outlined green/red, zones never drawn) on P04, each Task 1 piece and the full build.
- Station check: "Start anyway (practice)" when checks fail; those sessions are saved as not valid.

## 5. Pico W and data (Task 2)

**Hardware:** Pico W (MicroPython), MG995 servo on GP15 powered from an LM2596 step-down (3 x 18650),
HW-233 slide pot belts (chest GP26, abdomen GP27; only one exists so far), heart sensor on I2C0 GP4/GP5. The
purple board is a **GY-MAX30100** (part ID 0x11, not a MAX30102); its I2C pull-ups go to 1.8 V, fix with 4.7 kOhm
from SDA and from SCL to 3V3. The servo problem (0.5 to 2.5 ms pulses pushing the MG995 into its end stop) is
fixed; the team confirmed the servo now works. Use 1.0 to 2.0 ms pulses.

**Link (decided and tested):** Pico -> tablet over **Bluetooth Low Energy** (Nordic UART service, JSON lines,
20-byte pieces). Plain `ws://` from the https app is blocked by the browser, so the Pico's Wi-Fi is not used.
Web Bluetooth works on the MatePad in Chrome (tested: the device list appears). Settings > Pico W >
"Live Pico W (Bluetooth)"; the station check asks the operator to tap Connect and pick "LittleLungs".

**Firmware `pico/main.py` (2.0-ble):** belts at 50 Hz, heart beats from the IR signal (high-pass, smoothing,
peak finder, median of the last 6 intervals; q from interval regularity; finger from DC level), calibration
saves each belt's normal breath size, each paced breath is labelled by the abdomen's share of normalised
movement (>= 0.60 diaphragmatic, <= 0.40 thoracic, otherwise unclear; rejected if under half a normal breath;
one belt fitted -> unclear), servo mirrors the abdomen belt or runs a 4-breath demo, 1-second table printed in
Thonny's Shell. Tested in CPython with stubs (55/72/95/130 bpm read within 0.5 bpm). **Not yet run on the real Pico.**

**Bench scripts** (outside the repo, in the hand-off zip `hw/`): `servo_test.py`, `i2c_finder.py`,
`logger.py` (calibrate: slider mm vs ADC -> `calib_N.csv`; record: ~100 rows/s of t_ms, belt1, belt2, ir, red).

**Data path:** everything is saved in the tablet's IndexedDB as it happens and every 10 s. During a session the
app uploads new rows every 10 s (`type: "live"`: Roster and Sessions replaced, other rows appended, incl. one
Sensors row per second). At session end a full upload replaces all that session's rows (removes duplicates).
`Code.gs` deletes in blocks. **The team must paste the new `Code.gs` and deploy a new version** for live uploads.

## 6. Open items and decisions waiting

1. **Breathing design mismatch:** Mahmoud's old firmware scored breathing rate (15 BPM out of 10) from one slider;
   the app design uses two belts with per-breath labels. The new firmware follows the app. A second slide pot on
   the abdomen belt is needed, or the team changes the design.
2. Run `main.py` on the real Pico, send the Shell output (belts moving, finger on the sensor) for checking.
3. Run `i2c_finder.py`; if nothing at 0x57, add the two 4.7 kOhm pull-ups.
4. Belt calibration (DR5) with `logger.py` calibrate mode; heart-rate check against a pulse oximeter.
5. Buy/fit the tablet holder. Hand-held sessions are practice only (mark not valid in Review).
6. Test the new Task 1 judging with deliberate wrong placements (wrong piece, across zones, half off) on the tablet.
7. Recorded voice clip for the covered-marker reminder (currently the device's text-to-speech), and `p15_go.mp3`.
8. Poster: guide published (see links); team writes text; hardware figures are placeholders until real data.

## 7. Documents made with Claude (claude.ai artifacts, owner's account)

- Poster Writing Guide: https://claude.ai/artifact/SejJe9xST5dopx5kTNDeoq
- Training the camera AI, step by step: https://claude.ai/artifact/DkSzBX7q2JEbUoRHNhVzzW
- Label Check page: https://claude.ai/artifact/5XZcCUwCodmk3yJXAHsjzy
- Project Protocol: https://claude.ai/artifact/XpkcyM6JEECsJd5Tbha4JP
- Test Protocol & Rubrics: https://claude.ai/artifact/JjmbSRoYvx1AwN3SAqj6Lt
- Verity Voice Script: https://claude.ai/artifact/1mP2jyNndNUanCTSjXNDz1

## 8. Hand-off bundle contents

- `LittleLungs-code.zip`: this repository with its full git history, `hw/` bench scripts, `poster-work/`
  (figure scripts, figures, scenes, results), `analysis-scripts/` (session scoring and audit scripts).
- `LittleLungs-data.zip`: the 5 Collect-photos session zips, the 2 labelled hand-video zips and the 2 original videos.
  Put the session zips in one folder and point `train.py --zips` at it.
