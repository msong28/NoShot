import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

// Dismisses the in-app browser tab once the OAuth provider redirects back to
// the app on native; a documented Expo requirement, must run at module scope.
WebBrowser.maybeCompleteAuthSession();

/**
 * Exchanges the `code` in an OAuth redirect URL for a session (PKCE flow --
 * see the flowType note in src/lib/supabase.ts). Shared by both the web
 * callback screen and the native sign-in flow below, since either can be the
 * one to actually receive the redirect.
 */
export async function createSessionFromUrl(url: string) {
  const { queryParams } = Linking.parse(url);
  const errorDescription = queryParams?.error_description;
  if (typeof errorDescription === 'string') {
    throw new Error(errorDescription);
  }

  const code = queryParams?.code;
  if (typeof code !== 'string') {
    return;
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

/**
 * Google sign-in via a browser redirect (not the native picker) -- see
 * PROJECT_STATUS.md / the Milestone 2 write-up for why: it works on web,
 * iOS, and Android from one code path, and doesn't need a native dev client
 * to test, unlike @react-native-google-signin/google-signin.
 */
export async function signInWithGoogle() {
  const redirectTo = Linking.createURL('/auth-callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  if (Platform.OS === 'web') {
    window.location.assign(data.url);
    return;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') {
    await createSessionFromUrl(result.url);
  }
}

/**
 * Apple sign-in via the native modal -- no browser redirect involved. Only
 * ever available on iOS; callers should check isAppleSignInAvailable() (or
 * just Platform.OS === 'ios') before showing the button at all.
 */
export async function signInWithApple() {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple sign-in did not return an identity token');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
}

export async function isAppleSignInAvailable() {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}
