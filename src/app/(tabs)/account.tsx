import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { data: profile } = useProfile(session?.user.id);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.six,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
          },
        ]}
      >
        <ThemedText type="title">Account</ThemedText>
        {profile ? (
          <ThemedText themeColor="textSecondary">
            @{profile.username} · {profile.display_name}
          </ThemedText>
        ) : null}
        <ThemedText themeColor="textSecondary">
          Blocked users, privacy settings, and delete account will live here.
        </ThemedText>

        <Button variant="muted" onPress={() => supabase.auth.signOut()} style={styles.signOut}>
          Sign out
        </Button>
      </ScrollView>
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
    gap: Spacing.two,
  },
  signOut: {
    marginTop: Spacing.four,
  },
});
