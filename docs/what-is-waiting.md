# What is still waiting, and how each piece plugs in

The test flow, voice, scoring, PIN, ground-truth review, cloud upload and statistics are finished and run now in simulator mode. These parts wait for the hardware or for training data. Each one plugs into a single place, so nothing else in the app changes.

| Waiting for | Plugs into | Switch on with |
| --- | --- | --- |
| Pico W firmware (sensors, filter, breath classifier, servo) | `docs/pico-protocol.md` messages | Management > Settings > Pico W > Live |
| Pico to tablet connection choice | `PicoWS` in `js/pico.js` | Same setting |
| Corner-marker finder and board flattening | `VisionLive.boardView()` and `read()` in `js/vision.js` | Management > Settings > Camera AI > Live |
| Trained camera model | `VisionLive.model`, `selfTest()`, `read()` | Same setting |
| Board dimensions and zone positions | A zone setup screen (build after the marker finder works) | Saved zone boxes |
| Final six design requirements and the servo target | `S.TARGETS` in `js/config.js` | Edit the numbers |
| Hosting | Upload the folder to GitHub Pages | Open the link on the tablet |
| Five new Verity clips | `audio/` (list in the README) | Change `VERSION` in `sw.js` |
| Prep page | Waiting for its description | |

## Camera AI: the plan that runs on any device

1. **Find the 4 black corner markers** in each frame (for example with the js-aruco2 library if the corners are printed ArUco markers, or OpenCV.js).
2. **Flatten the board** to a fixed 600 x 900 image with a perspective transform. Every device then sees the same board in the same place.
3. **Crop the 5 organ zones** (slightly bigger than each piece) from the flattened board.
4. **Classify each crop** with a small image model: empty, heart, windpipe, diaphragm, right lung, left lung, or rotated. Google Teachable Machine (free, in the browser) exports TensorFlow.js models that run in this web app.
5. **Return the observation** `{ ready, hand, stableMs, handClearAt, zones }`. `S.judge()` already turns it into correct or wrong, including overlaps: a piece seen in another organ's zone is marked wrong.

Detecting the hand: add a "hand" class to the crop model, or treat a big change between frames as a hand in view.

## Training so it works on several devices

- Take photos with the **Board photos** page on the MatePad and the 4 other devices. Aim for about 200 for training and a separate 50 for testing.
- Vary lighting (daylight, classroom lights, dim), angle, distance and time of day. Include wrong pieces, rotated pieces, overlaps and hands.
- Paint the pieces before collecting most photos.
- Keep the test photos apart: different day, or a device left out of training, so accuracy is honest.
- Train one model on photos from all devices. The flattening step removes angle and distance differences; varied photos cover colour and sharpness.
- Report accuracy per device on the Statistics page (Placement detection, by device).
- If one device is weak, add photos from it and retrain. Use the confidence threshold in Settings to decide when a piece counts as "cannot verify".

## Pico breath classifier: how to train it

1. Run sessions with **10 volunteers** (not the 25 test students) with Pico in Live and the camera in Simulator.
2. The recorder marks each breath on the paper sheet; enter it in Review. Mark these sessions as excluded from statistics with the reason "training volunteer".
3. Download `Breaths.csv` from Statistics. Each row has chest and belly stretch, their ratio and the true label.
4. Start with a rule (belly stretch much larger than chest stretch means diaphragmatic), then fit a small model such as logistic regression on the ratio and both stretches, scaled by each person's calibration.
5. Check it with **leave one person out**: train on 9 volunteers, test on the 10th, repeat 10 times.
6. Copy the few numbers the model needs into the Pico's MicroPython code.

The heart-signal filter is trained the same way from **Download raw signals** in Review (heart-rate windows marked good or bad).

## Checked by hand (needed for accuracy numbers)

| What | Who | Where it goes |
| --- | --- | --- |
| Every placement: really correct or wrong | Recorder, on the paper sheet | Review > Task 1 placements |
| Every breath: really diaphragmatic, thoracic or unclear | Recorder, on the paper sheet | Review > Task 2 breaths |
| Pulse oximeter reading at the end of calibration | Operator | Review > Heart rate reference |
| Sessions to leave out (training volunteers, interruptions) | Operator | Review > Use in statistics |
| Pieces the camera could not verify in the full build | Operator, during the test, with the PIN | Saved automatically |
| A few placements filmed in slow motion, to confirm the app's response times | Team, once | Note in the report |

The AI results stay hidden while ground truth is entered, so the recorder is not influenced.
