import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useInvalidateProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { MIN_AGE, USERNAME_PATTERN } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

export function SetupProfileScreen() {
  const { session } = useSession();
  const invalidateProfile = useInvalidateProfile(session?.user.id);
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [ageAcknowledged, setAgeAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedUsername = username.trim().toLowerCase();
  const usernameError =
    normalizedUsername.length > 0 && !USERNAME_PATTERN.test(normalizedUsername)
      ? 'Lowercase letters, numbers, underscore, 3-20 characters'
      : undefined;

  const parsedBirthYear = Number.parseInt(birthYear, 10);
  const currentYear = new Date().getFullYear();
  const impliedAge = currentYear - parsedBirthYear;
  const birthYearError =
    birthYear.length > 0 && (!Number.isInteger(parsedBirthYear) || impliedAge < MIN_AGE)
      ? `Must indicate an age of at least ${MIN_AGE}`
      : undefined;

  const canSubmit =
    !!session &&
    !isSubmitting &&
    displayName.trim().length > 0 &&
    USERNAME_PATTERN.test(normalizedUsername) &&
    Number.isInteger(parsedBirthYear) &&
    impliedAge >= MIN_AGE &&
    ageAcknowledged;

  async function handleSubmit() {
    if (!session) return;
    setError(null);
    setIsSubmitting(true);

    const { error: insertError } = await supabase.from('profiles').insert({
      id: session.user.id,
      display_name: displayName.trim(),
      username: normalizedUsername,
      birth_year: parsedBirthYear,
      age_acknowledged_at: new Date().toISOString(),
    });

    setIsSubmitting(false);

    if (insertError) {
      setError(insertError.code === '23505' ? 'That username is already taken.' : insertError.message);
      return;
    }

    await invalidateProfile();
    navigate('/home', { replace: true });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-app flex-col justify-center gap-three p-four">
      <h1 className="font-display text-2xl font-extrabold">Set up your account</h1>
      <p className="text-text-secondary">Just a display name and username — no profile photo required.</p>

      <input
        placeholder="Display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        className="rounded-medium bg-surface p-three shadow-card"
      />
      <div>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          className="w-full rounded-medium bg-surface p-three shadow-card"
        />
        {usernameError ? <p className="mt-half text-sm text-danger">{usernameError}</p> : null}
      </div>
      <div>
        <input
          placeholder="Birth year"
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          className="w-full rounded-medium bg-surface p-three shadow-card"
        />
        {birthYearError ? <p className="mt-half text-sm text-danger">{birthYearError}</p> : null}
      </div>

      <label className="flex items-start gap-two">
        <input
          type="checkbox"
          checked={ageAcknowledged}
          onChange={() => setAgeAcknowledged((prev) => !prev)}
          className="mt-half h-5 w-5"
        />
        <span className="text-sm">
          I confirm I am at least {MIN_AGE} years old and eligible under the Terms for my region.
        </span>
      </label>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="rounded-pill bg-primary px-four py-three font-display font-bold text-on-primary disabled:opacity-60"
      >
        {isSubmitting ? 'Saving…' : 'Continue'}
      </button>
    </main>
  );
}
