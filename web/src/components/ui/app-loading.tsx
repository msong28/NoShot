import { Brick } from '@/components/ui/brick';

/**
 * The app-boot/auth-check moment -- the closest thing this SPA has to a
 * native "splash" screen. Shared by the three route guards that gate on
 * session/profile resolution, so it isn't duplicated three times. Not for
 * per-screen data-loading spinners elsewhere (those stay plain text --
 * Brick is for emotional beats, not dense/functional UI).
 */
export function AppLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-two p-four">
      <Brick size={60} variant="waiting" />
      <p className="text-text-secondary">Loading…</p>
    </main>
  );
}
