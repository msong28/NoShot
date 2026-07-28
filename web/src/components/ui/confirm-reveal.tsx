/**
 * A quick, fun full-screen confirmation overlay (emoji + headline) for a
 * positive action that just landed -- e.g. a bet being sent or accepted. The
 * animation plays and a tap anywhere continues via `onDone`; it never
 * auto-advances, so every reveal in the app is dismissed the same way. Only
 * fires off an action in this page session, never on a plain revisit.
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
      <p className="mt-two text-xs font-bold text-white/60">Tap to continue</p>
    </button>
  );
}
