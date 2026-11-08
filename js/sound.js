// Krótkie dźwięki zwrotne (generowane w przeglądarce, bez plików audio).
let ctx = null;
let enabled = true;

export const setSoundEnabled = (v) => { enabled = Boolean(v); };

function ensure() {
  try {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq, dur, type = 'sine', gain = 0.06, delay = 0) {
  if (!enabled) return;
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const unlockAudio = () => { ensure(); };
export const sOK = () => { tone(880, 0.12); tone(1320, 0.14, 'sine', 0.06, 0.12); };
export const sBAD = () => tone(200, 0.24, 'triangle', 0.09);
export const sWIN = () => { tone(523, 0.18, 'triangle'); tone(659, 0.18, 'triangle', 0.06, 0.18); tone(784, 0.36, 'triangle', 0.06, 0.36); };
