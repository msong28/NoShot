import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';

import { AppLoading } from '@/components/ui/app-loading';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

/** Gates the main app: needs a session AND a completed, active profile row.
 *
 * A deleted or admin-suspended profile still exists (delete_account_request
 * anonymizes rather than removing the row, and admin_suspend_user just
 * flips status), so `!profile` alone doesn't catch either. The two aren't
 * treated the same, though: suspension is a moderator's enforcement
 * action, so it's a hard block (signed out, with an explanation, sent to
 * sign-in). A self-deletion is the user's own choice, and since an OAuth
 * identity like Google always maps back to the same auth.users row (no way
 * to spin up a literal second account under the same email), the closest
 * equivalent to "let me sign up again" is routing to /setup-profile so
 * they can reactivate this same row via reactivate_account_request --
 * same login, fresh profile. */
export function RequireProfile() {
  const { session, isLoading: isSessionLoading } = useSession();
  const { data: profile, isLoading: isProfileLoading } = useProfile(session?.user.id);
  const [suspendedMessage, setSuspendedMessage] = useState<string | null>(null);

  const isSuspended = !!profile && profile.status === 'suspended';
  const needsSetup = !!session && (!profile || profile.status === 'deleted');

  useEffect(() => {
    if (isSuspended) {
      setSuspendedMessage('This account has been suspended.');
      supabase.auth.signOut();
    }
  }, [isSuspended]);

  if (isSessionLoading || (session && isProfileLoading)) {
    return <AppLoading />;
  }

  if (!session) {
    return (
      <Navigate
        to="/"
        replace
        state={suspendedMessage ? { authMessage: suspendedMessage } : undefined}
      />
    );
  }

  if (isSuspended) {
    // signOut() above is in flight -- keep showing a loading state rather
    // than rendering the Outlet (or navigating early ourselves) until
    // useSession reflects the cleared session, at which point the `!session`
    // branch above takes over. Navigating immediately here risks a bounce:
    // SignInScreen redirects straight back to /home whenever it sees a
    // still-truthy session, which briefly re-enters this exact branch.
    return <AppLoading />;
  }

  if (needsSetup) {
    return <Navigate to="/setup-profile" replace />;
  }

  return <Outlet />;
}
