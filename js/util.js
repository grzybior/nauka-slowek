// Drobne funkcje pomocnicze używane w całej aplikacji.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Zabezpiecza tekst przed wstawieniem do HTML (naprawia błąd z apostrofami i znakami specjalnymi). */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const fmtTime = (s) => {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60);
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};

export const fmtDate = (ts) =>
  new Date(ts).toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

export const fmtDay = (ts) =>
  new Date(ts).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });

/**
 * Normalizacja do porównywania odpowiedzi.
 * strict = true -> polskie znaki mają znaczenie (ł ≠ l, ą ≠ a).
 */
export function normalize(s, strict = false) {
  let t = String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/^[¿¡]+/, '').replace(/[.!?]+$/, '').trim();
  if (!strict) {
    // Bez rozróżniania znaków diakrytycznych: ą→a, ñ→n, é→e, ü→u, a także ß→ss, œ→oe, æ→ae, ł→l, ø→o.
    t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/ß/g, 'ss').replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/ł/g, 'l').replace(/ø/g, 'o');
  }
  return t;
}

/** Rozbija "dom / budynek" na ["dom", "budynek"]. */
export const splitMeanings = (s) =>
  String(s ?? '').split(/\s*[\/;]\s*/).map((x) => x.trim()).filter(Boolean);

/** Losowa kolejność (Fisher–Yates), nie zmienia oryginału. */
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/** Polska odmiana liczebnika: plural(5, 'słówko', 'słówka', 'słówek'). */
export function plural(n, one, few, many) {
  n = Math.abs(n);
  if (n === 1) return one;
  const t = n % 10, h = n % 100;
  return t >= 2 && t <= 4 && !(h >= 12 && h <= 14) ? few : many;
}

/** Pobranie pliku wygenerowanego w przeglądarce. */
export function downloadFile(name, content, type = 'text/plain') {
  const blob = new Blob([content], { type: type + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
