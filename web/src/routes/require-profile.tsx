import { Navigate, Outlet } from 'react-router';

import { AppLoading } from '@/components/ui/app-loading';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';

/** Gates the main app: needs a session AND a completed profile row. */
export function RequireProfile() {
  const { session, isLoading: isSessionLoading } = useSession();
  const { data: profile, isLoading: isProfileLoading } = useProfile(session?.user.id);

  if (isSessionLoading || (session && isProfileLoading)) {
    return <AppLoading />;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (!profile) {
    return <Navigate to="/setup-profile" replace />;
  }

  return <Outlet />;
}
