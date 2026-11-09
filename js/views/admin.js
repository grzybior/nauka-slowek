// Panel administratora: użytkownicy, blokady, wyłączenie rejestracji, czyszczenie nieaktywnych kont, wiadomości.
// Uwaga: bez serwera (plan darmowy) panel działa z przeglądarki administratora. Usuwa dane użytkownika i jego profil,
// a samo konto logowania usuwa się ręcznie w konsoli Firebase (Authentication → Users).
import { esc, fmtDate, plural } from '../util.js';
import { icon, toast, confirmDialog } from '../ui.js';
import { INACTIVE_DEFAULT_DAYS, WARN_DAYS } from '../limits.js';
import * as store from '../store.js';

const DAY = 86400000;
const COLLS = ['words', 'lists', 'sessions', 'settings'];

async function purgeUser(uid) {
  for (const c of COLLS) {
    for (let round = 0; round < 40; round++) {
      const docs = await store.gdb.list(`users/${uid}/${c}`, { limit: 400 });
      if (!docs.length) break;
      for (let i = 0; i < docs.length; i += 25) await Promise.all(docs.slice(i, i + 25).map((d) => store.gdb.del(`users/${uid}/${c}/${d.id}`)));
    }
  }
  await store.gdb.del('profiles/' + uid);
}

export function mount(el) {
  if (!store.state.isAdmin) {
    el.innerHTML = '<div class="card error-card"><h2>Brak dostępu</h2><p class="muted">Ta strona jest tylko dla administratora.</p></div>';
    return;
  }
  const me = store.state.user.uid;
  let cfg = { registrationOpen: true, purgeEnabled: false, inactiveDays: INACTIVE_DEFAULT_DAYS };
  let profiles = [], messages = [], destroyed = false;

  el.innerHTML = '<section class="page"><div class="page-head"><h1>Panel administratora</h1></div><div id="adm"><div class="spinner" role="status"></div></div></section>';
  const root = el.querySelector('#adm');

  const inactive = () => {
    const limit = Date.now() - cfg.inactiveDays * DAY;
    return profiles.filter((p) => p.id !== me && !p.blocked && (p.lastActive || p.createdAt || 0) < limit);
  };

  async function load() {
    try {
      const c = await store.gdb.get('config/app');
      cfg = { ...cfg, ...(c || {}) };
      [profiles, messages] = await Promise.all([store.gdb.list('profiles', { limit: 500 }), store.gdb.list('messages', { limit: 200 })]);
      messages.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      profiles.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
    } catch (e) {
      root.innerHTML = `<div class="card error-card"><h2>Nie udało się wczytać danych</h2><p class="muted">${esc(store.isQuotaError(e) ? 'Limit bazy wyczerpany, spróbuj jutro.' : e.message)}</p></div>`;
      return;
    }
    if (!destroyed) render();
  }

  const saveCfg = (patch) => { cfg = { ...cfg, ...patch }; return store.gdb.set('config/app', patch); };

  function render() {
    const old = inactive();
    const warned = old.filter((p) => p.warnedAt && Date.now() - p.warnedAt >= WARN_DAYS * DAY);
    const unread = messages.filter((m) => !m.read).length;
    root.innerHTML = `
    <div class="card">
      <h2>Ustawienia</h2>
      <label class="switch"><input type="checkbox" id="swReg" ${cfg.registrationOpen !== false ? 'checked' : ''}><span class="track"></span><span>Rejestracja nowych kont otwarta</span></label>
      <label class="switch"><input type="checkbox" id="swPurge" ${cfg.purgeEnabled ? 'checked' : ''}><span class="track"></span><span>Czyszczenie nieaktywnych kont włączone</span></label>
      <div class="field"><label for="inDays">Konto jest nieaktywne po (dniach bez logowania)</label>
        <input id="inDays" class="input narrow" type="number" min="30" max="3650" value="${cfg.inactiveDays}"></div>
      <p class="muted small">Gdy rejestracja jest zamknięta, nowe konta nie dostają dostępu do danych. Istniejący użytkownicy z profilem logują się normalnie.</p>
    </div>

    ${cfg.purgeEnabled ? `<div class="card">
      <h2>Nieaktywne konta (${old.length})</h2>
      <p class="muted">Bez logowania dłużej niż ${cfg.inactiveDays} ${plural(cfg.inactiveDays, 'dzień', 'dni', 'dni')}. Najpierw wyślij ostrzeżenie; dane można usunąć dopiero po ${WARN_DAYS} dniach od jego zapisania. Logowanie użytkownika anuluje ostrzeżenie.</p>
      <div class="row">
        <button class="btn btn-ghost" id="btnWarn" ${old.length ? '' : 'disabled'}>${icon('mail', 18)} Przygotuj ostrzeżenie (e-mail)</button>
        <button class="btn btn-danger" id="btnPurge" ${warned.length ? '' : 'disabled'}>${icon('trash', 18)} Usuń dane ostrzeżonych (${warned.length})</button>
      </div>
    </div>` : ''}

    <div class="card">
      <h2>Użytkownicy (${profiles.length})</h2>
      <div class="table-wrap"><table class="preview adm-table"><thead><tr><th>E-mail</th><th>Utworzono</th><th>Ostatnio</th><th>Status</th><th></th></tr></thead><tbody>
      ${profiles.map((p) => `<tr>
        <td>${esc(p.email || p.id)}${p.name ? `<br><span class="muted small">${esc(p.name)}</span>` : ''}</td>
        <td>${p.createdAt ? fmtDate(p.createdAt) : '—'}</td><td>${p.lastActive ? fmtDate(p.lastActive) : '—'}</td>
        <td>${p.id === me ? '<span class="tag">Ty</span>' : p.blocked ? '<span class="tag bad">Zablokowany</span>' : p.warnedAt ? '<span class="tag">Ostrzeżony</span>' : 'Aktywny'}</td>
        <td>${p.id === me ? '' : `<button class="btn btn-ghost btn-sm" data-block="${esc(p.id)}">${p.blocked ? 'Odblokuj' : 'Zablokuj'}</button>
          <button class="btn-icon danger" data-purge="${esc(p.id)}" aria-label="Usuń dane użytkownika" title="Usuń dane">${icon('trash', 18)}</button>`}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Brak użytkowników.</td></tr>'}
      </tbody></table></div>
    </div>

    <div class="card">
      <h2>Wiadomości (${messages.length}${unread ? `, nowe: ${unread}` : ''})</h2>
      ${messages.length ? messages.map((m) => `<div class="msg ${m.read ? '' : 'unread'}">
        <div class="msg-head"><strong>${esc(m.email || '')}</strong><span class="muted small">${fmtDate(m.createdAt)}</span></div>
        <p>${esc(m.text)}</p>
        <div class="row"><a class="btn btn-ghost btn-sm" href="mailto:${esc(m.email || '')}?subject=${encodeURIComponent('Słowik: odpowiedź')}">${icon('mail', 16)} Odpisz</a>
        ${m.read ? '' : `<button class="btn btn-ghost btn-sm" data-read="${esc(m.id)}">Oznacz jako przeczytane</button>`}
        <button class="btn-icon danger" data-delmsg="${esc(m.id)}" aria-label="Usuń wiadomość">${icon('trash', 18)}</button></div></div>`).join('') : '<p class="muted">Brak wiadomości.</p>'}
    </div>`;
  }

  root.addEventListener('change', async (e) => {
    try {
      if (e.target.id === 'swReg') await saveCfg({ registrationOpen: e.target.checked });
      else if (e.target.id === 'swPurge') { await saveCfg({ purgeEnabled: e.target.checked }); render(); }
      else if (e.target.id === 'inDays') {
        const d = Math.min(3650, Math.max(30, parseInt(e.target.value, 10) || INACTIVE_DEFAULT_DAYS));
        await saveCfg({ inactiveDays: d }); render();
      } else return;
      toast('Zapisano.', 'success');
    } catch (ex) { toast(ex.message, 'error'); }
  });

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    try {
      if (t.dataset.block) {
        const p = profiles.find((x) => x.id === t.dataset.block);
        await store.gdb.set('profiles/' + p.id, { blocked: !p.blocked });
        p.blocked = !p.blocked; render();
      } else if (t.dataset.purge) {
        const p = profiles.find((x) => x.id === t.dataset.purge);
        if (!await confirmDialog({ title: 'Usunąć dane użytkownika?', text: `Wszystkie słówka, listy i historia konta ${p.email} zostaną nieodwracalnie usunięte. Samo konto logowania usuń potem w konsoli Firebase.`, confirmLabel: 'Usuń', danger: true })) return;
        t.disabled = true;
        await purgeUser(p.id);
        profiles = profiles.filter((x) => x.id !== p.id); render();
        toast('Dane usunięte.', 'success');
      } else if (t.id === 'btnWarn') {
        const list = inactive();
        const body = `Cześć,\n\nTwoje konto w aplikacji Słowik jest nieaktywne od ponad ${cfg.inactiveDays} dni. Za ${WARN_DAYS} dni dane (słówka i historia) zostaną usunięte. Aby je zachować, wystarczy się zalogować.\n\nPozdrawiam`;
        const bcc = list.map((p) => p.email).filter(Boolean).join(',');
        await Promise.all(list.map((p) => store.gdb.set('profiles/' + p.id, { warnedAt: Date.now() })));
        list.forEach((p) => { p.warnedAt = Date.now(); });
        render();
        const url = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent('Słowik: konto zostanie usunięte za tydzień')}&body=${encodeURIComponent(body)}`;
        if (url.length > 1800) {
          try { await navigator.clipboard.writeText(bcc); } catch { /* ignore */ }
          toast('Zbyt wiele adresów na jeden link. Skopiowałem je do schowka, wklej w polu UDW swojej poczty.', 'info', 7000);
        } else location.href = url;
      } else if (t.id === 'btnPurge') {
        const list = inactive().filter((p) => p.warnedAt && Date.now() - p.warnedAt >= WARN_DAYS * DAY);
        if (!await confirmDialog({ title: 'Usunąć dane nieaktywnych?', text: `Dane ${list.length} ${plural(list.length, 'konta', 'kont', 'kont')} zostaną nieodwracalnie usunięte.`, confirmLabel: 'Usuń', danger: true })) return;
        t.disabled = true;
        for (const p of list) await purgeUser(p.id);
        profiles = profiles.filter((x) => !list.some((l) => l.id === x.id)); render();
        toast('Dane usunięte.', 'success');
      } else if (t.dataset.read) {
        await store.gdb.set('messages/' + t.dataset.read, { read: true });
        messages.find((m) => m.id === t.dataset.read).read = true; render();
      } else if (t.dataset.delmsg) {
        await store.gdb.del('messages/' + t.dataset.delmsg);
        messages = messages.filter((m) => m.id !== t.dataset.delmsg); render();
      }
    } catch (ex) { toast(ex.message || String(ex), 'error'); }
  });

  load();
  return { destroy() { destroyed = true; } };
}
