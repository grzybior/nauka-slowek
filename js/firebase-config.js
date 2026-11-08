// Konfiguracja Firebase. Wklej tutaj dane swojego projektu (instrukcja w README.md, krok 3).
//
// To NIE są tajne klucze: konfiguracja webowa Firebase jest z założenia publiczna.
// Dane chronią reguły Firestore z pliku firestore.rules (każdy widzi tylko swoje).
//
// Dopóki pola są puste, aplikacja działa w trybie DEMO: konta i dane żyją tylko
// w tej przeglądarce (localStorage). Dobre do wypróbowania, ale bez synchronizacji.

export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

export const isConfigured = () => Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
