// Panel użytkownika: dane konta, zmiana hasła, ustawienia nauki, eksport, wylogowanie.
import { esc, downloadFile } from '../util.js';
import { icon, seg, bindSegs, toast, confirmDialog } from '../ui.js';
import { toCSV } from '../csv.js';
import { canSpeak } from '../speech.js';
import * as store from '../store.js';

export function mount(el) {
  const s = store.state;
  const u = s.user;
  const p = s.prefs;
  const display = u.name || u.email.split('@')[0];

  el.innerHTML = `
  <section class="page">
    <div class="page-head"><h1>Profil</h1></div>
    <div class="grid-2">
      <div class="card">
        <div class="profile-id">
          <div class="avatar xl" aria-hidden="true">${esc(display.charAt(0).toUpperCase())}</div>
          <div><div class="profile-name" id="pName">${esc(display)}</div><div class="muted">${esc(u.email)}</div></div>
        </div>
        <form id="nameForm" class="field">
          <label for="fName">Imię wyświetlane</label>
          <div class="row">
            <input id="fName" class="input" type="text" maxlength="40" value="${esc(u.name || '')}" placeholder="np. Zosia">
            <button class="btn btn-primary" type="submit">Zapisz</button>
          </div>
        </form>
      </div>

      <div class="card">
        <h2>${icon('lock', 20)} Zmiana hasła</h2>
        <form id="passForm" novalidate>
          <div class="field"><label for="pCur">Obecne hasło</label><input id="pCur" class="input" type="password" autocomplete="current-password"></div>
          <div class="field"><label for="pNew">Nowe hasło</label><input id="pNew" class="input" type="password" autocomplete="new-password" placeholder="Minimum 6 znaków"></div>
          <div class="field"><label for="pRep">Powtórz nowe hasło</label><input id="pRep" class="input" type="password" autocomplete="new-password"></div>
          <div class="form-error" id="passErr" role="alert"></div>
          <button class="btn btn-primary" type="submit">Zmień hasło</button>
        </form>
      </div>

      <div class="card">
        <h2>${icon('sparkles', 20)} Ustawienia nauki</h2>
        <div class="field"><label>Motyw</label>${seg('theme', [['auto', 'Auto'], ['light', 'Jasny'], ['dark', 'Ciemny']], p.theme)}</div>
        ${canSpeak ? `<div class="field"><label>Akcent wymowy</label>
          <div class="row">${seg('accent', [['us', 'Amerykański'], ['gb', 'Brytyjski']], p.accent)}
          <button type="button" class="btn btn-ghost btn-sm" data-say="Hello, nice to meet you." data-test>${icon('volume', 16)} Posłuchaj</button></div></div>` : ''}
        <label class="switch"><input type="checkbox" id="swSpeak" ${p.autoSpeak ? 'checked' : ''} ${canSpeak ? '' : 'disabled'}><span class="track"></span><span>Odtwarzaj wymowę automatycznie w quizie</span></label>
        <label class="switch"><input type="checkbox" id="swSound" ${p.sounds ? 'checked' : ''}><span class="track"></span><span>Dźwięki poprawnej i błędnej odpowiedzi</span></label>
        <label class="switch"><input type="checkbox" id="swStrict" ${p.strict ? 'checked' : ''}><span class="track"></span><span>Wymagaj polskich znaków w pisowni (ą, ę, ł…)</span></label>
        <div class="field"><label for="pDelay">Przerwa po odpowiedzi (sekundy, 0 = przechodzę ręcznie)</label>
          <input id="pDelay" class="input narrow" type="number" min="0" max="10" step="0.5" value="${p.delay}"></div>
      </div>

      <div class="card">
        <h2>${icon('download', 20)} Twoje dane</h2>
        <p class="muted">Pobierz wszystkie swoje słówka jako plik CSV. Możesz go później zaimportować z powrotem.</p>
        <div class="row">
          <button class="btn btn-ghost" id="btnExport">${icon('download', 18)} Pobierz słówka (CSV)</button>
          <button class="btn btn-danger-ghost" id="btnOut">${icon('logout', 18)} Wyloguj się</button>
        </div>
      </div>
    </div>
  </section>`;

  const $ = (q) => el.querySelector(q);

  $('#nameForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await store.updateName($('#fName').value.trim());
      toast('Zapisano imię.', 'success');
      const n = store.state.user.name || store.state.user.email.split('@')[0];
      $('#pName').textContent = n;
      el.querySelector('.avatar').textContent = n.charAt(0).toUpperCase();
    } catch (ex) { toast(ex.message, 'error'); }
  });

  $('#passForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cur = $('#pCur').value, next = $('#pNew').value, rep = $('#pRep').value;
    const err = (m) => { $('#passErr').textContent = m; };
    if (!cur) return err('Podaj obecne hasło.');
    if (next.length < 6) return err('Nowe hasło musi mieć co najmniej 6 znaków.');
    if (next !== rep) return err('Nowe hasła nie są takie same.');
    if (next === cur) return err('Nowe hasło musi różnić się od obecnego.');
    err('');
    const btn = e.submitter || $('#passForm button');
    btn.disabled = true;
    try {
      await store.changePassword(cur, next);
      e.target.reset();
      toast('Hasło zostało zmienione.', 'success');
    } catch (ex) { err(ex.message); } finally { btn.disabled = false; }
  });

  bindSegs(el, (name, v) => store.savePrefs({ [name]: v }));
  $('#swSpeak').addEventListener('change', (e) => store.savePrefs({ autoSpeak: e.target.checked }));
  $('#swSound').addEventListener('change', (e) => store.savePrefs({ sounds: e.target.checked }));
  $('#swStrict').addEventListener('change', (e) => store.savePrefs({ strict: e.target.checked }));
  $('#pDelay').addEventListener('change', (e) => {
    const v = Math.min(10, Math.max(0, parseFloat(e.target.value)));
    const val = Number.isFinite(v) ? v : 1.2;
    e.target.value = val;
    store.savePrefs({ delay: val });
  });

  $('#btnExport').addEventListener('click', () => {
    if (!store.state.words.length) return toast('Nie masz jeszcze żadnych słówek.', 'info');
    downloadFile('moje-slowka.csv', toCSV(store.state.words), 'text/csv');
  });
  $('#btnOut').addEventListener('click', async () => {
    if (await confirmDialog({ title: 'Wylogować się?', text: 'Twoje dane zostają na koncie i będą czekać po ponownym zalogowaniu.', confirmLabel: 'Wyloguj' })) store.signOut();
  });

  return { destroy() {} };
}
