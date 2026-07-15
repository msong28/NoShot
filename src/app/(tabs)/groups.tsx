import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCreateGroup, useMyGroups, useRespondToGroupInvite } from '@/hooks/use-groups';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';

export default function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const userId = session?.user.id;

  const { activeGroups, pendingInvites } = useMyGroups(userId);
  const createGroup = useCreateGroup(userId);
  const respondToInvite = useRespondToGroupInvite(userId);

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    createGroup.mutate(name, {
      onSuccess: () => setName(''),
      onError: (err) => setError(getErrorMessage(err, 'Failed to create group')),
    });
  }

  function runAction(action: Promise<unknown>) {
    setError(null);
    action.catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.four },
        ]}
      >
        <ThemedText type="title">Groups</ThemedText>
        <ThemedText themeColor="textSecondary">
          Your groups, with per-currency net indicators and active-bet counts, will live here.
        </ThemedText>

        <ThemedText type="smallBold">New group</ThemedText>
        <TextField label="Group name" placeholder="Roommates" value={name} onChangeText={setName} />
        <Button onPress={handleCreate} disabled={!name.trim() || createGroup.isPending}>
          Create group
        </Button>
        {error ? (
          <ThemedText type="small" themeColor="negative">
            {error}
          </ThemedText>
        ) : null}

        {pendingInvites.length > 0 ? (
          <>
            <ThemedText type="smallBold">Invites</ThemedText>
            {pendingInvites.map((invite) => (
              <Card key={invite.group_id} style={styles.row}>
                <ThemedText>{invite.groups.name}</ThemedText>
                <ThemedView style={styles.rowActions}>
                  <Button
                    onPress={() =>
                      runAction(
                        respondToInvite.mutateAsync({ groupId: invite.group_id, accept: true }),
                      )
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    variant="muted"
                    onPress={() =>
                      runAction(
                        respondToInvite.mutateAsync({ groupId: invite.group_id, accept: false }),
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

        <ThemedText type="smallBold">Your groups</ThemedText>
        {activeGroups.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No groups yet — create one above.
          </ThemedText>
        ) : (
          activeGroups.map((group) => (
            <Link key={group.id} href={`/group/${group.id}`} asChild>
              <Card style={styles.row}>
                <ThemedText>{group.name}</ThemedText>
              </Card>
            </Link>
          ))
        )}
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
