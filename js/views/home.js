// Ekran startowy: statystyki, szybka powtórka i konfiguracja nowego quizu.
import { esc, plural, fmtDate, fmtTime } from '../util.js';
import { icon, seg, bindSegs, toast, isTyping } from '../ui.js';
import * as store from '../store.js';
import { setLaunch, takePreselect } from '../launch.js';
import { STARTER_WORDS, STARTER_NAME } from '../starter.js';
import { parseDuration } from '../quiz.js';
import { scoreRing, accuracyOf, DIR_LABEL, MODE_LABEL, TYPE_LABEL } from './shared.js';

const COUNTS = ['10', '20', '30', '50', 'all'];

export function mount(el) {
  const draft = { ...store.state.prefs.quiz };
  const pre = takePreselect();
  if (pre) draft.listId = pre;

  function launch(cfg) {
    setLaunch(cfg);
    location.hash = '#/quiz';
  }

  function render() {
    const s = store.state;
    const st = store.stats();
    const name = s.user.name || s.user.email.split('@')[0];
    const lists = [...store.VIRTUAL_LISTS, ...s.lists];
    if (!lists.some((l) => l.id === draft.listId)) draft.listId = 'all';
    const poolSize = store.poolFor(draft.listId).length;
    const recent = s.sessions.slice(0, 3);

    const sub = !st.words
      ? 'Zacznij od dodania pierwszych słówek.'
      : st.due
        ? `Na dziś czeka ${st.due} ${plural(st.due, 'słówko', 'słówka', 'słówek')}.`
        : 'Wszystko powtórzone. Świetna robota!';

    el.innerHTML = `
    <section class="page home">
      <div class="page-head">
        <div><h1>Cześć, ${esc(name)} 👋</h1><p class="muted">${sub}</p></div>
      </div>

      <div class="stats">
        <div class="stat"><span class="stat-ico t1">${icon('book', 18)}</span><div class="stat-num">${st.words}</div><div class="stat-lab">${plural(st.words, 'słówko', 'słówka', 'słówek')} w bazie</div></div>
        <div class="stat"><span class="stat-ico t2">${icon('repeat', 18)}</span><div class="stat-num">${st.due}</div><div class="stat-lab">na dziś</div></div>
        <div class="stat"><span class="stat-ico t3">${icon('flame', 18)}</span><div class="stat-num">${st.streak}</div><div class="stat-lab">${plural(st.streak, 'dzień', 'dni', 'dni')} z rzędu</div></div>
        <div class="stat"><span class="stat-ico t4">${icon('target', 18)}</span><div class="stat-num">${st.accuracy === null ? '—' : st.accuracy + '%'}</div><div class="stat-lab">skuteczność (10 ostatnich)</div></div>
      </div>

      ${!st.words ? `
      <div class="card empty-card">
        <div class="empty-emoji">📚</div>
        <h2>Twoja baza jest jeszcze pusta</h2>
        <p class="muted">Dodaj własne słówka (z podpowiedzią tłumaczenia), zaimportuj plik CSV albo wczytaj mały zestaw na próbę.</p>
        <div class="row center">
          <a class="btn btn-primary" href="#/words">${icon('plus', 18)} Dodaj słówka</a>
          <button class="btn btn-ghost" id="btnStarter">${icon('sparkles', 18)} Wczytaj przykładowe (${STARTER_WORDS.length})</button>
        </div>
      </div>` : `
      ${st.due ? `
      <div class="card cta">
        <div><h2>Powtórka na dziś</h2><p>${st.due} ${plural(st.due, 'słówko', 'słówka', 'słówek')} gotowych do powtórzenia. Krótka sesja robi największą różnicę.</p></div>
        <button class="btn btn-light btn-lg" id="btnQuick">${icon('play', 18)} Zacznij powtórkę</button>
      </div>` : ''}

      <form class="card setup" id="setup">
        <h2>Nowy quiz</h2>
        <div class="field">
          <label for="fList">Zestaw słówek</label>
          <select id="fList" class="select">${lists.map((l) => `<option value="${esc(l.id)}" ${l.id === draft.listId ? 'selected' : ''}>${esc(l.name)} (${store.poolFor(l.id).length})</option>`).join('')}</select>
        </div>
        <div class="setup-grid">
          <div class="field"><label>Kierunek</label>${seg('direction', [['enpl', 'EN → PL'], ['plen', 'PL → EN'], ['both', 'Oba']], draft.direction)}</div>
          <div class="field"><label>Zadanie</label>${seg('type', [['choice', 'Wybór'], ['spelling', 'Pisanie']], draft.type)}</div>
          <div class="field"><label>Tryb</label>${seg('mode', [['standard', 'Liczba pytań'], ['challenge', 'Na czas']], draft.mode)}</div>
          <div class="field" id="countField"><label for="fCount">Liczba pytań</label>
            <select id="fCount" class="select">${COUNTS.map((c) => `<option value="${c}" ${c === String(draft.count) ? 'selected' : ''}>${c === 'all' ? 'Wszystkie' : c}</option>`).join('')}</select></div>
          <div class="field" id="timeField"><label for="fTime">Czas (mm:ss)</label>
            <div class="row tight"><input id="fTime" class="input narrow" type="text" inputmode="numeric" value="${esc(draft.time)}">
              ${['1:00', '3:00', '5:00'].map((t) => `<button type="button" class="chip" data-time="${t}">${t}</button>`).join('')}</div></div>
        </div>
        <div class="setup-foot">
          <span class="muted" id="poolInfo"></span>
          <button class="btn btn-primary btn-lg" type="submit">${icon('play', 18)} Start</button>
        </div>
      </form>`}

      ${recent.length ? `
      <div class="section-head"><h2>Ostatnie sesje</h2><a class="link" href="#/history">Zobacz wszystkie ${icon('right', 16)}</a></div>
      <div class="sess-list">${recent.map(sessionCard).join('')}</div>` : ''}
    </section>`;
    bind();
    syncFields();
  }

  const sessionCard = (x) => {
    const p = accuracyOf(x);
    return `<a class="sess" href="#/history/${esc(x.id)}">
      ${scoreRing(p, 'sm')}
      <div class="sess-main"><div class="sess-title">${esc(x.listName || 'Quiz')}</div>
      <div class="sess-sub">${fmtDate(x.date)} · ${MODE_LABEL[x.mode] || ''} · ${TYPE_LABEL[x.type] || ''}</div></div>
      <div class="sess-score"><b>${x.score}/${x.total}</b><span>${fmtTime(x.duration || 0)}</span></div>${icon('right', 18)}</a>`;
  };

  function syncFields() {
    const f = el.querySelector('#setup');
    if (!f) return;
    el.querySelector('#countField').hidden = draft.mode !== 'standard';
    el.querySelector('#timeField').hidden = draft.mode !== 'challenge';
    const n = store.poolFor(draft.listId).length;
    el.querySelector('#poolInfo').textContent = `${n} ${plural(n, 'słówko', 'słówka', 'słówek')} w zestawie`;
  }

  function bind() {
    el.querySelector('#btnStarter')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      const r = await store.importWords(STARTER_WORDS, { newListName: STARTER_NAME });
      toast(`Dodano ${r.added} słówek do listy „${STARTER_NAME}”.`, 'success');
    });

    el.querySelector('#btnQuick')?.addEventListener('click', () => {
      launch({ listId: 'due', listName: store.listLabel('due'), mode: 'standard', type: draft.type, direction: draft.direction, count: '20', seconds: 0 });
    });

    const form = el.querySelector('#setup');
    if (!form) return;
    form.querySelector('#fList').addEventListener('change', (e) => { draft.listId = e.target.value; syncFields(); });
    form.querySelector('#fCount').addEventListener('change', (e) => { draft.count = e.target.value; });
    form.querySelector('#fTime').addEventListener('input', (e) => { draft.time = e.target.value; });
    form.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => {
      form.querySelector('#fTime').value = b.dataset.time;
      draft.time = b.dataset.time;
    }));
    bindSegs(form, (name, v) => { draft[name] = v; syncFields(); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const pool = store.poolFor(draft.listId);
      if (!pool.length) return toast('Ten zestaw jest pusty. Wybierz inny albo dodaj słówka.', 'error');
      if (draft.type === 'choice' && store.state.words.length < 2) return toast('Do quizu z wyborem potrzebujesz co najmniej 2 słówek.', 'error');
      const seconds = parseDuration(draft.time, 60);
      draft.time = fmtTime(seconds);
      store.savePrefs({ quiz: { ...draft } });
      launch({ listId: draft.listId, listName: store.listLabel(draft.listId), mode: draft.mode, type: draft.type, direction: draft.direction, count: draft.count, seconds });
    });
  }

  render();
  return {
    update() { if (!isTyping(el)) render(); },
    destroy() {},
  };
}
