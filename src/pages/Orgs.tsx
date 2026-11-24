import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../auth';
import { api } from '../lib/api';
import { useAction } from '../components/useLoad';

export default function Orgs() {
  const { me, error, reload } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const act = useAction();

  if (me && !me.is_platform_admin && me.organizations.length === 1) {
    return <Navigate to={`/app/${me.organizations[0].id}`} replace />;
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    let id = '';
    const ok = await act.run(async () => { id = await api.orgCreate(name); });
    if (ok) { setName(''); await reload(); nav(`/app/${id}/terminals`); }
  }

  return (
    <>
      <Header />
      <main className="page">
        <h1>Organisationen</h1>
        {error && <p className="banner error">{error}</p>}
        {me && me.organizations.length === 0 && (
          <p className="banner">Sie sind noch keiner Organisation zugeordnet. Bitten Sie eine Admin-Person Ihrer Organisation um eine Einladung.</p>
        )}
        <section className="list">
          {me?.organizations.map((o) => (
            <Link key={o.id} to={`/app/${o.id}`} className="item card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="t">{o.name}</span>
              <span className={`pill ${o.role === 'admin' ? 'good' : 'off'}`}>{o.role === 'admin' ? 'Admin' : 'Lesezugriff'}</span>
            </Link>
          ))}
        </section>
        {me?.is_platform_admin && (
          <section className="card stack">
            <h3>Neue Organisation anlegen</h3>
            <p className="note" style={{ margin: 0 }}>Für jeden Kunden eine eigene Organisation. Sie werden automatisch Admin und können danach Personen einladen und Terminals koppeln.</p>
            <form className="row" onSubmit={create}>
              <label className="f" htmlFor="orgname" style={{ flex: 1 }}>Name
                <input id="orgname" type="text" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Muster AG" />
              </label>
              <button className="btn primary" type="submit" disabled={act.busy}>Anlegen</button>
            </form>
            {act.error && <p className="banner error">{act.error}</p>}
          </section>
        )}
      </main>
    </>
  );
}
