# Słowik 🐦

Aplikacja do nauki słówek: angielski, hiszpański, niemiecki, francuski, włoski i szwedzki (z podpowiedziami po polsku). Działa w przeglądarce na komputerze i telefonie, bez budowania projektu (czysty HTML, CSS i moduły JavaScript).

## Co potrafi

- **Gotowe zestawy** słówek w każdym języku (podstawowy, jedzenie, podróże, czasowniki) jednym kliknięciem. **Formularz kontaktowy** i **panel administratora**.
- **Wiele języków**: przełącznik w górnym pasku. Każdy język ma własne słówka, listy, historię i wymowę; podpowiedzi tłumaczeń idą w parę „język ↔ polski”. Stare słówka sprzed wielojęzyczności są automatycznie angielskie. Nowy język dodasz w oknie przełącznika, a kolejne wpisz w `js/languages.js` (+ zestaw w `js/starter.js`).
- **Konta użytkowników** (Firebase): rejestracja z potwierdzeniem e-mail, logowanie, reset hasła mailem, zmiana hasła w profilu. Każdy widzi wyłącznie własne dane.
- **Własna baza słówek** zapisana na koncie (synchronizacja między telefonem a komputerem), z **listami** (np. „Ostatnie zajęcia”) i automatyczną listą „Wszystkie słówka”.
- **Podpowiedź tłumaczenia** przy dodawaniu słówka w obu kierunkach w wybranym języku, z możliwością dopisania kilku znaczeń.
- **Wymowa**: przycisk 🔊 (oraz wolniej 🐢) przy każdym słówku, w języku nauki (np. akcent amerykański/brytyjski, hiszpański z Hiszpanii/Ameryki Łacińskiej). Korzysta z syntezy mowy wbudowanej w przeglądarkę.
- **Import i eksport CSV** (przecinek, średnik i tabulator; cudzysłowy; pliki z Excela w windows-1250), także przez przeciągnięcie pliku na stronę.
- **Powtórki rozłożone w czasie** (system Leitnera): słówko poprawnie odpowiedziane wraca po 1, 2, 4, 8, 16 dniach, błędnie od razu. Zestaw „Na dziś” zbiera to, co czeka na powtórkę, a „Trudne słówka” to te, w których błędów jest więcej niż trafień.
- **Fiszki**: spokojne poznawanie słówek (zestaw i liczba na ekranie głównym), przyciski Poprzednia/Następna, strzałki i przesuwanie palcem, opcja ukrycia tłumaczenia do odkrycia dotknięciem. Fiszki niczego nie zapisują, więc nie wpływają na powtórki ani quizy.
- **Quiz**: wybór, pisanie albo **tryb mieszany** (rodzaj pytania zależy od tego, jak dobrze znasz słówko: nowe i trudne dostają głównie wybór, dobrze opanowane głównie pisanie; działa też w powtórce „Na dziś”), kierunek język→PL / PL→język / oba, tryb na liczbę pytań lub na czas, bez powtórzeń słówek w jednym quizie, skróty klawiaturowe (1–4, Enter). Po odpowiedzi PL→język obcy aplikacja czyta poprawne słowo i dopiero po skończeniu odczytu przechodzi do kolejnego pytania.
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

## Bezpieczeństwo i administracja

### Alert GitHuba „Google API Key” w `js/firebase-config.js`
To oczekiwany fałszywy alarm: klucz webowy Firebase jest z założenia publiczny (trafia do każdej przeglądarki), a dane chronią reguły Firestore. Nie musisz go obracać. Zalecane kroki:
1. **Ogranicz klucz.** <https://console.cloud.google.com> → wybierz projekt `nauka-slowek-3cc24` → *APIs & Services → Credentials* → klucz „Browser key” → *Application restrictions: Websites* i dodaj `https://grzybior.github.io/*` oraz `http://localhost:*/*`. Zostaw *API restrictions* bez zmian (jeśli kiedykolwiek logowanie przestanie działać po zmianie, usuń najpierw ostatnie ograniczenie).
2. **Zamknij alert** na GitHubie: *Security → Secret scanning →* alert → *Close as → Used in tests / False positive* z komentarzem „publiczny klucz webowy Firebase”.
3. *(Opcjonalnie, mocniejsza ochrona)* włącz **App Check** (reCAPTCHA v3) w *Build → App Check* i wymuś go dla Firestore.

### Reguły i konto administratora
1. Wklej nowe `firestore.rules` w *Firestore Database → Rules → Publish*. Reguły wymagają **potwierdzonego e-maila**, profilu użytkownika i braku blokady; chronią też przed zbyt długimi tekstami.
2. Pierwsze logowanie po aktualizacji: każdy (także Ty) dostanie e-mail z linkiem potwierdzającym. Kliknij go i wróć do aplikacji. Szablon maila: *Authentication → Templates → Email address verification* (język polski).
3. **Administrator:** zaloguj się raz, skopiuj swój UID (*Authentication → Users*), w Firestore utwórz kolekcję `admins` i dokument o ID równym Twojemu UID (może zawierać dowolne pole, np. `ok: true`). Po odświeżeniu w stopce pojawi się „Panel administratora”.

### Co potrafi panel administratora
- lista użytkowników, blokowanie/odblokowywanie, usuwanie danych użytkownika,
- wyłączenie rejestracji nowych kont,
- czyszczenie kont nieaktywnych po X dniach (do włączenia): ostrzeżenie mailem (UDW), po 7 dniach można usunąć dane tych, którzy się nie zalogowali (logowanie kasuje ostrzeżenie),
- skrzynka wiadomości z formularza kontaktowego.

Ograniczenia planu darmowego: panel działa z przeglądarki administratora (bez serwera), więc **maila z ostrzeżeniem wysyła admin ręcznie** z przygotowanego wzoru, a samo konto logowania usuwa się w konsoli (*Authentication → Users*). W pełni automatyczne czyszczenie i maile wymagają Cloud Functions (plan Blaze).

### Ochrona przed nadużyciami
Limity: 10 000 słówek na konto, 5000 wierszy i 1 MB na jeden import CSV, 200 znaków na słówko (także w regułach), 2000 znaków w wiadomości, jedna wiadomość na minutę. Rejestracja wymaga potwierdzenia e-maila. Na wypadek ataków pomocne są też budżet i alerty w Google Cloud (*Billing → Budgets & alerts*) oraz App Check.

### Gdy limit darmowego planu Firebase się wyczerpie
Plan Spark ma dzienne limity odczytów i zapisów (odnawiają się codziennie). Po ich wyczerpaniu aplikacja nie wyłącza się: pokazuje komunikat, dane już pobrane są czytane z pamięci urządzenia, a zapisy czekają w kolejce i synchronizują się po odnowieniu limitu. Bez wcześniej zapisanych danych na urządzeniu (nowy telefon) zobaczysz komunikat o limicie i będzie trzeba poczekać do następnego dnia.

## Publikacja na GitHub Pages

1. Wgraj całą zawartość tego folderu do repozytorium (razem z folderami `css/` i `js/`). Na GitHubie: **Add file → Upload files** i przeciągnij pliki oraz foldery.
2. *Settings → Pages → Build and deployment →* **Deploy from a branch**, gałąź `main`, folder `/ (root)`.
3. Po minucie aplikacja będzie pod adresem `https://<twoj-login>.github.io/nauka-slowek/`. Pamiętaj o kroku 6 powyżej.

## Format pliku CSV

Dwie kolumny, nagłówek jest opcjonalny:

```csv
term,polish
house,dom
"to look for","szukać"
"say ""hi""","cześć, hej"
```

Import trafia do aktualnie wybranego języka. Rozpoznawane są też nagłówki `english`, `spanish`, `angielski`, `hiszpański` itd. oraz `polski` oraz separator `;` (domyślny w polskim Excelu). Kilka znaczeń zapisuj po ukośniku: `house,dom / budynek`. Przy sprawdzaniu odpowiedzi wystarczy podać jedno z nich.

## Struktura projektu

```
index.html            szkielet strony
css/style.css         cały wygląd (motywy, układ mobilny)
js/app.js             start, nawigacja, router
js/store.js           stan aplikacji i operacje na danych
js/quiz.js            silnik quizu i powtórek (bez DOM, przetestowany)
js/csv.js             wczytywanie i zapis CSV
js/languages.js       lista języków, akcenty, kody mowy
js/langmenu.js        okno wyboru języka
js/starter.js         gotowe zestawy słówek (podstawowy i tematyczne, 6 języków)
js/limits.js          limity chroniące bazę
js/views/admin.js     panel administratora
js/views/contact.js   formularz kontaktowy
js/views/cards.js     fiszki
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
- Jakość i dostępne głosy wymowy zależą od przeglądarki i systemu (najlepiej wypadają Chrome, Edge i Safari). Gdy urządzenie nie ma głosu dla danego języka, Profil pokaże ostrzeżenie; głosy doinstalujesz w ustawieniach systemu.
- Seria dni z rzędu liczy naukę w dowolnym języku.
- Historia pokazuje 100 ostatnich sesji.
