// Podpowiedzi tłumaczeń przy dodawaniu słówek (darmowe API MyMemory, bez klucza).
// Uwaga: to tłumaczenie maszynowe/pamięciowe, więc traktuj je jako podpowiedź, nie wyrocznię.

const API = 'https://api.mymemory.translated.net/get';

function matchCase(source, text) {
  let t = text.trim().replace(/\s+/g, ' ');
  if (!/[.!?]$/.test(source)) t = t.replace(/[.!?]+$/, '');
  // Słowo wpisane małą literą -> podpowiedź też małą literą (np. "house" -> "dom", a nie "Dom").
  if (source[0] === source[0].toLowerCase() && !/^[A-ZĄĆĘŁŃÓŚŹŻ]{2,}/.test(t)) {
    t = t.charAt(0).toLowerCase() + t.slice(1);
  }
  return t;
}

/**
 * Zwraca do 4 propozycji tłumaczenia tekstu.
 * from/to: 'en' | 'pl'. Rzuca Error('quota') po wyczerpaniu limitu i Error('network') przy błędzie sieci.
 */
export async function suggest(text, from, to, signal) {
  const q = text.trim();
  if (q.length < 2) return [];

  let data;
  try {
    const res = await fetch(`${API}?q=${encodeURIComponent(q)}&langpair=${from}|${to}`, { signal });
    if (!res.ok) throw new Error('network');
    data = await res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('network');
  }

  const main = data?.responseData?.translatedText;
  if (typeof main === 'string' && /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(main)) throw new Error('quota');

  const out = [];
  const seen = new Set([q.toLowerCase()]);
  const add = (t) => {
    if (typeof t !== 'string') return;
    const v = matchCase(q, t);
    const k = v.toLowerCase();
    if (!v || v.length > 80 || seen.has(k)) return;
    seen.add(k);
    out.push(v);
  };

  add(main);
  (data.matches || [])
    .filter((m) => Number(m.match) >= 0.7)
    .sort((a, b) => Number(b.match) - Number(a.match))
    .forEach((m) => add(m.translation));

  return out.slice(0, 4);
}
