import { describe, expect, it } from 'vitest';
import { flushQueue, type PendingVote } from './voteQueue';

const q: PendingVote[] = [
  { id: 'a', question: 'q', value: 2, at: '2026-11-24T08:00:00Z' },
  { id: 'b', question: 'q', value: 0, at: '2026-11-24T08:01:00Z' },
  { id: 'c', question: 'q', value: 1, at: '2026-11-24T08:02:00Z' },
];

describe('Offline-Warteschlange', () => {
  it('entfernt gesendete und abgelehnte Stimmen', async () => {
    const r = await flushQueue(q, async (v) => (v.id === 'b' ? 'drop' : 'ok'));
    expect(r.queue).toEqual([]);
  });
  it('bricht bei Netzproblem ab und behält den Rest in Reihenfolge', async () => {
    const r = await flushQueue(q, async (v) => (v.id === 'b' ? 'retry' : 'ok'));
    expect(r.queue.map((v) => v.id)).toEqual(['b', 'c']);
  });
  it('hält bei gesperrtem Terminal an', async () => {
    const r = await flushQueue(q, async () => 'revoked');
    expect(r.revoked).toBe(true);
    expect(r.queue).toHaveLength(3);
  });
});
