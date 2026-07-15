import { Link } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

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
        <ThemedText type="title">Home</ThemedText>
        <ThemedText themeColor="textSecondary">
          Your owed/owing summary by currency, pending approvals, and recent activity will live
          here.
        </ThemedText>

        <Link href="/friends" asChild>
          <Card style={styles.friendsCard}>
            <ThemedText type="smallBold">Friends</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Search for friends, manage requests, and invite people.
            </ThemedText>
          </Card>
        </Link>
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
  friendsCard: {
    marginTop: Spacing.three,
    gap: Spacing.half,
  },
});
