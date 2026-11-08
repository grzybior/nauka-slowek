// Odsłuchiwanie wymowy angielskich słówek (Web Speech API wbudowane w przeglądarkę, bez kluczy i opłat).

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let voices = [];
function loadVoices() {
  voices = window.speechSynthesis.getVoices() || [];
}
if (canSpeak) {
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

const PREFERRED = /google|natural|premium|enhanced|samantha|daniel|serena|karen|alex/i;

function pickVoice(lang) {
  const want = lang.toLowerCase();
  const norm = (v) => v.lang.replace('_', '-').toLowerCase();
  const exact = voices.filter((v) => norm(v) === want);
  const pool = exact.length ? exact : voices.filter((v) => norm(v).startsWith('en'));
  return pool.find((v) => PREFERRED.test(v.name)) || pool[0] || null;
}

/** accent: 'us' | 'gb'; slow: wolniejsze tempo. */
export function speak(text, { accent = 'us', slow = false } = {}) {
  if (!canSpeak || !text) return;
  const lang = accent === 'gb' ? 'en-GB' : 'en-US';
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.rate = slow ? 0.65 : 0.95;
  synth.speak(u);
}

export function stopSpeaking() {
  if (canSpeak) window.speechSynthesis.cancel();
}
