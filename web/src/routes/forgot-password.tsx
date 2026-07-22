import { useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsSubmitting(false);
    if (resetError) {
      setError(getErrorMessage(resetError, 'Could not send the reset email'));
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-app flex-col justify-center gap-four p-four text-center">
      <div className="flex flex-col items-center">
        <h1 className="font-display text-screen-title font-extrabold tracking-display-tight">
          Reset your password
        </h1>
        <p className="mt-one text-text-secondary">We&rsquo;ll email you a link to set a new one.</p>
      </div>

      {sent ? (
        <p className="text-text-secondary">
          Check <strong>{email}</strong> for a reset link, then come back to sign in.
        </p>
      ) : (
        <div className="flex flex-col gap-two text-left">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="rounded-medium border border-line bg-surface p-three"
          />
          {error ? (
            <p role="alert" className="text-sm text-danger-ink">
              {error}
            </p>
          ) : null}
          <Button
            variant="primary"
            fullWidth
            disabled={!email.trim() || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </div>
      )}

      <Link to="/" className="text-sm text-text-secondary">
        Back to sign in
      </Link>
    </main>
  );
}
