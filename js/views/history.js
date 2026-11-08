// Historia: lista sesji z wykresem, najtrudniejsze słówka oraz szczegóły sesji z popełnionymi błędami.
import { esc, plural, fmtDate, fmtTime, pct } from '../util.js';
import { icon, speakBtn, toast, confirmDialog } from '../ui.js';
import { setLaunch, setPreselect } from '../launch.js';
import * as store from '../store.js';
import { answerRows, scoreRing, toneOf, accuracyOf, DIR_LABEL, MODE_LABEL, TYPE_LABEL } from './shared.js';

export function mount(el, ctx) {
  const id = ctx.params.id;
  let filter = 'all';

  const sessionRow = (x) => {
    const p = accuracyOf(x);
    const errs = x.total - x.score;
    return `<a class="sess" href="#/history/${esc(x.id)}">
      ${scoreRing(p, 'sm')}
      <div class="sess-main">
        <div class="sess-title">${esc(x.listName || 'Quiz')}</div>
        <div class="sess-sub">${fmtDate(x.date)} · ${MODE_LABEL[x.mode] || ''} · ${TYPE_LABEL[x.type] || ''} · ${DIR_LABEL[x.direction] || ''}</div>
      </div>
      <div class="sess-score"><b>${x.score}/${x.total}</b><span>${errs ? `${errs} ${plural(errs, 'błąd', 'błędy', 'błędów')}` : 'bez błędów'} · ${fmtTime(x.duration || 0)}</span></div>
      ${icon('right', 18)}</a>`;
  };

  function renderList() {
    const s = store.state;
    const sessions = s.sessions;
    const st = store.stats();
    const answered = sessions.reduce((n, x) => n + (x.total || 0), 0);
    const good = sessions.reduce((n, x) => n + (x.score || 0), 0);
    const recent = sessions.slice(0, 20).reverse();
    const hard = s.words.filter((w) => (w.wrong || 0) > 0).sort((a, b) => (b.wrong || 0) - (a.wrong || 0)).slice(0, 8);

    el.innerHTML = `
    <section class="page">
      <div class="page-head"><h1>Historia</h1></div>
      ${!sessions.length ? `
        <div class="card empty-card"><div class="empty-emoji">📈</div><h2>Brak sesji</h2>
        <p class="muted">Gdy ukończysz pierwszy quiz, pojawi się tutaj z listą wszystkich błędów.</p>
        <a class="btn btn-primary" href="#/">Zacznij quiz</a></div>` : `
      <div class="stats">
        <div class="stat"><span class="stat-ico t1">${icon('history', 18)}</span><div class="stat-num">${sessions.length}</div><div class="stat-lab">${plural(sessions.length, 'sesja', 'sesje', 'sesji')}</div></div>
        <div class="stat"><span class="stat-ico t2">${icon('check', 18)}</span><div class="stat-num">${answered}</div><div class="stat-lab">${plural(answered, 'odpowiedź', 'odpowiedzi', 'odpowiedzi')}</div></div>
        <div class="stat"><span class="stat-ico t4">${icon('target', 18)}</span><div class="stat-num">${pct(good, answered)}%</div><div class="stat-lab">skuteczność ogółem</div></div>
        <div class="stat"><span class="stat-ico t3">${icon('flame', 18)}</span><div class="stat-num">${st.streak}</div><div class="stat-lab">${plural(st.streak, 'dzień', 'dni', 'dni')} z rzędu</div></div>
      </div>

      <div class="card">
        <h2>Skuteczność ostatnich sesji</h2>
        <div class="bars" role="img" aria-label="Wykres skuteczności ostatnich ${recent.length} sesji">
          ${recent.map((x) => { const p = accuracyOf(x); return `<a class="bar ${toneOf(p)}" href="#/history/${esc(x.id)}" style="--h:${Math.max(p, 4)}%" title="${esc(fmtDate(x.date))}: ${p}% (${x.score}/${x.total})"><span>${p}</span></a>`; }).join('')}
        </div>
      </div>

      ${hard.length ? `
      <div class="card">
        <div class="section-head tight"><h2>Najtrudniejsze słówka</h2><button class="btn btn-ghost btn-sm" id="btnHard">${icon('target', 16)} Ćwicz trudne</button></div>
        <ul class="hard-list">${hard.map((w) => `<li><span class="w-en">${esc(w.en)}${speakBtn(w.en)}</span><span class="muted">${esc(w.pl)}</span><span class="tag bad">${w.wrong} ${plural(w.wrong, 'błąd', 'błędy', 'błędów')}</span></li>`).join('')}</ul>
      </div>` : ''}

      <div class="section-head"><h2>Wszystkie sesje</h2></div>
      <div class="sess-list">${sessions.map(sessionRow).join('')}</div>
      ${sessions.length >= 100 ? '<p class="muted small center">Pokazuję 100 ostatnich sesji.</p>' : ''}`}
    </section>`;

    el.querySelector('#btnHard')?.addEventListener('click', () => { setPreselect('hard'); location.hash = '#/'; });
  }

  function renderDetail() {
    const s = store.state.sessions.find((x) => x.id === id);
    if (!s) {
      el.innerHTML = `<section class="page"><a class="link back" href="#/history">${icon('left', 16)} Historia</a>
        <div class="card empty-card"><h2>Nie znaleziono sesji</h2><p class="muted">Mogła zostać usunięta albo jest starsza niż 100 ostatnich.</p></div></section>`;
      return;
    }
    const percent = accuracyOf(s);
    const answers = s.answers || [];
    const wrong = answers.filter((a) => !a.ok);
    const shown = filter === 'bad' ? wrong : answers;

    el.innerHTML = `
    <section class="page">
      <a class="link back" href="#/history">${icon('left', 16)} Historia</a>
      <div class="card detail-head">
        ${scoreRing(percent, 'lg')}
        <div class="detail-info">
          <h1>${esc(s.listName || 'Quiz')}</h1>
          <p class="muted">${fmtDate(s.date)}</p>
          <div class="tags">
            <span class="tag">${MODE_LABEL[s.mode] || ''}</span><span class="tag">${TYPE_LABEL[s.type] || ''}</span><span class="tag">${DIR_LABEL[s.direction] || ''}</span>
            <span class="tag">${icon('clock', 12)} ${fmtTime(s.duration || 0)}</span>
          </div>
          <p class="detail-score"><b>${s.score}</b> z ${s.total} poprawnych, <b class="${wrong.length ? 'bad-text' : 'ok-text'}">${wrong.length}</b> ${plural(wrong.length, 'błąd', 'błędy', 'błędów')}</p>
          <div class="row">
            ${wrong.length ? `<button class="btn btn-primary" id="btnRetry">${icon('target', 18)} Ćwicz błędne (${new Set(wrong.map((a) => a.wid)).size})</button>` : ''}
            <button class="btn btn-danger-ghost" id="btnDelete">${icon('trash', 18)} Usuń sesję</button>
          </div>
        </div>
      </div>
      <div class="section-head"><h2>Odpowiedzi</h2>
        <div class="seg" role="radiogroup" id="fSeg">
          <button type="button" data-f="all" class="${filter === 'all' ? 'active' : ''}">Wszystkie (${answers.length})</button>
          <button type="button" data-f="bad" class="${filter === 'bad' ? 'active' : ''}">Błędy (${wrong.length})</button>
        </div></div>
      <ul class="ans-list">${shown.length ? answerRows(shown) : '<li class="empty">Brak błędów w tej sesji. 🎉</li>'}</ul>
    </section>`;

    el.querySelector('#fSeg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) { filter = b.dataset.f; renderDetail(); }
    });
    el.querySelector('#btnRetry')?.addEventListener('click', () => {
      const ids = new Set(wrong.map((a) => a.wid));
      const existing = store.state.words.filter((w) => ids.has(w.id)).map((w) => w.id);
      if (!existing.length) return toast('Te słówka zostały już usunięte z bazy.', 'info');
      setLaunch({ listId: null, wordIds: existing, listName: 'Błędy z sesji', mode: 'standard', type: s.type || 'choice', direction: s.direction || 'both', count: 'all', seconds: 0 });
      location.hash = '#/quiz';
    });
    el.querySelector('#btnDelete')?.addEventListener('click', async () => {
      if (await confirmDialog({ title: 'Usunąć sesję?', text: 'Wpis zniknie z historii. Statystyki słówek (powtórki) pozostaną.', confirmLabel: 'Usuń', danger: true })) {
        location.hash = '#/history';
        store.deleteSession(id);
        toast('Sesję usunięto.', 'success');
      }
    });
  }

  const render = () => (id ? renderDetail() : renderList());
  render();
  return { update: render, destroy() {} };
}
