import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Capacitor } from '@capacitor/core';
import OneSignal from 'onesignal-cordova-plugin';

import { supabase } from '@/lib/supabase';

import { initializeOneSignal, registerPushAuthListener, requestPushPermission } from './onesignal';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn() } }));
vi.mock('onesignal-cordova-plugin', () => ({
  default: {
    initialize: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    Notifications: { requestPermission: vi.fn() },
  },
}));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: vi.fn() } },
}));

describe('initializeOneSignal', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it('does nothing on web', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    initializeOneSignal();

    expect(OneSignal.initialize).not.toHaveBeenCalled();
  });

  it('warns and skips init on native when no app id is configured', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.stubEnv('VITE_ONESIGNAL_APP_ID', '');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    initializeOneSignal();

    expect(OneSignal.initialize).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('VITE_ONESIGNAL_APP_ID'));
  });
});

describe('registerPushAuthListener', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing on web', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    registerPushAuthListener();

    expect(supabase.auth.onAuthStateChange).not.toHaveBeenCalled();
  });

  it('registers an auth listener on native', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

    registerPushAuthListener();

    expect(supabase.auth.onAuthStateChange).toHaveBeenCalled();
  });
});

describe('requestPushPermission', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves false on web without calling the native SDK', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    await expect(requestPushPermission()).resolves.toBe(false);

    expect(OneSignal.Notifications.requestPermission).not.toHaveBeenCalled();
  });
});
