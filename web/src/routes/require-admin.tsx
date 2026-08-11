import { Navigate, Outlet } from 'react-router';

import { useIsAdmin } from '@/hooks/use-admin';
import { useSession } from '@/hooks/use-session';

/** MOD-05's client-side route gate. This is UX only -- every admin RPC and
 * the reports_select RLS policy independently re-check is_admin()
 * server-side, so bypassing this check client-side gets a non-admin
 * nothing but permission errors. */
export function RequireAdmin() {
  const { session, isLoading: isSessionLoading } = useSession();
  const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin(session?.user.id);

  if (isSessionLoading || (session && isAdminLoading)) {
    return <p className="p-four text-text-secondary">Loading…</p>;
  }

  if (!session || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
