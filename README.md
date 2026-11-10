# Little Lungs: Smart Anatomy Test

The tablet app for the G12 capstone: an AI-graded anatomy assembly test and a breathing and heart-rate test, with Verity as the animated, speaking assistant, cloud upload, a History page for students, and a statistics page for the poster.

It runs in any modern browser and needs no laptop at the station. Until the Pico W and the camera model are ready, both run as simulators so the whole test can be rehearsed now.

## Put it on the tablet

1. Create a free GitHub account and a new public repository.
2. Upload everything in this folder (keep the folder structure, including `audio/`).
3. Repository Settings > Pages > Deploy from branch > `main` > `/ (root)`. GitHub gives a link like `https://yourname.github.io/anatomy-station/`.
4. Open the link on the MatePad. Use the browser menu's "Add to Home screen" so it opens full screen.
5. After the first visit the app works offline, because the files are stored on the tablet.

Check early that the MatePad's browser plays sound, opens the camera on the Board photos page, and keeps saved data after closing. Chrome on the tablet is the safest choice.

When you change any file, also change `VERSION` at the top of `sw.js`, so tablets fetch the new version.

## First start

1. Choose two PINs: a 4-digit operator PIN (unlocks the app and confirms test steps) and a 6-digit Management PIN. Only the operator knows them.
2. Management > Settings: set the device name and short code (for example MatePad, MP). Leave Pico W and Camera AI on Simulator for now.
3. Management > Settings > Camera: tap "Allow and test back camera" so the browser asks for camera permission once. Choose which camera watches the board.
4. Cloud: follow the steps at the top of `apps-script/Code.gs`, then paste the web app link and the sync key into Management > Settings.

## The tabs

| Tab | Who | What |
| --- | --- | --- |
| Home | Student | Verity, the Start the test button, information about the test, and the project contact |
| Prep | Student | Six practice reading passages (2 foundation, 2 intermediate, 2 advanced). After each one the student sees which answers were wrong and the correct answers, with no explanation, and can look at the passage again |
| History | Student | Past scores, reports and graphs, found by student ID and full name |
| Management | Operator, 6-digit PIN | Overview, Review, Statistics, Board photos, Settings |

Use the Full screen button at the top, or "Add to Home screen", to hide the browser bars.

## Running a session

Home > Start the test. The station check runs, then the student goes through P01 to P22 on their own. You type the PIN at P04 (checklist), P10 (start Task 2), P12 (belt fit), P20 (belts removed) and P22 (end session).

To pause, flag a problem or end early: press and hold "Little Lungs" at the top left for 3 seconds, then type the PIN.

The recorder fills in the paper sheet (Management > Overview > Print recorder sheet) during the session. The page code in the bottom corner (P07, P15) tells them where the test is.

## Data

Every session is saved on the tablet first, then uploaded to the Google Sheet when online. Uploads retry by themselves, and re-uploading replaces that session's rows, so there are never duplicates. The Sheet gets these tabs:

| Tab | One row per |
| --- | --- |
| Roster | Student (names stay only here) |
| Sessions | Session: scores, timings, heart rate, modes |
| Placements | Placement decision by the camera AI, with the recorder's verdict |
| Trials | Breathing trial |
| Breaths | Breath decision by the Pico, with the recorder's label |
| Answers | Answer to the graph questions B1 to B3 |
| Reading | Answer to a test reading question (passage, level, difficulty, correct, time, answer changes) |
| Prep | Answer to a Prep question (looked again, review time, self-report) |
| Events | Operator action (PIN steps, pauses, notes) |

## Ground truth and statistics

1. Review: enter the paper sheet for each session. The AI results stay hidden until you have entered yours.
2. Statistics: choose "This tablet" or "Google Sheet (all devices)". The page calculates the design requirements (accuracy with 95% confidence intervals, response times, heart-rate error, upload reliability, session length, lung model response) and the poster results (scores by grade and prior study, item difficulty, common errors, hint success, breathing success, question results).
3. Export: download each table as CSV, plus a poster summary.

Simulated and demo sessions are left out of statistics unless you tick the box. "Add 25 demo sessions" makes practice data so you can design the poster's results section before real testing.

## Scoring

Anatomy raw points are out of 18: students start at Level 2, so a perfect Part 1A is 2 + 2 + 3 + 3 + 3 = 13, plus 5 for the full build.

Breathing is out of 15: 2 trials worth 2 points each, 3 graph questions, and the reading section scaled to 8 points (reading points x 8 / 24). Each converts to a score out of 5, rounded to the nearest 0.5, and the two add up to the total out of 10.

## Reading section

Two passages, five questions each, five minutes each. Questions are worth 1 (easy), 2 (intermediate) or 3 (hard) points.

- G8 and G9 start with a foundation passage (2 easy, 2 intermediate, 1 hard). If they do well, passage 2 is intermediate; otherwise it is another foundation passage.
- G10 to G12 start with an intermediate passage (1 easy, 2 intermediate, 2 hard). If they do well, passage 2 is advanced (2 intermediate, 3 hard); otherwise it is another intermediate passage.
- "Doing well" means every intermediate question right and at least one hard question right.
- The 15 test passages (5 per level) live in `js/passages.js`. A student never gets a passage they saw in an earlier session.

The best path is intermediate + advanced = 24 points. G8 and G9 can reach 20 at most (foundation + intermediate).

## Prep and the comparison

Prep attempts are linked to test sessions by a coded student ID, so use the same student ID in both. Statistics > "Prep and test performance" puts each tested student in one group, using only Prep finished before the test:

| Group | Meaning |
| --- | --- |
| No prep | No Prep attempts |
| Blind | Did Prep, but looked at the passage again for fewer than half of their wrong answers |
| Investigated | Looked at the passage again for at least half of their wrong answers |
| No mistakes | Did Prep with no wrong answers, so there was nothing to investigate |

It compares reading, breathing (Task 2), graph questions and total between groups, and also shows the self-report ("Did you work out why each correct answer is right?"). Students choose whether to do Prep, so this shows a link, not proof that Prep causes better scores.

## Files

| File | What it does |
| --- | --- |
| `js/config.js` | Every sentence, question, timing and target |
| `js/test.js` | The test pages P01 to P22 |
| `js/pico.js` | Pico simulator and live Pico connection |
| `js/vision.js` | Camera simulator, live camera, and the judging rules |
| `js/passages.js` | The 15 test passages and 6 Prep passages |
| `js/reading.js` | The reading section: adaptive levels, timer, question panel |
| `js/prep.js` | The Prep tab |
| `js/accounts.js` | Student passwords |
| `js/data.js` | Scoring and the tables sent to the Sheet |
| `js/analysis.js` | Statistics |
| `js/admin.js` | Home, History and Management pages |
| `js/art.js` | Verity and the illustrations |
| `js/graphs.js` | Heart-rate and breathing graphs |
| `apps-script/Code.gs` | Google Sheets receiver |
| `docs/what-is-waiting.md` | What still needs hardware or training, and how it plugs in |
| `docs/pico-protocol.md` | Messages the Pico W firmware must send and receive |

## Clips to record in Verity's voice

The six reading-section clips are in `audio/`. One new clip is still needed; until it is added, the page shows the word without sound.

| File name | Sentence |
| --- | --- |
| `p15_go.mp3` | Go! |

The 1 to 5 countdown before each breathing trial reuses the score numbers `p21_num_1` to `p21_num_5`.

After adding clips, change `VERSION` in `sw.js`.

## Student passwords

Prep, History and the test form ask for the student's own password. The student ID is the only thing used to match results; names are not.

- Rules: at least 8 characters, with a capital letter, a small letter, a number and one of @ # $ % &.
- Stored on the tablet as a salted PBKDF2 hash. The password itself is never saved or uploaded.
- 5 wrong tries lock that student ID for 1 minute; 10 lock it for 10 minutes.
- Forgotten password: "I forgot my password" plus the operator PIN, or Management > Settings > Student passwords.
- If results already exist for a student ID with no password, setting one needs the operator PIN, so nobody can claim another student's results.
- Passwords live on each tablet. A student who uses a second tablet sets a password there too.

## Camera

Management > Overview has a Camera check: tap "Allow and test back camera", choose Allow in the browser window, and the live picture appears. The station check also opens the camera and asks the operator whether the whole board is in view.

The camera only works when the app is opened from its own https link (GitHub Pages). Inside the claude.ai preview the browser blocks it, and no permission window can appear; the app says so.
