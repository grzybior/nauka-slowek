// Wspólne elementy interfejsu: ikony, toasty, okna dialogowe, przyciski wymowy, przełączniki.
import { esc } from './util.js';
import { canSpeak } from './speech.js';

const ICONS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  history: '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
  repeat: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
};

export const icon = (name, size = 20) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/** Przycisk wymowy; obsługa kliknięć jest globalna (data-say w app.js). */
export function speakBtn(text, { slow = false } = {}) {
  if (!canSpeak || !text) return '';
  const label = (slow ? 'Posłuchaj wolno: ' : 'Posłuchaj wymowy: ') + text;
  return `<button type="button" class="btn-icon speak${slow ? ' slow' : ''}" data-say="${esc(text)}"${slow ? ' data-slow="1"' : ''} aria-label="${esc(label)}" title="${esc(label)}">${slow ? '<span aria-hidden="true">🐢</span>' : icon('volume', 18)}</button>`;
}

export function toast(msg, type = 'info', ms = 3400) {
  const box = document.getElementById('toasts');
  if (!box) return;
  while (box.children.length >= 3) box.firstElementChild.remove(); // nie zasłaniaj ekranu stosem powiadomień
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = msg;
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, ms);
}

/**
 * Okno modalne. actions: [{ label, kind: 'primary'|'ghost'|'danger', onClick(api) }].
 * Jeśli onClick zwróci false, okno zostaje otwarte (np. przy błędzie walidacji).
 */
export function openModal({ title, html, actions = [], wide = false, dismissible = true, onMount, onClose }) {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${esc(title)}</h2>${dismissible ? `<button type="button" class="btn-icon" data-close aria-label="Zamknij">${icon('x')}</button>` : ''}</div>
      <div class="modal-body">${html || ''}</div>
      ${actions.length ? '<div class="modal-foot"></div>' : ''}
    </div>`;
  const prevFocus = document.activeElement;
  document.body.appendChild(back);
  document.body.classList.add('modal-open');
  const el = back.querySelector('.modal');
  let closed = false;

  const api = {
    el,
    body: el.querySelector('.modal-body'),
    close(result) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      back.remove();
      if (!document.querySelector('.modal-backdrop')) document.body.classList.remove('modal-open');
      try { prevFocus?.focus?.({ preventScroll: true }); } catch { /* ignore */ }
      onClose?.(result);
    },
  };
  function onKey(e) {
    if (e.key === 'Escape' && dismissible) { e.stopPropagation(); api.close(); }
  }
  document.addEventListener('keydown', onKey, true);
  if (dismissible) {
    back.addEventListener('mousedown', (e) => { if (e.target === back) api.close(); });
    el.querySelector('[data-close]')?.addEventListener('click', () => api.close());
  }
  const foot = el.querySelector('.modal-foot');
  actions.forEach((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-' + (a.kind || 'ghost');
    b.textContent = a.label;
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const r = await a.onClick?.(api);
        if (r !== false) api.close(a.value);
      } finally { b.disabled = false; }
    });
    foot.appendChild(b);
  });
  onMount?.(api);
  if (!api.el.contains(document.activeElement)) {
    (el.querySelector('input,select,textarea') || el.querySelector('.btn-primary,.btn-danger') || el.querySelector('button'))?.focus({ preventScroll: true });
  }
  return api;
}

export function confirmDialog({ title, text, confirmLabel = 'Potwierdź', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    openModal({
      title,
      html: `<p class="modal-text">${esc(text)}</p>`,
      onClose: () => resolve(answer),
      actions: [
        { label: 'Anuluj', kind: 'ghost' },
        { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: () => { answer = true; } },
      ],
    });
  });
}

/** Okno z jednym polem tekstowym. validate(value) zwraca komunikat błędu albo ''. Zwraca tekst lub null. */
export function promptDialog({ title, label, value = '', confirmLabel = 'Zapisz', validate, maxLength = 40 }) {
  return new Promise((resolve) => {
    let result = null;
    openModal({
      title,
      html: `<form class="field" data-form><label for="pd-input">${esc(label)}</label><input id="pd-input" class="input" maxlength="${maxLength}" value="${esc(value)}" autocomplete="off"><div class="form-error" role="alert"></div></form>`,
      onClose: () => resolve(result),
      onMount: (api) => {
        const input = api.el.querySelector('input');
        input.select();
        api.el.querySelector('form').addEventListener('submit', (e) => {
          e.preventDefault();
          api.el.querySelector('.btn-primary').click();
        });
      },
      actions: [
        { label: 'Anuluj', kind: 'ghost' },
        {
          label: confirmLabel,
          kind: 'primary',
          onClick: (api) => {
            const v = api.el.querySelector('input').value.trim();
            const err = !v ? 'Wpisz nazwę.' : validate?.(v) || '';
            api.el.querySelector('.form-error').textContent = err;
            if (err) return false;
            result = v;
          },
        },
      ],
    });
  });
}

/** Przełącznik segmentowy. options: [[wartość, etykieta], ...] */
export function seg(name, options, value) {
  return `<div class="seg" role="radiogroup" data-seg="${esc(name)}">${options
    .map(([v, l]) => `<button type="button" role="radio" data-v="${esc(v)}" aria-checked="${String(v) === String(value)}" class="${String(v) === String(value) ? 'active' : ''}">${esc(l)}</button>`)
    .join('')}</div>`;
}

/** Podpina obsługę wszystkich przełączników segmentowych wewnątrz root. */
export function bindSegs(root, onChange) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.seg button');
    if (!b || !root.contains(b)) return;
    const group = b.closest('.seg');
    group.querySelectorAll('button').forEach((x) => {
      const on = x === b;
      x.classList.toggle('active', on);
      x.setAttribute('aria-checked', String(on));
    });
    onChange(group.dataset.seg, b.dataset.v);
  });
}

/** Pomija aktualizację widoku, gdy użytkownik właśnie pisze w polu formularza. */
export function isTyping(root) {
  const a = document.activeElement;
  return Boolean(a && root.contains(a) && a.matches('input[type="text"],input[type="email"],input[type="password"],input[type="search"],input[type="number"],textarea'));
}
