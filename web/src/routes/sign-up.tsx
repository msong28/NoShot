import { useState } from 'react';
import { Link, Navigate } from 'react-router';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

const MIN_PASSWORD_LENGTH = 8;

export function SignUpScreen() {
  const { session, isLoading } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

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

  if (confirmationSent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-app flex-col justify-center gap-three p-four">
        <h1 className="font-display text-2xl font-extrabold">Check your email</h1>
        <p className="text-text-secondary">
          We sent a confirmation link to {email.trim()}. Follow it, then come back and sign in.
        </p>
        <Link to="/" className="font-display text-sm text-secondary">
          Back to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-app flex-col justify-center gap-four p-four">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Create account</h1>
        <p className="mt-two text-text-secondary">
          Email and password only — you&apos;ll pick a username next.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-medium bg-danger-bg p-three text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-two">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="rounded-medium bg-surface p-three shadow-card"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="rounded-medium bg-surface p-three shadow-card"
        />
        {password.length > 0 && password.length < MIN_PASSWORD_LENGTH ? (
          <p className="text-sm text-danger">At least {MIN_PASSWORD_LENGTH} characters</p>
        ) : null}
        <button
          type="button"
          onClick={handleSignUp}
          disabled={isSubmitting || !email || password.length < MIN_PASSWORD_LENGTH}
          className="rounded-pill bg-primary px-four py-three font-display font-bold text-on-primary shadow-card disabled:opacity-60"
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
        <Link to="/" className="text-center font-display text-sm text-text-secondary">
          Already have an account? Sign in
        </Link>
      </div>
    </main>
  );
}
