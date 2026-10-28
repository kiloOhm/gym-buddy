/**
 * Web persistence backed by IndexedDB instead of localStorage: localStorage is capped at
 * ~5 MB and blocks the main thread, IndexedDB is async with a much larger quota. Builds before
 * this one kept the state in localStorage, so a value found only there is moved over on the
 * first read. Where IndexedDB is unavailable (some private-browsing modes) we fall back to
 * localStorage so the app still works.
 */
import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'gym-buddy';
const STORE = 'kv';

const local: StateStorage = {
  getItem: (name) => {
    try { return globalThis.localStorage?.getItem(name) ?? null; } catch { return null; }
  },
  setItem: (name, value) => {
    try { globalThis.localStorage?.setItem(name, value); } catch {}
  },
  removeItem: (name) => {
    try { globalThis.localStorage?.removeItem(name); } catch {}
  },
};

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function completed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

/** Opens the database once; resolves null (and forgets the failure, so the next call retries) when it can't. */
async function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null;
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    return await dbPromise;
  } catch {
    dbPromise = null;
    return null;
  }
}

async function write(db: IDBDatabase, op: (store: IDBObjectStore) => void): Promise<void> {
  const tx = db.transaction(STORE, 'readwrite');
  op(tx.objectStore(STORE));
  await completed(tx);
}

export const storage: StateStorage = {
  async getItem(name) {
    const db = await openDb();
    if (!db) return local.getItem(name);
    const value = await request<string | undefined>(db.transaction(STORE, 'readonly').objectStore(STORE).get(name));
    if (value != null) return value;
    const legacy = await local.getItem(name); // one-time migration from localStorage
    if (legacy == null) return null;
    await write(db, (s) => s.put(legacy, name));
    await local.removeItem(name);
    return legacy;
  },
  async setItem(name, value) {
    const db = await openDb();
    if (!db) return local.setItem(name, value);
    await write(db, (s) => s.put(value, name));
  },
  async removeItem(name) {
    const db = await openDb();
    if (!db) return local.removeItem(name);
    await write(db, (s) => s.delete(name));
  },
};
