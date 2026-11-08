// Wybiera backend: Firebase (gdy skonfigurowany) albo tryb demo w localStorage.
// Oba backendy mają ten sam interfejs:
//   mode, onAuth(cb), signUp, signIn, signOut, changePassword, resetPassword, updateName,
//   newId(uid, coll), set(uid, coll, id, data), update(uid, coll, id, patch), remove(uid, coll, id),
//   batch(uid, ops), watch(uid, coll, cb, opts) -> unsubscribe, setWriteErrorHandler(fn)
import { firebaseConfig, isConfigured } from './firebase-config.js';

export async function loadBackend() {
  if (isConfigured()) {
    const m = await import('./backend-firebase.js');
    return m.createBackend(firebaseConfig);
  }
  const m = await import('./backend-local.js');
  return m.createBackend();
}
