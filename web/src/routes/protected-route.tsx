import { Navigate, Outlet, useLocation } from 'react-router';

import { AppLoading } from '@/components/ui/app-loading';
import { useSession } from '@/hooks/use-session';

export function ProtectedRoute() {
  const { session, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) {
    return <AppLoading />;
  }

  if (!session) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
