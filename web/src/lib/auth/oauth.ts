import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

import { supabase } from '@/lib/supabase';

export type OAuthProvider = 'google' | 'apple';

function webRedirectUrl() {
  return `${window.location.origin}/auth/callback`;
}

const initializedProviders = new Set<OAuthProvider>();

/**
 * Lazy, per-provider, once-per-session init -- deliberately independent
 * per provider rather than one combined SocialLogin.initialize() call, so
 * signing in with Apple never depends on Google's env vars being set (and
 * vice versa). Apple needs no real credential on iOS (Sign in with Apple
 * runs on the app's own bundle ID + entitlement at the OS level --
 * `clientId` here only tells the plugin which provider config to use, per
 * its own docs). Google *does* need real OAuth client IDs from the same
 * Google Cloud project Milestone 2 already set up -- supplied via env
 * vars, same pattern as the Supabase URL/anon key. Fill these in
 * VITE_GOOGLE_IOS_CLIENT_ID / VITE_GOOGLE_WEB_CLIENT_ID before Google
 * native sign-in works; until then it throws clearly instead of failing
 * silently against empty strings.
 */
async function ensureProviderInitialized(provider: OAuthProvider) {
  if (initializedProviders.has(provider)) return;

  if (provider === 'google') {
    const iosClientId = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID as string | undefined;
    const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined;
    if (!iosClientId || !webClientId) {
      throw new Error(
        'Google native sign-in is not configured yet -- set VITE_GOOGLE_IOS_CLIENT_ID and VITE_GOOGLE_WEB_CLIENT_ID',
      );
    }
    await SocialLogin.initialize({
      google: {
        iOSClientId: iosClientId,
        iOSServerClientId: webClientId,
        webClientId,
        mode: 'online',
      },
    });
  } else {
    await SocialLogin.initialize({ apple: { clientId: 'com.noshot.web' } });
  }

  initializedProviders.add(provider);
}

/**
 * Native (Capacitor): a real native sign-in sheet via
 * @capgo/capacitor-social-login, exchanging the resulting identity token
 * directly with Supabase (`signInWithIdToken`) -- no browser tab at all,
 * unlike the previous Browser.open() redirect flow this replaces. Web:
 * unchanged full-page OAuth redirect landing on /auth/callback.
 */
export async function signInWithProvider(provider: OAuthProvider) {
  if (Capacitor.isNativePlatform()) {
    await ensureProviderInitialized(provider);
    const { result } = await SocialLogin.login({
      provider,
      options:
        provider === 'google' ? { scopes: ['email', 'profile'] } : { scopes: ['email', 'name'] },
    });
    const idToken = 'idToken' in result ? result.idToken : null;
    if (!idToken) throw new Error(`${provider} sign-in did not return an identity token`);

    const { error } = await supabase.auth.signInWithIdToken({ provider, token: idToken });
    if (error) throw error;
    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: webRedirectUrl(), skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Supabase did not return an OAuth URL');
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
