// Baza słówek: listy, dodawanie (z podpowiedzią tłumaczenia), edycja, import i eksport CSV.
import { esc, plural, normalize, downloadFile } from '../util.js';
import { icon, speakBtn, toast, openModal, confirmDialog, promptDialog } from '../ui.js';
import { parseWords, toCSV } from '../csv.js';
import { canSpeak } from '../speech.js';
import { isHard } from '../quiz.js';
import { setPreselect } from '../launch.js';
import * as store from '../store.js';
import { attachSuggest } from './shared.js';
import { langInfo } from '../languages.js';
import { packsFor } from '../starter.js';
import { MAX_FILE_BYTES, MAX_IMPORT_ROWS } from '../limits.js';

const PAGE = 100;
const MAX_WORDS_TXT = '10 000';
const wkey = (w) => normalize(w.term) + '|' + normalize(w.pl);
const slug = (s) => normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'slowka';

async function readText(file) {
  const buf = await file.arrayBuffer();
  let t = new TextDecoder('utf-8').decode(buf);
  // CSV z Excela bywa w windows-1250: wtedy polskie znaki wychodzą jako U+FFFD.
  if (t.includes('�')) t = new TextDecoder('windows-1250').decode(buf);
  return t;
}

function uniqueListName(base) {
  let name = base || 'Import';
  let i = 2;
  while (store.listNameTaken(name)) name = `${base} (${i++})`;
  return name;
}

export function mount(el) {
  const LANG = store.state.lang, L = langInfo(LANG);
  const v = { listId: 'all', q: '', sort: 'new', selecting: false, selected: new Set(), limit: PAGE, addList: '' };
  let listsKey = '';

  el.innerHTML = `
  <section class="page words">
    <div class="page-head">
      <h1>Moje słówka</h1>
      <div class="row tight">
        <button type="button" class="btn btn-ghost" id="btnPacks">${icon('sparkles', 18)} <span>Gotowe zestawy</span></button>
        <button type="button" class="btn btn-ghost" id="btnImport">${icon('upload', 18)} <span>Importuj CSV</span></button>
        <button type="button" class="btn btn-ghost" id="btnExport">${icon('download', 18)} <span>Eksport</span></button>
        <input type="file" id="fileCsv" accept=".csv,.txt,text/csv,text/plain" hidden>
      </div>
    </div>

    <div class="chips-scroll" id="tabs" role="tablist" aria-label="Listy słówek"></div>
    <div class="list-bar" id="listBar"></div>

    <form class="card add" id="addForm" autocomplete="off">
      <h2>Dodaj słówko</h2>
      <div class="add-grid">
        <div class="field"><label for="aEn">${esc(L.name)}</label>
          <div class="input-wrap"><input id="aEn" class="input" type="text" lang="${LANG}" autocapitalize="off" spellcheck="false" placeholder="np. ${esc(L.example[0])}">
          ${canSpeak ? `<button type="button" class="btn-icon in-input speak" id="aSpeak" data-say="" disabled aria-label="Posłuchaj wymowy">${icon('volume', 18)}</button>` : ''}</div></div>
        <div class="field"><label for="aPl">Polski</label>
          <input id="aPl" class="input" type="text" lang="pl" placeholder="np. ${esc(L.example[1])}"></div>
      </div>
      <div class="sugg" id="aSugg" aria-live="polite"></div>
      <div class="add-foot">
        <label class="inline"><span class="muted">Do listy:</span> <select id="aList" class="select"></select></label>
        <button class="btn btn-primary" type="submit">${icon('plus', 18)} Dodaj</button>
      </div>
    </form>

    <div class="toolbar">
      <div class="input-wrap search"><span class="in-icon">${icon('search', 18)}</span>
        <input id="fSearch" class="input" type="search" placeholder="Szukaj słówka…" aria-label="Szukaj słówka"></div>
      <select id="fSort" class="select" aria-label="Sortowanie">
        <option value="new">Najnowsze</option><option value="az">A–Z</option><option value="hard">Najtrudniejsze</option>
      </select>
      <button type="button" class="btn btn-ghost btn-sm" id="btnSelect">Zaznacz</button>
    </div>
    <div class="bulk" id="bulk" hidden></div>
    <div class="muted small count-line" id="countLine"></div>
    <ul class="word-list" id="wordList"></ul>
    <div id="more"></div>
    <div class="drop-overlay" id="drop" hidden>${icon('upload', 36)}<span>Upuść plik CSV, aby zaimportować</span></div>
  </section>`;

  const $ = (s) => el.querySelector(s);
  const aEn = $('#aEn'), aPl = $('#aPl'), aList = $('#aList');
  const sugg = attachSuggest(aEn, aPl, $('#aSugg'), LANG);

  /* ---------- widok listy ---------- */
  function ensureListValid() {
    if (!store.VIRTUAL_LISTS.some((l) => l.id === v.listId) && !store.isRealList(v.listId)) v.listId = 'all';
    if (v.addList && !store.isRealList(v.addList)) v.addList = '';
  }

  function visible() {
    let w = store.poolFor(v.listId).slice();
    const q = normalize(v.q);
    if (q) w = w.filter((x) => normalize(x.term).includes(q) || normalize(x.pl).includes(q));
    if (v.sort === 'az') w.sort((a, b) => a.term.localeCompare(b.term, LANG, { sensitivity: 'base' }));
    else if (v.sort === 'hard') w.sort((a, b) => (b.wrong || 0) - (a.wrong || 0) || (a.box || 0) - (b.box || 0));
    else w.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return w;
  }

  function renderTabs() {
    const lists = [...store.VIRTUAL_LISTS, ...store.state.lists];
    $('#tabs').innerHTML = lists
      .map((l) => `<button type="button" role="tab" aria-selected="${l.id === v.listId}" class="chip tab${l.id === v.listId ? ' active' : ''}" data-id="${esc(l.id)}">${esc(l.name)} <span class="count">${store.poolFor(l.id).length}</span></button>`)
      .join('') + `<button type="button" class="chip tab ghost" data-new>${icon('plus', 14)} Nowa lista</button>`;
  }

  function renderListBar() {
    const bar = $('#listBar');
    if (v.listId === 'all') { bar.innerHTML = ''; return; }
    const real = store.isRealList(v.listId);
    bar.innerHTML = `
      <span class="muted">Lista <strong>${esc(store.listLabel(v.listId))}</strong></span>
      <button type="button" class="btn btn-ghost btn-sm" data-act="practice">${icon('play', 16)} Ćwicz</button>
      ${real ? `<button type="button" class="btn btn-ghost btn-sm" data-act="rename">${icon('edit', 16)} Zmień nazwę</button>
      <button type="button" class="btn btn-danger-ghost btn-sm" data-act="dellist">${icon('trash', 16)} Usuń listę</button>` : ''}`;
  }

  function renderAddLists() {
    const lists = store.state.lists;
    const key = lists.map((l) => l.id + l.name).join('|');
    if (key === listsKey && aList.options.length) return;
    listsKey = key;
    aList.innerHTML = `<option value="">Bez listy</option>${lists.map((l) => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}<option value="__new__">＋ Nowa lista…</option>`;
    aList.value = v.addList;
  }

  const pips = (w) => `<span class="pips" title="Opanowanie: ${w.box || 0}/5" aria-label="Opanowanie ${w.box || 0} z 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= (w.box || 0) ? 'on' : ''}"></i>`).join('')}</span>`;

  function wordItem(w) {
    const tags = (w.listIds || []).map((id) => store.state.lists.find((l) => l.id === id)).filter(Boolean);
    const sel = v.selected.has(w.id);
    return `<li class="word${sel ? ' selected' : ''}${isHard(w) ? ' hard' : ''}" data-id="${esc(w.id)}">
      ${v.selecting ? `<input type="checkbox" class="chk" data-sel aria-label="Zaznacz ${esc(w.term)}" ${sel ? 'checked' : ''}>` : ''}
      <div class="word-main">
        <div class="w-en"><span>${esc(w.term)}</span>${speakBtn(w.term)}</div>
        <div class="w-pl">${esc(w.pl)}</div>
        <div class="w-meta">${pips(w)}${(w.wrong || 0) ? `<span class="tag bad">${w.wrong} ${plural(w.wrong, 'błąd', 'błędy', 'błędów')}</span>` : ''}${tags.slice(0, 3).map((t) => `<span class="tag">${esc(t.name)}</span>`).join('')}${tags.length > 3 ? `<span class="tag">+${tags.length - 3}</span>` : ''}</div>
      </div>
      ${v.selecting ? '' : `<div class="word-actions">
        <button type="button" class="btn-icon" data-edit aria-label="Edytuj ${esc(w.term)}" title="Edytuj">${icon('edit', 18)}</button>
        <button type="button" class="btn-icon danger" data-del aria-label="Usuń ${esc(w.term)}" title="Usuń">${icon('trash', 18)}</button>
      </div>`}
    </li>`;
  }

  function renderList() {
    const all = visible();
    const shown = all.slice(0, v.limit);
    const total = store.state.words.length;
    $('#countLine').textContent = all.length ? `${all.length} ${plural(all.length, 'słówko', 'słówka', 'słówek')}` : '';
    $('#wordList').innerHTML = shown.length
      ? shown.map(wordItem).join('')
      : `<li class="empty">${!total ? 'Baza jest pusta. Dodaj pierwsze słówko powyżej albo zaimportuj plik CSV.' : v.q ? 'Nic nie znaleziono.' : 'Ta lista jest pusta.'}</li>`;
    $('#more').innerHTML = all.length > shown.length
      ? `<button type="button" class="btn btn-ghost btn-block" data-more>Pokaż więcej (${all.length - shown.length})</button>` : '';
  }

  function renderBulk() {
    const bar = $('#bulk');
    $('#btnSelect').textContent = v.selecting ? 'Gotowe' : 'Zaznacz';
    bar.hidden = !v.selecting;
    if (!v.selecting) return;
    const n = v.selected.size;
    bar.innerHTML = `
      <span><strong>${n}</strong> zaznaczonych</span>
      <button type="button" class="btn btn-ghost btn-sm" data-bulk="all">Zaznacz widoczne</button>
      <button type="button" class="btn btn-ghost btn-sm" data-bulk="toList" ${n ? '' : 'disabled'}>Dodaj do listy…</button>
      ${store.isRealList(v.listId) ? `<button type="button" class="btn btn-ghost btn-sm" data-bulk="fromList" ${n ? '' : 'disabled'}>Usuń z listy</button>` : ''}
      <button type="button" class="btn btn-danger-ghost btn-sm" data-bulk="delete" ${n ? '' : 'disabled'}>${icon('trash', 16)} Usuń</button>`;
  }

  function renderAll() {
    ensureListValid();
    renderTabs();
    renderListBar();
    renderAddLists();
    renderList();
    renderBulk();
  }

  /* ---------- listy ---------- */
  async function newList() {
    const name = await promptDialog({
      title: 'Nowa lista', label: 'Nazwa listy (np. „Ostatnie zajęcia”)', confirmLabel: 'Utwórz',
      validate: (n) => (store.listNameTaken(n) ? 'Lista o takiej nazwie już istnieje.' : ''),
    });
    return name ? store.addList(name) : null;
  }

  $('#tabs').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-new')) {
      const id = await newList();
      if (id) { v.listId = id; v.addList = id; v.limit = PAGE; v.selected.clear(); listsKey = ''; renderAll(); }
      return;
    }
    v.listId = b.dataset.id;
    v.limit = PAGE;
    v.selected.clear();
    if (store.isRealList(v.listId)) { v.addList = v.listId; aList.value = v.addList; }
    renderAll();
  });

  $('#listBar').addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'practice') {
      if (!store.poolFor(v.listId).length) return toast('Ta lista jest pusta.', 'info');
      setPreselect(v.listId);
      location.hash = '#/';
    } else if (act === 'rename') {
      const cur = store.listLabel(v.listId);
      const name = await promptDialog({
        title: 'Zmień nazwę listy', label: 'Nowa nazwa', value: cur,
        validate: (n) => (store.listNameTaken(n, v.listId) ? 'Lista o takiej nazwie już istnieje.' : ''),
      });
      if (name) store.renameList(v.listId, name);
    } else if (act === 'dellist') {
      const n = store.poolFor(v.listId).length;
      if (await confirmDialog({ title: 'Usunąć listę?', text: `Lista „${store.listLabel(v.listId)}” zostanie usunięta. Jej ${n} ${plural(n, 'słówko zostanie', 'słówka zostaną', 'słówek zostanie')} w bazie (w „Wszystkie słówka”).`, confirmLabel: 'Usuń listę', danger: true })) {
        const id = v.listId;
        v.listId = 'all';
        await store.deleteList(id);
        toast('Lista usunięta.', 'success');
      }
    }
  });

  /* ---------- dodawanie ---------- */
  aList.addEventListener('change', async () => {
    if (aList.value === '__new__') {
      const id = await newList();
      v.addList = id || v.addList;
      listsKey = '';
      renderAddLists();
      aList.value = v.addList;
    } else v.addList = aList.value;
  });

  const syncSpeak = () => {
    const b = $('#aSpeak');
    if (!b) return;
    b.dataset.say = aEn.value.trim();
    b.disabled = !aEn.value.trim();
  };
  aEn.addEventListener('input', syncSpeak);

  $('#addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const term = aEn.value.trim(), pl = aPl.value.trim();
    if (!term || !pl) {
      toast('Wpisz słówko i jego tłumaczenie.', 'error');
      (term ? aPl : aEn).focus();
      return;
    }
    const r = await store.addWord({ term, pl, listIds: v.addList ? [v.addList] : [] });
    if (r.status === 'added') toast(`Dodano: ${term} — ${pl}`, 'success');
    else if (r.status === 'limit') toast('Osiągnięto limit 10 000 słówek na konto.', 'error');
    else if (r.status === 'linked') toast('To słówko już było w bazie. Dodano je do wybranej listy.', 'info');
    else toast('Takie słówko już jest w bazie.', 'info');
    aEn.value = ''; aPl.value = '';
    sugg.clear();
    syncSpeak();
    aEn.focus();
  });

  /* ---------- lista słówek ---------- */
  function toggleSel(id, li) {
    if (v.selected.has(id)) v.selected.delete(id); else v.selected.add(id);
    const on = v.selected.has(id);
    li.classList.toggle('selected', on);
    const c = li.querySelector('.chk');
    if (c) c.checked = on;
    renderBulk();
  }

  $('#wordList').addEventListener('click', async (e) => {
    const li = e.target.closest('.word');
    if (!li || e.target.closest('[data-say]')) return;
    const id = li.dataset.id;
    if (e.target.closest('[data-edit]')) return editWord(id);
    if (e.target.closest('[data-del]')) {
      const w = store.state.words.find((x) => x.id === id);
      if (w && await confirmDialog({ title: 'Usunąć słówko?', text: `„${w.term} — ${w.pl}” zniknie z bazy i ze wszystkich list.`, confirmLabel: 'Usuń', danger: true })) {
        await store.deleteWords([id]);
        toast('Słówko usunięte.', 'success');
      }
      return;
    }
    if (v.selecting) {
      e.preventDefault();
      toggleSel(id, li);
    }
  });

  $('#more').addEventListener('click', (e) => {
    if (e.target.closest('[data-more]')) { v.limit += PAGE; renderList(); }
  });

  $('#fSearch').addEventListener('input', (e) => { v.q = e.target.value; v.limit = PAGE; renderList(); });
  $('#fSort').addEventListener('change', (e) => { v.sort = e.target.value; renderList(); });
  $('#btnSelect').addEventListener('click', () => {
    v.selecting = !v.selecting;
    v.selected.clear();
    renderList();
    renderBulk();
  });

  /* ---------- operacje zbiorcze ---------- */
  async function pickList() {
    return new Promise((resolve) => {
      let result = null;
      const lists = store.state.lists;
      openModal({
        title: 'Dodaj do listy',
        html: `<div class="field"><label for="pl-sel">Lista</label>
          <select id="pl-sel" class="select">${lists.map((l) => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}<option value="__new__">＋ Nowa lista…</option></select></div>
          <div class="field" id="pl-newf"><label for="pl-new">Nazwa nowej listy</label><input id="pl-new" class="input" maxlength="40"></div>
          <div class="form-error" role="alert"></div>`,
        onClose: () => resolve(result),
        onMount: (api) => {
          const sel = api.el.querySelector('#pl-sel'), nf = api.el.querySelector('#pl-newf');
          const sync = () => { nf.hidden = sel.value !== '__new__'; };
          sel.addEventListener('change', sync);
          sync();
        },
        actions: [
          { label: 'Anuluj', kind: 'ghost' },
          {
            label: 'Dodaj', kind: 'primary',
            onClick: async (api) => {
              const sel = api.el.querySelector('#pl-sel');
              const err = api.el.querySelector('.form-error');
              if (sel.value !== '__new__') { result = sel.value; return; }
              const name = api.el.querySelector('#pl-new').value.trim();
              if (!name) { err.textContent = 'Wpisz nazwę nowej listy.'; return false; }
              if (store.listNameTaken(name)) { err.textContent = 'Lista o takiej nazwie już istnieje.'; return false; }
              result = await store.addList(name);
            },
          },
        ],
      });
    });
  }

  $('#bulk').addEventListener('click', async (e) => {
    const act = e.target.closest('[data-bulk]')?.dataset.bulk;
    if (!act) return;
    const ids = [...v.selected];
    if (act === 'all') {
      visible().forEach((w) => v.selected.add(w.id));
      renderList();
      renderBulk();
    } else if (act === 'toList') {
      const id = await pickList();
      if (id) {
        await store.addToList(ids, id);
        toast(`Dodano ${ids.length} ${plural(ids.length, 'słówko', 'słówka', 'słówek')} do listy „${store.listLabel(id)}”.`, 'success');
        v.selected.clear();
        renderAll();
      }
    } else if (act === 'fromList') {
      await store.removeFromList(ids, v.listId);
      toast('Usunięto z listy (słówka zostają w bazie).', 'success');
      v.selected.clear();
    } else if (act === 'delete') {
      if (await confirmDialog({ title: 'Usunąć zaznaczone?', text: `${ids.length} ${plural(ids.length, 'słówko zostanie', 'słówka zostaną', 'słówek zostanie')} trwale usunięte z bazy.`, confirmLabel: 'Usuń', danger: true })) {
        await store.deleteWords(ids);
        toast('Usunięto.', 'success');
        v.selected.clear();
        renderAll();
      }
    }
  });

  /* ---------- edycja ---------- */
  function editWord(id) {
    const w = store.state.words.find((x) => x.id === id);
    if (!w) return;
    const lists = store.state.lists;
    openModal({
      title: 'Edytuj słówko',
      html: `<form data-form autocomplete="off">
        <div class="field"><label for="eEn">${esc(L.name)}</label>
          <div class="input-wrap"><input id="eEn" class="input" type="text" value="${esc(w.term)}" lang="${LANG}" spellcheck="false">${speakBtn(w.term)}</div></div>
        <div class="field"><label for="ePl">Polski</label><input id="ePl" class="input" type="text" value="${esc(w.pl)}" lang="pl"></div>
        <div class="sugg" id="eSugg"></div>
        ${lists.length ? `<div class="field"><label>Listy</label><div class="checks">${lists.map((l) => `<label class="check"><input type="checkbox" value="${esc(l.id)}" ${(w.listIds || []).includes(l.id) ? 'checked' : ''}><span>${esc(l.name)}</span></label>`).join('')}</div></div>` : ''}
        <div class="form-error" role="alert"></div></form>`,
      onMount: (api) => {
        attachSuggest(api.el.querySelector('#eEn'), api.el.querySelector('#ePl'), api.el.querySelector('#eSugg'), LANG);
        api.el.querySelector('form').addEventListener('submit', (ev) => { ev.preventDefault(); api.el.querySelector('.btn-primary').click(); });
      },
      actions: [
        { label: 'Anuluj', kind: 'ghost' },
        {
          label: 'Zapisz', kind: 'primary',
          onClick: async (api) => {
            const term = api.el.querySelector('#eEn').value.trim(), pl = api.el.querySelector('#ePl').value.trim();
            if (!term || !pl) { api.el.querySelector('.form-error').textContent = 'Oba pola są wymagane.'; return false; }
            const listIds = [...api.el.querySelectorAll('.checks input:checked')].map((c) => c.value);
            await store.updateWord(id, { term, pl, listIds });
            toast('Zapisano zmiany.', 'success');
          },
        },
      ],
    });
  }

  /* ---------- import / eksport CSV ---------- */
  async function handleFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return toast(`Plik jest za duży (limit ${Math.round(MAX_FILE_BYTES / 1000)} KB).`, 'error', 6000);
    let text;
    try { text = await readText(file); } catch { return toast('Nie udało się odczytać pliku.', 'error'); }
    let { words, skipped } = parseWords(text);
    if (words.length > MAX_IMPORT_ROWS) { skipped += words.length - MAX_IMPORT_ROWS; words = words.slice(0, MAX_IMPORT_ROWS); toast(`Wczytano tylko pierwsze ${MAX_IMPORT_ROWS} wierszy (limit jednego importu).`, 'info', 6000); }
    if (!words.length) return toast('Nie znaleziono słówek. Plik powinien mieć dwie kolumny: term,polish (słówko i tłumaczenie).', 'error', 6500);

    const known = new Set(store.state.words.map(wkey));
    const dupes = words.filter((w) => known.has(wkey(w))).length;
    const baseName = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
    const lists = store.state.lists;
    const preview = words.slice(0, 5);

    openModal({
      title: 'Import słówek', wide: true,
      html: `<p class="modal-text">Znaleziono <strong>${words.length}</strong> ${plural(words.length, 'słówko', 'słówka', 'słówek')} w pliku <em>${esc(file.name)}</em>.
          ${dupes ? `<br><span class="muted">${dupes} już masz w bazie. Nie zostaną zdublowane, najwyżej trafią do wybranej listy.</span>` : ''}
          ${skipped ? `<br><span class="muted">Pominięto ${skipped} ${plural(skipped, 'wiersz', 'wiersze', 'wierszy')} (puste lub niepełne).</span>` : ''}</p>
        <table class="preview"><thead><tr><th>${esc(L.name)}</th><th>Polski</th></tr></thead><tbody>${preview.map((w) => `<tr><td>${esc(w.term)}</td><td>${esc(w.pl)}</td></tr>`).join('')}</tbody></table>
        ${words.length > preview.length ? `<p class="muted small">…i ${words.length - preview.length} więcej</p>` : ''}
        <div class="field"><label for="im-sel">Dodaj do listy</label>
          <select id="im-sel" class="select"><option value="__new__">＋ Nowa lista</option>${lists.map((l) => `<option value="${esc(l.id)}" ${l.id === v.listId ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}<option value="">Bez listy (tylko do bazy)</option></select></div>
        <div class="field" id="im-newf"><label for="im-new">Nazwa nowej listy</label><input id="im-new" class="input" maxlength="40" value="${esc(uniqueListName(baseName))}"></div>
        <div class="form-error" role="alert"></div>`,
      onMount: (api) => {
        const sel = api.el.querySelector('#im-sel'), nf = api.el.querySelector('#im-newf');
        const sync = () => { nf.hidden = sel.value !== '__new__'; };
        sel.addEventListener('change', sync);
        sync();
      },
      actions: [
        { label: 'Anuluj', kind: 'ghost' },
        {
          label: `Importuj ${words.length}`, kind: 'primary',
          onClick: async (api) => {
            const sel = api.el.querySelector('#im-sel').value;
            let opts = { listId: sel && sel !== '__new__' ? sel : null };
            if (sel === '__new__') {
              const name = api.el.querySelector('#im-new').value.trim();
              if (!name) { api.el.querySelector('.form-error').textContent = 'Wpisz nazwę nowej listy.'; return false; }
              if (store.listNameTaken(name)) { api.el.querySelector('.form-error').textContent = 'Lista o takiej nazwie już istnieje.'; return false; }
              opts = { newListName: name };
            }
            const r = await store.importWords(words, opts);
            if (r.listId) { v.listId = r.listId; v.addList = r.listId; }
            listsKey = '';
            renderAll();
            toast(`Dodano ${r.added} ${plural(r.added, 'nowe słówko', 'nowe słówka', 'nowych słówek')}${r.linked ? `, ${r.linked} dopisano do listy` : ''}${r.duplicates ? `, ${r.duplicates} pominięto jako duplikaty` : ''}${r.capped ? `. Limit bazy to ${MAX_WORDS_TXT} słówek, ${r.capped} pominięto` : ''}.`, 'success', 5000);
          },
        },
      ],
    });
  }

  $('#btnImport').addEventListener('click', () => $('#fileCsv').click());
  $('#fileCsv').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    handleFile(f);
  });
  $('#btnPacks').addEventListener('click', () => {
    const packs = packsFor(LANG);
    openModal({
      title: `Gotowe zestawy: ${L.name}`,
      html: `<p class="muted small">Zestaw trafia na nową listę. Słówka, które już masz, nie są dublowane.</p><div class="lang-list">${packs.map((p) => `<button type="button" class="lang-row" data-pack="${p.id}"><span class="lang-name">${esc(p.name)}</span><span class="muted small">${p.words.length} słówek</span></button>`).join('')}</div>`,
      onMount: (api) => api.el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-pack]');
        if (!b) return;
        const p = packs.find((x) => x.id === b.dataset.pack);
        api.close();
        const r = await store.importWords(p.words, { newListName: store.listNameTaken(p.name) ? `${p.name} (${L.short})` : p.name });
        toast(`Dodano ${r.added} słówek do listy „${p.name}”.`, 'success');
      }),
    });
  });

  $('#btnExport').addEventListener('click', () => {
    const pool = store.poolFor(v.listId);
    if (!pool.length) return toast('Brak słówek do wyeksportowania.', 'info');
    downloadFile(slug(store.listLabel(v.listId)) + '-' + LANG + '.csv', toCSV(pool), 'text/csv');
  });

  // Przeciągnij i upuść plik CSV na stronę.
  const drop = $('#drop');
  let dragDepth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  const onDragEnter = (e) => { if (hasFiles(e)) { dragDepth++; drop.hidden = false; } };
  const onDragLeave = (e) => { if (hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; drop.hidden = true; } };
  const onDragOver = (e) => { if (hasFiles(e)) e.preventDefault(); };
  const onDrop = (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    drop.hidden = true;
    handleFile(e.dataTransfer.files[0]);
  };
  window.addEventListener('dragenter', onDragEnter);
  window.addEventListener('dragleave', onDragLeave);
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('drop', onDrop);

  renderAll();
  return {
    update() { renderAll(); },
    destroy() {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    },
  };
}
