/* Pre-recorded Verity clips. Each page plays its main clip once; Replay plays it again. */
window.S = window.S || {};

S.audio = (() => {
  let current = null;      // the HTMLAudioElement now playing
  let lastMain = null;     // clip name the Replay button repeats
  let muted = false;
  const listeners = new Set();

  function fileFor(name) { return `audio/${name}.mp3`; }
  /* Verity's mouth moves while a clip plays */
  function speaking(on) { document.documentElement.classList.toggle('speaking', !!on); }
  function notify() { listeners.forEach(fn => fn(lastMain)); }

  /* Plays a clip and resolves when it ends. Never rejects: a missing file must not stop the test. */
  function play(name, opts = {}) {
    if (opts.main) { lastMain = name; notify(); }
    if (muted || S.run.speed > 1) {
      return S.run.wait(opts.fastMs || 400).catch(e => { if (e.name === 'Abort') throw e; });
    }
    return new Promise(resolve => {
      stop();
      const a = new Audio(fileFor(name));
      current = a;
      let done = false;
      const finish = () => { if (done) return; done = true; if (current === a) current = null; speaking(false); resolve(); };
      a.addEventListener('playing', () => speaking(true));
      a.addEventListener('pause', () => speaking(false));
      a.addEventListener('ended', finish);
      a.addEventListener('error', finish);
      const p = a.play();
      if (p && p.catch) p.catch(finish);
      /* Safety net so a stuck clip never blocks the test */
      const guard = setInterval(() => {
        if (done) { clearInterval(guard); return; }
        if (S.run.aborted) { clearInterval(guard); a.pause(); finish(); }
      }, 200);
    });
  }

  /* Fire and forget, used for the breathing count so it never delays the pacing */
  function cue(name) { play(name).catch(() => {}); }

  function replay() { if (lastMain && !S.run.paused) cue(lastMain); }
  function stop() { if (current) { current.pause(); current = null; } }
  function pauseAll() { if (current) current.pause(); }
  function resumeAll() { if (current) { const p = current.play(); if (p && p.catch) p.catch(() => {}); } }
  function setMain(name) { lastMain = name; notify(); }
  function onMain(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  /* Chains clips for a spoken score, e.g. 7.5 -> your_score, seven, point five, out of ten, label */
  async function sayScore(total, labelClip) {
    const whole = Math.floor(total);
    await play('p21_your_score');
    await play(`p21_num_${whole}`);
    if (total - whole >= 0.5) await play('p21_point_five');
    await play('p21_out_of_ten');
    await play(labelClip);
  }

  /* Browsers only allow sound after a tap. The first tap on the page unlocks it. */
  function unlock() {
    const a = new Audio();
    a.muted = true;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  }

  return { play, cue, replay, stop, pauseAll, resumeAll, setMain, onMain, sayScore, unlock, setMuted: m => { muted = m; }, get lastMain() { return lastMain; } };
})();
