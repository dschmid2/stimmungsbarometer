import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { configured } from './lib/supabase';
import Login from './pages/Login';
import Orgs from './pages/Orgs';
import OrgLayout from './pages/org/OrgLayout';
import Dashboard from './pages/org/Dashboard';
import Questions from './pages/org/Questions';
import Terminals from './pages/org/Terminals';
import Team from './pages/org/Team';
import Terminal from './pages/Terminal';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="narrow"><p className="muted">Wird geladen …</p></div>;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  if (!configured) {
    return (
      <div className="narrow">
        <h1>Stimmungsbarometer</h1>
        <p className="banner error">Die Verbindung zur Datenbank ist nicht eingerichtet. Bitte VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY setzen (siehe README).</p>
      </div>
    );
  }
  return (
    <Routes>
      {/* Das Terminal braucht kein Benutzerkonto, nur einen Kopplungscode */}
      <Route path="/terminal" element={<Terminal />} />
      <Route path="/*" element={
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/app" element={<RequireAuth><Orgs /></RequireAuth>} />
            <Route path="/app/:orgId" element={<RequireAuth><OrgLayout /></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="fragen" element={<Questions />} />
              <Route path="terminals" element={<Terminals />} />
              <Route path="team" element={<Team />} />
            </Route>
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </AuthProvider>
      } />
    </Routes>
  );
}
