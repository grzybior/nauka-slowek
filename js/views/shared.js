// Elementy wspólne dla kilku widoków.
import { esc, debounce, pct } from '../util.js';
import { icon, speakBtn } from '../ui.js';
import { suggest } from '../translate.js';

export const DIR_LABEL = { enpl: 'EN → PL', plen: 'PL → EN', both: 'EN ↔ PL' };
export const MODE_LABEL = { standard: 'Standardowy', challenge: 'Na czas' };
export const TYPE_LABEL = { choice: 'Wybór', spelling: 'Pisanie' };

/** Wersja angielska pytania/odpowiedzi (do przycisku wymowy). */
export const englishOf = (a) => (a.dir === 'enpl' ? a.q : a.correct);

export function answerRows(answers) {
  return answers
    .map((a) => `
      <li class="ans ${a.ok ? 'ok' : 'bad'}">
        <span class="ans-ico">${icon(a.ok ? 'check' : 'x', 16)}</span>
        <div class="ans-main">
          <div class="ans-q">${esc(a.q)}</div>
          <div class="ans-a">${a.ok
            ? esc(a.correct)
            : `<span class="given">${esc(a.given || '—')}</span><span class="arrow" aria-hidden="true">→</span><strong>${esc(a.correct)}</strong>`}</div>
        </div>
        ${speakBtn(englishOf(a))}
      </li>`)
    .join('');
}

export const scoreRing = (percent, size = '') =>
  `<div class="ring ${size}" style="--p:${percent}" role="img" aria-label="${percent}%"><span>${percent}%</span></div>`;

export const toneOf = (percent) => (percent >= 80 ? 'good' : percent >= 50 ? 'mid' : 'low');

export function scoreMessage(percent) {
  if (percent === 100) return 'Perfekcyjnie! 🎉';
  if (percent >= 80) return 'Świetna robota!';
  if (percent >= 60) return 'Dobrze, tak trzymaj!';
  if (percent >= 40) return 'Coraz lepiej. Powtórka pomoże.';
  return 'Nic nie szkodzi, każda powtórka się liczy.';
}

export const accuracyOf = (s) => pct(s.score, s.total);

/**
 * Podpowiedzi tłumaczeń pod dwoma polami (EN/PL).
 * Podpowiedzi pojawiają się dla pola, w którym użytkownik pisze, gdy drugie pole jest puste.
 * Kliknięcie wstawia tłumaczenie (kolejne kliknięcie dopisuje następne znaczenie po " / ").
 */
export function attachSuggest(enEl, plEl, box) {
  let ctrl = null;
  const fields = { en: enEl, pl: plEl };

  const clear = () => { ctrl?.abort(); box.innerHTML = ''; };

  const run = debounce(async (fromKey) => {
    const toKey = fromKey === 'en' ? 'pl' : 'en';
    const src = fields[fromKey];
    const text = src.value.trim();
    if (text.length < 2 || fields[toKey].value.trim()) { clear(); return; }
    ctrl?.abort();
    ctrl = new AbortController();
    box.innerHTML = '<span class="sugg-note">Szukam tłumaczenia…</span>';
    try {
      const list = await suggest(text, fromKey, toKey, ctrl.signal);
      if (src.value.trim() !== text) return;
      box.innerHTML = list.length
        ? `<span class="sugg-note">Podpowiedź:</span>${list.map((s) => `<button type="button" class="chip" data-fill="${esc(s)}" data-to="${toKey}">${esc(s)}</button>`).join('')}`
        : '<span class="sugg-note">Brak podpowiedzi, wpisz tłumaczenie ręcznie.</span>';
    } catch (e) {
      if (e.name === 'AbortError') return;
      box.innerHTML = `<span class="sugg-note">${e.message === 'quota'
        ? 'Dzienny limit podpowiedzi wyczerpany. Wpisz tłumaczenie ręcznie.'
        : 'Podpowiedzi niedostępne (brak połączenia). Wpisz tłumaczenie ręcznie.'}</span>`;
    }
  }, 450);

  enEl.addEventListener('input', () => run('en'));
  plEl.addEventListener('input', () => run('pl'));
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fill]');
    if (!b) return;
    const target = fields[b.dataset.to];
    const val = b.dataset.fill;
    target.value = target.value.trim() ? `${target.value.trim()} / ${val}` : val;
    target.dispatchEvent(new Event('suggest-fill', { bubbles: true }));
    b.remove();
    if (!box.querySelector('[data-fill]')) box.innerHTML = '';
    target.focus();
  });
  return { clear };
}
