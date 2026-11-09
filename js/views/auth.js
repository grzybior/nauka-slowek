// Ekran logowania / rejestracji / resetu hasła.
import { esc } from '../util.js';
import { icon, seg, bindSegs, toast } from '../ui.js';
import * as store from '../store.js';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function mount(el) {
  let mode = 'login';
  const demo = store.state.backendMode === 'local';

  el.innerHTML = `
  <div class="auth">
    <div class="auth-hero">
      <div class="brand big"><span class="brand-mark">🐦</span><span>Słowik</span></div>
      <h1>Ucz się języków <em>mądrzej</em>.</h1>
      <p class="lead">Angielski, hiszpański, niemiecki, francuski, włoski i szwedzki w jednej aplikacji: własna baza słówek, wymowa w każdym języku, podpowiedzi tłumaczeń i automatyczne powtórki dokładnie wtedy, gdy ich potrzebujesz.</p>
      <ul class="points">
        <li>${icon('volume', 18)}<span>Posłuchaj poprawnej wymowy każdego słówka</span></li>
        <li>${icon('repeat', 18)}<span>Powtórki rozłożone w czasie, bez zgadywania co powtarzać</span></li>
        <li>${icon('history', 18)}<span>Historia sesji z listą popełnionych błędów</span></li>
      </ul>
    </div>
    <div class="card auth-card">
      ${demo ? `<div class="notice warn"><strong>Tryb demo.</strong> Konta i dane są zapisywane tylko w tej przeglądarce. Aby mieć je na każdym urządzeniu, skonfiguruj Firebase (README).</div>` : ''}
      ${seg('authMode', [['login', 'Logowanie'], ['register', 'Rejestracja']], mode)}
      <form id="authForm" novalidate>
        <div class="field" id="nameField" hidden>
          <label for="aName">Imię (opcjonalnie)</label>
          <input id="aName" class="input" type="text" autocomplete="given-name" maxlength="40" placeholder="np. Zosia">
        </div>
        <div class="field">
          <label for="aEmail">E-mail</label>
          <input id="aEmail" class="input" type="email" autocomplete="email" inputmode="email" placeholder="ty@example.com" required>
        </div>
        <div class="field">
          <label for="aPass">Hasło</label>
          <div class="input-wrap">
            <input id="aPass" class="input" type="password" autocomplete="current-password" placeholder="Minimum 6 znaków" required>
            <button type="button" class="btn-icon in-input" id="togglePass" aria-label="Pokaż hasło">${icon('eye', 18)}</button>
          </div>
        </div>
        <div class="form-error" id="authErr" role="alert"></div>
        <button class="btn btn-primary btn-lg btn-block" id="authSubmit" type="submit">Zaloguj się</button>
        <button type="button" class="link" id="forgot">Nie pamiętam hasła</button>
      </form>
    </div>
  </div>`;

  const $ = (s) => el.querySelector(s);
  const err = (m) => { $('#authErr').textContent = m || ''; };

  function syncMode() {
    const reg = mode === 'register';
    $('#nameField').hidden = !reg;
    $('#authSubmit').textContent = reg ? 'Utwórz konto' : 'Zaloguj się';
    $('#aPass').autocomplete = reg ? 'new-password' : 'current-password';
    $('#forgot').hidden = reg;
    err('');
  }
  bindSegs(el, (_, v) => { mode = v; syncMode(); });
  syncMode();

  // Rejestracja może być wyłączona przez administratora (ustawienie publiczne).
  store.publicConfig().then((cfg) => {
    if (cfg.registrationOpen !== false || !el.isConnected) return;
    const reg = el.querySelector('[data-seg="authMode"] [data-v="register"]');
    if (reg) reg.hidden = true;
    mode = 'login'; syncMode();
    $('.auth-card').insertAdjacentHTML('afterbegin', '<div class="notice warn">Rejestracja nowych kont jest chwilowo wyłączona.</div>');
  });

  $('#togglePass').addEventListener('click', () => {
    const p = $('#aPass');
    const show = p.type === 'password';
    p.type = show ? 'text' : 'password';
    $('#togglePass').innerHTML = icon(show ? 'eyeoff' : 'eye', 18);
    $('#togglePass').setAttribute('aria-label', show ? 'Ukryj hasło' : 'Pokaż hasło');
  });

  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#aEmail').value.trim();
    const pass = $('#aPass').value;
    if (!EMAIL_RE.test(email)) return err('Podaj poprawny adres e-mail.');
    if (!pass) return err('Podaj hasło.');
    if (mode === 'register' && pass.length < 6) return err('Hasło musi mieć co najmniej 6 znaków.');
    err('');
    const btn = $('#authSubmit');
    btn.disabled = true;
    btn.classList.add('loading');
    try {
      if (mode === 'register') await store.signUp(email, pass, $('#aName').value.trim());
      else await store.signIn(email, pass);
    } catch (ex) {
      err(ex.message);
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  });

  $('#forgot').addEventListener('click', async () => {
    const email = $('#aEmail').value.trim();
    if (!EMAIL_RE.test(email)) return err('Wpisz swój e-mail powyżej, a wyślemy link do zmiany hasła.');
    err('');
    try {
      await store.resetPassword(email);
      toast('Wysłaliśmy link do zmiany hasła. Sprawdź skrzynkę (także spam).', 'success', 6000);
    } catch (ex) { err(ex.message); }
  });

  el.querySelector('.auth').insertAdjacentHTML('beforeend', '<footer class="site-foot">Stworzone przez Grzegorz Ścibior</footer>');
  return { destroy() {} };
}
