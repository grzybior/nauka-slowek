// Punkt startowy: wybór backendu, ekran logowania, powłoka z nawigacją i router (hash).
import * as store from './store.js';
import { loadBackend } from './backend.js';
import { speak } from './speech.js';
import { openLangMenu } from './langmenu.js';
import { langInfo } from './languages.js';
import { esc } from './util.js';
import { icon, toast } from './ui.js';
import * as homeView from './views/home.js';
import * as quizView from './views/quiz.js';
import * as wordsView from './views/words.js';
import * as historyView from './views/history.js';
import * as profileView from './views/profile.js';
import * as authView from './views/auth.js';
import * as contactView from './views/contact.js';
import * as adminView from './views/admin.js';

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
  { re: /^\/contact$/, view: contactView, nav: 'profile' },
  { re: /^\/admin$/, view: adminView, nav: 'profile' },
];

let shown = '';      // co jest teraz na ekranie: splash | auth | error | shell
let current = null;  // instancja aktualnego widoku
let shownLang = '';  // język, dla którego narysowano widok

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
  root.innerHTML = `<div class="splash"><div class="brand big"><span class="brand-mark">🐦</span><span>Słowik</span></div><div class="spinner" role="status" aria-label="Ładowanie"></div></div>`;
}

function paintError(message) {
  root.innerHTML = `<div class="splash"><div class="card error-card">
    <div class="empty-emoji">⚠️</div><h2>Coś poszło nie tak</h2><p class="muted">${esc(message)}</p>
    <div class="row center"><button class="btn btn-primary" id="btnRetry">Spróbuj ponownie</button>
    ${store.state.user ? '<button class="btn btn-ghost" id="btnOut">Wyloguj</button>' : ''}</div></div></div>`;
  root.querySelector('#btnRetry').addEventListener('click', () => location.reload());
  root.querySelector('#btnOut')?.addEventListener('click', () => store.signOut());
}

const footer = (admin = false) => `<footer class="site-foot">Stworzone przez Grzegorz Ścibior${store.state.status === 'ready' ? ' · <a href="#/contact">Kontakt</a>' : ''}${admin ? ' · <a href="#/admin">Panel administratora</a>' : ''}</footer>`;

function paintVerify() {
  const u = store.state.user;
  root.innerHTML = `<div class="splash"><div class="card error-card">
    <div class="brand big"><span class="brand-mark">🐦</span><span>Słowik</span></div>
    <h2>Potwierdź swój e-mail</h2>
    <p class="muted">Wysłaliśmy link na adres <strong>${esc(u?.email || '')}</strong>. Kliknij go, a potem wróć tutaj. Sprawdź też folder ze spamem.</p>
    <div class="form-error" id="vMsg" role="status"></div>
    <div class="row center"><button class="btn btn-primary" id="vCheck">Już kliknąłem(am)</button>
    <button class="btn btn-ghost" id="vResend">Wyślij link ponownie</button>
    <button class="btn btn-ghost" id="vOut">Wyloguj</button></div>${footer()}</div></div>`;
  const msg = (m) => { root.querySelector('#vMsg').textContent = m; };
  const check = async (quiet) => {
    try { if (!(await store.recheckVerification()) && !quiet) msg('Jeszcze nie widzę potwierdzenia. Kliknij link w mailu i spróbuj ponownie.'); }
    catch (e) { if (!quiet) msg(e.message); }
  };
  root.querySelector('#vCheck').addEventListener('click', () => check(false));
  root.querySelector('#vResend').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { await store.resendVerification(); msg('Wysłano ponownie.'); } catch (ex) { msg(ex.message); }
    setTimeout(() => { e.target.disabled = false; }, 30000);
  });
  root.querySelector('#vOut').addEventListener('click', () => store.signOut());
  const onFocus = () => { if (shown === 'verify') check(true); };
  window.addEventListener('focus', onFocus);
  current = { destroy() { window.removeEventListener('focus', onFocus); } };
}

function paintBlocked(reason) {
  const closed = reason === 'closed';
  root.innerHTML = `<div class="splash"><div class="card error-card">
    <div class="empty-emoji">${closed ? '🚧' : '🔒'}</div><h2>${closed ? 'Rejestracja jest wyłączona' : 'Konto jest zablokowane'}</h2>
    <p class="muted">${closed ? 'Nowe konta nie są teraz przyjmowane. Spróbuj później.' : 'Dostęp do tego konta został zablokowany przez administratora.'}</p>
    <button class="btn btn-ghost" id="btnOut">Wyloguj</button>${footer()}</div></div>`;
  root.querySelector('#btnOut').addEventListener('click', () => store.signOut());
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
      <a class="brand" href="#/"><span class="brand-mark">🐦</span><span>Słowik</span></a>
      <nav class="nav" aria-label="Główna nawigacja">${NAV.slice(0, 3).map(link).join('')}</nav>
      <button type="button" class="lang-chip" id="langChip" aria-label="Zmień język nauki" title="Zmień język nauki"></button>
      <a class="avatar" href="#/profile" data-nav="profile" aria-label="Profil: ${esc(u.name || u.email)}" id="topAvatar">${esc(initialOf(u))}</a>
    </header>
    <main id="view" class="container" tabindex="-1"></main>
    ${footer(store.state.isAdmin)}
    <nav class="tabbar" aria-label="Nawigacja">${NAV.map(tab).join('')}</nav>
  </div>`;
  document.getElementById('langChip').addEventListener('click', openLangMenu);
  paintLangChip();
  shownLang = store.state.lang;
  route();
}

function paintLangChip() {
  const b = document.getElementById('langChip');
  if (!b) return;
  const L = langInfo(store.state.lang);
  b.innerHTML = `<span class="lang-badge">${L.short}</span><span class="lang-chip-name">${esc(L.name)}</span>`;
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
  const key = s.status === 'ready' ? 'shell' : s.status === 'out' ? 'auth' : s.status === 'error' ? 'error' : s.status === 'verify' ? 'verify' : s.status === 'blocked' ? 'blocked' : 'splash';
  if (key !== shown) {
    destroyView();
    // Po wylogowaniu wracamy na ekran startowy, żeby kolejne logowanie nie lądowało np. na profilu.
    if (key === 'auth' && shown === 'shell' && location.hash !== '#/') history.replaceState(null, '', '#/');
    shown = key;
    if (key === 'shell') paintShell();
    else if (key === 'auth') paintAuth();
    else if (key === 'error') paintError(s.error);
    else if (key === 'verify') paintVerify();
    else if (key === 'blocked') paintBlocked(s.blockReason);
    else paintSplash();
    return;
  }
  if (key === 'shell') {
    const av = document.getElementById('topAvatar');
    if (av) av.textContent = initialOf(s.user);
    paintLangChip();
    if (s.lang !== shownLang) { shownLang = s.lang; route(); return; } // zmiana języka = świeże widoki
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
  const lang = b.dataset.lang || store.state.lang;
  speak(text, { lang, accent: b.dataset.accent || store.accentFor(lang), slow: b.dataset.slow === '1' });
  b.classList.add('pulse');
  setTimeout(() => b.classList.remove('pulse'), 700);
});

window.addEventListener('hashchange', route);

store.onError((e) => {
  console.error(e);
  if (store.isQuotaError(e)) {
    toast('Wyczerpany został dzienny limit darmowej bazy danych. Zmiany zostaną zapisane na urządzeniu i zsynchronizują się po odnowieniu limitu (zwykle jutro).', 'error', 9000);
    return;
  }
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
