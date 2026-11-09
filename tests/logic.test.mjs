import assert from 'node:assert/strict';
const R = new URL('../js/', import.meta.url).href;
const { parseWords, parseRows, toCSV } = await import(R + 'csv.js');
const Q = await import(R + 'quiz.js');
const U = await import(R + 'util.js');

// --- CSV
let r = parseWords('english,polish\nhouse,dom\n"to run, jog",biegać\nsay "hi",cześć\nempty,\n');
assert.equal(r.words.length, 3); assert.equal(r.skipped, 1);
assert.equal(r.words[1].term, 'to run, jog');
r = parseWords('english;polish\r\ncat;kot\r\ndog;pies');
assert.deepEqual(r.words, [{term:'cat',pl:'kot'},{term:'dog',pl:'pies'}]);
r = parseWords('﻿angielski,polski\nrun,biegać, uciekać\n');
assert.deepEqual(r.words, [{term:'run', pl:'biegać, uciekać'}]);
r = parseWords('apple,jabłko\npear,gruszka');           // bez nagłówka
assert.equal(r.words.length, 2);
r = parseWords('"say ""hi""","cześć, hej"\n');
assert.deepEqual(r.words, [{term:'say "hi"', pl:'cześć, hej'}]);
const back = parseWords(toCSV([{term:'a, b', pl:'c "d"'},{term:'x', pl:'y'}]));
assert.deepEqual(back.words, [{term:'a, b', pl:'c "d"'},{term:'x', pl:'y'}]);
assert.deepEqual(parseWords('').words, []);

// --- normalizacja / odpowiedzi
assert.equal(U.normalize('  Łąka. '), 'laka');
assert.equal(U.normalize('Łąka', true), 'łąka');
const q = {dir:'enpl', correct:'dom / budynek', q:'house'};
assert.ok(Q.isCorrect(q, 'Budynek')); assert.ok(Q.isCorrect(q, 'dom'));
assert.ok(!Q.isCorrect(q, '')); assert.ok(!Q.isCorrect(q, 'kot'));
assert.ok(!Q.isCorrect({correct:'łąka'}, 'laka', true));

// --- brak powtórzeń
const words = Array.from({length: 12}, (_, i) => ({id:'w'+i, term:'en'+i, pl:'pl'+i}));
for (let k = 0; k < 200; k++) {
  const quiz = Q.buildStandardQuiz(words, 'all', 'both');
  assert.equal(quiz.length, 12);
  assert.equal(new Set(quiz.map(x => x.id)).size, 12);
}
assert.equal(Q.buildStandardQuiz(words, 30, 'enpl').length, 12);      // przycięte do puli
assert.equal(Q.buildStandardQuiz(words, 10, 'enpl').length, 10);
const src = Q.createSource(words.slice(0,3), 'plen'); let prev = null;
for (let i = 0; i < 300; i++) { const x = src.next(); assert.notEqual(x.id, prev); prev = x.id; assert.equal(x.q, x.pl); }
const one = Q.createSource(words.slice(0,1)); one.next(); one.next();   // jedno słówko nie zawiesza
assert.throws(() => Q.createSource([]).next());

// --- odpowiedzi do wyboru
const qq = Q.makeQuestion({id:'x', term:"don't", pl:"nie rób / nie"}, 'enpl');
const ch = Q.buildChoices(qq, words, words);
assert.equal(ch.length, 4); assert.ok(ch.includes(qq.correct)); assert.equal(new Set(ch).size, 4);
const few = Q.buildChoices(Q.makeQuestion(words[0],'enpl'), words.slice(0,2), words);
assert.equal(few.length, 4);
const tiny = Q.buildChoices(Q.makeQuestion(words[0],'enpl'), words.slice(0,2), []);
assert.equal(tiny.length, 2);
const dup = [{id:'a',term:'a',pl:'dom'},{id:'b',term:'b',pl:'dom'},{id:'c',term:'c',pl:'kot'}];
assert.equal(Q.buildChoices(Q.makeQuestion(dup[0],'enpl'), dup, dup).length, 2);   // 'dom' nie jest błędną opcją dla 'dom'

// --- SRS
const t = 1_000_000_000_000;
let w = {box:0, correct:0, wrong:0};
w = {...w, ...Q.applyResult(w, true, t)}; assert.equal(w.box, 1); assert.equal(w.due, t + Q.DAY);
for (let i = 0; i < 8; i++) w = {...w, ...Q.applyResult(w, true, t)};
assert.equal(w.box, Q.MAX_BOX); assert.equal(w.due, t + 16*Q.DAY);
w = {...w, ...Q.applyResult(w, false, t)}; assert.equal(w.box, 0); assert.equal(w.due, t); assert.equal(w.wrong, 1);
assert.ok(Q.isDue({}, t)); assert.ok(Q.isDue({due:t-1}, t)); assert.ok(!Q.isDue({due:t+1}, t));
assert.ok(Q.isHard({wrong:2, correct:1})); assert.ok(!Q.isHard({wrong:1, correct:3})); assert.ok(!Q.isHard({}));

// --- czas i seria
assert.equal(Q.parseDuration('1:30'), 90); assert.equal(Q.parseDuration('45'), 45);
assert.equal(Q.parseDuration('abc'), 60); assert.equal(Q.parseDuration('0:01'), 10); assert.equal(Q.parseDuration('999:00'), 7200);
const now = new Date(2026, 10, 5, 12).getTime(), d = (n, h=10) => new Date(2026, 10, 5 - n, h).getTime();
assert.equal(Q.computeStreak([], now), 0);
assert.equal(Q.computeStreak([{date:d(0)},{date:d(1)},{date:d(2)},{date:d(4)}], now), 3);
assert.equal(Q.computeStreak([{date:d(1)},{date:d(2)}], now), 2);      // dziś jeszcze nie zerwało serii
assert.equal(Q.computeStreak([{date:d(2)}], now), 0);
assert.equal(U.esc(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
assert.equal(U.fmtTime(75), '01:15');
// --- tryb mieszany: rodzaj pytania
assert.equal(Q.pickKind({ box: 0 }, false), 'spelling');                 // za mało słówek na wybór
assert.equal(Q.pickKind({ box: 0 }, true, 0.5), 'choice');                // nowe słówko: wybór
assert.equal(Q.pickKind({ box: 5 }, true, 0.5), 'spelling');              // dobrze znane: pisanie
assert.equal(Q.pickKind(undefined, true, 0.5), 'choice');                 // brak danych = traktuj jak nowe
{
  let prev = -1;
  for (let b = 0; b <= 5; b++) {                                          // szansa rośnie z poziomem i mieści się w 0..1
    const c = Q.spellingChance({ box: b, correct: 5, wrong: 0 });
    assert.ok(c >= prev && c >= 0 && c <= 1); prev = c;
  }
  assert.ok(Q.spellingChance({ box: 4, correct: 1, wrong: 3 }) < Q.spellingChance({ box: 4, correct: 5, wrong: 0 })); // trudne: więcej wyboru
  assert.equal(Q.spellingChance({ box: 99 }), Q.spellingChance({ box: Q.MAX_BOX }));
  const freq = (w) => Array.from({ length: 6000 }, () => Q.pickKind(w)).filter((k) => k === 'spelling').length / 6000;
  assert.ok(Math.abs(freq({ box: 0 }) - 0.1) < 0.03, 'box 0 ~10% pisania');
  assert.ok(Math.abs(freq({ box: 4 }) - 0.85) < 0.03, 'box 4 ~85% pisania');
}
// --- wiele języków: normalizacja i CSV
assert.equal(U.normalize('¿Dónde está?'), 'donde esta');
assert.equal(U.normalize('Straße'), 'strasse');
assert.equal(U.normalize('Straße', true), 'straße');
assert.equal(U.normalize("L'été"), "l'ete");
assert.equal(U.normalize('cœur'), 'coeur');
assert.ok(Q.isCorrect({ correct: 'el niño' }, 'el nino'));
assert.ok(!Q.isCorrect({ correct: 'el niño' }, 'el nino', true));
assert.deepEqual(parseWords('spanish,polish\ncasa,dom').words, [{ term: 'casa', pl: 'dom' }]);
assert.deepEqual(parseWords('Deutsch;polnisch\nHaus;dom').words, [{ term: 'Deutsch', pl: 'polnisch' }, { term: 'Haus', pl: 'dom' }].slice(0, 2)); // brak nagłówka rozpoznanego = wiersze danych
assert.equal(toCSV([{ term: 'a', pl: 'b' }]).split('\n')[0], 'term,polish');
const L = await import(R + 'languages.js');
assert.equal(L.speechLocale('es', 'mx'), 'es-MX'); assert.equal(L.speechLocale('de'), 'de-DE');
assert.equal(L.speechLocale('xx'), 'en-US'); assert.equal(L.dirLabel('plen', 'es'), 'PL → ES');
const S = await import(R + 'starter.js');
for (const c of L.LANG_CODES) assert.equal(S.starterWords(c).length, 30);
assert.equal(L.speechLocale('sv'), 'sv-SE');
console.log('OK: wszystkie testy logiki przeszły');
