// Konfiguracja Firebase. Wklej tutaj dane swojego projektu (instrukcja w README.md, krok 3).
//
// To NIE są tajne klucze: konfiguracja webowa Firebase jest z założenia publiczna.
// Dane chronią reguły Firestore z pliku firestore.rules (każdy widzi tylko swoje).
//
// Dopóki pola są puste, aplikacja działa w trybie DEMO: konta i dane żyją tylko
// w tej przeglądarce (localStorage). Dobre do wypróbowania, ale bez synchronizacji.

export const firebaseConfig = {
  apiKey: 'AIzaSyAiDcQTy1mCTwm6jQ_FxSw4OlChSbAW3gU',
  authDomain: 'nauka-slowek-3cc24.firebaseapp.com',
  projectId: 'nauka-slowek-3cc24',
  storageBucket: 'nauka-slowek-3cc24.firebasestorage.app',
  messagingSenderId: '960058411491',
  appId: '1:960058411491:web:52eeb9718e65b135cfb8d6',
};

export const isConfigured = () => Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
