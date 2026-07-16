import * as AppleAuthentication from 'expo-apple-authentication';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/inline-error';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getErrorMessage } from '@/lib/errors';
import { isAppleSignInAvailable, signInWithApple, signInWithGoogle } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const colorScheme = useColorScheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAppleButton, setShowAppleButton] = useState(false);

  useEffect(() => {
    isAppleSignInAvailable().then(setShowAppleButton);
  }, []);

  async function handleSignIn() {
    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);
    if (signInError) setError(signInError.message);
    // On success, useSession() picks up the new session via onAuthStateChange
    // and the root layout's Stack.Protected routes away from here.
  }

  async function handleGoogleSignIn() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(getErrorMessage(err, 'Google sign-in failed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAppleSignIn() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithApple();
    } catch (err) {
      setError(getErrorMessage(err, 'Apple sign-in failed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen scroll={false}>
        <ThemedText type="headingXL">NoShot</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          Sign in to your account.
        </ThemedText>

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
        />

        <InlineError message={error} />

        <Button
          variant="primary"
          onPress={handleSignIn}
          disabled={isSubmitting || !email || !password}
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>

        <ThemedText type="bodySM" themeColor="textMuted" style={styles.divider}>
          or
        </ThemedText>

        <Button variant="outline" onPress={handleGoogleSignIn} disabled={isSubmitting}>
          Continue with Google
        </Button>

        {showAppleButton ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={
              colorScheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={999}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
        ) : null}

        <Link href="/sign-up" style={styles.link}>
          <ThemedText type="link">Need an account? Create one</ThemedText>
        </Link>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  link: {
    alignSelf: 'center',
    marginTop: Spacing.two,
  },
  divider: {
    textAlign: 'center',
  },
  appleButton: {
    height: 44,
    width: '100%',
  },
});
