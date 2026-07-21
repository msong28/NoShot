import { Link } from 'react-router';

import { BottomNav } from '@/components/bottom-nav';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export function AccountScreen() {
  const { session } = useSession();
  const { data: profile } = useProfile(session?.user.id);

  return (
    <main className="mx-auto max-w-app p-four pb-28">
      <h1 className="font-display text-2xl font-extrabold">Account</h1>
      {profile ? (
        <p className="mt-two text-text-secondary">
          @{profile.username} · {profile.display_name}
        </p>
      ) : null}
      <p className="mt-two text-text-secondary">Blocked users and privacy settings will live here.</p>

      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="mt-four rounded-pill bg-surface-sunken px-four py-three font-display font-bold text-text-secondary"
      >
        Sign out
      </button>

      <h2 className="mt-four font-display font-bold">Legal</h2>
      <div className="mt-two flex flex-col gap-two">
        <Link to="/privacy-policy" className="rounded-medium bg-surface p-three shadow-card">
          Privacy policy
        </Link>
        <Link to="/terms" className="rounded-medium bg-surface p-three shadow-card">
          Terms of service
        </Link>
        <Link to="/community-guidelines" className="rounded-medium bg-surface p-three shadow-card">
          Community guidelines
        </Link>
      </div>

      <Link
        to="/delete-account"
        className="mt-four block rounded-pill bg-danger-bg px-four py-three text-center font-display font-bold text-danger"
      >
        Delete account
      </Link>

      <BottomNav />
    </main>
  );
}
