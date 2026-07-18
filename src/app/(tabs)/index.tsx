import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useMyBets } from '@/hooks/use-bets';
import { useFriends } from '@/hooks/use-friends';
import { useMyGroups } from '@/hooks/use-groups';
import { useSession } from '@/hooks/use-session';

export default function HomeScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { incomingRequests } = useFriends(userId);
  const { activeGroups, pendingInvites } = useMyGroups(userId);
  const { activeBets, pendingBets, cancellationPendingBets } = useMyBets(userId);

  const attentionCount =
    incomingRequests.length +
    pendingInvites.length +
    pendingBets.length +
    cancellationPendingBets.length;

  return (
    <Screen bottomInset={BottomTabInset + Spacing.four} topInset={Spacing.six}>
      <ThemedText type="headingXL">Home</ThemedText>

      <Card>
        <ThemedText type="label" themeColor="textSecondary">
          Balances
        </ThemedText>
        <ThemedText type="bodySM" themeColor="textMuted">
          Your owed/owing summary by currency will live here once bets and the ledger exist.
        </ThemedText>
      </Card>

      {attentionCount > 0 ? (
        <>
          <SectionHeader title="Needs your attention" />
          {incomingRequests.map(({ friendship, profile }) => (
            <Link key={friendship.id} href="/friends" asChild>
              <ListRow
                leading={<Avatar id={profile.id} name={profile.display_name} />}
                title={profile.display_name}
                subtitle="Wants to be friends"
                trailing={<StatusBadge label="Review" variant="info" />}
              />
            </Link>
          ))}
          {pendingInvites.map((invite) => (
            <Link key={invite.group_id} href="/groups" asChild>
              <ListRow
                title={invite.groups.name}
                subtitle="Invited you to a group"
                trailing={<StatusBadge label="Review" variant="info" />}
              />
            </Link>
          ))}
          {pendingBets.map((bet) => (
            <Link key={bet.id} href={`/bet/${bet.id}`} asChild>
              <ListRow
                title={bet.title}
                subtitle="Bet proposal awaiting your response"
                trailing={<StatusBadge label="Review" variant="info" />}
              />
            </Link>
          ))}
          {cancellationPendingBets.map((bet) => (
            <Link key={bet.id} href={`/bet/${bet.id}`} asChild>
              <ListRow
                title={bet.title}
                subtitle="Someone wants to cancel this bet"
                trailing={<StatusBadge label="Review" variant="warning" />}
              />
            </Link>
          ))}
        </>
      ) : null}

      <SectionHeader title="Active bets" />
      {activeBets.length === 0 ? (
        <EmptyState
          icon="bet"
          title="No active bets"
          description="Propose one from the Add button below."
        />
      ) : (
        activeBets.map((bet) => (
          <Link key={bet.id} href={`/bet/${bet.id}`} asChild>
            <ListRow title={bet.title} />
          </Link>
        ))
      )}

      <SectionHeader title="Your groups" />
      {activeGroups.length === 0 ? (
        <EmptyState
          icon="groups"
          title="No groups yet"
          description="Create one to start tracking bets with friends."
        />
      ) : (
        activeGroups.map((group) => (
          <Link key={group.id} href={`/group/${group.id}`} asChild>
            <ListRow title={group.name} />
          </Link>
        ))
      )}

      <SectionHeader title="Shortcuts" />
      <Link href="/friends" asChild>
        <Card style={styles.shortcutCard}>
          <ThemedText type="smallBold">Friends</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Search for friends, manage requests, and invite people.
          </ThemedText>
        </Card>
      </Link>

      <Link href="/currencies" asChild>
        <Card style={styles.shortcutCard}>
          <ThemedText type="smallBold">Currencies</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Browse built-in currencies and create your own.
          </ThemedText>
        </Card>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shortcutCard: {
    gap: Spacing.half,
  },
});
