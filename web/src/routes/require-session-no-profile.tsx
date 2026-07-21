import { Navigate, Outlet } from 'react-router';

import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';

/** Gates setup-profile: needs a session but must NOT already have a profile. */
export function RequireSessionNoProfile() {
  const { session, isLoading: isSessionLoading } = useSession();
  const { data: profile, isLoading: isProfileLoading } = useProfile(session?.user.id);

  if (isSessionLoading || (session && isProfileLoading)) {
    return <p className="p-four text-text-secondary">Loading…</p>;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (profile) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}
