// Formularz kontaktowy: wiadomość trafia do panelu administratora (Firestore), bez zewnętrznych usług.
import { icon, toast } from '../ui.js';
import { esc } from '../util.js';
import { MAX_MESSAGE } from '../limits.js';
import * as store from '../store.js';

export function mount(el) {
  const u = store.state.user;
  el.innerHTML = `
  <section class="page narrow-page">
    <div class="page-head"><h1>Kontakt</h1></div>
    <form class="card" id="cForm">
      <p class="muted">Pomysł, błąd albo pytanie? Napisz do autora. Odpowiedź wyślemy na podany adres e-mail.</p>
      <div class="field"><label for="cMail">Twój e-mail</label><input id="cMail" class="input" type="email" value="${esc(u.email)}" required></div>
      <div class="field"><label for="cText">Wiadomość</label><textarea id="cText" class="input" rows="6" maxlength="${MAX_MESSAGE}" required></textarea></div>
      <div class="form-error" id="cErr" role="alert"></div>
      <button class="btn btn-primary" type="submit">${icon('mail', 18)} Wyślij</button>
    </form>
  </section>`;
  const $ = (q) => el.querySelector(q);
  $('#cForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#cForm button[type=submit]');
    btn.disabled = true;
    try {
      await store.sendContact($('#cText').value, $('#cMail').value.trim());
      $('#cText').value = '';
      $('#cErr').textContent = '';
      toast('Dziękuję! Wiadomość została wysłana.', 'success');
    } catch (ex) {
      $('#cErr').textContent = store.isQuotaError(ex) ? 'Wysyłanie chwilowo niedostępne (limit bazy). Spróbuj jutro.' : ex.message;
    } finally { btn.disabled = false; }
  });
}
