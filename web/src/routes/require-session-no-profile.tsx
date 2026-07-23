import { Navigate, Outlet } from 'react-router';

import { AppLoading } from '@/components/ui/app-loading';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';

/** Gates setup-profile: needs a session but must NOT already have a
 * *complete, active* profile.
 *
 * A deleted profile still exists as a row (delete_account_request
 * anonymizes rather than removes it), so `profile` alone being truthy is
 * not enough here -- RequireProfile deliberately sends a deleted profile
 * to /setup-profile to reactivate it (see that file's own comment), and
 * treating any existing row as "already set up" here would immediately
 * bounce it straight back to /home, which RequireProfile then bounces back
 * to /setup-profile again: an infinite redirect loop between the two
 * guards, with nothing rendered in between. */
export function RequireSessionNoProfile() {
  const { session, isLoading: isSessionLoading } = useSession();
  const { data: profile, isLoading: isProfileLoading } = useProfile(session?.user.id);

  if (isSessionLoading || (session && isProfileLoading)) {
    return <AppLoading />;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (profile && profile.status !== 'deleted') {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}
