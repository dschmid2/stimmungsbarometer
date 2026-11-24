import { useCallback, useEffect, useRef, useState } from 'react';

/** Lädt Daten, liefert Lade- und Fehlerzustand und eine Funktion zum Neuladen. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[], refreshMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fn = useRef(load);
  fn.current = load;

  const reload = useCallback(async () => {
    try {
      setData(await fn.current());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    reload();
    if (!refreshMs) return;
    const t = setInterval(reload, refreshMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload, setData };
}

/** Führt eine Aktion aus und merkt sich Fehler und "läuft gerade". */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (f: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await f(); return true; } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  }, []);
  return { busy, error, run, setError };
}
