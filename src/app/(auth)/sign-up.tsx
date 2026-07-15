import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const MIN_PASSWORD_LENGTH = 8;

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSignUp() {
    setError(null);
    setIsSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // If the project requires email confirmation, signUp() succeeds but
    // returns no session yet. Otherwise useSession() picks up the new
    // session via onAuthStateChange and the root layout routes onward.
    if (!data.session) {
      setConfirmationSent(true);
    }
  }

  if (confirmationSent) {
    return (
      <ThemedView style={styles.screen}>
        <ThemedView
          style={[
            styles.content,
            { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.four },
          ]}
        >
          <ThemedText type="title">Check your email</ThemedText>
          <ThemedText themeColor="textSecondary">
            We sent a confirmation link to {email.trim()}. Follow it, then come back and sign in.
          </ThemedText>
          <Link href="/" style={styles.link}>
            <ThemedText type="link">Back to sign in</ThemedText>
          </Link>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ThemedView
          style={[
            styles.content,
            { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.four },
          ]}
        >
          <ThemedText type="title">Create account</ThemedText>
          <ThemedText themeColor="textSecondary">
            Email and password only — you&apos;ll pick a username next.
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
            autoComplete="new-password"
            textContentType="newPassword"
            error={
              password.length > 0 && password.length < MIN_PASSWORD_LENGTH
                ? `At least ${MIN_PASSWORD_LENGTH} characters`
                : undefined
            }
          />

          {error ? (
            <ThemedText themeColor="negative" type="small">
              {error}
            </ThemedText>
          ) : null}

          <Button
            onPress={handleSignUp}
            disabled={isSubmitting || !email || password.length < MIN_PASSWORD_LENGTH}
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>

          <Link href="/" style={styles.link}>
            <ThemedText type="link">Already have an account? Sign in</ThemedText>
          </Link>
        </ThemedView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  link: {
    alignSelf: 'center',
    marginTop: Spacing.two,
  },
});
