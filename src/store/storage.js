/**
 * store/storage.js — Thin storage adapter.
 *
 * Local-first now. When PLATFORM.features.auth = true and Supabase is
 * configured, swap the adapter below without changing any consumer.
 *
 * Interface every adapter must implement:
 *   get(key)         → value | null
 *   set(key, value)  → void
 *   remove(key)      → void
 *   clear(prefix)    → void
 */

const LocalAdapter = {
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch {}
  },
  clear(prefix) {
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => localStorage.removeItem(k));
  },
};

/**
 * SupabaseAdapter (future — fill in when auth lands)
 *
 * const SupabaseAdapter = {
 *   async get(key) { ... },
 *   async set(key, value) { ... },
 *   ...
 * };
 */

export const storage = LocalAdapter;
