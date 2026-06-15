// Token storage in IndexedDB (NOT localStorage — off-limits in some sandboxed
// preview contexts; §3.8/§3.9). Tiny key/value wrapper.
const DB_NAME = 'marginalia';
const STORE = 'kv';
const TOKEN_KEY = 'app_token';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export async function getToken(): Promise<string | null> {
  const v = await withStore<string | undefined>('readonly', (s) => s.get(TOKEN_KEY));
  return v ?? null;
}

export async function setToken(token: string): Promise<void> {
  await withStore('readwrite', (s) => s.put(token, TOKEN_KEY));
}

export async function clearToken(): Promise<void> {
  await withStore('readwrite', (s) => s.delete(TOKEN_KEY));
}
