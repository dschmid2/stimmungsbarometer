import { useState, type FormEvent } from 'react';
import { useOrg } from './OrgLayout';
import { api, type Terminal } from '../../lib/api';
import { useAction, useLoad } from '../../components/useLoad';

function ago(iso: string | null): string {
  if (!iso) return 'nie';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return 'gerade eben';
  if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
  return new Date(iso).toLocaleDateString('de-CH');
}

function status(t: Terminal) {
  if (t.revoked) return <span className="pill off">entkoppelt</span>;
  const online = t.last_seen_at && Date.now() - new Date(t.last_seen_at).getTime() < 3 * 60_000;
  return online ? <span className="pill good">online</span> : <span className="pill bad">offline</span>;
}

export default function Terminals() {
  const org = useOrg();
  const isAdmin = org.role === 'admin';
  const list = useLoad(() => api.terminals(org.id), [org.id], 30_000);
  const act = useAction();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const terminalUrl = `${window.location.origin}/terminal`;

  async function claim(e: FormEvent) {
    e.preventDefault();
    const ok = await act.run(() => api.terminalClaim(org.id, code.replace(/\D/g, ''), name));
    if (ok) { setDone(name.trim()); setCode(''); setName(''); list.reload(); }
  }

  const run = async (f: () => Promise<unknown>) => { if (await act.run(f)) await list.reload(); };

  return (
    <main className="page">
      <div>
        <h1>Terminals</h1>
        <p className="muted" style={{ margin: '.3em 0 0' }}>Ein Terminal ist ein Bildschirm mit Buzzer-Pult. Gekoppelt wird es mit einem Code, ohne Benutzerkonto.</p>
      </div>
      {(list.error || act.error) && <p className="banner error">{list.error || act.error}</p>}

      {isAdmin && (
        <section className="card stack">
          <h3>Terminal koppeln</h3>
          <ol style={{ margin: 0, paddingLeft: '1.2em' }}>
            <li>Auf dem Terminal-Gerät im Browser <code>{terminalUrl}</code> öffnen. Am Raspberry Pi startet die Adresse automatisch.</li>
            <li>Der Bildschirm zeigt einen 6-stelligen Code. Er gilt 15 Minuten.</li>
            <li>Code und Standort hier eingeben. Das Terminal zeigt danach sofort die aktive Frage.</li>
          </ol>
          <form className="row" onSubmit={claim}>
            <label className="f" htmlFor="code">Kopplungscode
              <input id="code" className="code" type="text" inputMode="numeric" autoComplete="off" required pattern="\d{3}\s?\d{3}"
                maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" />
            </label>
            <label className="f" htmlFor="tname" style={{ flex: 1 }}>Standort (erscheint in der Auswertung)
              <input id="tname" type="text" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Kantine, Werkhalle Süd" />
            </label>
            <button className="btn primary" type="submit" disabled={act.busy}>Koppeln</button>
          </form>
          {done && <p className="banner ok" style={{ margin: 0 }}>Terminal „{done}“ ist gekoppelt.</p>}
        </section>
      )}

      <section className="card list">
        {list.loading && !list.data && <p className="muted" style={{ margin: 0 }}>Wird geladen …</p>}
        {list.data?.length === 0 && <p className="muted" style={{ margin: 0 }}>Noch keine Terminals gekoppelt.</p>}
        {list.data?.map((t) => (
          <div key={t.id} className={`item${t.revoked ? ' dim' : ''}`}>
            {renaming?.id === t.id ? (
              <form className="row" style={{ flex: 1 }} onSubmit={(e) => { e.preventDefault(); run(async () => { await api.terminalRename(org.id, t.id, renaming.name); setRenaming(null); }); }}>
                <label className="f" htmlFor={`rn-${t.id}`} style={{ flex: 1 }}>Standort
                  <input id={`rn-${t.id}`} type="text" required maxLength={60} value={renaming.name} onChange={(e) => setRenaming({ id: t.id, name: e.target.value })} />
                </label>
                <button className="btn primary small" type="submit">Speichern</button>
                <button className="btn small" type="button" onClick={() => setRenaming(null)}>Abbrechen</button>
              </form>
            ) : (
              <>
                <div className="t">{t.name}<div className="sub">Zuletzt erreichbar: {ago(t.last_seen_at)} · letzte Antwort: {ago(t.last_vote_at)}</div></div>
                {status(t)}
                {isAdmin && !t.revoked && <button className="btn small" onClick={() => setRenaming({ id: t.id, name: t.name })}>Umbenennen</button>}
                {isAdmin && !t.revoked && (confirm === t.id ? (
                  <>
                    <span className="note">Wirklich entkoppeln? Das Gerät braucht danach einen neuen Code.</span>
                    <button className="btn small danger" onClick={() => run(async () => { await api.terminalRevoke(org.id, t.id); setConfirm(null); })}>Ja, entkoppeln</button>
                    <button className="btn small" onClick={() => setConfirm(null)}>Abbrechen</button>
                  </>
                ) : <button className="btn small danger" onClick={() => setConfirm(t.id)}>Entkoppeln</button>)}
              </>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
