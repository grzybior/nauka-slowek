// Stan aplikacji + wszystkie operacje na danych użytkownika (listy, słówka, sesje, ustawienia).
import { normalize } from './util.js';
import { applyResult, isDue, isHard, computeStreak } from './quiz.js';
import { DEFAULT_LANG, isLang, defaultAccent } from './languages.js';
import { MAX_WORDS, MAX_TEXT, MAX_MESSAGE } from './limits.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

export const DEFAULT_PREFS = {
  langs: ['en'],       // języki, których się uczysz
  accents: {},         // wariant wymowy dla języka, np. { en: 'gb', es: 'mx' }
  accent: 'us',        // dawne ustawienie (akcent angielski); używane jako domyślne dla 'en'
  autoSpeak: true,     // odtwarzaj wymowę automatycznie
  sounds: true,        // dźwięki poprawna/błędna
  strict: false,       // wymagaj znaków diakrytycznych w pisowni
  delay: 1.2,          // przerwa po odpowiedzi (s); 0 = ręcznie
  theme: 'auto',       // 'auto' | 'light' | 'dark'
  quiz: { listId: 'all', direction: 'both', mode: 'standard', type: 'choice', count: '10', time: '3:00' },
};

export const state = {
  status: 'booting', // booting | out | verify | blocked | loading | ready | error
  blockReason: '',   // 'blocked' (konto zablokowane) | 'closed' (rejestracja wyłączona)
  isAdmin: false,
  quotaHit: false,   // wyczerpany limit darmowego planu Firebase
  user: null,
  error: '',
  langs: ['en'],
  lang: DEFAULT_LANG,  // aktualnie ćwiczony język (zapamiętany na urządzeniu)
  lists: [],           // listy, słówka i sesje TYLKO bieżącego języka
  words: [],
  sessions: [],
  prefs: clone(DEFAULT_PREFS),
  backendMode: '',
};

// Dane wszystkich języków; state.* to ich przefiltrowany widok.
const raw = { lists: [], words: [], sessions: [] };

let be = null;
let unsubs = [];
let loaded = new Set();
const listeners = new Set();
let queued = false;
let errorHandler = () => {};

const WATCHES = ['lists', 'words', 'sessions', 'settings'];
const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'pl');
const wordKey = (w) => normalize(w.term) + '|' + normalize(w.pl);

// Dane sprzed wielojęzyczności nie mają pola lang (to angielski) i trzymają słówko w polu en.
const normWord = (w) => ({ ...w, lang: isLang(w.lang) ? w.lang : 'en', term: w.term ?? w.en ?? '' });
const normOther = (x) => ({ ...x, lang: isLang(x.lang) ? x.lang : 'en' });
const langKey = (uid) => 'ns_lang_' + uid;

/** Języki widoczne w przełączniku: wybrane w ustawieniach + każdy, w którym już są dane. */
function enabledLangs() {
  const set = new Set((state.prefs.langs || ['en']).filter(isLang));
  for (const w of raw.words) set.add(w.lang);
  for (const l of raw.lists) set.add(l.lang);
  if (!set.size) set.add(DEFAULT_LANG);
  return [...set];
}

function recompute() {
  state.langs = enabledLangs();
  if (!state.langs.includes(state.lang)) state.lang = state.langs[0];
  state.lists = raw.lists.filter((l) => l.lang === state.lang).sort(byName);
  state.words = raw.words.filter((w) => w.lang === state.lang);
  state.sessions = raw.sessions.filter((s) => s.lang === state.lang);
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function onError(fn) { errorHandler = fn; }

function emit() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; listeners.forEach((f) => f(state)); });
}

function mergePrefs(p) {
  const { id, ...rest } = p || {};
  return { ...clone(DEFAULT_PREFS), ...rest, quiz: { ...DEFAULT_PREFS.quiz, ...(rest.quiz || {}) } };
}

function stop() {
  unsubs.forEach((u) => { try { u(); } catch { /* ignore */ } });
  unsubs = [];
}

/** Czy błąd to wyczerpany limit Firestore (plan Spark resetuje go codziennie). */
export const isQuotaError = (e) => e?.code === 'resource-exhausted' || /quota/i.test(e?.message || '');

/** Pomocnik do dokumentów globalnych (profile, config, wiadomości) — używany też przez panel admina. */
export const gdb = {
  get: (p) => be.getDocAt(p),
  set: (p, d, o) => be.setDocAt(p, d, o),
  del: (p) => be.deleteAt(p),
  list: (p, o) => be.listAt(p, o),
};

/** Publiczne ustawienia aplikacji (czytelne bez logowania): { registrationOpen }. */
export async function publicConfig() {
  try { return (await be.getDocAt('config/app')) || {}; } catch { return {}; }
}

/** Po weryfikacji e-mail: profil, blokada, rejestracja. Zwraca true, gdy można ładować dane. */
async function admit(user) {
  try {
    let p = await be.getDocAt('profiles/' + user.uid);
    const now = Date.now();
    if (!p) {
      const cfg = await publicConfig();
      if (cfg.registrationOpen === false) { state.blockReason = 'closed'; state.status = 'blocked'; emit(); return false; }
      p = { email: user.email, name: user.name || '', createdAt: now, lastActive: now, warnedAt: 0, blocked: false };
      await be.setDocAt('profiles/' + user.uid, p);
    } else if (p.blocked) {
      state.blockReason = 'blocked'; state.status = 'blocked'; emit(); return false;
    } else if (now - (p.lastActive || 0) > 6 * 3600e3 || p.warnedAt) {
      be.setDocAt('profiles/' + user.uid, { lastActive: now, warnedAt: 0, email: user.email, name: user.name || '' }).catch(() => {});
    }
    state.isAdmin = Boolean(await be.getDocAt('admins/' + user.uid).catch(() => null));
    return true;
  } catch (e) {
    state.status = 'error';
    state.error = isQuotaError(e)
      ? 'Wyczerpany został dzienny limit darmowej bazy danych. Spróbuj ponownie jutro.'
      : e?.code === 'permission-denied'
        ? 'Brak uprawnień do bazy danych. Sprawdź reguły Firestore (README, krok 5) i czy e-mail jest potwierdzony.'
        : 'Nie udało się połączyć z bazą: ' + (e?.message || e);
    emit();
    return false;
  }
}

/** Użytkownik kliknął link w mailu: odśwież konto i ruszaj dalej. */
export async function recheckVerification() {
  const u = await be.refreshUser();
  state.user = u;
  if (u.emailVerified) start(u); else emit();
  return u.emailVerified;
}
export const resendVerification = () => be.sendVerification();

/** Wiadomość do autora (trafia do panelu administratora). */
export async function sendContact(text, email) {
  text = String(text || '').trim().slice(0, MAX_MESSAGE);
  if (text.length < 5) throw new Error('Napisz trochę więcej.');
  let last = 0;
  try { last = Number(localStorage.getItem('ns_contact_ts')) || 0; } catch { /* ignore */ }
  if (Date.now() - last < 60000) throw new Error('Poczekaj chwilę przed wysłaniem kolejnej wiadomości.');
  const id = be.newId(state.user.uid, 'messages');
  await be.setDocAt('messages/' + id, { uid: state.user.uid, email: email || state.user.email, name: state.user.name || '', text, createdAt: Date.now(), read: false });
  try { localStorage.setItem('ns_contact_ts', String(Date.now())); } catch { /* ignore */ }
}

async function start(user) {
  stop();
  state.user = user;
  state.quotaHit = false;
  if (!user.emailVerified) { state.status = 'verify'; emit(); return; }
  state.status = 'loading';
  emit();
  if (!(await admit(user))) return;
  if (!state.user || state.user.uid !== user.uid) return; // wylogowano w międzyczasie
  try { const l = localStorage.getItem(langKey(user.uid)); state.lang = isLang(l) ? l : DEFAULT_LANG; } catch { state.lang = DEFAULT_LANG; }
  loaded = new Set();
  state.user = user;
  state.status = 'loading';
  state.error = '';
  const done = (n) => {
    loaded.add(n);
    if (loaded.size === WATCHES.length && state.status === 'loading') state.status = 'ready';
    emit();
  };
  const onFail = (err) => {
    state.status = 'error';
    if (isQuotaError(err)) state.quotaHit = true;
    state.error = isQuotaError(err)
      ? 'Wyczerpany został dzienny limit darmowej bazy danych. Dane wrócą po odnowieniu limitu (zwykle następnego dnia).'
      : err?.code === 'permission-denied'
      ? 'Brak uprawnień do bazy danych. Sprawdź reguły Firestore (README, krok 5).'
      : 'Nie udało się wczytać danych: ' + (err?.message || err);
    emit();
  };
  const u = user.uid;
  unsubs = [
    be.watch(u, 'lists', (d) => { raw.lists = d.map(normOther); recompute(); done('lists'); }, { onError: onFail }),
    be.watch(u, 'words', (d) => { raw.words = d.map(normWord); recompute(); done('words'); }, { onError: onFail }),
    be.watch(u, 'sessions', (d) => { raw.sessions = d.map(normOther); recompute(); done('sessions'); }, { sort: 'date', dir: 'desc', limit: 100, onError: onFail }),
    be.watch(u, 'settings', (d) => { state.prefs = mergePrefs(d.find((x) => x.id === 'prefs')); recompute(); done('settings'); }, { onError: onFail }),
  ];
  emit();
}

export function init(backend) {
  be = backend;
  state.backendMode = backend.mode;
  backend.setWriteErrorHandler((e) => errorHandler(e));
  backend.onAuth((user) => {
    if (!user) {
      stop();
      raw.lists = []; raw.words = []; raw.sessions = [];
      Object.assign(state, { user: null, status: 'out', error: '', isAdmin: false, blockReason: '', quotaHit: false, lang: DEFAULT_LANG, langs: ['en'], lists: [], words: [], sessions: [], prefs: clone(DEFAULT_PREFS) });
      emit();
    } else if (!state.user || state.user.uid !== user.uid) {
      start(user);
    } else {
      state.user = { ...state.user, ...user };
      if (state.status === 'verify' && user.emailVerified) start(user); else emit();
    }
  });
}

/* ---------- konto ---------- */
export const signIn = (email, pw) => be.signIn(email, pw);
export const signUp = async (email, pw, name) => {
  const u = await be.signUp(email, pw, name);
  if (state.user && name && state.user.name !== name) { state.user = { ...state.user, name }; emit(); }
  return u;
};
export const signOut = () => be.signOut();
export const resetPassword = (email) => be.resetPassword(email);
export const changePassword = (cur, next) => be.changePassword(cur, next);
export async function updateName(name) {
  const u = await be.updateName(name);
  state.user = { ...state.user, ...u };
  emit();
}

/* ---------- języki ---------- */
export function setLang(lang) {
  if (!isLang(lang) || lang === state.lang) return;
  state.lang = lang;
  try { localStorage.setItem(langKey(state.user.uid), lang); } catch { /* ignore */ }
  recompute();
  emit();
}

/** Dodaje język do swoich języków i od razu na niego przełącza. */
export async function addLanguage(lang) {
  if (!isLang(lang)) return;
  if (!state.prefs.langs.includes(lang)) await savePrefs({ langs: [...state.prefs.langs, lang] });
  setLang(lang);
}

/** Wariant wymowy dla języka (dla angielskiego respektuje dawne ustawienie accent). */
export function accentFor(lang = state.lang) {
  return state.prefs.accents?.[lang] || (lang === 'en' ? state.prefs.accent : '') || defaultAccent(lang);
}

export const setAccent = (lang, accent) => savePrefs({ accents: { ...state.prefs.accents, [lang]: accent } });

/** Liczba słówek w każdym języku (do przełącznika). */
export function langCounts() {
  const c = {};
  for (const w of raw.words) c[w.lang] = (c[w.lang] || 0) + 1;
  return c;
}

/* ---------- selektory ---------- */
export const VIRTUAL_LISTS = [
  { id: 'all', name: 'Wszystkie słówka' },
  { id: 'due', name: 'Na dziś' },
  { id: 'hard', name: 'Trudne słówka' },
];

export function poolFor(listId, now = Date.now()) {
  const w = state.words;
  if (listId === 'all') return w;
  if (listId === 'due') return w.filter((x) => isDue(x, now));
  if (listId === 'hard') return w.filter(isHard);
  return w.filter((x) => (x.listIds || []).includes(listId));
}

export function listLabel(id) {
  return VIRTUAL_LISTS.find((l) => l.id === id)?.name || state.lists.find((l) => l.id === id)?.name || 'Lista';
}

export const isRealList = (id) => state.lists.some((l) => l.id === id);

export function stats() {
  const now = Date.now();
  const recent = state.sessions.slice(0, 10);
  const total = recent.reduce((s, x) => s + (x.total || 0), 0);
  const good = recent.reduce((s, x) => s + (x.score || 0), 0);
  return {
    words: state.words.length,
    mastered: state.words.filter((w) => (w.box || 0) >= 4).length,
    due: state.words.filter((w) => isDue(w, now)).length,
    hard: state.words.filter(isHard).length,
    streak: computeStreak(raw.sessions, now), // seria liczy naukę w dowolnym języku
    accuracy: total ? Math.round((good / total) * 100) : null,
    sessions: state.sessions.length,
  };
}

/* ---------- listy ---------- */
export async function addList(name) {
  const id = be.newId(state.user.uid, 'lists');
  const data = { name: name.trim(), lang: state.lang, createdAt: Date.now() };
  raw.lists = [...raw.lists, { id, ...data }];
  recompute();
  emit();
  await be.set(state.user.uid, 'lists', id, data);
  return id;
}

export const renameList = (id, name) => be.update(state.user.uid, 'lists', id, { name: name.trim() });

export async function deleteList(id) {
  const ops = state.words
    .filter((w) => (w.listIds || []).includes(id))
    .map((w) => ({ type: 'update', coll: 'words', id: w.id, data: { listIds: w.listIds.filter((x) => x !== id) } }));
  ops.push({ type: 'delete', coll: 'lists', id });
  await be.batch(state.user.uid, ops);
}

export const listNameTaken = (name, exceptId) =>
  state.lists.some((l) => l.id !== exceptId && normalize(l.name, true) === normalize(name, true));

/* ---------- słówka ---------- */
export async function addWord({ term, pl, listIds = [] }) {
  term = term.trim().slice(0, MAX_TEXT); pl = pl.trim().slice(0, MAX_TEXT);
  const key = wordKey({ term, pl });
  const ex = state.words.find((w) => wordKey(w) === key);
  if (ex) {
    const missing = listIds.filter((id) => !(ex.listIds || []).includes(id));
    if (!missing.length) return { status: 'duplicate', word: ex };
    await be.update(state.user.uid, 'words', ex.id, { listIds: [...(ex.listIds || []), ...missing] });
    return { status: 'linked', word: ex };
  }
  if (raw.words.length >= MAX_WORDS) return { status: 'limit' };
  const id = be.newId(state.user.uid, 'words');
  const data = { lang: state.lang, term, pl, listIds, box: 0, due: 0, correct: 0, wrong: 0, lastSeen: 0, createdAt: Date.now() };
  await be.set(state.user.uid, 'words', id, data);
  return { status: 'added', word: { id, ...data } };
}

export const updateWord = (id, patch) => be.update(state.user.uid, 'words', id, patch);

export const deleteWords = (ids) =>
  be.batch(state.user.uid, ids.map((id) => ({ type: 'delete', coll: 'words', id })));

export function addToList(wordIds, listId) {
  const ops = [];
  for (const id of wordIds) {
    const w = state.words.find((x) => x.id === id);
    if (w && !(w.listIds || []).includes(listId)) ops.push({ type: 'update', coll: 'words', id, data: { listIds: [...(w.listIds || []), listId] } });
  }
  return ops.length ? be.batch(state.user.uid, ops) : Promise.resolve();
}

export function removeFromList(wordIds, listId) {
  const ops = [];
  for (const id of wordIds) {
    const w = state.words.find((x) => x.id === id);
    if (w && (w.listIds || []).includes(listId)) ops.push({ type: 'update', coll: 'words', id, data: { listIds: w.listIds.filter((x) => x !== listId) } });
  }
  return ops.length ? be.batch(state.user.uid, ops) : Promise.resolve();
}

/**
 * Import słówek (z CSV albo zestawu startowego).
 * Duplikaty (to samo słówko+pl w bieżącym języku) nie są dublowane; jeśli już istnieją, są tylko dopisywane do listy.
 * Zwraca { added, linked, duplicates, listId }.
 */
export async function importWords(rows, { listId = null, newListName = null } = {}) {
  const uid = state.user.uid;
  if (!listId && newListName) listId = await addList(newListName);

  const known = new Map(state.words.map((w) => [wordKey(w), { id: w.id, listIds: [...(w.listIds || [])], fresh: false, touched: false }]));
  const ops = [];
  let added = 0, linked = 0, duplicates = 0, capped = 0;
  const now = Date.now();

  for (const r of rows) {
    const term = r.term.trim().slice(0, MAX_TEXT), pl = r.pl.trim().slice(0, MAX_TEXT);
    if (!term || !pl) continue;
    const key = wordKey({ term, pl });
    const ex = known.get(key);
    if (ex) {
      if (listId && !ex.listIds.includes(listId)) {
        ex.listIds.push(listId);
        ex.touched = true;
        if (!ex.fresh) linked++; else duplicates++;
      } else duplicates++;
      continue;
    }
    if (raw.words.length + added >= MAX_WORDS) { capped++; continue; }
    const id = be.newId(uid, 'words');
    const listIds = listId ? [listId] : [];
    ops.push({ type: 'set', coll: 'words', id, data: { lang: state.lang, term, pl, listIds, box: 0, due: 0, correct: 0, wrong: 0, lastSeen: 0, createdAt: now + added } });
    known.set(key, { id, listIds, fresh: true, touched: false });
    added++;
  }
  for (const [, v] of known) {
    if (!v.fresh && v.touched) ops.push({ type: 'update', coll: 'words', id: v.id, data: { listIds: v.listIds } });
  }
  if (ops.length) await be.batch(uid, ops);
  return { added, linked, duplicates, capped, listId };
}

/* ---------- sesje ---------- */
/** Zapisuje sesję i aktualizuje statystyki powtórek słówek (kolejno, także gdy słówko padło kilka razy). */
export async function saveSession(session, results) {
  const uid = state.user.uid;
  const id = be.newId(uid, 'sessions');
  const ops = [{ type: 'set', coll: 'sessions', id, data: { ...session, lang: state.lang } }];
  const work = new Map();
  for (const r of results) {
    const base = work.get(r.wid) || state.words.find((w) => w.id === r.wid);
    if (!base) continue; // słówko usunięto w międzyczasie
    work.set(r.wid, { ...base, ...applyResult(base, r.ok) });
  }
  for (const [wid, w] of work) {
    ops.push({ type: 'update', coll: 'words', id: wid, data: { box: w.box, due: w.due, correct: w.correct, wrong: w.wrong, lastSeen: w.lastSeen } });
  }
  await be.batch(uid, ops);
  return id;
}

export const deleteSession = (id) => be.remove(state.user.uid, 'sessions', id);

/* ---------- ustawienia ---------- */
export function savePrefs(patch) {
  state.prefs = { ...state.prefs, ...patch, quiz: { ...state.prefs.quiz, ...(patch.quiz || {}) } };
  recompute();
  emit();
  return be.set(state.user.uid, 'settings', 'prefs', state.prefs);
}
