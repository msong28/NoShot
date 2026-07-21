import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';

import { Browser } from '@capacitor/browser';

import { useSession } from '@/hooks/use-session';
import { signInWithProvider } from '@/lib/auth/oauth';
import { getErrorMessage } from '@/lib/errors';

export function SignInScreen() {
  const { session, isLoading } = useSession();
  const [error, setError] = useState<string | null>(null);
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

  return (
    <main className="mx-auto flex min-h-screen max-w-app flex-col justify-center gap-four p-four">
      <div>
        <h1 className="font-display text-3xl font-extrabold">NoShot</h1>
        <p className="mt-two text-text-secondary">Bet with your friends. Settle up without the drama.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-medium bg-danger-bg p-three text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-three">
        <button
          type="button"
          onClick={() => handleSignIn('google')}
          disabled={pendingProvider !== null}
          className="rounded-pill bg-primary px-four py-three font-display font-bold text-on-primary shadow-card disabled:opacity-60"
        >
          {pendingProvider === 'google' ? 'Signing in…' : 'Continue with Google'}
        </button>
        <button
          type="button"
          onClick={() => handleSignIn('apple')}
          disabled={pendingProvider !== null}
          className="rounded-pill bg-secondary px-four py-three font-display font-bold text-on-secondary shadow-card disabled:opacity-60"
        >
          {pendingProvider === 'apple' ? 'Signing in…' : 'Continue with Apple'}
        </button>
      </div>
    </main>
  );
}
