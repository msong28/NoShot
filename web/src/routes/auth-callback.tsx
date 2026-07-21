import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router';

import { exchangeCodeForSession } from '@/lib/auth/oauth';
import { getErrorMessage } from '@/lib/errors';

/**
 * Web-only landing spot for the OAuth redirect -- native resolves the
 * exchange via the Capacitor deep-link listener (lib/auth/deep-link.ts) and
 * typically never renders this route at all.
 */
export function AuthCallbackScreen() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    exchangeCodeForSession(window.location.href)
      .then(() => setDone(true))
      .catch((err) => setError(getErrorMessage(err, 'Sign-in failed')));
  }, []);

  if (done) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-app flex-col items-center justify-center gap-three p-four text-center">
      {error ? (
        <>
          <p role="alert" className="text-danger">
            {error}
          </p>
          <Navigate to="/" replace />
        </>
      ) : (
        <p className="text-text-secondary">Signing you in…</p>
      )}
    </main>
  );
}
