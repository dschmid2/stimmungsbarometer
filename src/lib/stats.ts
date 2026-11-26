import type { StatRow } from './api';

export type Triple = [number, number, number];

/** Mindestanzahl Antworten, ab der Ergebnisse gezeigt werden (Anonymitätsschutz). */
export const MIN_GROUP = 5;

export const sum = (c: Triple) => c[0] + c[1] + c[2];
export const add = (a: Triple, b: Triple): Triple => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const triple = (r: StatRow): Triple => [Number(r.neg), Number(r.neu), Number(r.pos)];

/** Stimmungsindex: Anteil positiv minus Anteil negativ, von −100 bis +100. */
export function moodIndex(c: Triple): number | null {
  const t = sum(c);
  return t ? Math.round(((c[2] - c[0]) / t) * 100) : null;
}

export function total(rows: StatRow[]): Triple {
  return rows.reduce<Triple>((acc, r) => add(acc, triple(r)), [0, 0, 0]);
}

export function groupBy(rows: StatRow[], key: (r: StatRow) => string): Map<string, Triple> {
  const m = new Map<string, Triple>();
  for (const r of rows) m.set(key(r), add(m.get(key(r)) ?? [0, 0, 0], triple(r)));
  return m;
}

/** Alle Tage von from bis to (YYYY-MM-DD, beide inklusive). */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + 'T12:00:00Z');
  const end = new Date(to + 'T12:00:00Z');
  while (d <= end) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysAgo(n: number, now = new Date()): string {
  const d = new Date(now); d.setDate(d.getDate() - n); return isoDay(d);
}

export function toCsv(rows: StatRow[], questionText: (id: string) => string, terminalName: (id: string | null) => string): string {
  const esc = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  const lines = ['Datum;Stunde;Standort;Frage;negativ;neutral;positiv'];
  [...rows].sort((a, b) => (a.day + a.hour).localeCompare(b.day + b.hour)).forEach((r) =>
    lines.push([r.day, String(r.hour).padStart(2, '0'), esc(terminalName(r.terminal_id)), esc(questionText(r.question_id)),
      r.neg, r.neu, r.pos].join(';')));
  return lines.join('\n');
}
