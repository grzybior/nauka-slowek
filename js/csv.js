// Wczytywanie i zapisywanie plików CSV.
// Obsługuje cudzysłowy, przecinek / średnik / tabulator, BOM oraz opcjonalny nagłówek.

// Nagłówek kolumny ze słówkiem obcym (nazwa języka po angielsku/polsku, kod albo ogólne "term").
const TERM_HEADERS = ['term', 'word', 'słówko', 'slowko', 'english', 'angielski', 'spanish', 'hiszpański', 'hiszpanski', 'german', 'niemiecki', 'french', 'francuski', 'italian', 'włoski', 'wloski', 'swedish', 'szwedzki', 'sv', 'en', 'es', 'de', 'fr', 'it', 'eng'];
const PL_HEADERS = ['polish', 'polski', 'pl', 'pol'];

function countOutsideQuotes(line, ch) {
  let n = 0, q = false;
  for (const c of line) {
    if (c === '"') q = !q;
    else if (c === ch && !q) n++;
  }
  return n;
}

/** Zwraca tablicę wierszy (tablic pól). */
export function parseRows(text) {
  text = String(text ?? '').replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const best = [',', ';', '\t']
    .map((d) => [d, countOutsideQuotes(firstLine, d)])
    .sort((a, b) => b[1] - a[1])[0];
  const delim = best[1] > 0 ? best[0] : ',';

  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"' && field === '') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += c;
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

/**
 * Zamienia tekst CSV na listę słówek.
 * Zwraca { words: [{term, pl}], skipped } — skipped to liczba odrzuconych wierszy.
 */
export function parseWords(text) {
  const rows = parseRows(text);
  if (!rows.length) return { words: [], skipped: 0 };

  const head = rows[0].map((h) => h.trim().toLowerCase());
  let eIdx = head.findIndex((h) => TERM_HEADERS.includes(h));
  let pIdx = head.findIndex((h) => PL_HEADERS.includes(h));
  let body = rows;
  const hasHeader = eIdx !== -1 && pIdx !== -1;
  if (hasHeader) body = rows.slice(1);
  else { eIdx = 0; pIdx = 1; }

  const lastColIsPl = !hasHeader || pIdx === head.length - 1;
  const words = [];
  let skipped = 0;
  for (const r of body) {
    const term = (r[eIdx] ?? '').trim();
    // Jeśli polskie znaczenie zawierało nieocytowane przecinki, sklejamy je z powrotem.
    const pl = (lastColIsPl && pIdx > eIdx ? r.slice(pIdx).map((x) => x.trim()).join(', ') : r[pIdx] ?? '').trim();
    if (term && pl) words.push({ term, pl });
    else skipped++;
  }
  return { words, skipped };
}

const quote = (v) => (/[",;\n\r]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));

export function toCSV(words) {
  return 'term,polish\n' + words.map((w) => quote(w.term) + ',' + quote(w.pl)).join('\n') + '\n';
}
