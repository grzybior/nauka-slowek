// Odsłuchiwanie wymowy słówek w wybranym języku (Web Speech API wbudowane w przeglądarkę, bez kluczy i opłat).
import { speechLocale, DEFAULT_LANG } from './languages.js';

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

const norm = (v) => v.lang.replace('_', '-').toLowerCase();

function pickVoice(locale) {
  const want = locale.toLowerCase();
  const prefix = want.split('-')[0];
  const exact = voices.filter((v) => norm(v) === want);
  const pool = exact.length ? exact : voices.filter((v) => norm(v).split('-')[0] === prefix);
  return pool.find((v) => PREFERRED.test(v.name)) || pool[0] || null;
}

/** Czy urządzenie ma jakikolwiek głos dla danego języka (lista głosów bywa ładowana z opóźnieniem). */
export function hasVoice(lang) {
  if (!canSpeak) return false;
  if (!voices.length) loadVoices();
  if (!voices.length) return true; // jeszcze nie wiadomo, nie strasz ostrzeżeniem
  const prefix = speechLocale(lang).split('-')[0];
  return voices.some((v) => norm(v).split('-')[0] === prefix);
}

// Obietnica kończąca się, gdy bieżąca wymowa dobiegnie końca (albo zostanie przerwana).
let current = Promise.resolve();

/** lang: kod języka, accent: wariant (np. 'us'/'gb'), slow: wolniejsze tempo. Nowa wymowa przerywa poprzednią. */
export function speak(text, { lang = DEFAULT_LANG, accent, slow = false } = {}) {
  if (!canSpeak || !text) return;
  const locale = speechLocale(lang, accent);
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = locale;
  const v = pickVoice(locale);
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
