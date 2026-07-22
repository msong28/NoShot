import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { useInvalidateProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { MIN_AGE, USERNAME_PATTERN } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from({ length: 100 - MIN_AGE }, (_, i) => CURRENT_YEAR - MIN_AGE - i);

type Availability = 'idle' | 'checking' | 'available' | 'taken';

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
  const [availability, setAvailability] = useState<Availability>('idle');

  const normalizedUsername = username.trim().toLowerCase();
  const usernameFormatError =
    normalizedUsername.length > 0 && !USERNAME_PATTERN.test(normalizedUsername)
      ? 'Lowercase letters, numbers, underscore, 3-20 characters'
      : undefined;

  // Reuses get_invite_preview (README-verified callable pre-profile, since
  // it already has to work for anon invite links) as a lightweight exact-
  // match "is this username taken" check -- no username-availability RPC
  // exists, but this one is an exact-match lookup safe for this shape of
  // use (the same anti-enumeration reasoning that already covers its
  // invite-preview job: only an already-known, exact username works).
  useEffect(() => {
    if (usernameFormatError || !normalizedUsername) {
      setAvailability('idle');
      return;
    }
    setAvailability('checking');
    const timer = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc('get_invite_preview', {
        p_username: normalizedUsername,
      });
      if (rpcError) {
        setAvailability('idle');
        return;
      }
      setAvailability(data?.[0] ? 'taken' : 'available');
    }, 400);
    return () => clearTimeout(timer);
  }, [normalizedUsername, usernameFormatError]);

  const parsedBirthYear = Number.parseInt(birthYear, 10);
  const impliedAge = CURRENT_YEAR - parsedBirthYear;
  const birthYearError =
    birthYear.length > 0 && (!Number.isInteger(parsedBirthYear) || impliedAge < MIN_AGE)
      ? `Must indicate an age of at least ${MIN_AGE}`
      : undefined;

  const canSubmit =
    !!session &&
    !isSubmitting &&
    displayName.trim().length > 0 &&
    USERNAME_PATTERN.test(normalizedUsername) &&
    availability !== 'taken' &&
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
      setError(
        insertError.code === '23505' ? 'That username is already taken.' : insertError.message,
      );
      return;
    }

    await invalidateProfile();
    navigate('/home', { replace: true });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-app flex-col justify-center gap-four p-four">
      <div className="flex gap-two">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-pill ${i < 2 ? 'bg-grape' : 'bg-line'}`} />
        ))}
      </div>

      <div>
        <p className="font-mono text-eyebrow tracking-eyebrow font-bold uppercase text-text-faint">
          Step 2 of 3
        </p>
        <h1 className="mt-one font-display text-screen-title font-extrabold tracking-display-tight">
          Set up your player
        </h1>
      </div>

      <div className="flex justify-center">
        <div className="relative">
          <div className="flex h-24 w-24 items-center justify-center rounded-pill border-2 border-dashed border-grape bg-grape-soft text-3xl text-grape-ink">
            +
          </div>
          <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-pill bg-grape text-sm text-on-grape shadow-card">
            📷
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-three">
        <div>
          <p className="mb-one text-sm font-bold text-text-secondary">Display name</p>
          <input
            placeholder="Maya Chen"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-medium border border-line bg-surface p-three"
          />
        </div>

        <div>
          <p className="mb-one text-sm font-bold text-text-secondary">Username</p>
          <div className="relative">
            <input
              placeholder="@maya"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              className={`w-full rounded-medium border bg-surface p-three pr-24 ${
                usernameFormatError || availability === 'taken'
                  ? 'border-danger'
                  : availability === 'available'
                    ? 'border-up'
                    : 'border-line'
              }`}
            />
            {!usernameFormatError && availability !== 'idle' ? (
              <span
                className={`absolute right-three top-1/2 -translate-y-1/2 text-sm font-bold ${
                  availability === 'available'
                    ? 'text-up-ink'
                    : availability === 'taken'
                      ? 'text-danger-ink'
                      : 'text-text-faint'
                }`}
              >
                {availability === 'checking'
                  ? 'Checking…'
                  : availability === 'available'
                    ? '✓ available'
                    : 'Taken'}
              </span>
            ) : null}
          </div>
          {usernameFormatError ? (
            <p className="mt-half text-sm text-danger-ink">{usernameFormatError}</p>
          ) : null}
        </div>

        <div>
          <p className="mb-one text-sm font-bold text-text-secondary">Birth year</p>
          <select
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            className="w-full rounded-medium border border-line bg-surface p-three"
          >
            <option value="">Select…</option>
            {BIRTH_YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          {birthYearError ? (
            <p className="mt-half text-sm text-danger-ink">{birthYearError}</p>
          ) : null}
        </div>

        <label className="flex items-start gap-two rounded-medium border border-line bg-surface p-three">
          <input
            type="checkbox"
            checked={ageAcknowledged}
            onChange={() => setAgeAcknowledged((prev) => !prev)}
            className="mt-half h-5 w-5 accent-grape"
          />
          <span className="text-sm">
            I confirm I&rsquo;m <strong>{MIN_AGE} or older</strong> and understand NoShot is for
            fun, not real-money betting.
          </span>
        </label>

        {error ? <p className="text-sm text-danger-ink">{error}</p> : null}

        <Button variant="primary" fullWidth disabled={!canSubmit} onClick={handleSubmit}>
          {isSubmitting ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </main>
  );
}
