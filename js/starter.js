// Małe zestawy na start (po jednym na język), żeby od razu można było wypróbować aplikację.
// Ta sama kolejność pojęć we wszystkich językach. W niemieckim rzeczowniki mają rodzajnik.
export const STARTER_NAME = 'Przykładowe';

const PL = ['dom', 'samochód', 'książka', 'woda', 'przyjaciel', 'piękny', 'biegać', 'jeść', 'czas', 'praca',
  'szkoła', 'miasto', 'rodzina', 'jedzenie', 'szczęśliwy', 'trudny', 'łatwy', 'rozumieć', 'pamiętać', 'zawsze',
  'nigdy', 'jutro', 'wczoraj', 'okno', 'drzwi', 'ulica', 'uczyć się', 'podróżować', 'śniadanie', 'zmęczony'];

const TERMS = {
  en: ['house', 'car', 'book', 'water', 'friend', 'beautiful', 'to run', 'to eat', 'time', 'work',
    'school', 'city', 'family', 'food', 'happy', 'difficult', 'easy', 'to understand', 'to remember', 'always',
    'never', 'tomorrow', 'yesterday', 'window', 'door', 'street', 'to learn', 'to travel', 'breakfast', 'tired'],
  es: ['la casa', 'el coche', 'el libro', 'el agua', 'el amigo', 'hermoso', 'correr', 'comer', 'el tiempo', 'el trabajo',
    'la escuela', 'la ciudad', 'la familia', 'la comida', 'feliz', 'difícil', 'fácil', 'entender', 'recordar', 'siempre',
    'nunca', 'mañana', 'ayer', 'la ventana', 'la puerta', 'la calle', 'aprender', 'viajar', 'el desayuno', 'cansado'],
  de: ['das Haus', 'das Auto', 'das Buch', 'das Wasser', 'der Freund', 'schön', 'laufen', 'essen', 'die Zeit', 'die Arbeit',
    'die Schule', 'die Stadt', 'die Familie', 'das Essen', 'glücklich', 'schwierig', 'einfach', 'verstehen', 'sich erinnern', 'immer',
    'nie', 'morgen', 'gestern', 'das Fenster', 'die Tür', 'die Straße', 'lernen', 'reisen', 'das Frühstück', 'müde'],
  fr: ['la maison', 'la voiture', 'le livre', "l'eau", "l'ami", 'beau', 'courir', 'manger', 'le temps', 'le travail',
    "l'école", 'la ville', 'la famille', 'la nourriture', 'heureux', 'difficile', 'facile', 'comprendre', 'se souvenir', 'toujours',
    'jamais', 'demain', 'hier', 'la fenêtre', 'la porte', 'la rue', 'apprendre', 'voyager', 'le petit-déjeuner', 'fatigué'],
  sv: ['ett hus', 'en bil', 'en bok', 'vatten', 'en vän', 'vacker', 'springa', 'äta', 'en tid', 'ett arbete',
    'en skola', 'en stad', 'en familj', 'mat', 'glad', 'svår', 'lätt', 'förstå', 'komma ihåg', 'alltid',
    'aldrig', 'imorgon', 'igår', 'ett fönster', 'en dörr', 'en gata', 'lära sig', 'resa', 'en frukost', 'trött'],
  it: ['la casa', "l'auto", 'il libro', "l'acqua", "l'amico", 'bello', 'correre', 'mangiare', 'il tempo', 'il lavoro',
    'la scuola', 'la città', 'la famiglia', 'il cibo', 'felice', 'difficile', 'facile', 'capire', 'ricordare', 'sempre',
    'mai', 'domani', 'ieri', 'la finestra', 'la porta', 'la strada', 'imparare', 'viaggiare', 'la colazione', 'stanco'],
};

/** Zestaw startowy dla języka: lista { term, pl }. */
export const starterWords = (lang) => (TERMS[lang] || TERMS.en).map((term, i) => ({ term, pl: PL[i] }));

/* ---------- gotowe zestawy tematyczne (po 20 słówek, w każdym języku w tej samej kolejności pojęć) ---------- */
const PACKS = [
  {
    id: 'food', name: 'Jedzenie i picie',
    pl: ['chleb', 'mleko', 'ser', 'jajko', 'mięso', 'ryba', 'jabłko', 'owoce', 'warzywo', 'kawa', 'herbata', 'sok', 'piwo', 'wino', 'cukier', 'sól', 'zupa', 'obiad', 'kolacja', 'rachunek'],
    terms: {
      en: ['bread', 'milk', 'cheese', 'egg', 'meat', 'fish', 'apple', 'fruit', 'vegetable', 'coffee', 'tea', 'juice', 'beer', 'wine', 'sugar', 'salt', 'soup', 'lunch', 'dinner', 'bill'],
      es: ['el pan', 'la leche', 'el queso', 'el huevo', 'la carne', 'el pescado', 'la manzana', 'la fruta', 'la verdura', 'el café', 'el té', 'el zumo', 'la cerveza', 'el vino', 'el azúcar', 'la sal', 'la sopa', 'el almuerzo', 'la cena', 'la cuenta'],
      de: ['das Brot', 'die Milch', 'der Käse', 'das Ei', 'das Fleisch', 'der Fisch', 'der Apfel', 'das Obst', 'das Gemüse', 'der Kaffee', 'der Tee', 'der Saft', 'das Bier', 'der Wein', 'der Zucker', 'das Salz', 'die Suppe', 'das Mittagessen', 'das Abendessen', 'die Rechnung'],
      fr: ['le pain', 'le lait', 'le fromage', "l'œuf", 'la viande', 'le poisson', 'la pomme', 'le fruit', 'le légume', 'le café', 'le thé', 'le jus', 'la bière', 'le vin', 'le sucre', 'le sel', 'la soupe', 'le déjeuner', 'le dîner', "l'addition"],
      it: ['il pane', 'il latte', 'il formaggio', "l'uovo", 'la carne', 'il pesce', 'la mela', 'la frutta', 'la verdura', 'il caffè', 'il tè', 'il succo', 'la birra', 'il vino', 'lo zucchero', 'il sale', 'la zuppa', 'il pranzo', 'la cena', 'il conto'],
      sv: ['bröd', 'mjölk', 'ost', 'ett ägg', 'kött', 'fisk', 'ett äpple', 'frukt', 'en grönsak', 'kaffe', 'te', 'juice', 'öl', 'vin', 'socker', 'salt', 'soppa', 'lunch', 'middag', 'notan'],
    },
  },
  {
    id: 'travel', name: 'Podróże',
    pl: ['lotnisko', 'bilet', 'paszport', 'walizka', 'hotel', 'dworzec', 'pociąg', 'autobus', 'samolot', 'mapa', 'wakacje', 'plaża', 'góry', 'rezerwacja', 'bagaż', 'odjazd', 'przyjazd', 'turysta', 'wycieczka', 'granica'],
    terms: {
      en: ['airport', 'ticket', 'passport', 'suitcase', 'hotel', 'station', 'train', 'bus', 'plane', 'map', 'holiday', 'beach', 'mountains', 'reservation', 'luggage', 'departure', 'arrival', 'tourist', 'trip', 'border'],
      es: ['el aeropuerto', 'el billete', 'el pasaporte', 'la maleta', 'el hotel', 'la estación', 'el tren', 'el autobús', 'el avión', 'el mapa', 'las vacaciones', 'la playa', 'las montañas', 'la reserva', 'el equipaje', 'la salida', 'la llegada', 'el turista', 'la excursión', 'la frontera'],
      de: ['der Flughafen', 'die Fahrkarte', 'der Reisepass', 'der Koffer', 'das Hotel', 'der Bahnhof', 'der Zug', 'der Bus', 'das Flugzeug', 'die Karte', 'der Urlaub', 'der Strand', 'die Berge', 'die Reservierung', 'das Gepäck', 'die Abreise', 'die Ankunft', 'der Tourist', 'der Ausflug', 'die Grenze'],
      fr: ["l'aéroport", 'le billet', 'le passeport', 'la valise', "l'hôtel", 'la gare', 'le train', 'le bus', "l'avion", 'la carte', 'les vacances', 'la plage', 'les montagnes', 'la réservation', 'les bagages', 'le départ', "l'arrivée", 'le touriste', "l'excursion", 'la frontière'],
      it: ["l'aeroporto", 'il biglietto', 'il passaporto', 'la valigia', "l'albergo", 'la stazione', 'il treno', "l'autobus", "l'aereo", 'la mappa', 'le vacanze', 'la spiaggia', 'le montagne', 'la prenotazione', 'il bagaglio', 'la partenza', "l'arrivo", 'il turista', 'la gita', 'il confine'],
      sv: ['en flygplats', 'en biljett', 'ett pass', 'en resväska', 'ett hotell', 'en station', 'ett tåg', 'en buss', 'ett flygplan', 'en karta', 'en semester', 'en strand', 'bergen', 'en bokning', 'bagage', 'en avresa', 'en ankomst', 'en turist', 'en utflykt', 'en gräns'],
    },
  },
  {
    id: 'verbs', name: 'Najważniejsze czasowniki',
    pl: ['mieć', 'być', 'robić', 'iść', 'widzieć', 'mówić', 'chcieć', 'móc', 'wiedzieć', 'dawać', 'brać', 'myśleć', 'kupować', 'płacić', 'pracować', 'pisać', 'czytać', 'słuchać', 'otwierać', 'zamykać'],
    terms: {
      en: ['to have', 'to be', 'to do', 'to go', 'to see', 'to speak', 'to want', 'can', 'to know', 'to give', 'to take', 'to think', 'to buy', 'to pay', 'to work', 'to write', 'to read', 'to listen', 'to open', 'to close'],
      es: ['tener', 'ser', 'hacer', 'ir', 'ver', 'hablar', 'querer', 'poder', 'saber', 'dar', 'tomar', 'pensar', 'comprar', 'pagar', 'trabajar', 'escribir', 'leer', 'escuchar', 'abrir', 'cerrar'],
      de: ['haben', 'sein', 'machen', 'gehen', 'sehen', 'sprechen', 'wollen', 'können', 'wissen', 'geben', 'nehmen', 'denken', 'kaufen', 'bezahlen', 'arbeiten', 'schreiben', 'lesen', 'hören', 'öffnen', 'schließen'],
      fr: ['avoir', 'être', 'faire', 'aller', 'voir', 'parler', 'vouloir', 'pouvoir', 'savoir', 'donner', 'prendre', 'penser', 'acheter', 'payer', 'travailler', 'écrire', 'lire', 'écouter', 'ouvrir', 'fermer'],
      it: ['avere', 'essere', 'fare', 'andare', 'vedere', 'parlare', 'volere', 'potere', 'sapere', 'dare', 'prendere', 'pensare', 'comprare', 'pagare', 'lavorare', 'scrivere', 'leggere', 'ascoltare', 'aprire', 'chiudere'],
      sv: ['ha', 'vara', 'göra', 'gå', 'se', 'tala', 'vilja', 'kunna', 'veta', 'ge', 'ta', 'tänka', 'köpa', 'betala', 'arbeta', 'skriva', 'läsa', 'lyssna', 'öppna', 'stänga'],
    },
  },
];

/** Wszystkie zestawy dla języka: podstawowy (30 słówek) + tematyczne. Każdy: { id, name, words: [{term, pl}] }. */
export function packsFor(lang) {
  return [
    { id: 'basic', name: STARTER_NAME, words: starterWords(lang) },
    ...PACKS.map((p) => ({ id: p.id, name: p.name, words: p.terms[lang].map((term, i) => ({ term, pl: p.pl[i] })) })),
  ];
}
