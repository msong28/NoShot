import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Capacitor } from '@capacitor/core';

import { supabase } from '@/lib/supabase';

import { exchangeCodeForSession, signInWithProvider } from './oauth';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithOAuth: vi.fn(), exchangeCodeForSession: vi.fn() } },
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn() } }));
vi.mock('@capacitor/browser', () => ({ Browser: { open: vi.fn(), close: vi.fn() } }));

describe('exchangeCodeForSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exchanges the code found in the URL', async () => {
    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({ error: null } as never);

    await exchangeCodeForSession('https://app.test/auth/callback?code=abc123');

    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
  });

  it('throws on an error_description instead of exchanging', async () => {
    await expect(
      exchangeCodeForSession('https://app.test/auth/callback?error_description=denied'),
    ).rejects.toThrow('denied');

    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('no-ops when the URL has no code', async () => {
    await exchangeCodeForSession('https://app.test/auth/callback');

    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe('signInWithProvider (web)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://app.test', assign: vi.fn() },
      writable: true,
    });
  });

  it('requests an OAuth URL and redirects the browser', async () => {
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
      data: { url: 'https://accounts.google.com/authorize' },
      error: null,
    } as never);

    await signInWithProvider('google');

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://app.test/auth/callback', skipBrowserRedirect: true },
    });
    expect(window.location.assign).toHaveBeenCalledWith('https://accounts.google.com/authorize');
  });

  it('uses the identical code path for apple', async () => {
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
      data: { url: 'https://appleid.apple.com/authorize' },
      error: null,
    } as never);

    await signInWithProvider('apple');

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: { redirectTo: 'https://app.test/auth/callback', skipBrowserRedirect: true },
    });
  });
});
