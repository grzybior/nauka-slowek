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

// Obietnica kończąca się, gdy bieżąca wymowa dobiegnie końca (albo zostanie przerwana).
let current = Promise.resolve();

/** accent: 'us' | 'gb'; slow: wolniejsze tempo. Rozpoczęcie nowej wymowy przerywa poprzednią. */
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

  current = new Promise((resolve) => {
    let done = false;
    let timer = null;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    u.onend = finish;
    u.onerror = finish;
    // Zabezpieczenie: niektóre przeglądarki bywają, że nie wywołują onend (np. brak głosu).
    timer = setTimeout(finish, 3000 + (text.length * 180) / u.rate);
  });
  synth.speak(u);
}

/** Czeka, aż skończy się wszystko, co jest teraz odtwarzane (także wymowa uruchomiona w międzyczasie). */
export async function whenSpoken() {
  let p;
  do {
    p = current;
    await p;
  } while (p !== current);
}

export function stopSpeaking() {
  if (canSpeak) window.speechSynthesis.cancel();
}
