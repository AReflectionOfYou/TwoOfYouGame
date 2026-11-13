/* Two of You: sound effects.
 * Sounds are synthesized with the Web Audio API, so there are no audio files.
 * On iOS, Web Audio is silenced by the ring/silent switch. Where the Audio
 * Session API exists (Safari 16.4+), we also ask for the "ambient" session,
 * which respects silent mode and mixes with other audio. */
(function () {
  'use strict';

  try {
    if (navigator.audioSession) navigator.audioSession.type = 'ambient';
  } catch (e) { /* not supported */ }

  var ctx = null;
  var enabled = true;
  var unlocked = false;

  function getContext() {
    if (!enabled) return null;
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    return ctx;
  }

  /* iOS only lets audio start inside a user gesture. Call this from one. */
  function unlock() {
    if (unlocked || !enabled) return;
    var c = getContext();
    if (!c) return;
    var buffer = c.createBuffer(1, 1, 22050);
    var src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(c.destination);
    src.start(0);
    unlocked = true;
  }

  function tone(c, opts) {
    var t0 = c.currentTime + (opts.delay || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.toFreq) osc.frequency.exponentialRampToValueAtTime(opts.toFreq, t0 + opts.dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(opts.gain, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.02);
  }

  function flip() {
    var c = getContext();
    if (!c) return;
    tone(c, { type: 'triangle', freq: 540, toFreq: 260, dur: 0.09, gain: 0.07 });
  }

  function match() {
    var c = getContext();
    if (!c) return;
    [784, 988, 1319].forEach(function (f, i) {
      tone(c, { type: 'sine', freq: f, dur: 0.55, gain: 0.08, delay: i * 0.09 });
    });
  }

  function finish() {
    var c = getContext();
    if (!c) return;
    [523, 659, 784, 1047].forEach(function (f, i) {
      tone(c, { type: 'sine', freq: f, dur: 0.7, gain: 0.07, delay: i * 0.12 });
    });
  }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled && ctx && ctx.state === 'running') ctx.suspend().catch(function () {});
  }

  window.TOYAudio = { unlock: unlock, flip: flip, match: match, finish: finish, setEnabled: setEnabled };
})();
