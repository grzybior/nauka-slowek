// Języki nauki. Dodanie nowego języka = jeden wpis tutaj + zestaw przykładowych słówek w starter.js.
// Kody języków są zgodne z ISO 639-1 (używa ich też serwis podpowiedzi tłumaczeń).
//
// Uwaga o nazwach wewnętrznych: kierunki quizu 'enpl' i 'plen' to nazwy historyczne
// (zapisane w historii sesji) i oznaczają "język obcy → polski" oraz "polski → język obcy".

export const LANGS = {
  en: {
    name: 'Angielski', short: 'EN', sample: 'Hello, nice to meet you.', example: ['to look for', 'szukać'],
    accents: [['us', 'Amerykański', 'en-US'], ['gb', 'Brytyjski', 'en-GB']],
  },
  es: {
    name: 'Hiszpański', short: 'ES', sample: 'Hola, encantado de conocerte.', example: ['buscar', 'szukać'],
    accents: [['es', 'Hiszpania', 'es-ES'], ['mx', 'Ameryka Łacińska', 'es-MX']],
  },
  de: {
    name: 'Niemiecki', short: 'DE', sample: 'Hallo, schön, dich kennenzulernen.', example: ['suchen', 'szukać'],
    accents: [['de', 'Niemcy', 'de-DE']],
  },
  fr: {
    name: 'Francuski', short: 'FR', sample: 'Bonjour, ravi de vous rencontrer.', example: ['chercher', 'szukać'],
    accents: [['fr', 'Francja', 'fr-FR']],
  },
  sv: {
    name: 'Szwedzki', short: 'SV', sample: 'Hej, trevligt att träffas.', example: ['söka', 'szukać'],
    accents: [['se', 'Szwecja', 'sv-SE']],
  },
  it: {
    name: 'Włoski', short: 'IT', sample: 'Ciao, piacere di conoscerti.', example: ['cercare', 'szukać'],
    accents: [['it', 'Włochy', 'it-IT']],
  },
};

export const LANG_CODES = Object.keys(LANGS);
export const DEFAULT_LANG = 'en';

export const isLang = (c) => typeof c === 'string' && Object.prototype.hasOwnProperty.call(LANGS, c);
export const langInfo = (c) => LANGS[isLang(c) ? c : DEFAULT_LANG];
export const defaultAccent = (lang) => langInfo(lang).accents[0][0];

/** Kod języka dla syntezy mowy, np. ('es', 'mx') -> 'es-MX'. */
export function speechLocale(lang, accent) {
  const L = langInfo(lang);
  return (L.accents.find((a) => a[0] === accent) || L.accents[0])[2];
}

/** Opis kierunku quizu, np. 'EN → PL', 'PL → ES', 'DE ↔ PL'. */
export function dirLabel(dir, lang) {
  const s = langInfo(lang).short;
  return dir === 'enpl' ? `${s} → PL` : dir === 'plen' ? `PL → ${s}` : `${s} ↔ PL`;
}
