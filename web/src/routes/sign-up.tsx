import { useState } from 'react';
import { Link, Navigate } from 'react-router';

import { BackButton } from '@/components/ui/back-button';
import { Brick } from '@/components/ui/brick';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const MIN_PASSWORD_LENGTH = 8;

/** Real, simple heuristic (length + character-class variety) -- not a
 * fabricated meter. Maps to the mock's 4-segment bar + a mono label. */
function passwordStrength(password: string): { segments: number; label: string } {
  if (!password) return { segments: 0, label: '' };
  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password) || /[^a-zA-Z0-9]/.test(password)) score += 1;
  const labels = ['weak', 'weak', 'fair', 'good', 'strong'];
  return { segments: score, label: labels[score] };
}

export function SignUpScreen() {
  const { session, isLoading } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendError, setResendError] = useState<string | null>(null);

  if (!isLoading && session) {
    return <Navigate to="/home" replace />;
  }

  async function handleSignUp() {
    setError(null);
    setIsSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // If the project requires email confirmation, signUp() succeeds but
    // returns no session yet. Otherwise useSession() picks up the new
    // session via onAuthStateChange and this screen's own Navigate above
    // sends it onward.
    if (!data.session) {
      setConfirmationSent(true);
    }
  }

  async function handleResend() {
    setResendState('sending');
    setResendError(null);
    const { error: resendErr } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    });
    if (resendErr) {
      setResendError(getErrorMessage(resendErr, 'Could not resend the email'));
      setResendState('error');
      return;
    }
    setResendState('sent');
  }

  if (confirmationSent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-app flex-col items-center justify-center gap-three p-four text-center">
        <div className="relative">
          <div className="flex h-24 w-24 items-center justify-center rounded-pill bg-grape-soft">
            <Brick size={60} variant="waiting" />
          </div>
          <span className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-pill bg-surface text-base shadow-card">
            ✉️
          </span>
        </div>

        <h1 className="mt-two font-display text-screen-title font-extrabold tracking-display-tight">
          Check your email
        </h1>
        <p className="text-text-secondary">
          We sent a link to <strong>{email.trim()}</strong>. Tap it, then come back to sign in.
        </p>

        <p className="rounded-pill border border-line px-three py-one font-mono text-xs font-bold uppercase tracking-eyebrow text-text-faint">
          no shot you&rsquo;re in yet — confirm first
        </p>

        <a
          href={`mailto:${email.trim()}`}
          className="w-full rounded-[16px] bg-grape px-four py-three font-extrabold text-on-grape shadow-primary-button"
        >
          Open mail app
        </a>

        {resendState === 'sent' ? (
          <p className="text-sm font-bold text-up-ink">Email resent.</p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resendState === 'sending'}
            className="text-sm font-bold text-grape-ink disabled:opacity-60"
          >
            {resendState === 'sending' ? 'Resending…' : 'Resend email'}
          </button>
        )}
        {resendState === 'error' && resendError ? (
          <p role="alert" className="text-sm text-danger-ink">
            {resendError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setConfirmationSent(false)}
          className="text-sm text-text-secondary"
        >
          Wrong address? <span className="font-bold text-grape-ink">Go back</span>
        </button>
      </main>
    );
  }

  const strength = passwordStrength(password);

  return (
    <main className="mx-auto flex min-h-screen max-w-app flex-col justify-center gap-four p-four">
      <div>
        <BackButton />
        <h1 className="mt-three font-display text-screen-title font-extrabold tracking-display-tight">
          Make it official
        </h1>
        <p className="mt-two text-text-secondary">One account, all your bets in one place.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-medium bg-danger-soft p-three text-danger-ink">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-two">
        <div>
          <p className="mb-one text-sm font-bold text-text-secondary">Email</p>
          <input
            type="email"
            aria-label="Email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-medium border border-line bg-surface p-three"
          />
        </div>

        <div>
          <p className="mb-one text-sm font-bold text-text-secondary">Password</p>
          <input
            type="password"
            aria-label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className={`w-full rounded-medium border bg-surface p-three ${
              password.length > 0 ? 'border-grape' : 'border-line'
            }`}
          />
          {password.length > 0 ? (
            <div className="mt-two flex items-center gap-two">
              <div className="flex flex-1 gap-one">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-pill ${i < strength.segments ? 'bg-up' : 'bg-line'}`}
                  />
                ))}
              </div>
              <span className="font-mono text-xs font-bold text-up-ink">{strength.label}</span>
            </div>
          ) : null}
        </div>

        <Button
          variant="primary"
          fullWidth
          onClick={handleSignUp}
          disabled={isSubmitting || !email || password.length < MIN_PASSWORD_LENGTH}
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>

        <p className="text-center text-xs text-text-faint">
          By continuing you agree to our{' '}
          <Link to="/terms" className="font-bold text-grape-ink">
            Terms
          </Link>{' '}
          &amp;{' '}
          <Link to="/privacy-policy" className="font-bold text-grape-ink">
            Privacy Policy
          </Link>
          . NoShot is for fun — no real-money betting.
        </p>

        <Link to="/" className="text-center text-sm text-text-secondary">
          Got an account? <span className="font-bold text-grape-ink">Sign in</span>
        </Link>
      </div>
    </main>
  );
}
