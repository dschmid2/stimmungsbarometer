import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useAuth } from '../auth';

export default function Login() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!loading && session) return <Navigate to="/app" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    setState('busy'); setError(null);
    try {
      if (!(await api.canLogin(addr))) {
        setError('Für diese E-Mail-Adresse gibt es keinen Zugang. Bitte lassen Sie sich von Ihrer Organisation einladen.');
        setState('idle');
        return;
      }
      const { error: err } = await supabase.auth.signInWithOtp({
        email: addr,
        options: { emailRedirectTo: `${window.location.origin}/app`, shouldCreateUser: true },
      });
      if (err) throw err;
      setState('sent');
    } catch (e) {
      setError((e as Error).message || 'Anmeldung fehlgeschlagen.');
      setState('idle');
    }
  }

  return (
    <div className="narrow">
      <div className="brand"><span className="dots"><b /><b /><b /></span>Stimmungsbarometer</div>
      <div className="card stack">
        <h1>Anmelden</h1>
        {state === 'sent' ? (
          <p className="banner ok">
            Wir haben einen Anmeldelink an <strong>{email.trim()}</strong> geschickt. Öffnen Sie ihn auf diesem Gerät.
            Falls nichts ankommt, prüfen Sie den Spam-Ordner.
          </p>
        ) : (
          <form className="stack" onSubmit={submit}>
            <p className="muted" style={{ margin: 0 }}>Sie erhalten einen Link per E-Mail, ein Passwort ist nicht nötig.</p>
            <label className="f" htmlFor="email">E-Mail-Adresse
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {error && <p className="banner error" role="alert" style={{ margin: 0 }}>{error}</p>}
            <button className="btn primary" type="submit" disabled={state === 'busy'}>
              {state === 'busy' ? 'Wird gesendet …' : 'Anmeldelink senden'}
            </button>
          </form>
        )}
      </div>
      <p className="note">Terminal einrichten? Öffnen Sie auf dem Gerät am Bildschirm die Adresse <code>{window.location.origin}/terminal</code>.</p>
    </div>
  );
}
