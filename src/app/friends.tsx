import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { InviteQrCard } from '@/components/invite-qr-card';
import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
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
import { getErrorMessage } from '@/lib/errors';
import type { PublicProfile } from '@/lib/friend';

export default function FriendsScreen() {
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
  const [blockTarget, setBlockTarget] = useState<PublicProfile | null>(null);

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
      setActionError(getErrorMessage(error, 'Something went wrong'));
    });
  }

  return (
    <Screen>
      <Button variant="muted" onPress={() => router.back()}>
        Back
      </Button>
      <ThemedText type="headingXL">Friends</ThemedText>

      {profile ? <InviteQrCard username={profile.username} /> : null}

      <SectionHeader title="Find friends" />
      <TextField
        label="Username"
        variant="search"
        placeholder="Search by username"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />
      <InlineError
        message={search.isError ? getErrorMessage(search.error, 'Search failed') : null}
      />
      {(search.data ?? []).map((result) => (
        <ListRow
          key={result.id}
          leading={<Avatar id={result.id} name={result.display_name} />}
          title={result.display_name}
          subtitle={`@${result.username}`}
          trailing={
            <Button variant="primary" onPress={() => runAction(sendRequest.mutateAsync(result.id))}>
              Add
            </Button>
          }
        />
      ))}

      <InlineError message={actionError} />

      {incomingRequests.length > 0 ? (
        <>
          <SectionHeader title="Requests" />
          {incomingRequests.map(({ friendship, profile: requesterProfile }) => (
            <ListRow
              key={friendship.id}
              leading={<Avatar id={requesterProfile.id} name={requesterProfile.display_name} />}
              title={requesterProfile.display_name}
              subtitle={`@${requesterProfile.username}`}
              trailing={
                <View style={styles.rowActions}>
                  <Button
                    variant="primary"
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
                </View>
              }
            />
          ))}
        </>
      ) : null}

      {outgoingRequests.length > 0 ? (
        <>
          <SectionHeader title="Sent requests" />
          {outgoingRequests.map(({ friendship, profile: addresseeProfile }) => (
            <ListRow
              key={friendship.id}
              leading={<Avatar id={addresseeProfile.id} name={addresseeProfile.display_name} />}
              title={addresseeProfile.display_name}
              subtitle={`@${addresseeProfile.username}`}
              trailing={
                <Button
                  variant="muted"
                  onPress={() => runAction(cancelRequest.mutateAsync(friendship.id))}
                >
                  Cancel
                </Button>
              }
            />
          ))}
        </>
      ) : null}

      <SectionHeader title="Your friends" />
      {friends.length === 0 ? (
        <EmptyState
          icon="friends"
          title="No friends yet"
          description="Search for a username above or share your invite link."
        />
      ) : (
        friends.map(({ friendship, profile: friendProfile }) => (
          <ListRow
            key={friendship.id}
            leading={<Avatar id={friendProfile.id} name={friendProfile.display_name} />}
            title={friendProfile.display_name}
            subtitle={`@${friendProfile.username}`}
            trailing={
              <Button variant="muted" onPress={() => setBlockTarget(friendProfile)}>
                Block
              </Button>
            }
          />
        ))
      )}

      <ConfirmationDialog
        visible={blockTarget !== null}
        title={blockTarget ? `Block ${blockTarget.display_name}?` : 'Block this friend?'}
        description="They won't be able to see your profile, invite you, or message you, and this removes your friendship."
        confirmLabel="Block"
        destructive
        onConfirm={() => {
          if (blockTarget) runAction(blockUser.mutateAsync(blockTarget.id));
          setBlockTarget(null);
        }}
        onCancel={() => setBlockTarget(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
