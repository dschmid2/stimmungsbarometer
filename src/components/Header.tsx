import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth';
import type { OrgRef } from '../lib/api';

export default function Header({ org }: { org?: OrgRef }) {
  const { me, signOut } = useAuth();
  return (
    <header className="top">
      <Link to="/app" className="brand"><span className="dots"><b /><b /><b /></span>Stimmungsbarometer</Link>
      {org && <span className="orgname">{org.name}</span>}
      {org && (
        <nav className="tabs" aria-label="Bereiche">
          <NavLink to={`/app/${org.id}`} end className={({ isActive }) => (isActive ? 'active' : '')}>Auswertung</NavLink>
          <NavLink to={`/app/${org.id}/fragen`} className={({ isActive }) => (isActive ? 'active' : '')}>Fragen</NavLink>
          <NavLink to={`/app/${org.id}/terminals`} className={({ isActive }) => (isActive ? 'active' : '')}>Terminals</NavLink>
          <NavLink to={`/app/${org.id}/team`} className={({ isActive }) => (isActive ? 'active' : '')}>Team</NavLink>
        </nav>
      )}
      <span className="spacer" />
      {me && (
        <span className="userbox">
          {me.email}
          <button className="btn small" onClick={() => signOut()}>Abmelden</button>
        </span>
      )}
    </header>
  );
}
