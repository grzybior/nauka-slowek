// Backend oparty o Firebase Authentication + Cloud Firestore (SDK z CDN, bez budowania projektu).
// Dane użytkownika leżą pod users/{uid}/{lists|words|sessions|settings}.

const VERSION = '10.14.1';
const CDN = `https://www.gstatic.com/firebasejs/${VERSION}/`;

const AUTH_ERRORS = {
  'auth/invalid-email': 'Nieprawidłowy adres e-mail.',
  'auth/missing-email': 'Podaj adres e-mail.',
  'auth/user-not-found': 'Nieprawidłowy e-mail lub hasło.',
  'auth/wrong-password': 'Nieprawidłowy e-mail lub hasło.',
  'auth/invalid-credential': 'Nieprawidłowy e-mail lub hasło.',
  'auth/invalid-login-credentials': 'Nieprawidłowy e-mail lub hasło.',
  'auth/missing-password': 'Podaj hasło.',
  'auth/email-already-in-use': 'Konto z tym adresem już istnieje.',
  'auth/weak-password': 'Hasło jest za słabe (minimum 6 znaków).',
  'auth/too-many-requests': 'Zbyt wiele prób. Spróbuj ponownie za chwilę.',
  'auth/network-request-failed': 'Brak połączenia z internetem.',
  'auth/requires-recent-login': 'Ze względów bezpieczeństwa zaloguj się ponownie i spróbuj jeszcze raz.',
  'auth/user-disabled': 'To konto zostało zablokowane.',
  'auth/operation-not-allowed': 'Logowanie e-mailem i hasłem nie jest włączone w Firebase (zobacz README, krok 2).',
  'auth/configuration-not-found': 'Firebase Authentication nie jest uruchomione dla tego projektu (zobacz README, krok 2).',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Nieprawidłowy klucz API w firebase-config.js.',
  'auth/invalid-api-key': 'Nieprawidłowy klucz API w firebase-config.js.',
  'auth/unauthorized-domain': 'Ta domena nie jest dodana w Firebase (Authentication → Settings → Authorized domains). Zobacz README, krok 6.',
};

function friendly(e, ctx) {
  const code = e?.code || '';
  if (ctx === 'change' && /wrong-password|invalid-credential|invalid-login/.test(code)) {
    return new Error('Obecne hasło jest nieprawidłowe.');
  }
  return new Error(AUTH_ERRORS[code] || `Coś poszło nie tak (${code || e?.message || 'nieznany błąd'}).`);
}

export async function createBackend(config) {
  const [appM, authM, fs] = await Promise.all([
    import(CDN + 'firebase-app.js'),
    import(CDN + 'firebase-auth.js'),
    import(CDN + 'firebase-firestore.js'),
  ]);

  const app = appM.initializeApp(config);
  const auth = authM.getAuth(app);
  auth.languageCode = 'pl'; // maile resetujące hasło po polsku

  let db;
  try {
    // Trwały cache: aplikacja działa offline, a zapisy synchronizują się po powrocie sieci.
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch {
    db = fs.getFirestore(app);
  }

  let onWriteError = null;
  const guard = (p) => p.catch((e) => onWriteError?.(e));
  const col = (uid, coll) => fs.collection(db, 'users', uid, coll);
  const ref = (uid, coll, id) => fs.doc(db, 'users', uid, coll, id);
  const toUser = (u) => ({ uid: u.uid, email: u.email || '', name: u.displayName || '' });

  return {
    mode: 'firebase',
    setWriteErrorHandler(fn) { onWriteError = fn; },

    onAuth(cb) { return authM.onAuthStateChanged(auth, (u) => cb(u ? toUser(u) : null)); },

    async signUp(email, password, name) {
      try {
        const cred = await authM.createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name) await authM.updateProfile(cred.user, { displayName: name });
        return toUser(cred.user);
      } catch (e) { throw friendly(e); }
    },
    async signIn(email, password) {
      try {
        const cred = await authM.signInWithEmailAndPassword(auth, email.trim(), password);
        return toUser(cred.user);
      } catch (e) { throw friendly(e); }
    },
    signOut() { return authM.signOut(auth); },
    async resetPassword(email) {
      try { await authM.sendPasswordResetEmail(auth, email.trim()); } catch (e) { throw friendly(e); }
    },
    async changePassword(current, next) {
      const user = auth.currentUser;
      if (!user) throw new Error('Nie jesteś zalogowany.');
      try {
        // Zmiana hasła wymaga świeżego logowania, więc najpierw potwierdzamy obecne hasło.
        await authM.reauthenticateWithCredential(user, authM.EmailAuthProvider.credential(user.email, current));
        await authM.updatePassword(user, next);
      } catch (e) { throw friendly(e, 'change'); }
    },
    async updateName(name) {
      try {
        await authM.updateProfile(auth.currentUser, { displayName: name });
        return toUser(auth.currentUser);
      } catch (e) { throw friendly(e); }
    },

    newId(uid, coll) { return fs.doc(col(uid, coll)).id; },
    // Zapisy nie czekają na serwer (działa offline); błędy trafiają do onWriteError.
    set(uid, coll, id, data) { guard(fs.setDoc(ref(uid, coll, id), data, { merge: true })); return Promise.resolve(); },
    update(uid, coll, id, patch) { guard(fs.updateDoc(ref(uid, coll, id), patch)); return Promise.resolve(); },
    remove(uid, coll, id) { guard(fs.deleteDoc(ref(uid, coll, id))); return Promise.resolve(); },
    batch(uid, ops) {
      // Firestore pozwala na 500 operacji w jednej paczce.
      for (let i = 0; i < ops.length; i += 400) {
        const b = fs.writeBatch(db);
        for (const op of ops.slice(i, i + 400)) {
          const r = ref(uid, op.coll, op.id);
          if (op.type === 'delete') b.delete(r);
          else if (op.type === 'update') b.update(r, op.data);
          else b.set(r, op.data, { merge: true });
        }
        guard(b.commit());
      }
      return Promise.resolve();
    },

    watch(uid, coll, cb, opts = {}) {
      const cons = [];
      if (opts.sort) cons.push(fs.orderBy(opts.sort, opts.dir || 'desc'));
      if (opts.limit) cons.push(fs.limit(opts.limit));
      return fs.onSnapshot(
        fs.query(col(uid, coll), ...cons),
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => opts.onError?.(err),
      );
    },
  };
}
