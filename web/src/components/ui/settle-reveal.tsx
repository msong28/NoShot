export type SettleOutcome = 'won' | 'lost' | 'tied';

const CONFETTI = [
  { top: '18%', left: '14%', color: 'bg-lime', rotate: '15deg' },
  { top: '30%', left: '78%', color: 'bg-up', rotate: '-20deg' },
  { top: '12%', left: '60%', color: 'bg-white', rotate: '40deg' },
  { top: '45%', left: '8%', color: 'bg-down', rotate: '-10deg' },
  { top: '55%', left: '85%', color: 'bg-lime', rotate: '25deg' },
  { top: '8%', left: '35%', color: 'bg-up', rotate: '-30deg' },
  { top: '65%', left: '20%', color: 'bg-white', rotate: '10deg' },
] as const;

const THEME: Record<
  SettleOutcome,
  { bg: string; emoji: string; headline: string; accent: string; confetti: boolean }
> = {
  won: { bg: 'bg-grape', emoji: '🏆', headline: 'You won!', accent: 'text-lime', confetti: true },
  lost: { bg: 'bg-down', emoji: '💸', headline: 'You lost', accent: 'text-white', confetti: false },
  tied: {
    bg: 'bg-ink',
    emoji: '🤝',
    headline: "It's a tie",
    accent: 'text-white',
    confetti: false,
  },
};

/**
 * Same-session "here's what happened" overlay shown to whoever settles a bet,
 * for every outcome -- a quick, fun beat that showcases the result (including a
 * loss). The animation plays and a tap anywhere continues via `onDone` (which
 * drops them on their Done bets); it never auto-advances, matching every other
 * reveal. Only fires off the settling action in this page session, never on a
 * plain revisit.
 */
export function SettleReveal({
  outcome,
  betTitle,
  opponentName,
  amount,
  currencyName,
  currencyIcon,
  onDone,
}: {
  outcome: SettleOutcome;
  betTitle: string;
  opponentName: string;
  amount: number;
  currencyName?: string;
  currencyIcon?: string | null;
  onDone: () => void;
}) {
  const theme = THEME[outcome];
  const amountLabel = `${currencyIcon ? `${currencyIcon} ` : ''}${currencyName ?? 'Payout'} ×${amount}`;

  return (
    <button
      type="button"
      onClick={onDone}
      aria-label="Continue"
      className={`fixed inset-0 z-50 flex w-full flex-col items-center justify-center overflow-hidden p-four text-center text-white ${theme.bg}`}
    >
      {theme.confetti
        ? CONFETTI.map((c, i) => (
            <span
              key={i}
              aria-hidden
              className={`absolute h-3 w-3 animate-bounce ${c.color}`}
              style={{ top: c.top, left: c.left, transform: `rotate(${c.rotate})` }}
            />
          ))
        : null}

      <p className="font-mono text-eyebrow tracking-eyebrow font-bold uppercase text-white/70">
        Result is in
      </p>

      <div className="relative mt-three flex h-32 w-32 items-center justify-center">
        <span aria-hidden className="absolute inset-0 rounded-pill bg-white/20 animate-ping" />
        <span className="relative flex h-32 w-32 animate-bounce items-center justify-center rounded-pill bg-white/15 text-6xl">
          {theme.emoji}
        </span>
      </div>

      <h1 className="mt-four font-display text-hero font-extrabold tracking-display-tight">
        {theme.headline}
      </h1>
      <p className="mt-one text-white/80">{betTitle}</p>

      {outcome === 'tied' ? (
        <div className="mt-four w-full max-w-app rounded-large bg-white/15 p-four">
          <p className="font-display text-lg font-extrabold">No one owes anyone</p>
        </div>
      ) : (
        <div className="mt-four w-full max-w-app rounded-large bg-white/15 p-four">
          <p className="text-xs text-white/70">
            {outcome === 'won'
              ? `${opponentName.toUpperCase()} OWES YOU`
              : `YOU OWE ${opponentName.toUpperCase()}`}
          </p>
          <p className={`mt-one font-display text-lg font-extrabold ${theme.accent}`}>
            {amountLabel}
          </p>
        </div>
      )}

      <p className="mt-six text-xs font-bold text-white/60">Tap to continue</p>
    </button>
  );
}
