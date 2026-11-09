// Okno wyboru języka nauki: przełączanie między językami i dodawanie nowych.
import { esc, plural } from './util.js';
import { openModal, toast } from './ui.js';
import { LANGS, LANG_CODES } from './languages.js';
import * as store from './store.js';

/** Po zmianie języka widoki muszą się przeładować; szczegóły sesji z innego języka nie istnieją. */
function afterSwitch() {
  if (/^#\/history\/.+/.test(location.hash)) location.hash = '#/history';
}

export function openLangMenu() {
  const s = store.state;
  const counts = store.langCounts();
  const mine = s.langs;
  const others = LANG_CODES.filter((c) => !mine.includes(c));

  const row = (c, adding) => {
    const n = counts[c] || 0;
    const active = !adding && c === s.lang;
    return `<button type="button" class="lang-row${active ? ' active' : ''}" data-lang="${c}" ${adding ? 'data-add="1"' : ''}>
      <span class="lang-badge">${LANGS[c].short}</span>
      <span class="lang-name">${esc(LANGS[c].name)}</span>
      <span class="muted small">${adding ? 'Dodaj' : `${n} ${plural(n, 'słówko', 'słówka', 'słówek')}`}</span>
      ${active ? '<span class="lang-check" aria-hidden="true">✓</span>' : ''}
    </button>`;
  };

  openModal({
    title: 'Język nauki',
    html: `<div class="lang-list" role="list">${mine.map((c) => row(c, false)).join('')}</div>
      ${others.length ? `<h3 class="lang-sub">Dodaj język</h3><div class="lang-list">${others.map((c) => row(c, true)).join('')}</div>` : ''}
      <p class="muted small">Każdy język ma własne słówka, listy i historię. Polski zostaje językiem podpowiedzi.</p>`,
    onMount: (api) => {
      api.el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-lang]');
        if (!b) return;
        const c = b.dataset.lang;
        api.close();
        if (b.dataset.add) {
          await store.addLanguage(c);
          toast(`Dodano język: ${LANGS[c].name}. Możesz zacząć od zestawu przykładowych słówek.`, 'success');
        } else store.setLang(c);
        afterSwitch();
      });
    },
  });
}
