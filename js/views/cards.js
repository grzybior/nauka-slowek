// Fiszki: spokojne poznawanie słówek, bez oceniania. Nie zmieniają powtórek ani statystyk (nic nie zapisują).
import { esc, shuffle } from '../util.js';
import { icon } from '../ui.js';
import { speak, stopSpeaking, canSpeak } from '../speech.js';
import { takeCards } from '../launch.js';
import * as store from '../store.js';

const HIDE_KEY = 'ns_cards_hide';
const loadHide = () => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } };
const saveHide = (v) => { try { localStorage.setItem(HIDE_KEY, v ? '1' : '0'); } catch { /* ignore */ } };

export function mount(el) {
  const cfg = takeCards();
  if (!cfg) { location.hash = '#/'; return; }
  const lang = store.state.lang;
  const pool = store.poolFor(cfg.listId);
  if (!pool.length) { location.hash = '#/'; return; }

  let deck = [];
  let idx = 0;
  let hide = loadHide();      // true: tłumaczenie ukryte, dotknij kartę, by je odkryć
  let revealed = false;

  const deal = () => {
    const all = shuffle(pool);
    deck = cfg.count === 'all' ? all : all.slice(0, Number(cfg.count) || 10);
    idx = 0;
    revealed = false;
  };

  const say = (text, slow = false) => {
    if (canSpeak) speak(text, { lang, accent: store.accentFor(lang), slow });
  };

  function renderCard(auto = true) {
    const w = deck[idx];
    const showPl = !hide || revealed;
    const last = idx === deck.length - 1;
    el.innerHTML = `
    <section class="page fc">
      <div class="fc-top">
        <a class="btn btn-ghost btn-sm" href="#/">${icon('left', 16)} Zakończ</a>
        <span class="fc-count" aria-live="polite">${idx + 1} / ${deck.length}</span>
        <label class="switch fc-switch"><input type="checkbox" id="fcHide" ${hide ? 'checked' : ''}><span class="track"></span><span>Ukryj tłumaczenie</span></label>
      </div>
      <div class="fc-bar" aria-hidden="true"><span style="width:${((idx + 1) / deck.length) * 100}%"></span></div>
      <div class="q-card fc-card" id="fcCard" role="button" tabindex="0" aria-label="${showPl ? 'Fiszka' : 'Odkryj tłumaczenie'}">
        <div class="fc-term">${esc(w.term)}</div>
        <div class="fc-tools">${canSpeak ? `<button type="button" class="btn-icon" data-say-now aria-label="Posłuchaj">${icon('volume', 22)}</button><button type="button" class="btn-icon" data-say-slow aria-label="Posłuchaj wolniej">🐢</button>` : ''}</div>
        <div class="fc-pl ${showPl ? '' : 'hidden'}">${showPl ? esc(w.pl) : 'Dotknij, aby zobaczyć tłumaczenie'}</div>
      </div>
      <div class="fc-nav">
        <button type="button" class="btn btn-ghost btn-lg" id="fcPrev" ${idx === 0 ? 'disabled' : ''}>${icon('left', 18)} Poprzednia</button>
        <button type="button" class="btn btn-primary btn-lg" id="fcNext">${last ? 'Koniec' : 'Następna'} ${icon('right', 18)}</button>
      </div>
      <p class="muted small center">Strzałki ← → przechodzą między fiszkami, spacja odkrywa tłumaczenie.</p>
    </section>`;
    el.querySelector('#fcHide').addEventListener('change', (e) => { hide = e.target.checked; saveHide(hide); revealed = false; renderCard(false); });
    el.querySelector('#fcPrev').addEventListener('click', prev);
    el.querySelector('#fcNext').addEventListener('click', next);
    const card = el.querySelector('#fcCard');
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-say-now],[data-say-slow]')) return;
      flip();
    });
    el.querySelector('[data-say-now]')?.addEventListener('click', () => say(w.term));
    el.querySelector('[data-say-slow]')?.addEventListener('click', () => say(w.term, true));
    if (auto && store.state.prefs.autoSpeak) say(w.term);
  }

  function renderEnd() {
    stopSpeaking();
    el.innerHTML = `
    <section class="page fc">
      <div class="card empty-card">
        <div class="empty-emoji">🎉</div>
        <h2>Przejrzano ${deck.length} ${deck.length === 1 ? 'fiszkę' : 'fiszek'}</h2>
        <p class="muted">Fiszki nie wpływają na powtórki ani quizy. To tylko spokojna nauka.</p>
        <div class="row center">
          <button class="btn btn-primary" id="fcAgain">Jeszcze raz (nowa kolejność)</button>
          <a class="btn btn-ghost" href="#/">Wróć</a>
        </div>
      </div>
    </section>`;
    el.querySelector('#fcAgain').addEventListener('click', () => { deal(); renderCard(); });
  }

  function flip() { if (hide) { revealed = !revealed; renderCard(false); } else next(); }
  function next() { if (idx >= deck.length - 1) return renderEnd(); idx++; revealed = false; renderCard(); }
  function prev() { if (idx > 0) { idx--; revealed = false; renderCard(); } }

  const onKey = (e) => {
    if (e.target.closest?.('input, select, textarea') || e.ctrlKey || e.metaKey) return;
    if (!el.querySelector('#fcCard')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if (e.key === ' ' || e.key === 'Enter') { if (e.target.closest?.('button, a')) return; e.preventDefault(); flip(); }
  };
  document.addEventListener('keydown', onKey);

  let sx = null;
  const onStart = (e) => { sx = e.touches[0].clientX; };
  const onEnd = (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    sx = null;
    if (Math.abs(dx) > 60) (dx < 0 ? next : prev)();
  };
  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchend', onEnd, { passive: true });

  deal();
  renderCard();
  return {
    destroy() {
      document.removeEventListener('keydown', onKey);
      stopSpeaking();
    },
  };
}
