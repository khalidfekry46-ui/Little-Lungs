/* Smart Anatomy Station: fixed test content and defaults.
   Every sentence here matches the Verity voice script word for word. */
window.S = window.S || {};

S.APP_VERSION = '1.2.0';
S.APP_NAME = 'Little Lungs: Smart Anatomy Test';
S.CONTACT_EMAIL = 'Khalidfekry46@gmail.com';

S.ORGANS = ['heart', 'windpipe', 'diaphragm', 'rlung', 'llung'];

S.ORGAN_NAME = {
  heart: 'Heart',
  windpipe: 'Windpipe',
  diaphragm: 'Diaphragm',
  rlung: 'Right lung',
  llung: 'Left lung'
};

S.PROMPTS = {
  heart: {
    1: 'Place the heart.',
    2: 'Place the organ that pumps blood around the body.',
    3: 'Place the organ that sits between the two lungs.'
  },
  windpipe: {
    1: 'Place the windpipe.',
    2: 'Place the tube that carries air down to the lungs.',
    3: 'Place the airway above the lungs that splits into two branches.'
  },
  diaphragm: {
    1: 'Place the diaphragm.',
    2: 'Place the muscle that contracts to pull air into the lungs.',
    3: 'Place the structure below both lungs that separates the chest from the abdomen.'
  },
  rlung: {
    1: 'Place the right lung.',
    2: 'Place the lung with three lobes.',
    3: "Place the larger lung, on the body's right side."
  },
  llung: {
    1: 'Place the left lung.',
    2: 'Place the lung with a notch for the heart.',
    3: "Place the smaller lung, on the body's left side."
  }
};

S.HINTS = {
  heart: 'Not quite. Here is a hint: it sits in the middle of the chest, between the lungs. You have twenty more seconds.',
  windpipe: 'Not quite. Here is a hint: it is at the top, leading down into the lungs. You have twenty more seconds.',
  diaphragm: 'Not quite. Here is a hint: it is a dome-shaped muscle at the bottom of the chest. You have twenty more seconds.',
  rlung: "Not quite. Here is a hint: left and right mean the body's own sides. The body's right is on your left as you face the board. You have twenty more seconds.",
  llung: 'Not quite. Here is a hint: this lung is smaller because it makes room for the heart. You have twenty more seconds.'
};

S.TEXT = {
  p00_sound_check: 'This is a sound check. If you can hear me, the operator may continue.',
  p01_welcome_v2: 'Welcome to Little Lungs, the Smart Anatomy Test. I am Verity, and I will guide you through this test.',
  p02_form: 'Please fill in your details on the screen, then tap Next.',
  p03_consent: 'Please read the two statements on the screen. If you agree, tap I agree.',
  p04_wait_operator: 'Thank you. Please wait while the operator prepares the station.',
  p05_overview_v3: 'This test has two tasks. In Task 1, you will place organ pieces on the board. In Task 2, you will follow breathing instructions, answer questions about your graph, and read two short passages. The whole test takes about twenty-two minutes. You can replay any instruction by tapping Replay. Tap Start when you are ready.',
  p18_reading_directions: 'Now read two short passages about breathing and the heart. Each passage has five questions. You have five minutes for each passage, and you can go back and change your answers until the time runs out. Tap Start when you are ready.',
  p19_passage: 'Read the passage, then answer the five questions.',
  p19_1min_left: 'One minute left.',
  p19_time_up: 'Time is up for this passage.',
  p06_t1_directions: 'Task 1: Anatomy assembly. You will hear one instruction at a time. Take the correct piece from the tray and place it on the board. Then move your hand away so the camera can check it. You have thirty seconds for each piece. After each check, return the piece to the tray. Tap Start when you are ready.',
  p07_move_hand: 'Please move your hand away from the board so I can check your answer.',
  p07_10s_left: 'Ten seconds left.',
  p07_time_up: 'Time is up. Please return the piece to the tray.',
  p07_recorded: 'Answer recorded. Please return the piece to the tray.',
  p08_build_directions: 'Next is the full build challenge. Place all five pieces to build the complete chest model. You have ninety seconds. Tap Start when you are ready.',
  p09_30s_left: 'Thirty seconds left.',
  p09_time_up: 'Time is up. Please step back from the board.',
  p09_recorded: 'Your model has been recorded.',
  p10_t1_complete: 'Task 1 is complete. Please wait while the operator prepares Task 2.',
  p11_t2_directions: 'Task 2: Breathing and heart rate. You will wear two belts and a finger clip. They measure how your chest and belly move, and your heart rate. Then you will follow breathing instructions and answer questions. If you feel dizzy at any time, stop and tell the operator. Tap Next to continue.',
  p12_setup: 'The operator will now help you put on the chest belt, the belly belt, and the finger clip. The clip goes on the hand you do not write with. Please stand still.',
  p12_finger_retry: 'I cannot read your heart rate clearly. Please keep your hand still and the clip firmly on your finger.',
  p12_belt_adjust: 'The operator will adjust your belts. Please stand still.',
  p13_calibration: 'First, breathe normally for thirty seconds. Please do not talk or move. The graph on the screen shows your heart rate.',
  p13_calibration_done: 'Thank you. Calibration is complete.',
  p14_trial_directions: 'Next, you will be asked to breathe in a certain way. Follow the count: breathe in for four seconds, then out for four seconds, four times. Stay still and do not talk. Tap Start when you are ready.',
  p15_cmd_diaphragmatic: 'Breathe using diaphragmatic breathing.',
  p15_cmd_thoracic: 'Breathe using thoracic breathing.',
  p15_go: 'Go!',
  p15_count_in: 'In, two, three, four.',
  p15_count_out: 'Out, two, three, four.',
  p15_repeat_breath: "That breath was not clear. Let's do one more.",
  p15_retry_diaphragmatic: "Let's try that once more. Put one hand on your belly and one on your chest. Breathe so only the belly hand moves.",
  p15_retry_thoracic: "Let's try that once more. Put one hand on your chest and one on your belly. Breathe so only the chest hand moves.",
  p15_rest: 'Now breathe normally and rest for fifteen seconds.',
  p15_trials_done: 'The breathing trials are complete. Keep the belts on and breathe normally.',
  p16_graph_own: 'Look at the graph on the screen. It shows your own breathing and heart rate. Use it to answer the next three questions.',
  p16_graph_backup: 'Your heart signal was not clear enough, so you will use a sample graph instead. It shows breathing and heart rate. Use it to answer the next three questions.',
  p17_5s_left: 'Five seconds left.',
  p18_knowledge_directions: 'Now answer four questions about breathing. Tap your choice for each one.',
  p20_t2_complete: 'Task 2 is complete. The operator will now help you remove the belts and the finger clip.',
  p21_results_intro: 'The test is complete. Here are your results.',
  p22_thank_you: 'Thank you for taking part. Please let the operator know you are finished.',
  any_paused: 'The test is paused. Please wait for the operator.',
  any_resumed: 'The test will now continue.'
};

/* Graph questions: the correct answer is worked out from the graph shown. */
S.GRAPH_QUESTIONS = [
  { id: 'B1', clip: 'p17_B1', text: 'When did the heart rate go up? While breathing in, while breathing out, or it did not change?',
    options: [['in', 'While breathing in'], ['out', 'While breathing out'], ['none', 'It did not change']] },
  { id: 'B2', clip: 'p17_B2', text: 'During diaphragmatic breathing, compared with the resting heart rate, was the heart rate higher, lower, or about the same?',
    options: [['higher', 'Higher'], ['lower', 'Lower'], ['same', 'About the same']] },
  { id: 'B3', clip: 'p17_B3', text: 'In which type of breathing did the heart rate rise and fall more? Diaphragmatic, thoracic, or no difference?',
    options: [['diaphragmatic', 'Diaphragmatic'], ['thoracic', 'Thoracic'], ['none', 'No difference']] }
];

S.KNOWLEDGE_QUESTIONS = [
  { id: 'C1', clip: 'p19_C1', demo: true, answer: 'diaphragm',
    text: 'Watch the lung model. Which part of the model makes the lungs fill? The diaphragm, the heart, or the windpipe?',
    options: [['diaphragm', 'The diaphragm'], ['heart', 'The heart'], ['windpipe', 'The windpipe']] },
  { id: 'C2', clip: 'p19_C2_v2', answer: 'phrenic',
    text: 'Which nerve carries the signals that make the diaphragm contract? The phrenic nerve, the vagus nerve, the intercostal nerves, or the accessory nerve?',
    options: [['phrenic', 'The phrenic nerve'], ['vagus', 'The vagus nerve'], ['intercostal', 'The intercostal nerves'], ['accessory', 'The accessory nerve']] },
  { id: 'C3', clip: 'p19_C3_v2', answer: 'co2_up',
    text: 'In a healthy person at rest, which change in the blood is the strongest signal to breathe faster? Rising carbon dioxide, falling oxygen, rising oxygen, or falling carbon dioxide?',
    options: [['co2_up', 'Rising carbon dioxide'], ['o2_down', 'Falling oxygen'], ['o2_up', 'Rising oxygen'], ['co2_down', 'Falling carbon dioxide']] },
  { id: 'C4', clip: 'p19_C4_v2', answer: 'recoil',
    text: 'During quiet breathing at rest, what mainly pushes air out of the lungs? The diaphragm relaxing while the lungs recoil, the diaphragm contracting, the internal intercostal muscles contracting, or the abdominal muscles contracting?',
    options: [['recoil', 'The diaphragm relaxes and the lungs recoil'], ['dia_contract', 'The diaphragm contracts'], ['internal', 'The internal intercostal muscles contract'], ['abdominal', 'The abdominal muscles contract']] }
];

/* How each page's words are shown: title and lead are bold, body is regular.
   The spoken clip always reads the full sentence in S.TEXT. */
S.PAGES = {
  P01: { lead: 'Welcome to Little Lungs, the Smart Anatomy Test.', body: 'I am Verity, and I will guide you through this test.' },
  P05: { lead: 'This test has two tasks. In Task 1, you will place organ pieces on the board. In Task 2, you will follow breathing instructions, answer questions about your graph, and read two short passages.', body: 'The whole test takes about twenty-two minutes. You can replay any instruction by tapping Replay. Tap Start when you are ready.' },
  P06: { title: 'Task 1: Anatomy assembly.', body: 'You will hear one instruction at a time. Take the correct piece from the tray and place it on the board. Then move your hand away so the camera can check it. You have thirty seconds for each piece. After each check, return the piece to the tray. Tap Start when you are ready.' },
  P08: { title: 'Next is the full build challenge.', body: 'Place all five pieces to build the complete chest model. You have ninety seconds. Tap Start when you are ready.' },
  P10: { lead: 'Task 1 is complete.', body: 'Please wait while the operator prepares Task 2.' },
  P11: { title: 'Task 2: Breathing and heart rate.', body: 'You will wear two belts and a finger clip. They measure how your chest and belly move, and your heart rate. Then you will follow breathing instructions and answer questions. If you feel dizzy at any time, stop and tell the operator. Tap Next to continue.' },
  P14: { lead: 'Next, you will be asked to breathe in a certain way. Follow the count:', body: 'breathe in for four seconds, then out for four seconds, four times. Stay still and do not talk. Tap Start when you are ready.' },
  P20: { body: 'Task 2 is complete. The operator will now help you remove the belts and the finger clip.' }
};


S.LABELS = [
  [9, 'Excellent', 'p21_label_excellent'],
  [7, 'Good', 'p21_label_good'],
  [5, 'Satisfactory', 'p21_label_satisfactory'],
  [3, 'Developing', 'p21_label_developing'],
  [0, 'Beginning', 'p21_label_beginning']
];

S.TIMING = {
  itemMs: 30000,
  hintMs: 20000,
  buildMs: 90000,
  questionMs: 20000,
  calibrationMs: 30000,
  phaseMs: 4000,
  autoMs: 60000,
  returnMs: 10000,
  passageMs: 300000,
  restMs: 15000,
  stableMs: 1000,
  handNagMs: 5000,
  breathWaitMs: 1500,
  maxExtraBreaths: 2
};

/* Design requirement targets. Candidates only: the final six are not decided yet. */
S.TARGETS = {
  placementAccuracy: 0.95,
  breathAccuracy: 0.95,
  minimumAccuracy: 0.80,
  placementResponseMs: 2000,
  breathLatencyMs: 1000,
  hrErrorBpm: 5,
  syncReliability: 1.0,
  sessionMinutes: 22,
  servoLatencyMs: 500
};

S.DEFAULT_SETTINGS = {
  deviceLabel: 'MatePad',
  deviceCode: 'MP',
  picoMode: 'sim',
  picoUrl: 'ws://192.168.1.50:8080',
  visionMode: 'sim',
  syncUrl: '',
  syncKey: '',
  confThreshold: 0.6,
  hrSwingThreshold: 2,
  mirrorDuringTrials: false,
  simAutoStudent: true,
  simSkill: 0.75,
  simAiError: 0.03,
  simSpeed: 1,
  cameraFacing: 'environment',
  nextSeq: 1
};
