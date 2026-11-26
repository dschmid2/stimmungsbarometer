import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarController, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineController,
  LineElement, PointElement, Tooltip,
} from 'chart.js';
import { Bar, Chart } from 'react-chartjs-2';
import { useOrg } from './OrgLayout';
import { api, type StatRow } from '../../lib/api';
import { useLoad } from '../../components/useLoad';
import { dayRange, daysAgo, groupBy, isoDay, MIN_GROUP, moodIndex, sum, toCsv, total, type Triple } from '../../lib/stats';

ChartJS.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

const COLORS = { neg: '#d2453b', neu: '#e3a12a', pos: '#2f9e63', accent: '#1d5c74' };
const RANGES: Record<string, { label: string; days: number }> = {
  '7': { label: 'Letzte 7 Tage', days: 7 },
  '30': { label: 'Letzte 30 Tage', days: 30 },
  '90': { label: 'Letzte 90 Tage', days: 90 },
  '365': { label: 'Letzte 12 Monate', days: 365 },
};

function Dist({ c }: { c: Triple }) {
  const t = sum(c) || 1;
  return (
    <div className="dist" aria-hidden="true">
      {(['--neg', '--neu', '--pos'] as const).map((v, i) => <span key={v} style={{ width: `${(c[i] / t) * 100}%`, background: `var(${v})` }} />)}
    </div>
  );
}

function IndexPill({ i }: { i: number | null }) {
  if (i == null) return <span className="muted">–</span>;
  const cl = i >= 30 ? 'good' : i >= 0 ? 'mid' : 'bad';
  return <span className={`pill ${cl}`}>{i > 0 ? '+' : ''}{i}</span>;
}

export default function Dashboard() {
  const org = useOrg();
  const [range, setRange] = useState('30');
  const [qFilter, setQFilter] = useState('all');
  const [tFilter, setTFilter] = useState('all');
  const [csv, setCsv] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const from = daysAgo(RANGES[range].days - 1);
  const to = isoDay(new Date());

  const stats = useLoad(() => api.stats(org.id, from, to), [org.id, from, to], 60_000);
  const questions = useLoad(() => api.questions(org.id), [org.id]);
  const terminals = useLoad(() => api.terminals(org.id), [org.id]);

  const qText = (id: string) => questions.data?.find((q) => q.id === id)?.text ?? 'Unbekannte Frage';
  const tName = (id: string | null) => (id && terminals.data?.find((t) => t.id === id)?.name) || 'Entferntes Terminal';

  const rows: StatRow[] = useMemo(
    () => (stats.data ?? []).filter((r) => (qFilter === 'all' || r.question_id === qFilter) && (tFilter === 'all' || r.terminal_id === tFilter)),
    [stats.data, qFilter, tFilter],
  );
  const tot = total(rows);
  const N = sum(tot);
  const idx = moodIndex(tot);
  const days = new Set(rows.map((r) => r.day)).size;

  // Verlauf pro Tag
  const dayList = dayRange(from, to);
  const byDay = groupBy(rows, (r) => r.day);
  const dayLabels = dayList.map((d) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`);
  const daySeries = (i: number) => dayList.map((d) => byDay.get(d)?.[i] ?? 0);
  const dayIndex = dayList.map((d) => { const c = byDay.get(d); return c && sum(c) >= MIN_GROUP ? moodIndex(c) : null; });

  // Nach Tageszeit (Anteile)
  const byHour = groupBy(rows, (r) => String(r.hour).padStart(2, '0'));
  const hours = [...byHour.keys()].sort();
  const hourPct = (i: number) => hours.map((h) => { const c = byHour.get(h)!; return sum(c) ? Math.round((c[i] / sum(c)) * 100) : 0; });

  // Nach Standort
  const byTerminal = [...groupBy(rows, (r) => r.terminal_id ?? '').entries()].sort((a, b) => sum(b[1]) - sum(a[1]));

  const usedQuestions = questions.data?.filter((q) => q.votes > 0 || q.active) ?? [];
  const err = stats.error || questions.error || terminals.error;

  async function copyCsv() {
    const text = toCsv(rows, qText, tName);
    setCsv(text);
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* Text bleibt sichtbar */ }
  }

  return (
    <main className="page">
      <div className="row between">
        <div>
          <h1>Auswertung</h1>
          <p className="muted" style={{ margin: '.3em 0 0' }}>
            {stats.loading && !stats.data ? 'Daten werden geladen …' : `${org.name} · aktualisiert sich jede Minute`}
          </p>
        </div>
        <div className="row">
          <label className="f" htmlFor="fQ">Frage
            <select id="fQ" value={qFilter} onChange={(e) => setQFilter(e.target.value)}>
              <option value="all">Alle Fragen</option>
              {usedQuestions.map((q) => <option key={q.id} value={q.id}>{q.text.length > 48 ? q.text.slice(0, 46) + ' …' : q.text}</option>)}
            </select>
          </label>
          <label className="f" htmlFor="fR">Zeitraum
            <select id="fR" value={range} onChange={(e) => setRange(e.target.value)}>
              {Object.entries(RANGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label className="f" htmlFor="fT">Standort
            <select id="fT" value={tFilter} onChange={(e) => setTFilter(e.target.value)}>
              <option value="all">Alle Standorte</option>
              {terminals.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      {err && <p className="banner error">{err}</p>}
      {stats.data && stats.data.length === 0 && (
        <p className="banner">Noch keine Antworten in diesem Zeitraum. <Link to={`/app/${org.id}/terminals`}>Terminal koppeln</Link>, um Daten zu sammeln.</p>
      )}
      {N > 0 && N < MIN_GROUP && (
        <p className="banner">Weniger als {MIN_GROUP} Antworten in dieser Auswahl. Das Ergebnis ist nicht aussagekräftig, und einzelne Personen könnten erkennbar sein.</p>
      )}

      <section className="kpis">
        <div className="card kpi">
          <div className="l">Antworten</div>
          <div className="v">{N.toLocaleString('de-CH')}</div>
          <div className="note">{N ? `an ${days} Tag${days === 1 ? '' : 'en'} · Ø ${Math.round(N / Math.max(days, 1))} pro Tag` : ' '}</div>
        </div>
        <div className="card kpi">
          <div className="l">Stimmungsindex <span title="Anteil positiv minus Anteil negativ, von −100 bis +100">ⓘ</span></div>
          <div className="v" style={{ color: idx == null ? undefined : idx >= 30 ? 'var(--pos)' : idx >= 0 ? 'color-mix(in srgb, var(--neu) 75%, var(--ink))' : 'var(--neg)' }}>
            {idx == null || N < MIN_GROUP ? '–' : `${idx > 0 ? '+' : ''}${idx}`}
          </div>
          <div className="note">−100 alle negativ · +100 alle positiv</div>
        </div>
        <div className="card kpi">
          <div className="l">Verteilung</div>
          {N >= MIN_GROUP ? <Dist c={tot} /> : <div className="dist" />}
          <div className="legend">
            {(['negativ', 'neutral', 'positiv'] as const).map((n, i) => (
              <span key={n}><b style={{ background: [COLORS.neg, COLORS.neu, COLORS.pos][i] }} />{n} {N >= MIN_GROUP ? Math.round((tot[i] / N) * 100) : '–'} %</span>
            ))}
          </div>
        </div>
      </section>

      <section className="charts">
        <div className="card">
          <h3>Verlauf pro Tag</h3>
          <p className="note" style={{ margin: '.2em 0 10px' }}>Balken: Anzahl Antworten · Linie: Stimmungsindex (ab {MIN_GROUP} Antworten pro Tag)</p>
          <div className="chartbox">
            <Chart type="bar" data={{
              labels: dayLabels,
              datasets: [
                { type: 'bar' as const, label: 'Negativ', data: daySeries(0), backgroundColor: COLORS.neg, stack: 's', yAxisID: 'y', order: 2 },
                { type: 'bar' as const, label: 'Neutral', data: daySeries(1), backgroundColor: COLORS.neu, stack: 's', yAxisID: 'y', order: 2 },
                { type: 'bar' as const, label: 'Positiv', data: daySeries(2), backgroundColor: COLORS.pos, stack: 's', yAxisID: 'y', order: 2 },
                { type: 'line' as const, label: 'Stimmungsindex', data: dayIndex, borderColor: COLORS.accent, backgroundColor: COLORS.accent, yAxisID: 'y1', tension: 0.3, spanGaps: true, pointRadius: 3, order: 1 },
              ],
            }} options={{
              maintainAspectRatio: false, animation: false,
              interaction: { mode: 'index', intersect: false },
              plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } } },
              scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Antworten' } },
                y1: { position: 'right', min: -100, max: 100, grid: { display: false }, title: { display: true, text: 'Index' } },
              },
            }} />
          </div>
        </div>
        <div className="card">
          <h3>Nach Tageszeit</h3>
          <p className="note" style={{ margin: '.2em 0 10px' }}>Anteil der Antworten je Stunde</p>
          <div className="chartbox">
            <Bar data={{
              labels: hours.map((h) => `${h} Uhr`),
              datasets: [
                { label: 'Negativ', data: hourPct(0), backgroundColor: COLORS.neg, stack: 's' },
                { label: 'Neutral', data: hourPct(1), backgroundColor: COLORS.neu, stack: 's' },
                { label: 'Positiv', data: hourPct(2), backgroundColor: COLORS.pos, stack: 's' },
              ],
            }} options={{
              maintainAspectRatio: false, animation: false,
              interaction: { mode: 'index', intersect: false },
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: {
                  label: (c) => `${c.dataset.label}: ${c.raw} %`,
                  footer: (it) => `${sum(byHour.get(hours[it[0].dataIndex])!)} Antworten`,
                } },
              },
              scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, max: 100, beginAtZero: true, ticks: { callback: (v) => `${v} %` } } },
            }} />
          </div>
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginBottom: 8 }}>Nach Standort</h3>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Standort</th><th>Antworten</th><th>Verteilung</th><th>Index</th></tr></thead>
            <tbody>
              {byTerminal.length === 0 && <tr><td colSpan={4} className="muted">Keine Daten in dieser Auswahl.</td></tr>}
              {byTerminal.map(([id, c]) => (
                <tr key={id}>
                  <td>{tName(id || null)}</td>
                  <td>{sum(c)}</td>
                  <td>{sum(c) >= MIN_GROUP ? <Dist c={c} /> : <span className="note">ausgeblendet (unter {MIN_GROUP} Antworten)</span>}</td>
                  <td>{sum(c) >= MIN_GROUP ? <IndexPill i={moodIndex(c)} /> : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack">
        <div className="row between" style={{ alignItems: 'center' }}>
          <div>
            <h3>Daten exportieren</h3>
            <p className="note" style={{ margin: '.2em 0 0' }}>Aktuelle Auswahl als CSV (Semikolon-getrennt, für Excel), pro Tag, Stunde und Standort</p>
          </div>
          <button className="btn" onClick={copyCsv} disabled={!rows.length}>{copied ? 'Kopiert ✓' : 'CSV kopieren'}</button>
        </div>
        {csv != null && <textarea className="csv" readOnly value={csv} aria-label="CSV-Daten" />}
      </section>
    </main>
  );
}
