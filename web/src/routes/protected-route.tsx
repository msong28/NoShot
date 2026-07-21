import { Navigate, Outlet, useLocation } from 'react-router';

import { useSession } from '@/hooks/use-session';

export function ProtectedRoute() {
  const { session, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) {
    return <p className="p-four text-text-secondary">Loading…</p>;
  }

  if (!session) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
