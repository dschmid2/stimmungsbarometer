/** Kleiner, fehlertoleranter Zugriff auf localStorage. */
export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* voll oder gesperrt */ }
  },
  remove(key: string) {
    try { localStorage.removeItem(key); } catch { /* egal */ }
  },
};
