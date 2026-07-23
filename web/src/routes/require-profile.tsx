import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router';

import { AppLoading } from '@/components/ui/app-loading';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

/** Gates the main app: needs a session AND a completed, active profile row.
 * A deleted or admin-suspended profile still exists (delete_account_request
 * anonymizes rather than removing the row, and admin_suspend_user just
 * flips status), so `!profile` alone doesn't catch either -- without this,
 * signing back in after "deleting" your account (or getting suspended)
 * would drop you right back into a fully working app, just under the
 * anonymized name. */
export function RequireProfile() {
  const { session, isLoading: isSessionLoading } = useSession();
  const { data: profile, isLoading: isProfileLoading } = useProfile(session?.user.id);

  const isInactive = !!profile && profile.status !== 'active';

  useEffect(() => {
    if (isInactive) {
      supabase.auth.signOut();
    }
  }, [isInactive]);

  if (isSessionLoading || (session && isProfileLoading)) {
    return <AppLoading />;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (isInactive) {
    // signOut() above is in flight -- keep showing a loading state rather
    // than rendering the Outlet (or navigating early ourselves) until
    // useSession reflects the cleared session, at which point the `!session`
    // branch above takes over. Navigating immediately here risks a bounce:
    // SignInScreen redirects straight back to /home whenever it sees a
    // still-truthy session, which briefly re-enters this exact branch.
    return <AppLoading />;
  }

  if (!profile) {
    return <Navigate to="/setup-profile" replace />;
  }

  return <Outlet />;
}
