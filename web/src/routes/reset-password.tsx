import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { exchangeCodeForSession } from '@/lib/auth/oauth';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/**
 * Landing spot for the emailed password-recovery link. Reuses the same
 * `exchangeCodeForSession` helper /auth/callback uses for OAuth -- with
 * this project's PKCE flow, Supabase's recovery-email redirect carries the
 * same `?code=` param, so the exchange call is identical either way.
 */
export function ResetPasswordScreen() {
  const [status, setStatus] = useState<'exchanging' | 'ready' | 'error'>('exchanging');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    exchangeCodeForSession(window.location.href)
      .then(() => setStatus('ready'))
      .catch((err) => {
        setError(getErrorMessage(err, 'This reset link is invalid or has expired.'));
        setStatus('error');
      });
  }, []);

  async function handleSubmit() {
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    setIsSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);
    if (updateError) {
      setError(getErrorMessage(updateError, 'Could not update your password'));
      return;
    }
    setDone(true);
  }

  if (done) {
    return <Navigate to="/home" replace />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-app flex-col justify-center gap-four p-four text-center">
      <h1 className="font-display text-screen-title font-extrabold tracking-display-tight">
        Set a new password
      </h1>

      {status === 'exchanging' ? (
        <p className="text-text-secondary">Verifying your reset link…</p>
      ) : null}

      {status === 'error' ? (
        <>
          <p role="alert" className="text-danger-ink">
            {error}
          </p>
          <Link to="/forgot-password" className="text-sm font-bold text-grape-ink">
            Request a new link
          </Link>
        </>
      ) : null}

      {status === 'ready' ? (
        <div className="flex flex-col gap-two text-left">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="rounded-medium border border-line bg-surface p-three"
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="rounded-medium border border-line bg-surface p-three"
          />
          {error ? (
            <p role="alert" className="text-sm text-danger-ink">
              {error}
            </p>
          ) : null}
          <Button variant="primary" fullWidth disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      ) : null}
    </main>
  );
}
