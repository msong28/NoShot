import { useEffect } from 'react';

/** How long the reveal holds before it auto-advances via `onDone`. Short and
 * punchy -- a "here's what just happened" beat, not a loading screen; a tap
 * skips it early. */
const HOLD_MS = 1600;

/**
 * A quick, fun full-screen confirmation overlay (emoji + headline) for a
 * positive action that just landed -- e.g. a bet being accepted. Auto-advances
 * to `onDone` after a short hold, and a tap skips it. Only fires off an action
 * in this page session, never on a plain revisit.
 */
export function ConfirmReveal({
  emoji,
  title,
  subtitle,
  onDone,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, HOLD_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <button
      type="button"
      onClick={onDone}
      aria-label="Continue"
      className="fixed inset-0 z-50 flex w-full flex-col items-center justify-center gap-four overflow-hidden bg-grape p-four text-center text-white"
    >
      <div className="relative flex h-28 w-28 items-center justify-center">
        <span aria-hidden className="absolute inset-0 animate-ping rounded-pill bg-white/25" />
        <span className="relative flex h-28 w-28 animate-bounce items-center justify-center rounded-pill bg-white/15 text-5xl">
          {emoji}
        </span>
      </div>
      <div>
        <p className="font-display text-lg font-extrabold">{title}</p>
        {subtitle ? <p className="mt-one text-white/80">{subtitle}</p> : null}
      </div>
    </button>
  );
}
