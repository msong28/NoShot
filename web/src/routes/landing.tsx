import { Link, Navigate } from 'react-router';

import { Brick } from '@/components/ui/brick';
import { useSession } from '@/hooks/use-session';

const STEPS = [
  {
    emoji: '🤝',
    title: 'Pick a rival',
    body: 'Challenge a friend to anything — chores, coffee, who’s right.',
  },
  {
    emoji: '🎯',
    title: 'Set the stakes',
    body: 'Name the bet, agree on what’s on the line, lock it in.',
  },
  {
    emoji: '🏆',
    title: 'Settle up',
    body: 'Brick keeps score and tracks who owes what, so nobody has to nag.',
  },
] as const;

const linkButton =
  'inline-flex w-full items-center justify-center rounded-[16px] px-four py-three text-sm font-extrabold transition-opacity active:opacity-70';

/** Public front door at `/`. Signed-in visitors skip straight to /home;
 * everyone else gets the pitch and a path to sign-up or sign-in. */
export function LandingScreen() {
  const { session, isLoading } = useSession();

  if (!isLoading && session) {
    return <Navigate to="/home" replace />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-app flex-col gap-five p-four">
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <Brick size={120} variant="cheeky" />
        <h1 className="mt-four font-display text-hero font-extrabold tracking-display-tight">
          Bet your friends.
          <br />
          <span className="text-grape-ink">Keep the receipts.</span>
        </h1>
        <p className="mt-three max-w-xs text-text-secondary">
          NoShot is the unofficial referee for bets with friends — set the stakes, call the winner,
          and track who owes what.
        </p>
        <div className="mt-five flex w-full flex-col gap-two">
          <Link
            to="/sign-up"
            className={`${linkButton} bg-grape text-on-grape shadow-primary-button`}
          >
            Get started
          </Link>
          <Link to="/sign-in" className={`${linkButton} border border-line bg-surface text-ink`}>
            I already have an account
          </Link>
        </div>
      </section>

      <section aria-label="How it works" className="flex flex-col gap-three">
        <h2 className="text-center text-sm font-bold uppercase tracking-wide text-text-faint">
          How it works
        </h2>
        {STEPS.map((step) => (
          <div
            key={step.title}
            className="flex items-start gap-three rounded-medium border border-line bg-surface p-three"
          >
            <span aria-hidden className="text-2xl">
              {step.emoji}
            </span>
            <div>
              <h3 className="font-bold">{step.title}</h3>
              <p className="text-sm text-text-secondary">{step.body}</p>
            </div>
          </div>
        ))}
      </section>

      <footer className="flex justify-center gap-three pb-three text-xs text-text-faint">
        <Link to="/terms">Terms</Link>
        <Link to="/privacy-policy">Privacy</Link>
        <Link to="/community-guidelines">Guidelines</Link>
      </footer>
    </main>
  );
}
