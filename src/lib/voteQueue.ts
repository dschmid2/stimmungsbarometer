import { store } from './storage';

/** Eine Stimme, die noch nicht beim Server angekommen ist. */
export interface PendingVote { id: string; question: string; value: number; at: string }

const KEY = 'sb.terminal.pending';
const MAX = 2000; // Sicherheitsgrenze, falls ein Terminal lange offline ist

export function loadQueue(): PendingVote[] {
  return store.get<PendingVote[]>(KEY, []);
}

export function saveQueue(q: PendingVote[]) {
  store.set(KEY, q.slice(-MAX));
}

export function enqueue(q: PendingVote[], v: Omit<PendingVote, 'id'>): PendingVote[] {
  const next = [...q, { ...v, id: Math.random().toString(36).slice(2) + Date.now().toString(36) }];
  saveQueue(next);
  return next;
}

/**
 * Schickt wartende Stimmen ab. send() liefert:
 *   'ok'      – angekommen, aus der Warteschlange nehmen
 *   'drop'    – vom Server abgelehnt (ungültig), ebenfalls entfernen
 *   'retry'   – Netzproblem, später erneut versuchen (Abbruch der Runde)
 *   'revoked' – Terminal gesperrt, alles anhalten
 */
export async function flushQueue(
  q: PendingVote[],
  send: (v: PendingVote) => Promise<'ok' | 'drop' | 'retry' | 'revoked'>,
): Promise<{ queue: PendingVote[]; revoked: boolean }> {
  let rest = [...q];
  for (const v of q) {
    const r = await send(v);
    if (r === 'retry') break;
    if (r === 'revoked') { saveQueue(rest); return { queue: rest, revoked: true }; }
    rest = rest.filter((x) => x.id !== v.id);
    saveQueue(rest);
  }
  return { queue: rest, revoked: false };
}
