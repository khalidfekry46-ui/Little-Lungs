/* Reading passages in the style of the STEM University Reading Test (URT).
   Each passage is about 170 to 240 words (about 1.5 minutes of reading) with 5 four-option questions.
   d = difficulty: E easy (1 point), I intermediate (2 points), H hard (3 points). a = index of the correct option.
   Test passages: 5 foundation (E,E,I,I,H), 5 intermediate (E,I,I,H,H), 5 advanced (I,I,H,H,H).
   Prep passages are different topics and are never used in the test. */
window.S = window.S || {};

S.PASSAGES = [
  /* ---------------- Test: foundation ---------------- */
  { id: 'T-F1', set: 'test', level: 'foundation', title: 'The Road Air Travels',
    text: [
      'When you breathe in through your nose, air passes through the nasal cavity, where it is warmed, moistened and filtered by hairs and sticky mucus. It then moves through the pharynx, a passage shared with food, and into the larynx, or voice box. A flap of tissue called the epiglottis closes over the larynx when you swallow, so food goes down the oesophagus instead.',
      'Below the larynx is the trachea, a tube about 12 cm long held open by C-shaped rings of cartilage. The trachea divides into two bronchi, one for each lung. Inside the lungs, each bronchus branches again and again into thousands of narrower tubes called bronchioles. The smallest bronchioles end in clusters of tiny air sacs called alveoli, where oxygen passes into the blood.',
      'The airways are lined with cells that carry tiny hairs called cilia. Mucus traps dust and microbes, and the cilia beat in waves that sweep the mucus upward toward the throat, where it is swallowed or coughed out. This "mucus escalator" keeps the delicate alveoli clean.'],
    questions: [
      { d: 'E', q: 'Which structure does air pass through immediately after the larynx?', o: ['The pharynx', 'The trachea', 'The bronchi', 'The bronchioles'], a: 1 },
      { d: 'E', q: 'What is the main role of the epiglottis?', o: ['To warm incoming air', 'To stop food entering the larynx during swallowing', 'To produce the voice', 'To trap dust particles'], a: 1 },
      { d: 'I', q: 'Why does the trachea need rings of cartilage?', o: ['To keep the tube open while air moves in and out', 'To produce mucus', 'To exchange gases with the blood', 'To push mucus upward'], a: 0 },
      { d: 'I', q: 'If the cilia stopped beating, which would most likely happen?', o: ['The alveoli would grow larger', 'Mucus and trapped particles would build up in the airways', 'The epiglottis would stay open', 'Air would no longer be warmed'], a: 1 },
      { d: 'H', q: 'Breathing through the mouth on a cold, dusty day irritates the airways more than breathing through the nose. Which statement from the passage best explains this?', o: ['The pharynx is shared with food.', 'The nasal cavity warms, moistens and filters incoming air.', 'The trachea divides into two bronchi.', 'Oxygen passes into the blood in the alveoli.'], a: 1 }
    ] },
  { id: 'T-F2', set: 'test', level: 'foundation', title: 'How the Diaphragm Moves Air',
    text: [
      'The lungs have no muscles of their own, so they cannot inflate themselves. Breathing depends on the muscles around them. The most important is the diaphragm, a dome-shaped sheet of muscle that separates the chest cavity from the abdomen.',
      'When you breathe in, the diaphragm contracts and flattens, moving downward. At the same time, the external intercostal muscles between the ribs contract, pulling the ribs upward and outward. Both movements make the chest cavity larger. Because the volume inside the chest increases, the air pressure inside the lungs falls slightly below the pressure of the air outside, and air flows in.',
      'During quiet breathing out, the diaphragm and intercostal muscles relax. The diaphragm returns to its dome shape, the ribs move down and in, and the elastic lungs recoil. The chest volume decreases, the pressure inside rises above the outside pressure, and air flows out. During hard exercise, the internal intercostal and abdominal muscles also contract to push air out faster.',
      'Breathing that relies mostly on the diaphragm makes the belly rise, while breathing that relies mostly on the rib muscles makes the chest rise.'],
    questions: [
      { d: 'E', q: 'What happens to the diaphragm when you breathe in?', o: ['It relaxes and becomes dome-shaped', 'It contracts and flattens', 'It pushes the ribs downward', 'It fills with air'], a: 1 },
      { d: 'E', q: 'Air flows into the lungs because the pressure inside the lungs becomes:', o: ['higher than the outside pressure', 'equal to the outside pressure', 'lower than the outside pressure', 'zero'], a: 2 },
      { d: 'I', q: 'According to the passage, quiet breathing out is mainly:', o: ['an active process using the abdominal muscles', 'a passive process caused by muscles relaxing and the lungs recoiling', 'caused by the diaphragm contracting', 'caused by the internal intercostal muscles'], a: 1 },
      { d: 'I', q: "A student's belly rises clearly while the chest barely moves. Which muscle is the student mainly using?", o: ['The diaphragm', 'The external intercostals', 'The internal intercostals', 'The abdominal muscles'], a: 0 },
      { d: 'H', q: 'A person has a weak diaphragm but normal rib muscles. Which statements are most likely true? I. They can still breathe in using the external intercostals. II. Their chest volume increases less with each breath. III. Their lungs can inflate by themselves.', o: ['I only', 'I and II only', 'II and III only', 'I, II and III'], a: 1 }
    ] },
  { id: 'T-F3', set: 'test', level: 'foundation', title: 'Where Gases Change Places',
    text: [
      'Each lung contains hundreds of millions of alveoli, tiny air sacs whose total inner surface area is about 70 square metres, roughly half a tennis court. The wall of an alveolus is only one cell thick, and each alveolus is wrapped in a net of capillaries whose walls are also one cell thick. Together, the two walls form a barrier less than one micrometre across.',
      'Gases cross this barrier by diffusion: they move from where they are more concentrated to where they are less concentrated. Air reaching the alveoli has a high concentration of oxygen, while blood arriving from the body has a low concentration of oxygen, so oxygen diffuses into the blood. Carbon dioxide does the opposite: it is more concentrated in the blood than in the alveolar air, so it diffuses out and is breathed out.',
      'Breathing keeps these differences, called concentration gradients, steep by bringing in fresh air and removing used air. Blood flow also helps by carrying oxygen-rich blood away. The inside of each alveolus is covered by a thin layer of moisture, because gases must dissolve before they can diffuse across the wall.'],
    questions: [
      { d: 'E', q: 'By which process do oxygen and carbon dioxide cross the alveolar wall?', o: ['Active transport', 'Diffusion', 'Osmosis', 'Filtration'], a: 1 },
      { d: 'E', q: 'Blood arriving at the lungs from the body contains:', o: ['high oxygen and low carbon dioxide', 'low oxygen and high carbon dioxide', 'high oxygen and high carbon dioxide', 'no carbon dioxide'], a: 1 },
      { d: 'I', q: 'Which feature mainly increases the amount of gas that can be exchanged at the same time?', o: ['The large total surface area of the alveoli', 'The cartilage rings of the trachea', 'The moisture inside the alveoli', 'The mucus in the bronchi'], a: 0 },
      { d: 'I', q: 'Why does breathing keep the concentration gradients steep?', o: ['It makes the alveolar walls thinner', 'Fresh air keeps alveolar oxygen high and carries carbon dioxide away', 'It pumps blood through the capillaries', 'It turns carbon dioxide into oxygen'], a: 1 },
      { d: 'H', q: 'In a lung disease, the walls between alveoli are destroyed, so many small alveoli merge into fewer large sacs. Which result is most likely?', o: ['Surface area increases, so more oxygen enters the blood', 'Surface area decreases, so less oxygen enters the blood each minute', 'The barrier becomes thinner, so gas exchange speeds up', 'Carbon dioxide starts diffusing from the air into the blood'], a: 1 }
    ] },
  { id: 'T-F4', set: 'test', level: 'foundation', title: 'Heart and Lungs During Exercise',
    text: [
      "A class measured one student's breathing rate and heart rate at rest and after three activities. Each activity lasted three minutes, and the measurements were taken in the first minute after stopping."],
    table: { head: ['Activity', 'Breathing rate (breaths per minute)', 'Heart rate (beats per minute)'], rows: [['Sitting at rest', '14', '72'], ['Walking', '20', '95'], ['Jogging', '32', '135'], ['Running fast', '44', '170']] },
    after: [
      'During exercise, the muscles use more oxygen and produce more carbon dioxide because they release more energy through cellular respiration. Breathing faster and deeper brings in more oxygen and removes carbon dioxide, while a faster heart rate pumps blood more quickly between the lungs and the muscles.',
      'After exercise stops, both rates gradually return to their resting values. The time this takes is called the recovery time, and it is usually shorter in people who exercise regularly.'],
    questions: [
      { d: 'E', q: "What was the student's heart rate after jogging?", o: ['95 beats per minute', '135 beats per minute', '32 beats per minute', '170 beats per minute'], a: 1 },
      { d: 'E', q: 'Which activity produced the highest breathing rate?', o: ['Sitting at rest', 'Walking', 'Jogging', 'Running fast'], a: 3 },
      { d: 'I', q: 'Which statement best describes the data?', o: ['As activity becomes more intense, breathing rate and heart rate both increase', 'Heart rate increases but breathing rate stays the same', 'Both rates decrease during exercise', 'Breathing rate is always higher than heart rate'], a: 0 },
      { d: 'I', q: 'Why were the measurements taken in the first minute after stopping?', o: ['Because the rates start returning to resting values soon after exercise ends', 'Because the heart stops after exercise', 'To let the muscles produce more carbon dioxide', 'Because breathing rate cannot be measured at rest'], a: 0 },
      { d: 'H', q: 'The class wants to test whether regular exercise shortens recovery time. Which plan is best?', o: ['Measure one student once after running and once after walking', 'Compare the recovery times of students who train regularly and students who do not, after the same activity for the same time', 'Measure one student’s resting heart rate every day', 'Ask students how tired they feel after running'], a: 1 }
    ] },
  { id: 'T-F5', set: 'test', level: 'foundation', title: 'Asthma: When Airways Narrow',
    text: [
      'The walls of the bronchioles contain smooth muscle. In a person with asthma, these airways are very sensitive. Triggers such as dust, pollen, smoke, cold air or exercise can cause the smooth muscle to contract, the lining to swell, and extra mucus to be produced. All three narrow the airways.',
      'During an asthma attack, a person may wheeze, cough, feel tightness in the chest and struggle to breathe out. Because air must pass through narrower tubes, more effort is needed to move the same volume of air.',
      'Two kinds of medicine are commonly used. A reliever inhaler contains a drug that relaxes the smooth muscle in the bronchioles within minutes, widening them. A preventer inhaler usually contains a steroid that reduces swelling and sensitivity over days or weeks when taken every day. People with asthma are also advised to identify and avoid their triggers. Asthma usually cannot be cured, but with the right treatment most people control it well and live active lives.'],
    questions: [
      { d: 'E', q: 'Which of the following is NOT listed as an asthma trigger?', o: ['Pollen', 'Smoke', 'Cold air', 'Drinking water'], a: 3 },
      { d: 'E', q: 'What does a reliever inhaler do?', o: ['Reduces swelling over several weeks', 'Relaxes the smooth muscle of the bronchioles within minutes', 'Kills microbes in the lungs', 'Strengthens the diaphragm'], a: 1 },
      { d: 'I', q: 'Which three changes narrow the airways during an attack?', o: ['Muscle contraction, swelling of the lining, and extra mucus', 'Bursting alveoli, growing cilia, and bleeding', 'A weak diaphragm, broken ribs, and coughing', 'Lower heart rate, less blood, and more oxygen'], a: 0 },
      { d: 'I', q: 'A student with asthma has a race in 10 minutes and feels her chest tighten. Which inhaler helps more right now, and why?', o: ['The preventer, because it works over days', 'The reliever, because it widens the airways within minutes', 'The preventer, because it relaxes the diaphragm', 'Neither, because asthma cannot be treated'], a: 1 },
      { d: 'H', q: 'During an attack, breathing out feels harder than breathing in. Which explanation fits best?', o: ['Quiet breathing out depends on passive recoil, which may not push air quickly enough through narrowed airways', 'Breathing out uses the diaphragm contracting, which asthma weakens', 'Air cannot enter the alveoli during asthma', 'Carbon dioxide cannot diffuse during asthma'], a: 0 }
    ] },

  /* ---------------- Test: intermediate ---------------- */
  { id: 'T-I1', set: 'test', level: 'intermediate', title: 'What Makes You Breathe',
    text: [
      'Breathing is controlled by groups of neurons in the brainstem, mainly in the medulla oblongata. These neurons send rhythmic signals through the phrenic nerves to the diaphragm and through other nerves to the intercostal muscles.',
      'The rate and depth of breathing are adjusted mostly by chemoreceptors. Central chemoreceptors in the medulla respond to the acidity of the fluid around the brain, which rises when the carbon dioxide level in the blood rises, because carbon dioxide reacts with water to form carbonic acid. Peripheral chemoreceptors in the carotid arteries and the aorta also respond to carbon dioxide, but they are the main sensors of a large fall in blood oxygen. In healthy people at sea level, carbon dioxide is the strongest everyday signal: even a small rise makes breathing faster and deeper.',
      'In an experiment, volunteers held their breath for as long as possible in two conditions. In condition 1, they first breathed normally. In condition 2, they first breathed fast and deep (hyperventilated) for 30 seconds. The average breath-holding time was 55 seconds in condition 1 and 95 seconds in condition 2. Hyperventilating before swimming underwater is dangerous, because a person may faint from low oxygen before the urge to breathe becomes strong.'],
    questions: [
      { d: 'E', q: 'Where are the neurons that set the basic rhythm of breathing?', o: ['In the cerebellum', 'In the medulla oblongata', 'In the lungs', 'In the diaphragm'], a: 1 },
      { d: 'I', q: 'Why does a rise in blood carbon dioxide make the fluid around the brain more acidic?', o: ['Carbon dioxide reacts with water to form carbonic acid', 'Carbon dioxide lowers the oxygen level in the brain', 'Carbon dioxide blocks the phrenic nerves', 'Carbon dioxide turns into lactic acid'], a: 0 },
      { d: 'I', q: 'What was the independent variable in the experiment?', o: ['The breath-holding time', 'Whether the volunteers hyperventilated before holding their breath', 'The number of volunteers', 'The blood oxygen level'], a: 1 },
      { d: 'H', q: 'Which best explains why breath-holding time was longer in condition 2?', o: ['Hyperventilation stored extra oxygen in the lungs for many minutes', 'Hyperventilation lowered blood carbon dioxide, so it took longer to reach the level that forces a breath', 'Hyperventilation weakened the diaphragm', 'Hyperventilation switched off the peripheral chemoreceptors'], a: 1 },
      { d: 'H', q: 'Which statements explain why hyperventilating before swimming underwater is dangerous? I. Oxygen can fall to a fainting level before carbon dioxide rises enough to cause a strong urge to breathe. II. The main everyday signal to breathe is carbon dioxide, not oxygen. III. Hyperventilation raises blood carbon dioxide.', o: ['I only', 'I and II only', 'II and III only', 'I, II and III'], a: 1 }
    ] },
  { id: 'T-I2', set: 'test', level: 'intermediate', title: 'Measuring Lung Volumes',
    text: [
      'A spirometer measures how much air a person breathes in and out. The volume moved during one quiet breath is the tidal volume. After a normal breath in, a person can still breathe in extra air, the inspiratory reserve volume. After a normal breath out, they can still force out extra air, the expiratory reserve volume. The vital capacity is the largest volume a person can breathe out after the deepest possible breath in; it equals tidal volume + inspiratory reserve volume + expiratory reserve volume.',
      'Even after the strongest breath out, about 1.2 L of air stays in the lungs. This residual volume keeps the alveoli from collapsing, and it cannot be measured with a simple spirometer. Minute ventilation, the volume of air breathed per minute, equals tidal volume multiplied by breathing rate.'],
    table: { head: ['Student', 'Tidal volume (L)', 'Inspiratory reserve (L)', 'Expiratory reserve (L)', 'Breathing rate (per minute)'], rows: [['X', '0.5', '2.5', '1.0', '14'], ['Y', '0.6', '3.0', '1.2', '12']] },
    questions: [
      { d: 'E', q: "What is Student X's vital capacity?", o: ['3.0 L', '3.5 L', '4.0 L', '5.2 L'], a: 2 },
      { d: 'I', q: "What is Student Y's minute ventilation?", o: ['7.0 L per minute', '7.2 L per minute', '4.8 L per minute', '12.6 L per minute'], a: 1 },
      { d: 'I', q: 'Why can a simple spirometer not measure the residual volume?', o: ['It is too small to detect', 'This air never leaves the lungs, so it never passes through the spirometer', 'It contains only carbon dioxide', 'It changes every second'], a: 1 },
      { d: 'H', q: 'Which conclusion is supported by the table?', o: ['Student X breathes faster but moves less air per minute than Student Y', 'Student X moves more air per minute because X breathes faster', 'Both students have the same vital capacity', 'Student Y has the smaller tidal volume'], a: 0 },
      { d: 'H', q: 'Student X changes to slow deep breaths of 1.0 L at 7 breaths per minute. Compared with before, minute ventilation would:', o: ['halve', 'stay the same, at 7.0 L per minute', 'double', 'be impossible to calculate'], a: 1 }
    ] },
  { id: 'T-I3', set: 'test', level: 'intermediate', title: 'Carrying Oxygen',
    text: [
      'Oxygen does not dissolve well in blood plasma. About 98% of the oxygen carried in blood is bound to hemoglobin, an iron-containing protein inside red blood cells. Each hemoglobin molecule can carry up to four oxygen molecules. In the lungs, where oxygen is plentiful, hemoglobin loads oxygen; in active tissues, where oxygen is used up, it releases it.',
      "A pulse oximeter, like the sensor on this station's finger clip, shines red and infrared light through the finger. Oxygen-rich and oxygen-poor hemoglobin absorb these two kinds of light differently, so the sensor can estimate the percentage of hemoglobin carrying oxygen, called oxygen saturation (SpO2). In healthy people at sea level, SpO2 is usually 95% to 100%.",
      'At high altitude, air pressure is lower, so each breath brings fewer oxygen molecules into the lungs and SpO2 falls. Over several weeks at altitude, the kidneys release more of the hormone erythropoietin (EPO), which stimulates the bone marrow to make more red blood cells. Some athletes train at altitude for this reason. However, more red blood cells also make the blood thicker.'],
    questions: [
      { d: 'E', q: 'Where is most of the oxygen in blood carried?', o: ['Dissolved in plasma', 'Bound to hemoglobin in red blood cells', 'Inside white blood cells', 'Attached to platelets'], a: 1 },
      { d: 'I', q: 'How does a pulse oximeter estimate oxygen saturation?', o: ['By listening to heart sounds', 'By comparing how oxygen-rich and oxygen-poor hemoglobin absorb red and infrared light', 'By counting red blood cells', 'By measuring the air pressure'], a: 1 },
      { d: 'I', q: 'Why does SpO2 fall at high altitude?', o: ['The air there contains no oxygen', 'Lower air pressure means fewer oxygen molecules enter the lungs with each breath', 'Hemoglobin stops working in the cold', 'The kidneys stop making EPO'], a: 1 },
      { d: 'H', q: 'An athlete lives at altitude for six weeks, then races at sea level. Which advantage is she most likely to have?', o: ['More red blood cells, so her blood can carry more oxygen', 'A larger lung surface area', 'More oxygen dissolved in her plasma', 'Thinner blood, so a lower heart rate'], a: 0 },
      { d: 'H', q: 'Which is a possible DISADVANTAGE of making a very large number of red blood cells?', o: ['Thicker blood is harder for the heart to pump', 'The blood carries less oxygen', 'SpO2 falls below 50%', 'Hemoglobin can no longer bind oxygen'], a: 0 }
    ] },
  { id: 'T-I4', set: 'test', level: 'intermediate', title: 'Heartbeats That Follow the Breath',
    text: [
      'If heart rate is measured beat by beat, it is not perfectly steady. In most healthy young people, heart rate speeds up slightly while breathing in and slows down while breathing out. This pattern is called respiratory sinus arrhythmia (RSA). Despite its name, it is normal and is usually a sign of a healthy, flexible heart rhythm.',
      "RSA happens mainly because of the vagus nerve, which slows the heart. While breathing in, the brainstem reduces the vagus nerve's activity, so the heart speeds up; while breathing out, vagus activity returns and the heart slows.",
      'A team recorded the heart rate of 20 teenagers in three conditions lasting two minutes each. The swing is the difference between the highest and lowest heart rate within each breath.'],
    table: { head: ['Condition', 'Breaths per minute', 'Average heart rate (bpm)', 'Average swing (bpm)'], rows: [['Normal breathing', '15', '78', '4'], ['Slow diaphragmatic breathing', '6', '75', '11'], ['Fast shallow chest breathing', '24', '80', '2']] },
    questions: [
      { d: 'E', q: 'In most healthy young people, what happens to heart rate while breathing in?', o: ['It slows down', 'It speeds up', 'It stops briefly', 'It stays exactly the same'], a: 1 },
      { d: 'I', q: 'Which nerve is mainly responsible for RSA?', o: ['The phrenic nerve', 'The vagus nerve', 'The optic nerve', 'The intercostal nerves'], a: 1 },
      { d: 'I', q: 'Which condition produced the largest swing in heart rate?', o: ['Normal breathing', 'Slow diaphragmatic breathing', 'Fast shallow chest breathing', 'All three were equal'], a: 1 },
      { d: 'H', q: 'Which conclusion is best supported by the data?', o: ['Faster breathing produces larger heart-rate swings', 'Slower, deeper breathing produces larger swings, while average heart rate changes only a little', 'RSA only happens during chest breathing', 'Breathing rate has no effect on heart rate'], a: 1 },
      { d: 'H', q: "A student's heart rate stays exactly the same during every breath, even during slow breathing. Which could explain this? I. Very low vagus nerve activity. II. A sensor that is not detecting individual beats accurately. III. Breathing too slowly.", o: ['I only', 'II only', 'I and II only', 'I, II and III'], a: 2 }
    ] },
  { id: 'T-I5', set: 'test', level: 'intermediate', title: 'Surfactant and the First Breath',
    text: [
      'The inside of each alveolus is coated with a thin layer of water. Water molecules attract one another strongly, creating surface tension, a force that pulls the wet surfaces inward and tends to make tiny sacs collapse. Smaller sacs are affected more, because the inward pressure caused by surface tension increases as the radius of the sac decreases.',
      'To prevent this, special cells in the alveolar wall secrete surfactant, a mixture of lipids and proteins that spreads over the water layer and lowers surface tension. With surfactant, the alveoli stay open between breaths and the lungs need much less effort to inflate.',
      'Surfactant production begins in the fetus at around 24 weeks of pregnancy, and enough is usually present by about 35 weeks. Babies born very early may not have enough. They develop respiratory distress syndrome: they breathe rapidly with great effort, and many alveoli collapse after each breath. Treatments include giving the mother steroid injections before an expected early birth, which speeds up surfactant production in the baby, and placing surfactant into the baby’s airways through a tube after birth.'],
    questions: [
      { d: 'E', q: 'What does surfactant do?', o: ['Raises surface tension', 'Lowers surface tension', 'Carries oxygen in the blood', 'Produces mucus'], a: 1 },
      { d: 'I', q: 'Why are smaller alveoli more likely to collapse?', o: ['They contain more water', 'The inward pressure from surface tension is greater when the radius is smaller', 'They have no capillaries', 'They receive less air'], a: 1 },
      { d: 'I', q: 'Which baby is MOST at risk of respiratory distress syndrome?', o: ['A baby born at 40 weeks', 'A baby born at 37 weeks', 'A baby born at 28 weeks', 'A baby born at 35 weeks'], a: 2 },
      { d: 'H', q: 'Why are steroids given to the mother before an early birth?', o: ['They speed up surfactant production in the baby, so the lungs are ready for the first breath', 'They replace surfactant in the mother’s lungs', 'They stop the birth from happening', 'They lower the baby’s heart rate'], a: 0 },
      { d: 'H', q: 'The same pressure is used to inflate a normal lung and a lung that lacks surfactant. What would you predict?', o: ['The lung lacking surfactant inflates to a smaller volume', 'Both lungs inflate equally', 'The lung lacking surfactant inflates more', 'The normal lung cannot hold air'], a: 0 }
    ] },

  /* ---------------- Test: advanced ---------------- */
  { id: 'T-A1', set: 'test', level: 'advanced', title: 'Why Breathing Rises During Exercise',
    text: [
      'During moderate exercise, ventilation (the volume of air breathed per minute) can rise from about 6 L to more than 60 L per minute. Two scientists explain this differently.',
      'Scientist 1 (chemical hypothesis): Working muscles produce more carbon dioxide and use more oxygen. The rising carbon dioxide level in the blood stimulates chemoreceptors, which signal the brainstem to increase breathing. Therefore, ventilation should rise only after blood carbon dioxide has increased.',
      'Scientist 2 (neural hypothesis): When the brain sends signals to start moving the muscles, it also sends signals to the breathing centres, and sensors in moving joints and muscles send more. Therefore, ventilation should rise at the very start of exercise, before blood chemistry changes.',
      'Observations: (1) Ventilation increases within the first few seconds of exercise, before blood leaving the muscles could reach the chemoreceptors. (2) During moderate, steady exercise, arterial carbon dioxide stays nearly constant, close to its resting value. (3) When another person moves a volunteer’s relaxed leg, ventilation rises slightly even though the volunteer’s muscles do no work. (4) In very hard exercise, lactic acid makes the blood more acidic, and ventilation rises steeply.'],
    questions: [
      { d: 'I', q: 'According to Scientist 1, what directly triggers the increase in breathing?', o: ['Signals from the motor cortex', 'Rising blood carbon dioxide detected by chemoreceptors', 'Sensors in moving joints', 'Falling body temperature'], a: 1 },
      { d: 'I', q: 'Observation 1 supports which scientist, and why?', o: ['Scientist 1, because carbon dioxide rises instantly', 'Scientist 2, because breathing rises before blood chemistry could change', 'Scientist 1, because blood moves very fast', 'Neither, because ventilation does not change'], a: 1 },
      { d: 'H', q: 'Why is Observation 2 a problem for Scientist 1?', o: ['If only rising carbon dioxide drove breathing, it would have to stay above its resting level, yet it stays nearly constant', 'Carbon dioxide cannot be measured in arteries', 'It shows that oxygen rises during exercise', 'It proves that muscles produce no carbon dioxide'], a: 0 },
      { d: 'H', q: 'Which observation best supports a role for chemical signals during very hard exercise?', o: ['Observation 1', 'Observation 2', 'Observation 3', 'Observation 4'], a: 3 },
      { d: 'H', q: 'Which conclusion is most consistent with all four observations?', o: ['Only Scientist 1 is correct', 'Only Scientist 2 is correct', 'Neural signals start the rise and match it to effort, while chemical signals add to it, especially in hard exercise', 'Neither nerves nor blood chemistry affect breathing'], a: 2 }
    ] },
  { id: 'T-A2', set: 'test', level: 'advanced', title: 'The Oxygen Hand-Off',
    text: [
      'The oxygen–hemoglobin dissociation curve shows the percentage of hemoglobin carrying oxygen (saturation) at different partial pressures of oxygen (PO2). The curve is S-shaped.',
      'In the lungs, PO2 is about 100 mmHg and hemoglobin is about 98% saturated. In resting tissues, PO2 is about 40 mmHg and saturation falls to about 75%, so hemoglobin releases roughly a quarter of its oxygen. In hard-working muscle, PO2 may fall to about 20 mmHg, where saturation is only about 35%.',
      'The shape matters. The top of the curve is flat: saturation stays high even if PO2 in the lungs falls somewhat. The middle of the curve is steep: a small drop in PO2 in the tissues makes hemoglobin release a large amount of oxygen.',
      'The curve can also shift. When carbon dioxide, acidity or temperature rise, as they do in active muscle, hemoglobin binds oxygen less tightly. The curve shifts to the right, so at the same PO2 hemoglobin holds less oxygen and releases more to the cells. This is called the Bohr effect.'],
    questions: [
      { d: 'I', q: 'About how saturated is hemoglobin as it leaves the lungs?', o: ['35%', '75%', '98%', '50%'], a: 2 },
      { d: 'I', q: 'At rest, about what fraction of its oxygen does hemoglobin release in the tissues?', o: ['About one quarter', 'About half', 'About three quarters', 'All of it'], a: 0 },
      { d: 'H', q: 'Why is the steep middle part of the curve useful?', o: ['A small fall in tissue PO2 releases a large amount of oxygen', 'It keeps hemoglobin fully saturated in the tissues', 'It stops carbon dioxide from binding', 'It lets hemoglobin load oxygen in the tissues'], a: 0 },
      { d: 'H', q: 'During exercise, muscle temperature and carbon dioxide rise. What happens?', o: ['The curve shifts right, and hemoglobin releases more oxygen to the muscle', 'The curve shifts left, and hemoglobin holds more oxygen', 'The curve does not change', 'Hemoglobin stops carrying oxygen completely'], a: 0 },
      { d: 'H', q: 'At moderate altitude, a climber’s lung PO2 falls from 100 to 80 mmHg. What does the passage predict?', o: ['Saturation stays fairly high, because the top of the curve is flat', 'Saturation falls to about 50%', 'Saturation rises above 98%', 'Hemoglobin can no longer load oxygen'], a: 0 }
    ] },
  { id: 'T-A3', set: 'test', level: 'advanced', title: 'The Pleural Seal',
    text: [
      'Each lung is covered by a thin membrane, and the inside of the chest wall is lined by another. Between them is the pleural space, which holds only a few millilitres of fluid.',
      'The lungs are elastic and always tend to recoil inward, while the chest wall tends to spring outward. These opposite pulls keep the pressure in the pleural space below atmospheric pressure, about 4 mmHg lower at rest. This negative pressure holds the lungs stretched against the chest wall, so when the chest expands, the lungs expand with it. While breathing in, the pleural pressure becomes even more negative, about 6 mmHg below atmospheric.',
      'If air enters the pleural space, through a wound in the chest wall or a tear in the lung, the pressure there rises to atmospheric pressure. This is a pneumothorax. The lung on that side is no longer held open and collapses, while the other lung usually keeps working, because each lung has its own pleural space. Doctors treat a large pneumothorax by inserting a tube that removes the air so the lung can re-expand.',
      "Boyle's law states that, at constant temperature, the pressure of a gas is inversely proportional to its volume."],
    questions: [
      { d: 'I', q: 'At rest, the pressure in the pleural space is:', o: ['higher than atmospheric pressure', 'lower than atmospheric pressure', 'equal to atmospheric pressure', 'zero'], a: 1 },
      { d: 'I', q: 'Why do the lungs always tend to recoil inward?', o: ['Because they are elastic', 'Because the diaphragm pulls them', 'Because the pleural fluid pushes them', 'Because air pressure outside is low'], a: 0 },
      { d: 'H', q: 'After a stab wound to the right side of the chest wall, which is most likely?', o: ['The right lung collapses, and the left lung keeps working', 'Both lungs collapse', 'Neither lung is affected', 'Only the left lung collapses'], a: 0 },
      { d: 'H', q: "Using Boyle's law, why does air flow into the lungs when the chest expands?", o: ['Lung volume increases, so the pressure inside falls below atmospheric pressure', 'Lung volume decreases, so pressure falls', 'Lung volume increases, so pressure rises', 'Pleural fluid pushes air into the lungs'], a: 0 },
      { d: 'H', q: 'Why does removing air from the pleural space let the lung re-expand? I. It restores negative pleural pressure. II. The lung is pulled outward with the chest wall again. III. It makes the lung less elastic.', o: ['I only', 'I and II only', 'II and III only', 'I, II and III'], a: 1 }
    ] },
  { id: 'T-A4', set: 'test', level: 'advanced', title: 'A Gas the Sensor Cannot See',
    text: [
      'Carbon monoxide (CO) is a colourless, odourless gas produced when fuels such as gas, charcoal or wood burn without enough oxygen, for example in a heater used in a closed room. CO binds to the same sites on hemoglobin as oxygen, but about 200 to 250 times more strongly. Hemoglobin carrying CO is called carboxyhemoglobin.',
      'Because CO occupies binding sites and is released very slowly, less hemoglobin is available to carry oxygen. CO also makes the remaining hemoglobin hold its oxygen more tightly, so even less oxygen is released to the tissues. Early symptoms include headache, dizziness and nausea; high levels can cause loss of consciousness and death.',
      'A standard pulse oximeter measures the absorption of red and infrared light. Carboxyhemoglobin absorbs red light almost the same way as oxygen-rich hemoglobin, so the device cannot tell them apart. A patient with CO poisoning may therefore show an SpO2 of 97% while the blood carries far less oxygen than normal. Hospitals use a CO-oximeter, which measures more wavelengths. Treatment is breathing high-concentration oxygen, which speeds up the removal of CO from hemoglobin.'],
    questions: [
      { d: 'I', q: 'Why is CO hard to notice without equipment?', o: ['It is colourless and odourless', 'It is only produced outdoors', 'It causes no symptoms', 'It is heavier than water'], a: 0 },
      { d: 'I', q: 'What is carboxyhemoglobin?', o: ['Hemoglobin carrying carbon dioxide', 'Hemoglobin carrying carbon monoxide', 'A type of white blood cell', 'Hemoglobin without iron'], a: 1 },
      { d: 'H', q: 'Why might a standard pulse oximeter show 97% in CO poisoning?', o: ['Carboxyhemoglobin absorbs red light almost like oxygen-rich hemoglobin, so it is counted as carrying oxygen', 'CO raises the real oxygen level in blood', 'The sensor switches off when CO is present', 'CO makes the finger warmer'], a: 0 },
      { d: 'H', q: 'Which effects of CO reduce oxygen delivery to the tissues? I. CO occupies oxygen binding sites. II. The remaining hemoglobin releases oxygen less easily. III. CO destroys red blood cells immediately.', o: ['I only', 'I and II only', 'II and III only', 'I, II and III'], a: 1 },
      { d: 'H', q: 'A family uses a charcoal heater in a closed room, and two members have headaches. The finger sensor reads 98% for both. What is the best conclusion?', o: ['The reading rules out CO poisoning', 'The reading cannot rule out CO poisoning; they need fresh air and testing with a CO-oximeter', 'The headaches are caused by too much oxygen', 'They should breathe faster in the room'], a: 1 }
    ] },
  { id: 'T-A5', set: 'test', level: 'advanced', title: 'Breathing on the Roof of the World',
    text: [
      'At sea level, air pressure is about 760 mmHg and oxygen makes up about 21% of the air. At 5,500 m, the air still contains about 21% oxygen, but the air pressure is only about half its sea-level value, so each breath delivers about half as many oxygen molecules. A team of climbers recorded these resting measurements during an expedition.'],
    table: { head: ['Altitude (m)', 'SpO2 (%)', 'Breaths per minute', 'Heart rate (bpm)'], rows: [['0', '98', '13', '64'], ['2,500', '93', '15', '72'], ['4,000', '86', '18', '82'], ['5,500', '78', '22', '95']] },
    after: [
      'When blood oxygen falls a lot, the peripheral chemoreceptors stimulate faster, deeper breathing. This also removes more carbon dioxide than usual, making the blood slightly alkaline. Because the central chemoreceptors respond to acidity, this alkalinity partly holds back the drive to breathe during the first days. Over several days, the kidneys excrete more bicarbonate, bringing blood acidity back toward normal and allowing breathing to increase further. This is part of acclimatization.'],
    questions: [
      { d: 'I', q: 'Why does each breath at 5,500 m deliver fewer oxygen molecules?', o: ['The air contains a smaller percentage of oxygen', 'The air pressure is about half that at sea level', 'Climbers breathe more slowly', 'Cold air destroys oxygen'], a: 1 },
      { d: 'I', q: 'By how much did resting heart rate rise between sea level and 5,500 m?', o: ['18 bpm', '23 bpm', '31 bpm', '95 bpm'], a: 2 },
      { d: 'H', q: 'Which best explains the rise in breathing rate in the table?', o: ['As SpO2 falls, the peripheral chemoreceptors stimulate breathing', 'As altitude rises, blood carbon dioxide rises sharply', 'The kidneys make breathing faster on the first day', 'Higher heart rate forces the lungs to move'], a: 0 },
      { d: 'H', q: 'Why does fast breathing at altitude make the blood slightly alkaline?', o: ['It removes more carbon dioxide, so less carbonic acid forms', 'It adds bicarbonate to the blood', 'It increases lactic acid', 'It raises blood oxygen above normal'], a: 0 },
      { d: 'H', q: 'Why does a climber who stays several days at 4,000 m breathe more than on the first day? I. The kidneys excrete bicarbonate, restoring blood acidity. II. The central chemoreceptors are no longer held back by alkaline blood. III. The air pressure at 4,000 m rises over the days.', o: ['I only', 'I and II only', 'II and III only', 'I, II and III'], a: 1 }
    ] },

  /* ---------------- Prep (practice) passages, never used in the test ---------------- */
  { id: 'P-F1', set: 'prep', level: 'foundation', title: 'Breathing Is Not Respiration',
    text: [
      'Many people use the words breathing and respiration as if they meant the same thing, but biologists separate them. Breathing, or ventilation, is the movement of air into and out of the lungs. It happens only in animals with lungs or similar organs, and it is carried out by muscles.',
      'Cellular respiration is a chemical process that happens inside almost every living cell, in plants as well as animals. In aerobic respiration, glucose reacts with oxygen to release energy, producing carbon dioxide and water. Most of this process takes place in the mitochondria. The energy released is stored in a molecule called ATP, which cells use to contract muscles, send nerve signals and build new molecules.',
      'Breathing exists to serve respiration: it brings oxygen into the blood so it can reach the cells, and it removes the carbon dioxide that respiration produces. When cells are very active, as in running muscles, they respire faster, so they need more oxygen and make more carbon dioxide. Plants respire all the time, day and night, even though in daylight they also carry out photosynthesis.'],
    questions: [
      { d: 'E', q: 'In which part of the cell does most aerobic respiration take place?', o: ['The nucleus', 'The mitochondria', 'The cell membrane', 'The ribosomes'], a: 1 },
      { d: 'E', q: 'Besides energy, what does aerobic respiration produce?', o: ['Oxygen and glucose', 'Carbon dioxide and water', 'Nitrogen and water', 'Glucose and carbon dioxide'], a: 1 },
      { d: 'I', q: 'Which statement best describes the difference between breathing and respiration?', o: ['Breathing moves air in and out of the lungs; respiration is a chemical reaction in cells that releases energy', 'They are two words for the same process', 'Breathing happens in every cell; respiration happens only in the lungs', 'Respiration moves air; breathing makes ATP'], a: 0 },
      { d: 'I', q: 'Why does breathing rate rise when you run?', o: ['Muscle cells respire faster, so they need more oxygen and produce more carbon dioxide', 'Running makes the lungs larger', 'Respiration stops while running', 'The heart produces oxygen'], a: 0 },
      { d: 'H', q: 'Which statements are correct? I. Plant cells carry out respiration. II. Breathing takes place inside every cell. III. Plants keep respiring at night.', o: ['I only', 'I and III only', 'II and III only', 'I, II and III'], a: 1 }
    ] },
  { id: 'P-F2', set: 'prep', level: 'foundation', title: 'The Body’s Air Filters',
    text: [
      'Every day you breathe in around 10,000 litres of air that contains dust, pollen, bacteria and viruses. Several defences stop most of these from reaching the alveoli. Hairs inside the nostrils trap large particles. Sticky mucus lining the nose, trachea and bronchi catches smaller ones, and cilia sweep the mucus toward the throat.',
      'If something irritates the airways, sensory receptors trigger reflexes. A sneeze clears the nose, and a cough clears the trachea and bronchi. In a cough, you first breathe in deeply, the vocal cords close, and the abdominal muscles contract strongly to raise the pressure in the chest. Then the vocal cords suddenly open, so air bursts out at high speed and carries the irritant with it.',
      'Particles that still reach the alveoli are engulfed and digested by white blood cells called alveolar macrophages. Cigarette smoke damages these defences: it slows and later destroys the cilia, so mucus collects in the airways, and smokers often develop a daily cough.'],
    questions: [
      { d: 'E', q: 'What traps large particles inside the nose?', o: ['Hairs', 'Cilia in the alveoli', 'Macrophages', 'The epiglottis'], a: 0 },
      { d: 'E', q: 'Which reflex clears the trachea and bronchi?', o: ['A sneeze', 'A cough', 'A yawn', 'A hiccup'], a: 1 },
      { d: 'I', q: 'Why do the vocal cords close before the burst of air in a cough?', o: ['So that pressure can build up in the chest', 'So that food does not enter the lungs', 'To produce sound', 'To let mucus enter the lungs'], a: 0 },
      { d: 'I', q: 'What do alveolar macrophages do?', o: ['Make mucus', 'Engulf and digest particles that reach the alveoli', 'Carry oxygen', 'Beat to move mucus'], a: 1 },
      { d: 'H', q: 'Why do smokers often cough every day?', o: ['Smoke damages the cilia, so mucus is not swept away and must be cleared by coughing', 'Smoke makes the alveoli larger', 'Smoke increases the number of nose hairs', 'Smoke stops the production of mucus'], a: 0 }
    ] },
  { id: 'P-I1', set: 'prep', level: 'intermediate', title: 'Counting Breaths With a Belt',
    text: [
      'A student team built a breathing monitor using two stretch belts. Each belt contains a sensor whose reading rises as the belt stretches. Belt C goes around the chest at armpit level, and belt A goes around the abdomen just above the navel.',
      'Before each test, the volunteer breathed normally for 30 seconds while the system recorded the average stretch of each belt. This baseline let the team compare everyone fairly, because people differ in size and the belts may be fastened more or less tightly. Volunteers were then asked to breathe in two styles. For each breath, the team calculated the ratio R = (increase in belt A reading) ÷ (increase in belt C reading), both measured from the baseline.'],
    table: { head: ['Breathing style', 'Increase, belt A', 'Increase, belt C', 'Ratio R'], rows: [['Belly (diaphragmatic)', '90', '20', '4.5'], ['Chest (thoracic)', '18', '80', '0.23']] },
    after: ['The team classified a breath as diaphragmatic when R was greater than 2 and thoracic when R was less than 0.5. Breaths in between were marked unclear.'],
    questions: [
      { d: 'E', q: 'Where is belt A placed?', o: ['Around the chest at armpit level', 'Around the abdomen just above the navel', 'Around the neck', 'Around the upper arm'], a: 1 },
      { d: 'I', q: 'Why was a baseline recorded before each test?', o: ['People differ in size and belt tightness, so the baseline allows a fair comparison', 'To warm up the sensors', 'To measure heart rate', 'To make the volunteer tired'], a: 0 },
      { d: 'H', q: 'One breath increases belt A by 30 and belt C by 60. How is it classified?', o: ['Diaphragmatic', 'Thoracic', 'Unclear', 'It cannot be calculated'], a: 2 },
      { d: 'I', q: 'Which situation would most likely produce more unclear breaths?', o: ['The volunteer talks or moves during the breaths', 'The belts are calibrated carefully', 'The ratio is used', 'A baseline is recorded'], a: 0 },
      { d: 'H', q: 'Why might the team use the ratio R instead of the belly-belt increase alone?', o: ['The ratio compares belly and chest movement in the same breath, so deep and shallow breaths of the same style give similar values', 'The ratio is always larger', 'The chest belt is more accurate', 'The belly belt cannot measure deep breaths'], a: 0 }
    ] },
  { id: 'P-I2', set: 'prep', level: 'intermediate', title: 'Emphysema',
    text: [
      'Emphysema is a long-term lung disease, most often caused by many years of smoking. Chemicals in smoke attract white blood cells that release enzymes, and over time these enzymes break down the elastic fibres in the alveolar walls. The walls between neighbouring alveoli are destroyed, so many small air sacs merge into fewer, larger ones. This reduces the surface area available for gas exchange.',
      'The loss of elastic fibres causes a second problem. Normally, the stretched lungs recoil when the breathing muscles relax, pushing air out. In emphysema, the lungs recoil weakly, and small airways that are no longer held open by the surrounding tissue tend to collapse during breathing out. Air becomes trapped, and the chest may become permanently enlarged, a shape sometimes called a barrel chest.',
      'People with emphysema often breathe out slowly through pursed lips, which keeps some pressure in the airways and helps them stay open. The damage cannot be reversed, but stopping smoking slows its progress.'],
    questions: [
      { d: 'E', q: 'What is the most common cause of emphysema?', o: ['Many years of smoking', 'Drinking cold water', 'Asthma inhalers', 'Exercise'], a: 0 },
      { d: 'I', q: 'How does emphysema reduce gas exchange?', o: ['Destroyed walls leave fewer, larger air sacs with less surface area', 'It thickens the cilia', 'It fills the alveoli with blood', 'It increases the number of alveoli'], a: 0 },
      { d: 'I', q: 'Why is breathing out especially difficult in emphysema?', o: ['The lungs recoil weakly and small airways collapse, trapping air', 'The diaphragm becomes too strong', 'The trachea becomes blocked by cartilage', 'The heart beats too slowly'], a: 0 },
      { d: 'H', q: 'How does breathing out through pursed lips help?', o: ['It keeps some pressure in the airways so they stay open while breathing out', 'It increases the number of alveoli', 'It adds oxygen to the air', 'It strengthens the elastic fibres'], a: 0 },
      { d: 'H', q: 'Which statements are supported by the passage? I. The damage is permanent. II. Stopping smoking slows the disease. III. Emphysema increases the number of elastic fibres.', o: ['I only', 'I and II only', 'II and III only', 'I, II and III'], a: 1 }
    ] },
  { id: 'P-A1', set: 'prep', level: 'advanced', title: 'Gills Run in Reverse',
    text: [
      'Water holds far less oxygen than air. A litre of water at 20 °C contains about 9 mg of dissolved oxygen, while a litre of air contains about 280 mg. Fish must therefore extract oxygen very efficiently.',
      'Water flows over the gill filaments in one direction, while blood in the capillaries of the gills flows in the opposite direction. This arrangement is called countercurrent exchange. As blood picks up oxygen, it keeps meeting water that has given up less of its oxygen, so along the whole exchange surface the water is slightly richer in oxygen than the blood next to it, and diffusion continues all the way.',
      'If water and blood flowed in the same direction (concurrent flow), their oxygen levels would quickly become equal, and diffusion would stop when the blood was about half saturated. With countercurrent flow, fish can remove about 80% of the oxygen from the water passing over their gills.',
      'Human lungs work differently. Air moves in and out through the same tubes, so fresh air always mixes with stale air left in the airways, and alveolar air contains less oxygen than outside air.'],
    questions: [
      { d: 'I', q: 'About how many times more oxygen does a litre of air hold than a litre of water?', o: ['About 3 times', 'About 30 times', 'About 300 times', 'About 3,000 times'], a: 1 },
      { d: 'I', q: 'What is countercurrent exchange?', o: ['Water and blood flowing in opposite directions', 'Water and blood flowing in the same direction', 'Air flowing in and out through the same tube', 'Blood flowing back and forth'], a: 0 },
      { d: 'H', q: 'Why does diffusion continue along the whole gill surface?', o: ['The water stays slightly richer in oxygen than the blood beside it everywhere', 'The blood is always fully saturated', 'The water has more carbon dioxide than the blood', 'The gill walls pump oxygen actively'], a: 0 },
      { d: 'H', q: 'With concurrent flow, about how saturated could the blood become at most?', o: ['About 10%', 'About 50%', 'About 80%', 'About 100%'], a: 1 },
      { d: 'H', q: 'According to the passage, why does alveolar air contain less oxygen than outside air?', o: ['Fresh air mixes with stale air left in the airways because air moves in and out through the same tubes', 'The lungs use countercurrent exchange', 'Water vapour removes oxygen', 'The alveoli produce carbon monoxide'], a: 0 }
    ] },
  { id: 'P-A2', set: 'prep', level: 'advanced', title: 'Holding Breath in the Deep',
    text: [
      'Weddell seals can dive for over an hour and reach depths of several hundred metres. Unlike human free divers, they breathe out before diving, so little air remains in their lungs. This reduces buoyancy and the amount of nitrogen that dissolves in the blood under high pressure.',
      'Instead of the lungs, seals store oxygen in their bodies. Their blood volume per kilogram of body mass is two to three times that of humans, their blood contains more hemoglobin, and their muscles contain large amounts of myoglobin, an oxygen-storing protein.',
      'During a dive, a set of responses called the dive reflex conserves oxygen. Heart rate falls sharply (bradycardia), from about 55 to as low as 15 beats per minute in long dives, and blood vessels to the gut, kidneys and resting muscles constrict, so oxygen-rich blood goes mainly to the brain and heart. Muscles then rely on the oxygen stored in their own myoglobin, and in very long dives they switch to anaerobic respiration, producing lactic acid that is cleared after the seal surfaces.',
      'Humans also have a weak dive reflex: putting the face in cold water slows the heart rate a little.'],
    questions: [
      { d: 'I', q: 'What do Weddell seals do just before diving, unlike human free divers?', o: ['Take an extra deep breath', 'Breathe out', 'Increase their heart rate', 'Swallow water'], a: 1 },
      { d: 'I', q: 'Which is NOT a way seals store oxygen for a dive?', o: ['A large blood volume', 'A lot of hemoglobin', 'Myoglobin in the muscles', 'A large volume of air in the lungs'], a: 3 },
      { d: 'H', q: 'Why does narrowing the blood vessels to the gut and kidneys help during a dive?', o: ['It saves oxygen-rich blood for the brain and heart', 'It makes the seal sink faster', 'It produces more myoglobin', 'It removes lactic acid'], a: 0 },
      { d: 'H', q: 'What does lactic acid in the muscles after a very long dive show?', o: ['The muscles switched to anaerobic respiration when their oxygen ran low', 'The seal breathed during the dive', 'The heart rate increased', 'The lungs were full of air'], a: 0 },
      { d: 'H', q: 'A student wearing the station’s finger clip puts her face in cold water. What does the passage predict?', o: ['Her heart rate decreases slightly', 'Her heart rate doubles', 'Her SpO2 rises above 100%', 'Nothing changes'], a: 0 }
    ] }
];

S.READING_POINTS = { E: 1, I: 2, H: 3 };
S.READING_MAX = 24;      /* best path: intermediate (11) + advanced (13) */
S.READING_WEIGHT = 8;    /* reading is worth up to 8 of Task 2's 15 raw points */

/* Spread the correct answers across A to D. The order is fixed per question (seeded by its id),
   so every student sees the same letters and item statistics stay comparable.
   Roman-numeral options (I only, I and II only...) keep their natural order. */
(function balanceOptions() {
  const seed = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  S.PASSAGES.forEach(p => p.questions.forEach((q, i) => {
    q.id = `${p.id}-Q${i + 1}`;
    if (/^I only$/.test(q.o[0])) return;
    let s = seed(q.id);
    const idx = [0, 1, 2, 3];
    for (let k = 3; k > 0; k--) { s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0; const j = s % (k + 1); [idx[k], idx[j]] = [idx[j], idx[k]]; }
    const correct = q.o[q.a];
    q.o = idx.map(n => q.o[n]);
    q.a = q.o.indexOf(correct);
  }));
})();
