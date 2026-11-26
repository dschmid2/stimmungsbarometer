import { useState, type FormEvent } from 'react';
import { useOrg } from './OrgLayout';
import { api, type Question } from '../../lib/api';
import { useAction, useLoad } from '../../components/useLoad';

const DEFAULT_LABELS = ['Nicht gut', 'Geht so', 'Gut'];

function QuestionForm({ initial, onSave, onCancel, busy }: {
  initial?: Question; busy: boolean;
  onSave: (text: string, labels: string[]) => void; onCancel?: () => void;
}) {
  const [text, setText] = useState(initial?.text ?? '');
  const [labels, setLabels] = useState<string[]>(initial?.labels ?? ['', '', '']);
  const pre = initial ? initial.id : 'new';
  function submit(e: FormEvent) {
    e.preventDefault();
    onSave(text.trim(), labels.map((l, i) => l.trim() || DEFAULT_LABELS[i]));
  }
  return (
    <form className="row" onSubmit={submit}>
      <label className="f" htmlFor={`${pre}-t`} style={{ flex: '1 1 100%' }}>Fragetext
        <input id={`${pre}-t`} type="text" required maxLength={160} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="z. B. Wie gut fühlen Sie sich über die Veränderungen informiert?" />
      </label>
      {['Linker Buzzer (rot)', 'Mittlerer Buzzer (gelb)', 'Rechter Buzzer (grün)'].map((l, i) => (
        <label key={l} className="f" htmlFor={`${pre}-l${i}`}>{l}
          <input id={`${pre}-l${i}`} type="text" maxLength={24} placeholder={DEFAULT_LABELS[i]} value={labels[i]}
            onChange={(e) => setLabels(labels.map((x, j) => (j === i ? e.target.value : x)))} />
        </label>
      ))}
      <button className="btn primary" type="submit" disabled={busy}>{initial ? 'Speichern' : 'Frage hinzufügen'}</button>
      {onCancel && <button className="btn" type="button" onClick={onCancel}>Abbrechen</button>}
    </form>
  );
}

export default function Questions() {
  const org = useOrg();
  const isAdmin = org.role === 'admin';
  const qs = useLoad(() => api.questions(org.id), [org.id]);
  const act = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [showArchived, setShowArchived] = useState(false);

  const list = (qs.data ?? []).filter((q) => showArchived || !q.archived);
  const archivedCount = (qs.data ?? []).filter((q) => q.archived).length;

  const run = async (f: () => Promise<unknown>) => { if (await act.run(f)) await qs.reload(); };

  return (
    <main className="page">
      <div>
        <h1>Fragen</h1>
        <p className="muted" style={{ margin: '.3em 0 0' }}>Es ist immer genau eine Frage aktiv. Alle Terminals zeigen sie innerhalb einer Minute an.</p>
      </div>
      {!isAdmin && <p className="banner">Sie haben Lesezugriff. Fragen ändern können nur Admins dieser Organisation.</p>}
      {(qs.error || act.error) && <p className="banner error">{qs.error || act.error}</p>}

      <section className="card list">
        {qs.loading && !qs.data && <p className="muted" style={{ margin: 0 }}>Wird geladen …</p>}
        {qs.data && list.length === 0 && <p className="muted" style={{ margin: 0 }}>Noch keine Fragen angelegt.</p>}
        {list.map((q) => editing === q.id ? (
          <div key={q.id} className="item">
            <QuestionForm initial={q} busy={act.busy} onCancel={() => setEditing(null)}
              onSave={(t, l) => run(async () => { await api.questionSave(org.id, q.id, t, l); setEditing(null); })} />
          </div>
        ) : (
          <div key={q.id} className={`item${q.active ? ' active' : ''}${q.archived ? ' dim' : ''}`}>
            <div className="t">{q.text}<div className="sub">{q.labels.join(' · ')}</div></div>
            <span className="note">{q.votes} Antworten</span>
            {q.active && <span className="pill good">aktiv</span>}
            {q.archived && <span className="pill off">archiviert</span>}
            {isAdmin && !q.active && !q.archived && <button className="btn small" onClick={() => run(() => api.questionActivate(org.id, q.id))}>Aktiv setzen</button>}
            {isAdmin && !q.archived && (
              <button className="btn small" onClick={() => setEditing(q.id)}
                title={q.votes ? 'Bestehende Antworten bleiben dieser Frage zugeordnet' : undefined}>Bearbeiten</button>
            )}
            {isAdmin && !q.active && (
              <button className="btn small" onClick={() => run(() => api.questionArchive(org.id, q.id, !q.archived))}>
                {q.archived ? 'Wiederherstellen' : 'Archivieren'}
              </button>
            )}
          </div>
        ))}
        {archivedCount > 0 && (
          <button className="btn link" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Archivierte ausblenden' : `${archivedCount} archivierte anzeigen`}
          </button>
        )}
      </section>

      {isAdmin && (
        <section className="card stack">
          <h3>Neue Frage</h3>
          <QuestionForm key={formKey} busy={act.busy}
            onSave={(t, l) => run(async () => { await api.questionSave(org.id, null, t, l); setFormKey((k) => k + 1); })} />
          <p className="note" style={{ margin: 0 }}>
            Tipp aus dem Change-Management: Wechseln Sie die Frage alle 2–4 Wochen und berichten Sie dem Team, was Sie mit den Ergebnissen gemacht haben.
            Archivierte Fragen bleiben in der Auswertung erhalten.
          </p>
        </section>
      )}
    </main>
  );
}
