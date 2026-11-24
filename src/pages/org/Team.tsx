import { useState, type FormEvent } from 'react';
import { useOrg } from './OrgLayout';
import { api, type Role } from '../../lib/api';
import { useAction, useLoad } from '../../components/useLoad';
import { useAuth } from '../../auth';

const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', viewer: 'Lesezugriff' };

export default function Team() {
  const org = useOrg();
  const { reload: reloadMe } = useAuth();
  const isAdmin = org.role === 'admin';
  const data = useLoad(() => api.members(org.id), [org.id]);
  const act = useAction();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [sent, setSent] = useState<string | null>(null);
  const [rename, setRename] = useState(org.name);

  const run = async (f: () => Promise<unknown>) => { if (await act.run(f)) await data.reload(); };

  async function invite(e: FormEvent) {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (await act.run(() => api.invite(org.id, addr, role))) { setSent(addr); setEmail(''); data.reload(); }
  }

  return (
    <main className="page">
      <div>
        <h1>Team</h1>
        <p className="muted" style={{ margin: '.3em 0 0' }}>Wer die Auswertung sehen und das Stimmungsbarometer verwalten darf.</p>
      </div>
      {(data.error || act.error) && <p className="banner error">{data.error || act.error}</p>}

      {isAdmin && (
        <section className="card stack">
          <h3>Person einladen</h3>
          <form className="row" onSubmit={invite}>
            <label className="f" htmlFor="inv" style={{ flex: 1 }}>E-Mail-Adresse
              <input id="inv" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="f" htmlFor="role">Rolle
              <select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="viewer">Lesezugriff: sieht die Auswertung</option>
                <option value="admin">Admin: verwaltet Fragen, Terminals, Team</option>
              </select>
            </label>
            <button className="btn primary" type="submit" disabled={act.busy}>Einladen</button>
          </form>
          {sent && (
            <p className="banner ok" style={{ margin: 0 }}>
              {sent} ist eingeladen. Schicken Sie der Person diese Adresse: <code>{window.location.origin}/login</code>. Dort meldet sie sich mit ihrer E-Mail an.
            </p>
          )}
        </section>
      )}

      <section className="card">
        <h3 style={{ marginBottom: 8 }}>Mitglieder</h3>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>E-Mail</th><th>Rolle</th><th /></tr></thead>
            <tbody>
              {data.data?.members.map((m) => (
                <tr key={m.user_id}>
                  <td>{m.email}{m.is_me && <span className="note"> (Sie)</span>}</td>
                  <td>
                    {isAdmin ? (
                      <select aria-label={`Rolle von ${m.email}`} value={m.role}
                        onChange={(e) => run(async () => { await api.memberSetRole(org.id, m.user_id, e.target.value as Role); if (m.is_me) await reloadMe(); })}>
                        <option value="viewer">{ROLE_LABEL.viewer}</option>
                        <option value="admin">{ROLE_LABEL.admin}</option>
                      </select>
                    ) : ROLE_LABEL[m.role]}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {isAdmin && !m.is_me && <button className="btn small danger" onClick={() => run(() => api.memberRemove(org.id, m.user_id))}>Entfernen</button>}
                  </td>
                </tr>
              ))}
              {data.data?.invites.map((i) => (
                <tr key={i.id}>
                  <td>{i.email} <span className="pill off">eingeladen</span></td>
                  <td>{ROLE_LABEL[i.role]}</td>
                  <td style={{ textAlign: 'right' }}>
                    {isAdmin && <button className="btn small" onClick={() => run(() => api.inviteDelete(org.id, i.id))}>Einladung zurückziehen</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isAdmin && (
        <section className="card stack">
          <h3>Organisation</h3>
          <form className="row" onSubmit={(e) => { e.preventDefault(); act.run(async () => { await api.orgRename(org.id, rename); await reloadMe(); }); }}>
            <label className="f" htmlFor="oname" style={{ flex: 1 }}>Name
              <input id="oname" type="text" required maxLength={120} value={rename} onChange={(e) => setRename(e.target.value)} />
            </label>
            <button className="btn" type="submit" disabled={act.busy || rename.trim() === org.name}>Umbenennen</button>
          </form>
        </section>
      )}
    </main>
  );
}
