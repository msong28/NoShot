import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

import { supabase } from '@/lib/supabase';

import { exchangeCodeForSession, signInWithProvider } from './oauth';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn(),
      signInWithIdToken: vi.fn(),
      exchangeCodeForSession: vi.fn(),
    },
  },
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(), getPlatform: vi.fn(() => 'ios') },
}));
vi.mock('@capgo/capacitor-social-login', () => ({
  SocialLogin: { initialize: vi.fn(), login: vi.fn() },
}));

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

describe('signInWithProvider (native)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.stubEnv('VITE_GOOGLE_IOS_CLIENT_ID', 'ios-client-id');
    vi.stubEnv('VITE_GOOGLE_WEB_CLIENT_ID', 'web-client-id');
  });

  afterEach(() => vi.unstubAllEnvs());

  // Must run before any other test successfully initializes 'google' --
  // ensureProviderInitialized() only re-checks env vars the first time a
  // given provider is initialized per module lifetime.
  it('throws a clear error for google when the client IDs are not configured', async () => {
    vi.unstubAllEnvs();

    await expect(signInWithProvider('google')).rejects.toThrow(
      'Google native sign-in is not configured yet',
    );
    expect(SocialLogin.login).not.toHaveBeenCalled();
  });

  it('exchanges the native Apple identity token with Supabase, no browser involved', async () => {
    vi.mocked(SocialLogin.login).mockResolvedValue({
      provider: 'apple',
      result: { idToken: 'apple-id-token' },
    } as never);
    vi.mocked(supabase.auth.signInWithIdToken).mockResolvedValue({ error: null } as never);

    await signInWithProvider('apple');

    expect(SocialLogin.login).toHaveBeenCalledWith({
      provider: 'apple',
      options: { scopes: ['email', 'name'] },
    });
    expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'apple-id-token',
    });
  });

  it('exchanges the native Google identity token with Supabase', async () => {
    vi.mocked(SocialLogin.login).mockResolvedValue({
      provider: 'google',
      result: { idToken: 'google-id-token' },
    } as never);
    vi.mocked(supabase.auth.signInWithIdToken).mockResolvedValue({ error: null } as never);

    await signInWithProvider('google');

    expect(SocialLogin.login).toHaveBeenCalledWith({
      provider: 'google',
      options: { scopes: ['email', 'profile'] },
    });
    expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'google-id-token',
    });
  });

  it('throws instead of exchanging when no identity token comes back', async () => {
    vi.mocked(SocialLogin.login).mockResolvedValue({
      provider: 'apple',
      result: { idToken: null },
    } as never);

    await expect(signInWithProvider('apple')).rejects.toThrow('did not return an identity token');
    expect(supabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  });
});
