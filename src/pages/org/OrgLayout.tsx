import { Outlet, useOutletContext, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import { useAuth } from '../../auth';
import type { OrgRef } from '../../lib/api';

export function useOrg() {
  return useOutletContext<OrgRef>();
}

export default function OrgLayout() {
  const { orgId } = useParams();
  const { me, loading } = useAuth();
  const org = me?.organizations.find((o) => o.id === orgId);

  if (loading || !me) return <div className="narrow"><p className="muted">Wird geladen …</p></div>;
  if (!org) {
    return (
      <>
        <Header />
        <main className="page"><p className="banner error">Diese Organisation gibt es nicht, oder Sie haben keinen Zugang.</p></main>
      </>
    );
  }
  return (
    <>
      <Header org={org} />
      <Outlet context={org} />
    </>
  );
}
