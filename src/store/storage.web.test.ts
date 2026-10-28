/**
 * Exercises the web persistence adapter against a minimal in-memory fake of the IndexedDB API
 * (only what storage.web.ts uses) and a Map-backed localStorage.
 */
type Handler = (() => void) | null;
type FakeRequest = { result?: unknown; error: unknown; onsuccess: Handler; onerror: Handler; onupgradeneeded?: Handler };

function fakeIndexedDB() {
  const data = new Map<string, unknown>();
  let created = false;
  const succeed = (req: FakeRequest, result: unknown) =>
    setTimeout(() => { req.result = result; req.onsuccess?.(); });
  const db = {
    createObjectStore: () => { created = true; },
    transaction: () => {
      const tx = { oncomplete: null as Handler, onerror: null as Handler, onabort: null as Handler, error: null, objectStore: () => store };
      const finish = () => setTimeout(() => tx.oncomplete?.());
      const store = {
        get: (key: string) => { const req: FakeRequest = { error: null, onsuccess: null, onerror: null }; succeed(req, data.get(key)); return req; },
        put: (value: unknown, key: string) => { data.set(key, value); finish(); return {}; },
        delete: (key: string) => { data.delete(key); finish(); return {}; },
      };
      return tx;
    },
  };
  const open = () => {
    const req: FakeRequest = { error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
    setTimeout(() => {
      req.result = db;
      if (!created) req.onupgradeneeded?.();
      req.onsuccess?.();
    });
    return req;
  };
  return { indexedDB: { open }, data };
}

function fakeLocalStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

function setGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

/** Fresh module per test so the cached database promise does not leak between cases. */
function load(): typeof import('./storage.web') {
  let mod!: typeof import('./storage.web');
  jest.isolateModules(() => {
    mod = jest.requireActual<typeof import('./storage.web')>('./storage.web');
  });
  return mod;
}

const KEY = 'gym-buddy-v1';
let ls: ReturnType<typeof fakeLocalStorage>;

beforeEach(() => {
  ls = fakeLocalStorage();
  setGlobal('localStorage', ls);
});

afterAll(() => {
  setGlobal('indexedDB', undefined);
});

describe('web storage adapter (IndexedDB)', () => {
  it('round-trips set, get and remove', async () => {
    const fake = fakeIndexedDB();
    setGlobal('indexedDB', fake.indexedDB);
    const { storage } = load();
    expect(await storage.getItem(KEY)).toBeNull();
    await storage.setItem(KEY, '{"a":1}');
    expect(fake.data.get(KEY)).toBe('{"a":1}');
    expect(await storage.getItem(KEY)).toBe('{"a":1}');
    await storage.removeItem(KEY);
    expect(await storage.getItem(KEY)).toBeNull();
    expect(ls.map.size).toBe(0);
  });

  it('migrates an existing localStorage value once', async () => {
    const fake = fakeIndexedDB();
    setGlobal('indexedDB', fake.indexedDB);
    ls.setItem(KEY, '{"old":true}');
    const { storage } = load();
    expect(await storage.getItem(KEY)).toBe('{"old":true}');
    expect(fake.data.get(KEY)).toBe('{"old":true}');
    expect(ls.getItem(KEY)).toBeNull();
    expect(await storage.getItem(KEY)).toBe('{"old":true}'); // now served from IndexedDB
  });

  it('falls back to localStorage when IndexedDB is unavailable', async () => {
    setGlobal('indexedDB', undefined);
    const { storage } = load();
    await storage.setItem(KEY, 'v');
    expect(ls.getItem(KEY)).toBe('v');
    expect(await storage.getItem(KEY)).toBe('v');
    await storage.removeItem(KEY);
    expect(ls.getItem(KEY)).toBeNull();
  });
});
