import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useInvalidateProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { MIN_AGE, USERNAME_PATTERN } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

export default function SetupProfileScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { session } = useSession();
  const invalidateProfile = useInvalidateProfile(session?.user.id);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [ageAcknowledged, setAgeAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedUsername = username.trim().toLowerCase();
  const usernameError =
    normalizedUsername.length > 0 && !USERNAME_PATTERN.test(normalizedUsername)
      ? 'Lowercase letters, numbers, underscore, 3-20 characters'
      : undefined;

  const parsedBirthYear = Number.parseInt(birthYear, 10);
  const currentYear = new Date().getFullYear();
  const impliedAge = currentYear - parsedBirthYear;
  const birthYearError =
    birthYear.length > 0 && (!Number.isInteger(parsedBirthYear) || impliedAge < MIN_AGE)
      ? `Must indicate an age of at least ${MIN_AGE}`
      : undefined;

  const canSubmit =
    !!session &&
    !isSubmitting &&
    displayName.trim().length > 0 &&
    USERNAME_PATTERN.test(normalizedUsername) &&
    Number.isInteger(parsedBirthYear) &&
    impliedAge >= MIN_AGE &&
    ageAcknowledged;

  async function handleSubmit() {
    if (!session) return;
    setError(null);
    setIsSubmitting(true);

    const { error: insertError } = await supabase.from('profiles').insert({
      id: session.user.id,
      display_name: displayName.trim(),
      username: normalizedUsername,
      birth_year: parsedBirthYear,
      age_acknowledged_at: new Date().toISOString(),
    });

    setIsSubmitting(false);

    if (insertError) {
      setError(
        insertError.code === '23505' ? 'That username is already taken.' : insertError.message,
      );
      return;
    }

    await invalidateProfile();
    // Root layout's Stack.Protected re-evaluates once the profile query
    // resolves and routes into (tabs).
  }

  return (
    <ThemedView style={styles.screen}>
      <ThemedView
        style={[
          styles.content,
          { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.four },
        ]}
      >
        <ThemedText type="title">Set up your account</ThemedText>
        <ThemedText themeColor="textSecondary">
          Just a display name and username — no profile photo required.
        </ThemedText>

        <TextField label="Display name" value={displayName} onChangeText={setDisplayName} />
        <TextField
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          error={usernameError}
        />
        <TextField
          label="Birth year"
          value={birthYear}
          onChangeText={setBirthYear}
          keyboardType="number-pad"
          maxLength={4}
          error={birthYearError}
        />

        <Pressable
          onPress={() => setAgeAcknowledged((prev) => !prev)}
          style={styles.acknowledgeRow}
        >
          <ThemedView
            type={ageAcknowledged ? 'accent' : 'backgroundElement'}
            style={[styles.checkbox, { borderColor: theme.border }]}
          >
            {ageAcknowledged ? <ThemedText themeColor="accentText">✓</ThemedText> : null}
          </ThemedView>
          <ThemedText type="small" style={styles.acknowledgeText}>
            I confirm I am at least {MIN_AGE} years old and eligible under the Terms for my region.
          </ThemedText>
        </Pressable>

        {error ? (
          <ThemedText themeColor="negative" type="small">
            {error}
          </ThemedText>
        ) : null}

        <Button onPress={handleSubmit} disabled={!canSubmit}>
          {isSubmitting ? 'Saving…' : 'Continue'}
        </Button>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  acknowledgeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Radii.small,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acknowledgeText: {
    flex: 1,
  },
});
