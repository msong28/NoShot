import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

import { supabase } from '@/lib/supabase';

export type OAuthProvider = 'google' | 'apple';

const NATIVE_REDIRECT_URL = 'noshotweb://auth-callback';

function webRedirectUrl() {
  return `${window.location.origin}/auth/callback`;
}

/**
 * Both Google and Apple go through the same browser-redirect flow -- no
 * native Apple modal, unlike the Expo app's expo-apple-authentication path.
 * Native (Capacitor) opens the URL in an in-app sheet and waits for the
 * appUrlOpen deep link (see deep-link.ts); web does a plain full-page
 * redirect and lands on /auth/callback.
 */
export async function signInWithProvider(provider: OAuthProvider) {
  const isNative = Capacitor.isNativePlatform();
  const redirectTo = isNative ? NATIVE_REDIRECT_URL : webRedirectUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Supabase did not return an OAuth URL');

  if (isNative) {
    await Browser.open({ url: data.url });
    return;
  }

  window.location.assign(data.url);
}

/** Shared by the web /auth/callback route and the native deep-link handler. */
export async function exchangeCodeForSession(url: string) {
  const parsed = new URL(url);
  const errorDescription = parsed.searchParams.get('error_description');
  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const code = parsed.searchParams.get('code');
  if (!code) return;

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}
