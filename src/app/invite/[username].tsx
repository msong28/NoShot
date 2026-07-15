import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useSendFriendRequest } from '@/hooks/use-friends';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/errors';
import type { PublicProfile } from '@/lib/friend';

export default function InvitePreviewScreen() {
  const insets = useSafeAreaInsets();
  const { username } = useLocalSearchParams<{ username: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: ownProfile } = useProfile(userId);
  const sendRequest = useSendFriendRequest(userId);
  const [requestSent, setRequestSent] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const previewQuery = useQuery({
    queryKey: ['invite-preview', username],
    queryFn: async (): Promise<PublicProfile | null> => {
      const { data, error } = await supabase.rpc('get_invite_preview', { p_username: username });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!username,
  });

  const content = (() => {
    if (previewQuery.isLoading) {
      return <ActivityIndicator />;
    }

    if (!previewQuery.data) {
      return <ThemedText themeColor="textSecondary">This invite link isn&apos;t valid.</ThemedText>;
    }

    const invitedProfile = previewQuery.data;

    return (
      <>
        <ThemedText type="subtitle">
          @{invitedProfile.username} · {invitedProfile.display_name}
        </ThemedText>
        <ThemedText themeColor="textSecondary">wants to be your friend on NoShot.</ThemedText>

        {session && ownProfile ? (
          requestSent ? (
            <ThemedText themeColor="positive">Friend request sent.</ThemedText>
          ) : (
            <>
              <Button
                onPress={() => {
                  setRequestError(null);
                  sendRequest.mutate(invitedProfile.id, {
                    onSuccess: () => setRequestSent(true),
                    onError: (error) =>
                      setRequestError(getErrorMessage(error, 'Failed to send request')),
                  });
                }}
              >
                Add as friend
              </Button>
              {requestError ? (
                <ThemedText type="small" themeColor="negative">
                  {requestError}
                </ThemedText>
              ) : null}
            </>
          )
        ) : (
          <>
            <ThemedText themeColor="textSecondary">
              Create an account or sign in to add {invitedProfile.display_name} as a friend.
            </ThemedText>
            <Link href="/sign-up" asChild>
              <Button>Create account</Button>
            </Link>
            <Link href="/" asChild>
              <Button variant="muted">Sign in</Button>
            </Link>
          </>
        )}
      </>
    );
  })();

  return (
    <ThemedView style={styles.screen}>
      <ThemedView
        style={[
          styles.content,
          { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.four },
        ]}
      >
        <ThemedText type="title">NoShot</ThemedText>
        {content}
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
});
