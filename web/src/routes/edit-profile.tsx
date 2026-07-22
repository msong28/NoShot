import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/inline-error';
import { useProfile, useUpdateProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';

/**
 * Scoped to display_name only -- the profiles table's column-level UPDATE
 * grant (see 20260722120000_account_deletion.sql) intentionally only
 * allows display_name/birth_year/age_acknowledged_at direct client
 * updates. Username changes have real implications (invite links,
 * mentions elsewhere) this pass doesn't take on.
 */
export function EditProfileScreen() {
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile, isLoading } = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);

  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) setDisplayName(profile.display_name);
  }, [profile]);

  function handleSave() {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    setError(null);
    setSaved(false);
    updateProfile.mutate(
      { display_name: trimmed },
      {
        onSuccess: () => setSaved(true),
        onError: (err) => setError(getErrorMessage(err, 'Could not save your profile')),
      },
    );
  }

  if (isLoading || !profile) {
    return (
      <main className="mx-auto max-w-app p-four">
        <BackButton />
        <p className="mt-four text-text-secondary">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <BackButton />
      <h1 className="mt-three font-display text-screen-title font-extrabold tracking-display-tight">
        Edit profile
      </h1>
      <p className="mt-one text-sm text-text-secondary">
        @{profile.username} · username can&rsquo;t be changed yet
      </p>

      <div className="mt-four">
        <p className="mb-one text-sm font-bold text-text-secondary">Display name</p>
        <input
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            setSaved(false);
          }}
          className="w-full rounded-medium border border-line bg-surface p-three"
        />
      </div>

      <InlineError message={error} />
      {saved ? <p className="mt-two text-sm font-bold text-up-ink">Saved.</p> : null}

      <div className="mt-four flex gap-two">
        <Button
          variant="primary"
          disabled={!displayName.trim() || updateProfile.isPending}
          onClick={handleSave}
        >
          {updateProfile.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </div>
    </main>
  );
}
