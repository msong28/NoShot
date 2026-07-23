export function getInviteLink(username: string): string {
  return `${window.location.origin}/invite/${username}`;
}

/**
 * Tries the native share sheet first (Messages/Mail/AirDrop/etc -- works in
 * the Capacitor WebView on a real device, and in most modern mobile
 * browsers), falling back to a clipboard copy for platforms without Web
 * Share support (most desktop browsers). Returns which path was taken so
 * callers know whether to show their own confirmation -- a native share
 * sheet already gives its own feedback, a silent clipboard copy doesn't.
 */
export async function shareInviteLink(
  username: string,
  displayName: string,
): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = getInviteLink(username);

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'NoShot',
        text: `${displayName} is on NoShot -- bets with friends, no real money, just bragging rights.`,
        url,
      });
      return 'shared';
    } catch (err) {
      // AbortError = the user dismissed the share sheet themselves, not a
      // real failure -- don't fall through to a clipboard copy they didn't
      // ask for. Any other error (e.g. share unsupported for this data on
      // this platform) does fall through.
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    }
  }

  await navigator.clipboard.writeText(url);
  return 'copied';
}
