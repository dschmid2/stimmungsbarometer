import { describe, expect, it } from 'vitest';
import { dayRange, groupBy, moodIndex, toCsv, total } from './stats';
import type { StatRow } from './api';

const rows: StatRow[] = [
  { day: '2026-11-20', hour: 9, terminal_id: 't1', question_id: 'q1', neg: 1, neu: 2, pos: 7 },
  { day: '2026-11-20', hour: 12, terminal_id: 't2', question_id: 'q1', neg: 4, neu: 0, pos: 1 },
  { day: '2026-11-21', hour: 9, terminal_id: 't1', question_id: 'q2', neg: 0, neu: 1, pos: 0 },
];

describe('Auswertung', () => {
  it('zählt alle Stimmen zusammen', () => {
    expect(total(rows)).toEqual([5, 3, 8]);
  });
  it('berechnet den Stimmungsindex', () => {
    expect(moodIndex([5, 3, 8])).toBe(19);
    expect(moodIndex([0, 0, 4])).toBe(100);
    expect(moodIndex([0, 0, 0])).toBeNull();
  });
  it('gruppiert nach Terminal', () => {
    const g = groupBy(rows, (r) => r.terminal_id ?? '');
    expect(g.get('t1')).toEqual([1, 3, 7]);
    expect(g.get('t2')).toEqual([4, 0, 1]);
  });
  it('liefert lückenlose Tage, auch über den Monatswechsel', () => {
    expect(dayRange('2026-11-29', '2026-12-02')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
  });
  it('erzeugt CSV mit Semikolon und maskierten Anführungszeichen', () => {
    const csv = toCsv(rows.slice(0, 1), () => 'Wie "geht" es?', () => 'Kantine');
    expect(csv.split('\n')[1]).toBe('2026-11-20;09;"Kantine";"Wie ""geht"" es?";1;2;7');
  });
});
