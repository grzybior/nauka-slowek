// Punkt startowy: wybór backendu, ekran logowania, powłoka z nawigacją i router (hash).
import * as store from './store.js';
import { loadBackend } from './backend.js';
import { speak } from './speech.js';
import { esc } from './util.js';
import { icon, toast } from './ui.js';
import * as homeView from './views/home.js';
import * as quizView from './views/quiz.js';
import * as wordsView from './views/words.js';
import * as historyView from './views/history.js';
import * as profileView from './views/profile.js';
import * as authView from './views/auth.js';

const root = document.getElementById('app');

const NAV = [
  ['home', 'Start', 'home', '#/'],
  ['words', 'Słówka', 'book', '#/words'],
  ['history', 'Historia', 'history', '#/history'],
  ['profile', 'Profil', 'user', '#/profile'],
];

const ROUTES = [
  { re: /^\/?$/, view: homeView, nav: 'home' },
  { re: /^\/quiz$/, view: quizView, nav: 'home', focus: true },
  { re: /^\/words$/, view: wordsView, nav: 'words' },
  { re: /^\/history(?:\/([^/]+))?$/, view: historyView, nav: 'history' },
  { re: /^\/profile$/, view: profileView, nav: 'profile' },
];

let shown = '';      // co jest teraz na ekranie: splash | auth | error | shell
let current = null;  // instancja aktualnego widoku

/* ---------- motyw ---------- */
function applyTheme(t) {
  const h = document.documentElement;
  if (t === 'light' || t === 'dark') h.dataset.theme = t;
  else delete h.dataset.theme;
  try { localStorage.setItem('ns_theme', t); } catch { /* ignore */ }
}

/* ---------- ekrany ---------- */
function destroyView() {
  try { current?.destroy?.(); } catch (e) { console.error(e); }
  current = null;
}

function paintSplash() {
  root.innerHTML = `<div class="splash"><div class="brand big"><span class="brand-mark">🧠</span><span>Nauka słówek</span></div><div class="spinner" role="status" aria-label="Ładowanie"></div></div>`;
}

function paintError(message) {
  root.innerHTML = `<div class="splash"><div class="card error-card">
    <div class="empty-emoji">⚠️</div><h2>Coś poszło nie tak</h2><p class="muted">${esc(message)}</p>
    <div class="row center"><button class="btn btn-primary" id="btnRetry">Spróbuj ponownie</button>
    ${store.state.user ? '<button class="btn btn-ghost" id="btnOut">Wyloguj</button>' : ''}</div></div></div>`;
  root.querySelector('#btnRetry').addEventListener('click', () => location.reload());
  root.querySelector('#btnOut')?.addEventListener('click', () => store.signOut());
}

function paintAuth() {
  root.innerHTML = '<div id="authRoot"></div>';
  current = authView.mount(root.querySelector('#authRoot'));
}

const initialOf = (u) => (u.name || u.email || '?').charAt(0).toUpperCase();

function paintShell() {
  const u = store.state.user;
  const link = ([key, label, , href]) => `<a href="${href}" data-nav="${key}">${label}</a>`;
  const tab = ([key, label, ic, href]) => `<a href="${href}" data-nav="${key}">${icon(ic, 22)}<span>${label}</span></a>`;
  root.innerHTML = `
  <div class="shell" id="shell">
    <header class="topbar">
      <a class="brand" href="#/"><span class="brand-mark">🧠</span><span>Nauka słówek</span></a>
      <nav class="nav" aria-label="Główna nawigacja">${NAV.slice(0, 3).map(link).join('')}</nav>
      <a class="avatar" href="#/profile" data-nav="profile" aria-label="Profil: ${esc(u.name || u.email)}" id="topAvatar">${esc(initialOf(u))}</a>
    </header>
    <main id="view" class="container" tabindex="-1"></main>
    <nav class="tabbar" aria-label="Nawigacja">${NAV.map(tab).join('')}</nav>
  </div>`;
  route();
}

function route() {
  if (shown !== 'shell') return;
  const path = (location.hash.replace(/^#/, '') || '/').split('?')[0];
  let match = null;
  const r = ROUTES.find((x) => (match = path.match(x.re)));
  if (!r) { location.hash = '#/'; return; }

  destroyView();
  const shell = document.getElementById('shell');
  const view = document.getElementById('view');
  view.innerHTML = '';
  shell.classList.toggle('focus', Boolean(r.focus));
  if (r.focus) document.getElementById('toasts')?.replaceChildren(); // quiz bez zalegających powiadomień
  shell.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === r.nav;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  try {
    current = r.view.mount(view, { params: { id: match[1] ? decodeURIComponent(match[1]) : null } }) || null;
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card error-card"><h2>Nie udało się wyświetlić widoku</h2><p class="muted">${esc(e.message)}</p></div>`;
  }
  window.scrollTo(0, 0);
}

/* ---------- reakcja na zmiany stanu ---------- */
function onState(s) {
  applyTheme(s.prefs.theme);
  const key = s.status === 'ready' ? 'shell' : s.status === 'out' ? 'auth' : s.status === 'error' ? 'error' : 'splash';
  if (key !== shown) {
    destroyView();
    // Po wylogowaniu wracamy na ekran startowy, żeby kolejne logowanie nie lądowało np. na profilu.
    if (key === 'auth' && shown === 'shell' && location.hash !== '#/') history.replaceState(null, '', '#/');
    shown = key;
    if (key === 'shell') paintShell();
    else if (key === 'auth') paintAuth();
    else if (key === 'error') paintError(s.error);
    else paintSplash();
    return;
  }
  if (key === 'shell') {
    const av = document.getElementById('topAvatar');
    if (av) av.textContent = initialOf(s.user);
    try { current?.update?.(); } catch (e) { console.error(e); }
  }
}

/* ---------- globalne zdarzenia ---------- */
// Przyciski wymowy ([data-say]) działają w każdym widoku.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-say]');
  if (!b || b.disabled) return;
  e.preventDefault();
  const text = b.dataset.say;
  if (!text) return;
  speak(text, { accent: store.state.prefs.accent, slow: b.dataset.slow === '1' });
  b.classList.add('pulse');
  setTimeout(() => b.classList.remove('pulse'), 700);
});

window.addEventListener('hashchange', route);

store.onError((e) => {
  console.error(e);
  const denied = e?.code === 'permission-denied';
  toast(denied ? 'Brak uprawnień do zapisu. Sprawdź reguły Firestore (README).' : 'Nie udało się zapisać zmian: ' + (e?.message || e), 'error', 6000);
});
store.subscribe(onState);

/* ---------- start ---------- */
(async function boot() {
  shown = 'splash';
  paintSplash();
  try {
    store.init(await loadBackend());
  } catch (e) {
    console.error(e);
    shown = 'error';
    paintError('Nie udało się uruchomić aplikacji (sprawdź połączenie z internetem i konfigurację Firebase). ' + (e?.message || ''));
  }
})();
