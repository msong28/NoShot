import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';

import { Browser } from '@capacitor/browser';

import { Brick } from '@/components/ui/brick';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/use-session';
import { signInWithProvider } from '@/lib/auth/oauth';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export function SignInScreen() {
  const { session, isLoading } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<'google' | 'apple' | null>(null);

  useEffect(() => {
    // Browser.open()'s promise resolves once the in-app sheet is presented,
    // not once it closes -- so cancelling/dismissing it manually (rather
    // than completing the flow) would otherwise leave pendingProvider stuck
    // forever, since neither success nor the try/catch's error path ever
    // fires in that case.
    const listener = Browser.addListener('browserFinished', () => {
      setPendingProvider(null);
    });
    return () => {
      listener.then((handle) => handle.remove());
    };
  }, []);

  if (!isLoading && session) {
    return <Navigate to="/home" replace />;
  }

  async function handleSignIn(provider: 'google' | 'apple') {
    setError(null);
    setPendingProvider(provider);
    try {
      await signInWithProvider(provider);
    } catch (err) {
      setError(getErrorMessage(err, 'Sign-in failed'));
      setPendingProvider(null);
    }
  }

  async function handlePasswordSignIn() {
    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);
    if (signInError) setError(signInError.message);
    // On success, useSession() picks up the new session via onAuthStateChange
    // and this screen's own Navigate above sends it onward.
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-app flex-col justify-center gap-four p-four">
      <div className="flex flex-col items-center text-center">
        <Brick size={60} variant="default" />
        <h1 className="mt-three font-display text-screen-title font-extrabold tracking-display-tight">
          Welcome back
        </h1>
        <p className="mt-one text-text-secondary">no shot you stayed away this long</p>
      </div>

      {error && (
        <p role="alert" className="rounded-medium bg-danger-soft p-three text-danger-ink">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-two">
        <Button
          variant="ink"
          fullWidth
          disabled={pendingProvider !== null}
          onClick={() => handleSignIn('apple')}
        >
          {pendingProvider === 'apple' ? 'Signing in…' : 'Continue with Apple'}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          disabled={pendingProvider !== null}
          onClick={() => handleSignIn('google')}
        >
          <span className="font-extrabold text-[#4285F4]">G</span>
          {pendingProvider === 'google' ? 'Signing in…' : 'Continue with Google'}
        </Button>
      </div>

      <div className="flex items-center gap-three text-sm text-text-faint">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="flex flex-col gap-two">
        <div>
          <p className="mb-one text-sm font-bold text-text-secondary">Email</p>
          <input
            type="email"
            aria-label="Email"
            placeholder="maya@email.com"
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
            autoComplete="current-password"
            className="w-full rounded-medium border border-line bg-surface p-three"
          />
        </div>
        <Link to="/forgot-password" className="self-end text-sm font-bold text-grape-ink">
          Forgot password?
        </Link>
        <Button
          variant="primary"
          fullWidth
          onClick={handlePasswordSignIn}
          disabled={isSubmitting || !email || !password}
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
        <Link to="/sign-up" className="text-center text-sm text-text-secondary">
          New here? <span className="font-bold text-grape-ink">Create account</span>
        </Link>
      </div>
    </main>
  );
}
