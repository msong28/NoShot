import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/**
 * Where the Google OAuth redirect (web) or a missed native deep link lands.
 * The native happy path usually never reaches this screen -- signInWithGoogle
 * and signInWithApple in src/lib/oauth.ts handle the session exchange
 * directly -- but it's the only place web has, since a full-page redirect
 * can't resolve a JS promise the way expo-web-browser's native flow does.
 */
export default function AuthCallbackScreen() {
  const { code, error_description: errorDescription } = useLocalSearchParams<{
    code?: string;
    error_description?: string;
  }>();
  const [error, setError] = useState<string | null>(errorDescription ?? null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current || errorDescription) return;
    hasRun.current = true;

    if (!code) {
      router.replace('/');
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) {
        setError(getErrorMessage(exchangeError, 'Sign-in failed'));
        return;
      }
      // useSession() picks up the new session and the root layout's
      // Stack.Protected routes to setup-profile or the main tabs from here.
      router.replace('/');
    });
  }, [code, errorDescription]);

  return (
    <ThemedView style={styles.screen}>
      <ThemedView style={styles.content}>
        {error ? (
          <>
            <ThemedText themeColor="negative">{error}</ThemedText>
            <Button onPress={() => router.replace('/')}>Back to sign in</Button>
          </>
        ) : (
          <>
            <ActivityIndicator />
            <ThemedText themeColor="textSecondary">Signing you in…</ThemedText>
          </>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
});
