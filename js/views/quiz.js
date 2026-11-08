// Widok quizu: pytania (wybór / pisanie), tryb standardowy i na czas, podsumowanie i zapis sesji.
import { esc, fmtTime, pct } from '../util.js';
import { icon, speakBtn, toast, openModal } from '../ui.js';
import { speak, stopSpeaking } from '../speech.js';
import { sOK, sBAD, sWIN, setSoundEnabled, unlockAudio } from '../sound.js';
import { buildStandardQuiz, createSource, buildChoices, isCorrect } from '../quiz.js';
import { takeLaunch } from '../launch.js';
import * as store from '../store.js';
import { answerRows, scoreRing, scoreMessage, DIR_LABEL } from './shared.js';

export function mount(el) {
  const initial = takeLaunch();
  if (!initial) {
    location.hash = '#/';
    return { destroy() {} };
  }

  let run = null;
  let destroyed = false;
  const prefs = () => store.state.prefs;

  const resolvePool = (cfg) => {
    if (cfg.wordIds) {
      const ids = new Set(cfg.wordIds);
      return store.state.words.filter((w) => ids.has(w.id));
    }
    return store.poolFor(cfg.listId).slice();
  };

  function begin(cfg) {
    const pool = resolvePool(cfg);
    if (!pool.length) {
      toast('Ten zestaw jest pusty.', 'error');
      location.hash = '#/';
      return;
    }
    setSoundEnabled(prefs().sounds);
    unlockAudio();
    run = {
      cfg, pool, all: store.state.words.slice(),
      idx: 0, score: 0, answers: [],
      awaiting: false, finished: false, saved: false,
      start: Date.now(), q: null, choices: [], advance: null, tick: null,
    };
    if (cfg.mode === 'standard') {
      run.questions = buildStandardQuiz(pool, cfg.count, cfg.direction);
      run.total = run.questions.length;
    } else {
      run.source = createSource(pool, cfg.direction);
      run.total = null;
    }
    renderPlay();
    nextQuestion();
    run.tick = setInterval(onTick, 250);
    onTick();
  }

  /* ---------- widok pytania ---------- */
  function renderPlay() {
    const spelling = run.cfg.type === 'spelling';
    el.innerHTML = `
    <section class="quiz">
      <div class="quiz-top">
        <button type="button" class="btn-icon" id="qExit" aria-label="Zakończ quiz">${icon('x', 22)}</button>
        <div class="quiz-meta"><span class="badge" id="qCount"></span><span class="badge good" id="qScore"></span></div>
        <div class="timer" id="qTimer" aria-live="off">00:00</div>
      </div>
      <div class="progress" aria-hidden="true"><div class="fill" id="qFill"></div></div>
      <div class="q-card">
        <div class="q-dir" id="qDir"></div>
        <div class="q-word" id="qWord"></div>
        <div class="q-tools" id="qTools"></div>
        <div class="answers" id="qAnswers" ${spelling ? 'hidden' : ''}></div>
        <form class="spell" id="qForm" ${spelling ? '' : 'hidden'} autocomplete="off">
          <input id="qInput" class="input big" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Wpisz tłumaczenie…" aria-label="Twoja odpowiedź">
          <button class="btn btn-primary btn-lg" id="qSubmit" type="submit">Sprawdź</button>
        </form>
        <div class="feedback" id="qFb" aria-live="polite"></div>
        <button type="button" class="btn btn-ghost btn-block" id="qNext" hidden>Dalej ${icon('right', 18)}</button>
      </div>
      <p class="hint muted">${spelling ? 'Enter: sprawdź i przejdź dalej' : 'Klawisze 1–4: wybór odpowiedzi. Enter lub spacja: dalej'}</p>
    </section>`;

    const $ = (s) => el.querySelector(s);
    $('#qExit').addEventListener('click', onExit);
    $('#qNext').addEventListener('click', next);
    $('#qAnswers').addEventListener('click', (e) => {
      const b = e.target.closest('.opt');
      if (b) answer(run.choices[Number(b.dataset.i)], b);
    });
    $('#qForm').addEventListener('submit', (e) => {
      e.preventDefault();
      if (run.awaiting) next();
      else answer($('#qInput').value);
    });
  }

  const $q = (s) => el.querySelector(s);

  function nextQuestion() {
    if (run.finished) return;
    const cfg = run.cfg;
    run.q = cfg.mode === 'standard' ? run.questions[run.idx] : run.source.next();
    run.awaiting = false;
    const q = run.q;

    $q('#qDir').textContent = DIR_LABEL[q.dir];
    $q('#qWord').textContent = q.q;
    $q('#qTools').innerHTML = q.dir === 'enpl' ? speakBtn(q.q) + speakBtn(q.q, { slow: true }) : '';
    $q('#qFb').textContent = '';
    $q('#qFb').className = 'feedback';
    $q('#qNext').hidden = true;
    updateHud();

    if (cfg.type === 'choice') {
      run.choices = buildChoices(q, run.pool, run.all);
      $q('#qAnswers').innerHTML = run.choices
        .map((c, i) => `<button type="button" class="opt" data-i="${i}"><span class="key">${i + 1}</span><span class="opt-text">${esc(c)}</span></button>`)
        .join('');
    } else {
      const input = $q('#qInput');
      input.value = '';
      input.readOnly = false;
      input.className = 'input big';
      $q('#qSubmit').textContent = 'Sprawdź';
      input.focus({ preventScroll: true });
    }
    if (prefs().autoSpeak && q.dir === 'enpl') speak(q.q, { accent: prefs().accent });
  }

  function updateHud() {
    const cfg = run.cfg;
    if (cfg.mode === 'standard') {
      $q('#qCount').textContent = `Pytanie ${Math.min(run.idx + 1, run.total)}/${run.total}`;
      $q('#qScore').textContent = `${run.score} ✓`;
      $q('#qFill').style.width = (run.answers.length / run.total) * 100 + '%';
    } else {
      $q('#qCount').textContent = `${run.answers.length} odp.`;
      $q('#qScore').textContent = `${run.score}/${run.answers.length} ✓`;
    }
  }

  function onTick() {
    if (!run || run.finished) return;
    const elapsed = (Date.now() - run.start) / 1000;
    if (run.cfg.mode === 'standard') {
      $q('#qTimer').textContent = fmtTime(elapsed);
    } else {
      const left = Math.max(0, run.cfg.seconds - elapsed);
      $q('#qTimer').textContent = fmtTime(Math.ceil(left));
      $q('#qTimer').classList.toggle('low', left <= 10);
      $q('#qFill').style.width = (left / run.cfg.seconds) * 100 + '%';
      if (left <= 0) finish();
    }
  }

  /* ---------- odpowiedź ---------- */
  function answer(given, optEl) {
    if (!run || run.awaiting || run.finished) return;
    const cfg = run.cfg;
    if (cfg.type === 'spelling' && !String(given).trim()) return;
    run.awaiting = true;

    const q = run.q;
    const ok = isCorrect(q, given, prefs().strict);
    run.answers.push({ wid: q.id, q: q.q, correct: q.correct, given: String(given).trim(), ok, dir: q.dir });
    if (ok) run.score++;
    ok ? sOK() : sBAD();

    if (cfg.type === 'choice') {
      el.querySelectorAll('.opt').forEach((b) => {
        const txt = run.choices[Number(b.dataset.i)];
        b.classList.add('locked');
        if (txt === q.correct) b.classList.add('ok');
        else if (b === optEl) b.classList.add('bad');
      });
    } else {
      const input = $q('#qInput');
      input.readOnly = true;
      input.classList.add(ok ? 'ok' : 'bad');
      $q('#qSubmit').textContent = 'Dalej';
    }
    const fb = $q('#qFb');
    fb.className = 'feedback ' + (ok ? 'ok' : 'bad');
    fb.innerHTML = ok ? `${icon('check', 18)} Dobrze!` : `${icon('x', 18)} Poprawnie: <strong>${esc(q.correct)}</strong>`;

    if (q.dir === 'plen') {
      $q('#qTools').innerHTML = speakBtn(q.correct) + speakBtn(q.correct, { slow: true });
      if (prefs().autoSpeak) speak(q.correct, { accent: prefs().accent });
    }
    updateHud();

    const last = cfg.mode === 'standard' && run.answers.length >= run.total;
    const nextBtn = $q('#qNext');
    nextBtn.hidden = false;
    nextBtn.innerHTML = last ? 'Zobacz wynik' : `Dalej ${icon('right', 18)}`;
    if (cfg.type === 'choice') nextBtn.focus({ preventScroll: true });

    const delay = Number(prefs().delay) || 0;
    if (delay > 0) run.advance = setTimeout(next, delay * 1000);
  }

  function next() {
    if (!run || run.finished || !run.awaiting) return;
    clearTimeout(run.advance);
    if (run.cfg.mode === 'standard') {
      run.idx++;
      if (run.idx >= run.total) return finish();
    }
    nextQuestion();
  }

  function onKey(e) {
    if (!run || run.finished || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.modal-backdrop')) return;
    if (run.awaiting) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); next(); }
      return;
    }
    if (run.cfg.type === 'choice') {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= run.choices.length) {
        e.preventDefault();
        answer(run.choices[n - 1], el.querySelectorAll('.opt')[n - 1]);
      }
    }
  }
  document.addEventListener('keydown', onKey);

  /* ---------- zakończenie ---------- */
  function onExit() {
    if (!run || run.finished) { location.hash = '#/'; return; }
    if (!run.answers.length) { location.hash = '#/'; return; }
    openModal({
      title: 'Zakończyć quiz?',
      html: `<p class="modal-text">Odpowiedziałeś na ${run.answers.length}. Możesz zapisać dotychczasowy wynik albo wyjść bez zapisywania.</p>`,
      actions: [
        { label: 'Wróć do quizu', kind: 'ghost' },
        { label: 'Wyjdź bez zapisu', kind: 'danger-ghost', onClick: () => { location.hash = '#/'; } },
        { label: 'Zakończ i zapisz', kind: 'primary', onClick: () => { finish(); } },
      ],
    });
  }

  async function finish() {
    if (!run || run.finished) return;
    run.finished = true;
    clearTimeout(run.advance);
    clearInterval(run.tick);
    stopSpeaking();

    const cfg = run.cfg;
    let duration = (Date.now() - run.start) / 1000;
    if (cfg.mode === 'challenge') duration = Math.min(duration, cfg.seconds);
    const total = run.answers.length;
    if (!total) { location.hash = '#/'; return; }
    sWIN();

    const session = {
      date: Date.now(), listId: cfg.listId || null, listName: cfg.listName || 'Quiz',
      mode: cfg.mode, type: cfg.type, direction: cfg.direction,
      total, score: run.score, duration: Math.round(duration), answers: run.answers,
    };
    renderSummary(session, null);
    const mine = run;
    if (!mine.saved) {
      mine.saved = true;
      try {
        const id = await store.saveSession(session, mine.answers.map((a) => ({ wid: a.wid, ok: a.ok })));
        // Nie nadpisuj ekranu, jeśli użytkownik zdążył już zacząć kolejny quiz albo wyjść.
        if (!destroyed && run === mine) renderSummary(session, id);
      } catch (e) {
        toast('Nie udało się zapisać wyniku: ' + (e.message || e), 'error', 6000);
      }
    }
  }

  function renderSummary(session, savedId) {
    const percent = pct(session.score, session.total);
    const wrong = session.answers.filter((a) => !a.ok);
    const wrongIds = [...new Set(wrong.map((a) => a.wid))];
    el.innerHTML = `
    <section class="page summary">
      <div class="card summary-card">
        ${scoreRing(percent, 'lg')}
        <h1>${esc(scoreMessage(percent))}</h1>
        <p class="muted">${session.score} z ${session.total} poprawnych · ${fmtTime(session.duration)} · ${esc(session.listName)}</p>
        <div class="row center">
          <button class="btn btn-primary" id="sAgain">${icon('repeat', 18)} Jeszcze raz</button>
          ${wrongIds.length ? `<button class="btn btn-ghost" id="sWrong">${icon('target', 18)} Powtórz błędne (${wrongIds.length})</button>` : ''}
          <a class="btn btn-ghost" href="#/">Wróć na start</a>
        </div>
        <p class="muted small">${savedId ? `Wynik zapisany w <a class="link" href="#/history/${esc(savedId)}">historii</a>.` : 'Zapisuję wynik…'}</p>
      </div>
      <div class="section-head"><h2>Odpowiedzi</h2>
        <div class="seg" role="radiogroup" id="sFilter">
          <button type="button" class="active" data-f="all">Wszystkie</button>
          <button type="button" data-f="bad">Błędy (${wrong.length})</button>
        </div></div>
      <ul class="ans-list" id="sList">${answerRows(session.answers)}</ul>
    </section>`;
    window.scrollTo({ top: 0 });

    el.querySelector('#sAgain').addEventListener('click', () => { begin(run.cfg); });
    el.querySelector('#sWrong')?.addEventListener('click', () => {
      begin({ listId: null, wordIds: wrongIds, listName: 'Błędy z ostatniego quizu', mode: 'standard', type: run.cfg.type, direction: run.cfg.direction, count: 'all', seconds: 0 });
    });
    el.querySelector('#sFilter').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      el.querySelectorAll('#sFilter button').forEach((x) => x.classList.toggle('active', x === b));
      el.querySelector('#sList').innerHTML = answerRows(b.dataset.f === 'bad' ? wrong : session.answers);
    });
  }

  begin(initial);

  return {
    destroy() {
      destroyed = true;
      document.removeEventListener('keydown', onKey);
      if (run) { clearTimeout(run.advance); clearInterval(run.tick); }
      stopSpeaking();
    },
  };
}
