// Minimal localStorage stub so page modules (which read theme/lang prefs from
// localStorage at module scope via src/core/store.js) can be imported in the
// default Node test environment — we only test their exported pure functions,
// never actually touch storage/DOM, so an in-memory Map is enough.
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map()
  globalThis.localStorage = {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: k => mem.delete(k),
    clear: () => mem.clear(),
  }
}
