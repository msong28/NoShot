import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router';

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
    return <Navigate to="/home" replace />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-app flex-col items-center justify-center gap-three p-four text-center">
      {error ? (
        <>
          {/* Stay on this screen so the failure reason is actually readable --
              navigating away instantly made every exchange failure look like a
              silent bounce back to sign-in. */}
          <p role="alert" className="text-danger">
            {error}
          </p>
          <Link to="/" replace className="text-sm font-bold text-grape-ink">
            Back to sign in
          </Link>
        </>
      ) : (
        <p className="text-text-secondary">Signing you in…</p>
      )}
    </main>
  );
}
