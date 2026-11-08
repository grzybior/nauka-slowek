# Nauka słówek

Aplikacja do nauki słówek angielsko-polskich. Działa w przeglądarce na komputerze i telefonie, bez budowania projektu (czysty HTML, CSS i moduły JavaScript).

## Co potrafi

- **Konta użytkowników** (Firebase): rejestracja, logowanie, reset hasła mailem, zmiana hasła w profilu. Każdy widzi wyłącznie własne dane.
- **Własna baza słówek** zapisana na koncie (synchronizacja między telefonem a komputerem), z **listami** (np. „Ostatnie zajęcia”) i automatyczną listą „Wszystkie słówka”.
- **Podpowiedź tłumaczenia** przy dodawaniu słówka w obu kierunkach (EN↔PL), z możliwością dopisania kilku znaczeń.
- **Wymowa**: przycisk 🔊 (oraz wolniej 🐢) przy każdym angielskim słówku, akcent amerykański lub brytyjski. Korzysta z syntezy mowy wbudowanej w przeglądarkę.
- **Import i eksport CSV** (przecinek, średnik i tabulator; cudzysłowy; pliki z Excela w windows-1250), także przez przeciągnięcie pliku na stronę.
- **Powtórki rozłożone w czasie** (system Leitnera): słówko poprawnie odpowiedziane wraca po 1, 2, 4, 8, 16 dniach, błędnie od razu. Zestaw „Na dziś” zbiera to, co czeka na powtórkę, a „Trudne słówka” to te, w których błędów jest więcej niż trafień.
- **Quiz**: wybór lub pisanie, kierunek EN→PL / PL→EN / oba, tryb na liczbę pytań lub na czas, bez powtórzeń słówek w jednym quizie, skróty klawiaturowe (1–4, Enter).
- **Historia**: każda sesja z wynikiem, czasem i pełną listą odpowiedzi (błędy z Twoją odpowiedzią i poprawną), wykres skuteczności, najtrudniejsze słówka, przycisk „Ćwicz błędne”.
- Jasny i ciemny motyw, układ dopasowany do telefonu (dolna nawigacja).

## Uruchomienie lokalne

Moduły JavaScript nie działają po otwarciu `index.html` dwuklikiem (przeglądarka blokuje je dla `file://`). Uruchom prosty serwer w folderze projektu:

```bash
python3 -m http.server 8000
# potem otwórz http://localhost:8000
```

Dopóki `js/firebase-config.js` jest pusty, aplikacja działa w **trybie demo**: konta i dane są zapisywane tylko w tej przeglądarce (localStorage), bez synchronizacji i bez resetu hasła mailem. To dobry sposób, żeby ją wypróbować przed konfiguracją Firebase.

## Konfiguracja Firebase (krok po kroku)

Plan darmowy (Spark) w zupełności wystarcza do własnej nauki i małej grupy użytkowników.

1. **Projekt.** Wejdź na <https://console.firebase.google.com>, kliknij **Add project**, wpisz nazwę (np. `nauka-slowek`). Google Analytics możesz wyłączyć.
2. **Logowanie.** *Build → Authentication → Get started → Sign-in method →* **Email/Password** *→ Enable → Save.*
3. **Aplikacja webowa.** Na stronie głównej projektu kliknij ikonę **`</>` (Web)**, nadaj nazwę, zatwierdź (Firebase Hosting nie jest potrzebny). Skopiuj obiekt `firebaseConfig` i wklej jego wartości do pliku **`js/firebase-config.js`**. To nie są tajne klucze: konfiguracja webowa jest z założenia publiczna, a dane chronią reguły z kroku 5.
4. **Baza danych.** *Build → Firestore Database → Create database →* wybierz lokalizację w Europie (np. `eur3` lub `europe-west`) *→ tryb produkcyjny (production mode).*
5. **Reguły dostępu.** *Firestore Database → Rules*, wklej zawartość pliku **`firestore.rules`** z tego repozytorium i kliknij **Publish**. Dzięki nim każdy użytkownik ma dostęp tylko do własnych danych.
6. **Domena strony.** *Authentication → Settings → Authorized domains → Add domain* i dodaj domenę, pod którą działa aplikacja, np. `grzybior.github.io`. Bez tego logowanie na GitHub Pages zgłosi błąd domeny (`localhost` jest dodany domyślnie).
7. *(Opcjonalnie)* *Authentication → Templates → Password reset →* ustaw język polski w mailu resetującym hasło.

## Publikacja na GitHub Pages

1. Wgraj całą zawartość tego folderu do repozytorium (razem z folderami `css/` i `js/`). Na GitHubie: **Add file → Upload files** i przeciągnij pliki oraz foldery.
2. *Settings → Pages → Build and deployment →* **Deploy from a branch**, gałąź `main`, folder `/ (root)`.
3. Po minucie aplikacja będzie pod adresem `https://<twoj-login>.github.io/nauka-slowek/`. Pamiętaj o kroku 6 powyżej.

## Format pliku CSV

Dwie kolumny, nagłówek jest opcjonalny:

```csv
english,polish
house,dom
"to look for","szukać"
"say ""hi""","cześć, hej"
```

Rozpoznawane są też nagłówki `angielski,polski` oraz separator `;` (domyślny w polskim Excelu). Kilka znaczeń zapisuj po ukośniku: `house,dom / budynek`. Przy sprawdzaniu odpowiedzi wystarczy podać jedno z nich.

## Struktura projektu

```
index.html            szkielet strony
css/style.css         cały wygląd (motywy, układ mobilny)
js/app.js             start, nawigacja, router
js/store.js           stan aplikacji i operacje na danych
js/quiz.js            silnik quizu i powtórek (bez DOM, przetestowany)
js/csv.js             wczytywanie i zapis CSV
js/speech.js          wymowa (Web Speech API)
js/translate.js       podpowiedzi tłumaczeń (MyMemory, darmowe, bez klucza)
js/backend-firebase.js  logowanie i baza w Firebase
js/backend-local.js     tryb demo (localStorage)
js/views/             ekrany: auth, home, quiz, words, history, profile
firestore.rules       reguły bezpieczeństwa Firestore
tests/                testy logiki: node tests/logic.test.mjs
```

## Uwagi

- Podpowiedzi tłumaczeń pochodzą z darmowego serwisu MyMemory, który ma dzienny limit zapytań. Po jego wyczerpaniu aplikacja wyświetli komunikat, a słówka nadal można wpisywać ręcznie. Traktuj podpowiedzi jako pomoc, nie wyrocznię.
- Jakość i dostępne głosy wymowy zależą od przeglądarki i systemu (najlepiej wypadają Chrome, Edge i Safari).
- Historia pokazuje 100 ostatnich sesji.
