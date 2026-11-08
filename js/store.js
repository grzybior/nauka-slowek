// Stan aplikacji + wszystkie operacje na danych użytkownika (listy, słówka, sesje, ustawienia).
import { normalize } from './util.js';
import { applyResult, isDue, isHard, computeStreak } from './quiz.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

export const DEFAULT_PREFS = {
  accent: 'us',        // 'us' | 'gb'
  autoSpeak: true,     // odtwarzaj wymowę automatycznie
  sounds: true,        // dźwięki poprawna/błędna
  strict: false,       // wymagaj polskich znaków w pisowni
  delay: 1.2,          // przerwa po odpowiedzi (s); 0 = ręcznie
  theme: 'auto',       // 'auto' | 'light' | 'dark'
  quiz: { listId: 'all', direction: 'both', mode: 'standard', type: 'choice', count: '10', time: '3:00' },
};

export const state = {
  status: 'booting', // booting | out | loading | ready | error
  user: null,
  error: '',
  lists: [],
  words: [],
  sessions: [],
  prefs: clone(DEFAULT_PREFS),
  backendMode: '',
};

let be = null;
let unsubs = [];
let loaded = new Set();
const listeners = new Set();
let queued = false;
let errorHandler = () => {};

const WATCHES = ['lists', 'words', 'sessions', 'settings'];
const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'pl');
const wordKey = (w) => normalize(w.en) + '|' + normalize(w.pl);

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

function start(user) {
  stop();
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
    state.error = err?.code === 'permission-denied'
      ? 'Brak uprawnień do bazy danych. Sprawdź reguły Firestore (README, krok 5).'
      : 'Nie udało się wczytać danych: ' + (err?.message || err);
    emit();
  };
  const u = user.uid;
  unsubs = [
    be.watch(u, 'lists', (d) => { state.lists = d.sort(byName); done('lists'); }, { onError: onFail }),
    be.watch(u, 'words', (d) => { state.words = d; done('words'); }, { onError: onFail }),
    be.watch(u, 'sessions', (d) => { state.sessions = d; done('sessions'); }, { sort: 'date', dir: 'desc', limit: 100, onError: onFail }),
    be.watch(u, 'settings', (d) => { state.prefs = mergePrefs(d.find((x) => x.id === 'prefs')); done('settings'); }, { onError: onFail }),
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
      Object.assign(state, { user: null, status: 'out', error: '', lists: [], words: [], sessions: [], prefs: clone(DEFAULT_PREFS) });
      emit();
    } else if (!state.user || state.user.uid !== user.uid) {
      start(user);
    } else {
      state.user = user;
      emit();
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
    streak: computeStreak(state.sessions, now),
    accuracy: total ? Math.round((good / total) * 100) : null,
    sessions: state.sessions.length,
  };
}

/* ---------- listy ---------- */
export async function addList(name) {
  const id = be.newId(state.user.uid, 'lists');
  const data = { name: name.trim(), createdAt: Date.now() };
  state.lists = [...state.lists, { id, ...data }].sort(byName);
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
export async function addWord({ en, pl, listIds = [] }) {
  en = en.trim(); pl = pl.trim();
  const key = wordKey({ en, pl });
  const ex = state.words.find((w) => wordKey(w) === key);
  if (ex) {
    const missing = listIds.filter((id) => !(ex.listIds || []).includes(id));
    if (!missing.length) return { status: 'duplicate', word: ex };
    await be.update(state.user.uid, 'words', ex.id, { listIds: [...(ex.listIds || []), ...missing] });
    return { status: 'linked', word: ex };
  }
  const id = be.newId(state.user.uid, 'words');
  const data = { en, pl, listIds, box: 0, due: 0, correct: 0, wrong: 0, lastSeen: 0, createdAt: Date.now() };
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
 * Duplikaty (to samo en+pl) nie są dublowane; jeśli już istnieją, są tylko dopisywane do listy.
 * Zwraca { added, linked, duplicates, listId }.
 */
export async function importWords(rows, { listId = null, newListName = null } = {}) {
  const uid = state.user.uid;
  if (!listId && newListName) listId = await addList(newListName);

  const known = new Map(state.words.map((w) => [wordKey(w), { id: w.id, listIds: [...(w.listIds || [])], fresh: false, touched: false }]));
  const ops = [];
  let added = 0, linked = 0, duplicates = 0;
  const now = Date.now();

  for (const r of rows) {
    const en = r.en.trim(), pl = r.pl.trim();
    if (!en || !pl) continue;
    const key = wordKey({ en, pl });
    const ex = known.get(key);
    if (ex) {
      if (listId && !ex.listIds.includes(listId)) {
        ex.listIds.push(listId);
        ex.touched = true;
        if (!ex.fresh) linked++; else duplicates++;
      } else duplicates++;
      continue;
    }
    const id = be.newId(uid, 'words');
    const listIds = listId ? [listId] : [];
    ops.push({ type: 'set', coll: 'words', id, data: { en, pl, listIds, box: 0, due: 0, correct: 0, wrong: 0, lastSeen: 0, createdAt: now + added } });
    known.set(key, { id, listIds, fresh: true, touched: false });
    added++;
  }
  for (const [, v] of known) {
    if (!v.fresh && v.touched) ops.push({ type: 'update', coll: 'words', id: v.id, data: { listIds: v.listIds } });
  }
  if (ops.length) await be.batch(uid, ops);
  return { added, linked, duplicates, listId };
}

/* ---------- sesje ---------- */
/** Zapisuje sesję i aktualizuje statystyki powtórek słówek (kolejno, także gdy słówko padło kilka razy). */
export async function saveSession(session, results) {
  const uid = state.user.uid;
  const id = be.newId(uid, 'sessions');
  const ops = [{ type: 'set', coll: 'sessions', id, data: session }];
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
  emit();
  return be.set(state.user.uid, 'settings', 'prefs', state.prefs);
}
