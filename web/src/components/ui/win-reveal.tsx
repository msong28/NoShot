import { Brick } from '@/components/ui/brick';

const CONFETTI = [
  { top: '18%', left: '14%', color: 'bg-lime', rotate: '15deg' },
  { top: '30%', left: '78%', color: 'bg-up', rotate: '-20deg' },
  { top: '12%', left: '60%', color: 'bg-white', rotate: '40deg' },
  { top: '45%', left: '8%', color: 'bg-down', rotate: '-10deg' },
  { top: '55%', left: '85%', color: 'bg-lime', rotate: '25deg' },
  { top: '8%', left: '35%', color: 'bg-up', rotate: '-30deg' },
  { top: '65%', left: '20%', color: 'bg-white', rotate: '10deg' },
] as const;

/**
 * README §"Win reveal": a same-session celebration overlay -- triggered
 * once, immediately after an action in this page session resolves the bet
 * in the viewer's favor (no "has this been seen" backend state; it never
 * reappears on a later visit since revisiting doesn't re-fire the
 * triggering mutation).
 */
export function WinReveal({
  betTitle,
  opponentName,
  payout,
  currencyName,
  currencyIcon,
  onDismiss,
}: {
  betTitle: string;
  opponentName: string;
  payout: number;
  currencyName?: string;
  currencyIcon?: string | null;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-grape p-four text-center text-white">
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          aria-hidden
          className={`absolute h-3 w-3 ${c.color}`}
          style={{ top: c.top, left: c.left, transform: `rotate(${c.rotate})` }}
        />
      ))}

      <p className="font-mono text-eyebrow tracking-eyebrow font-bold uppercase text-lime">
        Result is in
      </p>
      <div className="mt-three rounded-pill ring-4 ring-white/40">
        <Brick size={120} variant="cheeky" />
      </div>
      <h1 className="mt-four font-display text-hero font-extrabold tracking-display-tight">
        You won! 🏆
      </h1>
      <p className="mt-one text-white/80">{betTitle}</p>

      <div className="mt-four w-full rounded-large bg-white/15 p-four">
        <p className="text-xs text-white/70">{opponentName.toUpperCase()} OWES YOU</p>
        <p className="mt-one font-display text-lg font-extrabold text-lime">
          {currencyIcon ? `${currencyIcon} ` : ''}
          {currencyName ?? 'Payout'} ×{payout}
        </p>
      </div>

      <div className="mt-auto flex w-full flex-col gap-two pt-six">
        <button
          type="button"
          onClick={onDismiss}
          className="w-full rounded-[16px] bg-lime px-four py-three font-extrabold text-on-lime"
        >
          Rub it in 😏
        </button>
        <button type="button" onClick={onDismiss} className="w-full py-two font-bold text-white">
          Cash in later
        </button>
      </div>
    </div>
  );
}
