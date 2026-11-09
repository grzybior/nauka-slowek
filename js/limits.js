// Limity chroniące bazę i darmowy plan Firebase przed przypadkowym lub złośliwym przeciążeniem.
export const MAX_WORDS = 10000;          // słówek na użytkownika (we wszystkich językach)
export const MAX_IMPORT_ROWS = 5000;     // wierszy w jednym imporcie CSV
export const MAX_FILE_BYTES = 1_000_000; // rozmiar pliku CSV
export const MAX_TEXT = 200;             // znaków w słówku/tłumaczeniu (zgodne z firestore.rules)
export const MAX_MESSAGE = 2000;         // znaków w wiadomości kontaktowej
export const INACTIVE_DEFAULT_DAYS = 365;
export const WARN_DAYS = 7;
