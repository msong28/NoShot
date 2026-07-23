import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getInviteLink, shareInviteLink } from './invite-link';

describe('getInviteLink', () => {
  it('builds an absolute invite URL from the current origin', () => {
    expect(getInviteLink('maya')).toBe(`${window.location.origin}/invite/maya`);
  });
});

describe('shareInviteLink', () => {
  const originalShare = navigator.share;
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
  });

  it('uses the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });

    const result = await shareInviteLink('maya', 'Maya Chen');

    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: `${window.location.origin}/invite/maya` }),
    );
    expect(result).toBe('shared');
  });

  it('reports "cancelled" without falling back to a clipboard copy when the user dismisses the share sheet', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('dismissed'), { name: 'AbortError' }));
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const result = await shareInviteLink('maya', 'Maya Chen');

    expect(result).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to a clipboard copy when share fails for a real reason', async () => {
    const share = vi.fn().mockRejectedValue(new Error('not supported for this data'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const result = await shareInviteLink('maya', 'Maya Chen');

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/maya`);
    expect(result).toBe('copied');
  });

  it('copies to the clipboard directly when the Web Share API is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const result = await shareInviteLink('maya', 'Maya Chen');

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/maya`);
    expect(result).toBe('copied');
  });
});
