import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export function ProfileScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile, isLoading, error } = useProfile(userId);

  if (isLoading) {
    return <p className="p-four text-text-secondary">Loading profile…</p>;
  }

  if (error) {
    return (
      <p role="alert" className="p-four text-danger">
        Couldn&rsquo;t load your profile.
      </p>
    );
  }

  if (!profile) {
    return <p className="p-four text-text-secondary">No profile found for this account yet.</p>;
  }

  return (
    <main className="mx-auto max-w-app p-four">
      <div className="rounded-large bg-surface p-four shadow-card">
        <h1 className="font-display text-2xl font-extrabold">{profile.display_name}</h1>
        <p className="mt-half text-text-secondary">@{profile.username}</p>
        <p className="mt-three">
          Status: <span className="font-display font-bold">{profile.status}</span>
        </p>
      </div>

      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="mt-four rounded-pill bg-danger-bg px-four py-three font-display font-bold text-danger"
      >
        Sign out
      </button>
    </main>
  );
}
