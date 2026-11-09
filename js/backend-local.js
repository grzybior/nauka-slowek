// Tryb DEMO: konta i dane w localStorage tej przeglądarki. Bez synchronizacji, bez resetu hasła mailem.
// Używany, dopóki firebase-config.js jest pusty. Ma ten sam interfejs co backend Firebase.

const NS = 'nauka_demo_';
const read = (k, d) => {
  try { const v = localStorage.getItem(NS + k); return v ? JSON.parse(v) : d; } catch { return d; }
};
const write = (k, v) => localStorage.setItem(NS + k, JSON.stringify(v));
const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

async function hashPw(pw, salt) {
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + pw));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0;
  for (const c of salt + pw) h = (h * 31 + c.charCodeAt(0)) | 0;
  return String(h);
}

export async function createBackend() {
  let authCb = null;
  let current = null;
  let onWriteError = null;
  const watchers = new Set();
  const cache = {};

  const users = () => read('users', {});
  const pub = (email, u) => ({ uid: u.uid, email, name: u.name || '', emailVerified: true });
  const glob = () => (cache.__g ??= read('global', {}));
  const saveGlob = () => write('global', glob());
  const db = (u) => (cache[u] ??= read('data_' + u, {}));
  const save = (u) => {
    try { write('data_' + u, cache[u]); } catch (e) { onWriteError?.(e); }
  };

  function snapshot(u, coll, o = {}) {
    let docs = Object.entries(db(u)[coll] || {}).map(([id, d]) => ({ id, ...d }));
    if (o.sort) {
      const dir = o.dir === 'asc' ? 1 : -1;
      docs.sort((a, b) => (a[o.sort] > b[o.sort] ? 1 : a[o.sort] < b[o.sort] ? -1 : 0) * dir);
    }
    if (o.limit) docs = docs.slice(0, o.limit);
    return structuredClone(docs);
  }
  const notify = (u, coll) => watchers.forEach((w) => { if (w.u === u && w.coll === coll) w.cb(snapshot(u, coll, w.o)); });

  function apply(u, op) {
    const c = (db(u)[op.coll] ??= {});
    if (op.type === 'delete') delete c[op.id];
    else if (op.type === 'update') {
      if (!c[op.id]) throw new Error('Dokument nie istnieje');
      Object.assign(c[op.id], structuredClone(op.data));
    } else c[op.id] = { ...(c[op.id] || {}), ...structuredClone(op.data) };
  }

  return {
    mode: 'local',
    setWriteErrorHandler(fn) { onWriteError = fn; },

    onAuth(cb) {
      authCb = cb;
      const email = read('session', null);
      const u = email && users()[email];
      current = u ? pub(email, u) : null;
      setTimeout(() => cb(current), 0);
    },
    async signUp(email, password, name) {
      email = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Nieprawidłowy adres e-mail.');
      if (password.length < 6) throw new Error('Hasło jest za słabe (minimum 6 znaków).');
      const us = users();
      if (us[email]) throw new Error('Konto z tym adresem już istnieje.');
      const salt = rid();
      const first = !Object.keys(us).length;
      us[email] = { uid: rid(), name: name || '', salt, hash: await hashPw(password, salt) };
      write('users', us);
      if (first) { (glob().admins ??= {})[us[email].uid] = { demo: true }; saveGlob(); } // w demo pierwszy użytkownik jest administratorem
      write('session', email);
      current = pub(email, us[email]);
      authCb(current);
      return current;
    },
    async signIn(email, password) {
      email = email.trim().toLowerCase();
      const u = users()[email];
      if (!u || (await hashPw(password, u.salt)) !== u.hash) throw new Error('Nieprawidłowy e-mail lub hasło.');
      write('session', email);
      current = pub(email, u);
      authCb(current);
      return current;
    },
    async sendVerification() { /* w trybie demo konto nie wymaga potwierdzenia */ },
    async refreshUser() { return current; },

    // Dokumenty globalne (profiles/config/admins/messages) oraz users/{uid}/{coll}/{id} w tym samym stylu co Firestore.
    async getDocAt(path) {
      const [a, b, c, d] = path.split('/');
      const v = a === 'users' ? db(b)[c]?.[d] : glob()[a]?.[b];
      return v ? { id: d || b, ...structuredClone(v) } : null;
    },
    async setDocAt(path, data, { merge = true } = {}) {
      const [a, b, c, d] = path.split('/');
      if (a === 'users') { (db(b)[c] ??= {})[d] = { ...(merge ? db(b)[c][d] : {}), ...structuredClone(data) }; save(b); return; }
      const g = glob();
      (g[a] ??= {})[b] = { ...(merge ? g[a][b] : {}), ...structuredClone(data) };
      saveGlob();
    },
    async deleteAt(path) {
      const [a, b, c, d] = path.split('/');
      if (a === 'users') { delete db(b)[c]?.[d]; save(b); notify(b, c); return; }
      delete glob()[a]?.[b];
      saveGlob();
    },
    async listAt(path, { limit = 500 } = {}) {
      const [a, b, c] = path.split('/');
      const src = a === 'users' ? db(b)[c] : glob()[a];
      return Object.entries(src || {}).slice(0, limit).map(([id, d]) => ({ id, ...structuredClone(d) }));
    },
    async signOut() {
      write('session', null);
      current = null;
      authCb(null);
    },
    async resetPassword() { throw new Error('W trybie demo nie da się zresetować hasła mailem. Skonfiguruj Firebase (README).'); },
    async changePassword(cur, next) {
      const us = users();
      const u = us[current.email];
      if ((await hashPw(cur, u.salt)) !== u.hash) throw new Error('Obecne hasło jest nieprawidłowe.');
      if (next.length < 6) throw new Error('Hasło jest za słabe (minimum 6 znaków).');
      u.salt = rid();
      u.hash = await hashPw(next, u.salt);
      write('users', us);
    },
    async updateName(name) {
      const us = users();
      us[current.email].name = name;
      write('users', us);
      current = { ...current, name };
      return current;
    },

    newId() { return rid(); },
    set(u, coll, id, data) { apply(u, { type: 'set', coll, id, data }); save(u); notify(u, coll); return Promise.resolve(); },
    update(u, coll, id, data) { apply(u, { type: 'update', coll, id, data }); save(u); notify(u, coll); return Promise.resolve(); },
    remove(u, coll, id) { apply(u, { type: 'delete', coll, id }); save(u); notify(u, coll); return Promise.resolve(); },
    batch(u, ops) {
      ops.forEach((op) => apply(u, op));
      save(u);
      [...new Set(ops.map((o) => o.coll))].forEach((c) => notify(u, c));
      return Promise.resolve();
    },
    watch(u, coll, cb, o = {}) {
      const w = { u, coll, cb, o };
      watchers.add(w);
      setTimeout(() => { if (watchers.has(w)) cb(snapshot(u, coll, o)); }, 0);
      return () => watchers.delete(w);
    },
  };
}
