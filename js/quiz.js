// Silnik quizu i powtórek (system Leitnera). Bez dostępu do DOM, dzięki czemu da się go testować.
import { normalize, splitMeanings, shuffle } from './util.js';

export const DAY = 86400000;
/** Odstępy między powtórkami (w dniach) dla pudełek 0..5. */
export const INTERVALS_DAYS = [0, 1, 2, 4, 8, 16];
export const MAX_BOX = INTERVALS_DAYS.length - 1;

/** Szansa na pytanie pisaniem (zamiast wyboru) zależnie od poziomu opanowania słówka (pudełka 0..5). */
const SPELLING_CHANCE = [0.1, 0.3, 0.5, 0.7, 0.85, 0.9];

/**
 * Szansa (0..1), że słówko zostanie zadane pisaniem w quizie mieszanym.
 * Nowe słówka wypadają głównie jako wybór (łatwiej rozpoznać), dobrze znane głównie jako pisanie.
 * Słówka trudne (więcej błędów niż trafień) dostają dodatkowo więcej wyboru.
 */
export function spellingChance(w) {
  const base = SPELLING_CHANCE[Math.min(Math.max((w && w.box) || 0, 0), MAX_BOX)];
  return w && isHard(w) ? Math.max(0, base - 0.25) : base;
}

/**
 * Rodzaj pytania w quizie mieszanym: 'spelling' albo 'choice'.
 * canChoose = false, gdy w bazie jest za mało słówek na odpowiedzi do wyboru. rnd pozwala na deterministyczne testy.
 */
export function pickKind(w, canChoose = true, rnd = Math.random()) {
  if (!canChoose) return 'spelling';
  return rnd < spellingChance(w) ? 'spelling' : 'choice';
}

/** Słówko czeka na powtórkę (nowe albo z minionym terminem). */
export const isDue = (w, now = Date.now()) => !w.due || w.due <= now;
/** Słówko sprawia kłopot: błędów jest co najmniej tyle, co poprawnych odpowiedzi. */
export const isHard = (w) => (w.wrong || 0) > 0 && (w.wrong || 0) >= (w.correct || 0);

/** Nowe statystyki słówka po odpowiedzi. Poprawna: wyższe pudełko i późniejsza powtórka; błędna: od nowa. */
export function applyResult(w, ok, now = Date.now()) {
  const box = ok ? Math.min((w.box || 0) + 1, MAX_BOX) : 0;
  return {
    box,
    due: ok ? now + INTERVALS_DAYS[box] * DAY : now,
    correct: (w.correct || 0) + (ok ? 1 : 0),
    wrong: (w.wrong || 0) + (ok ? 0 : 1),
    lastSeen: now,
  };
}

export function makeQuestion(w, direction) {
  const dir = direction === 'both' ? (Math.random() < 0.5 ? 'enpl' : 'plen') : direction;
  return {
    id: w.id, en: w.en, pl: w.pl, dir,
    q: dir === 'enpl' ? w.en : w.pl,
    correct: dir === 'enpl' ? w.pl : w.en,
  };
}

/**
 * Źródło pytań: losuje z "worka" i dopiero po wyczerpaniu wszystkich słówek tasuje go od nowa,
 * więc słówka nie powtarzają się, dopóki nie przejdziemy całej puli.
 */
export function createSource(words, direction = 'both') {
  let bag = [];
  let last = null;
  const refill = () => {
    bag = shuffle(words);
    // Pierwsze losowane (koniec tablicy) nie może być tym samym słówkiem co poprzednio.
    if (bag.length > 1 && last && bag[bag.length - 1].id === last.id) {
      [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
  };
  return {
    size: words.length,
    next() {
      if (!words.length) throw new Error('Brak słówek');
      if (!bag.length) refill();
      last = bag.pop();
      return makeQuestion(last, direction);
    },
  };
}

/** Quiz o stałej liczbie pytań (bez powtórzeń słówek). count: liczba albo 'all'. */
export function buildStandardQuiz(words, count, direction) {
  const n = count === 'all' ? words.length : Math.min(Number(count) || 10, words.length);
  const src = createSource(words, direction);
  return Array.from({ length: n }, () => src.next());
}

/** Odpowiedzi do wyboru: poprawna + błędne z tej samej puli (a gdy za mało – z całej bazy). */
export function buildChoices(q, primary, fallback = [], n = 4) {
  const key = q.dir === 'enpl' ? 'pl' : 'en';
  const bad = new Set([normalize(q.correct)]);
  splitMeanings(q.correct).forEach((m) => bad.add(normalize(m)));

  const collect = (list) => {
    const seen = new Set();
    const out = [];
    for (const w of list) {
      const val = w[key];
      const nv = normalize(val);
      if (!val || seen.has(nv) || bad.has(nv)) continue;
      if (splitMeanings(val).some((m) => bad.has(normalize(m)))) continue;
      seen.add(nv);
      out.push(val);
    }
    return out;
  };

  let wrong = shuffle(collect(primary)).slice(0, n - 1);
  if (wrong.length < n - 1) {
    const extra = shuffle(collect(fallback)).filter((v) => !wrong.some((x) => normalize(x) === normalize(v)));
    wrong = wrong.concat(extra.slice(0, n - 1 - wrong.length));
  }
  return shuffle([q.correct, ...wrong]);
}

/** Sprawdza odpowiedź; przy kilku znaczeniach ("dom / budynek") wystarczy jedno z nich. */
export function isCorrect(q, given, strict = false) {
  const g = normalize(given, strict);
  if (!g) return false;
  if (normalize(q.correct, strict) === g) return true;
  return splitMeanings(q.correct).some((m) => normalize(m, strict) === g);
}

/** "1:30" albo "90" -> sekundy (10 s – 2 h). */
export function parseDuration(str, fallback = 60) {
  const s = String(str ?? '').trim();
  let sec;
  if (s.includes(':')) {
    const [m, ss] = s.split(':');
    sec = (parseInt(m, 10) || 0) * 60 + (parseInt(ss, 10) || 0);
  } else sec = parseInt(s, 10);
  if (!Number.isFinite(sec) || sec <= 0) sec = fallback;
  return Math.min(Math.max(sec, 10), 7200);
}

const dayKey = (ts) => {
  const d = new Date(ts);
  return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
};

/** Seria dni z rzędu z co najmniej jedną sesją (dziś jeszcze nie przerywa serii). */
export function computeStreak(sessions, now = Date.now()) {
  const days = new Set(sessions.map((s) => dayKey(s.date)));
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}
