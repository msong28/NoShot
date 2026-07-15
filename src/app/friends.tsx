import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InviteQrCard } from '@/components/invite-qr-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  useBlockUser,
  useCancelFriendRequest,
  useFriends,
  useRespondFriendRequest,
  useSearchUsername,
  useSendFriendRequest,
} from '@/hooks/use-friends';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { friendErrorMessage, type PublicProfile } from '@/lib/friend';

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);

  const { incomingRequests, outgoingRequests, friends } = useFriends(userId);
  const sendRequest = useSendFriendRequest(userId);
  const respondRequest = useRespondFriendRequest(userId);
  const cancelRequest = useCancelFriendRequest(userId);
  const blockUser = useBlockUser(userId);
  const search = useSearchUsername();

  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 3) return;

    const timer = setTimeout(() => {
      search.mutate(query.trim());
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function runAction(action: Promise<unknown>) {
    setActionError(null);
    action.catch((error: unknown) => {
      setActionError(friendErrorMessage(error, 'Something went wrong'));
    });
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
        ]}
      >
        <Button variant="muted" onPress={() => router.back()} style={styles.backButton}>
          Back
        </Button>
        <ThemedText type="title">Friends</ThemedText>

        {profile ? <InviteQrCard username={profile.username} /> : null}

        <ThemedText type="smallBold">Find friends</ThemedText>
        <TextField
          label="Username"
          placeholder="Search by username"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {search.isError ? (
          <ThemedText type="small" themeColor="negative">
            {friendErrorMessage(search.error, 'Search failed')}
          </ThemedText>
        ) : null}
        {(search.data ?? []).map((result) => (
          <SearchResultRow
            key={result.id}
            profile={result}
            onSendRequest={() => runAction(sendRequest.mutateAsync(result.id))}
          />
        ))}

        {actionError ? (
          <ThemedText type="small" themeColor="negative">
            {actionError}
          </ThemedText>
        ) : null}

        {incomingRequests.length > 0 ? (
          <>
            <ThemedText type="smallBold">Requests</ThemedText>
            {incomingRequests.map(({ friendship, profile: requesterProfile }) => (
              <Card key={friendship.id} style={styles.row}>
                <ThemedText>
                  @{requesterProfile.username} · {requesterProfile.display_name}
                </ThemedText>
                <ThemedView style={styles.rowActions}>
                  <Button
                    onPress={() =>
                      runAction(
                        respondRequest.mutateAsync({ friendshipId: friendship.id, accept: true }),
                      )
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    variant="muted"
                    onPress={() =>
                      runAction(
                        respondRequest.mutateAsync({ friendshipId: friendship.id, accept: false }),
                      )
                    }
                  >
                    Decline
                  </Button>
                </ThemedView>
              </Card>
            ))}
          </>
        ) : null}

        {outgoingRequests.length > 0 ? (
          <>
            <ThemedText type="smallBold">Sent requests</ThemedText>
            {outgoingRequests.map(({ friendship, profile: addresseeProfile }) => (
              <Card key={friendship.id} style={styles.row}>
                <ThemedText>
                  @{addresseeProfile.username} · {addresseeProfile.display_name}
                </ThemedText>
                <Button
                  variant="muted"
                  onPress={() => runAction(cancelRequest.mutateAsync(friendship.id))}
                >
                  Cancel
                </Button>
              </Card>
            ))}
          </>
        ) : null}

        <ThemedText type="smallBold">Your friends</ThemedText>
        {friends.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No friends yet — search for a username above or share your invite link.
          </ThemedText>
        ) : (
          friends.map(({ friendship, profile: friendProfile }) => (
            <Card key={friendship.id} style={styles.row}>
              <ThemedText>
                @{friendProfile.username} · {friendProfile.display_name}
              </ThemedText>
              <Button
                variant="muted"
                onPress={() => runAction(blockUser.mutateAsync(friendProfile.id))}
              >
                Block
              </Button>
            </Card>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

function SearchResultRow({
  profile,
  onSendRequest,
}: {
  profile: PublicProfile;
  onSendRequest: () => void;
}) {
  return (
    <Card style={styles.row}>
      <ThemedText>
        @{profile.username} · {profile.display_name}
      </ThemedText>
      <Button onPress={onSendRequest}>Add</Button>
    </Card>
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
  backButton: {
    alignSelf: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rowActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
