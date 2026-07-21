import { Link } from 'react-router';

import { BottomNav } from '@/components/bottom-nav';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import { useMyBets } from '@/hooks/use-bets';
import { useFriends } from '@/hooks/use-friends';
import { useMyGroups } from '@/hooks/use-groups';
import { useMyBalances } from '@/hooks/use-ledger';
import { useMyRedemptions } from '@/hooks/use-redemption';
import { useSession } from '@/hooks/use-session';

export function HomeScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { incomingRequests } = useFriends(userId);
  const { activeGroups, pendingInvites } = useMyGroups(userId);
  const { activeBets, pendingBets, cancellationPendingBets, resolutionPendingBets, resolvedBets } =
    useMyBets(userId);
  const { rows: balanceRows } = useMyBalances(userId);
  const { needsMyConfirmation: redemptionsNeedingConfirmation } = useMyRedemptions(userId);

  const attentionCount =
    incomingRequests.length +
    pendingInvites.length +
    pendingBets.length +
    cancellationPendingBets.length +
    resolutionPendingBets.length +
    redemptionsNeedingConfirmation.length;

  return (
    <main className="mx-auto max-w-app p-four pb-28">
      <h1 className="font-display text-2xl font-extrabold">Home</h1>

      <Link to="/balances" className="mt-three block rounded-large bg-surface p-three shadow-card">
        <p className="text-sm font-bold text-text-secondary">Balances</p>
        {balanceRows.length === 0 ? (
          <p className="text-sm text-text-faint">All settled up.</p>
        ) : (
          balanceRows.slice(0, 3).map(({ balance, counterparty }) => (
            <p key={`${balance.counterparty_id}:${balance.currency_id}`} className="truncate text-sm">
              {balance.net_amount > 0 ? 'Owes you: ' : 'You owe: '}
              {counterparty?.display_name ?? 'Unknown'}
            </p>
          ))
        )}
      </Link>

      {attentionCount > 0 ? (
        <>
          <SectionHeader title="Needs your attention" />
          <div className="mt-two flex flex-col gap-two">
            {incomingRequests.map(({ friendship, profile }) => (
              <Link key={friendship.id} to="/friends">
                <ListRow title={profile.display_name} subtitle="Wants to be friends" trailing={<StatusBadge label="Review" variant="info" />} />
              </Link>
            ))}
            {pendingInvites.map((invite) => (
              <Link key={invite.group_id} to="/groups">
                <ListRow title={invite.groups.name} subtitle="Invited you to a group" trailing={<StatusBadge label="Review" variant="info" />} />
              </Link>
            ))}
            {pendingBets.map((bet) => (
              <Link key={bet.id} to={`/bet/${bet.id}`}>
                <ListRow title={bet.title} subtitle="Bet proposal awaiting your response" trailing={<StatusBadge label="Review" variant="info" />} />
              </Link>
            ))}
            {cancellationPendingBets.map((bet) => (
              <Link key={bet.id} to={`/bet/${bet.id}`}>
                <ListRow title={bet.title} subtitle="Someone wants to cancel this bet" trailing={<StatusBadge label="Review" variant="warning" />} />
              </Link>
            ))}
            {resolutionPendingBets.map((bet) => (
              <Link key={bet.id} to={`/bet/${bet.id}`}>
                <ListRow
                  title={bet.title}
                  subtitle={bet.status === 'disputed' ? 'Result disputed' : 'Result awaiting confirmation'}
                  trailing={<StatusBadge label="Review" variant="info" />}
                />
              </Link>
            ))}
            {redemptionsNeedingConfirmation.map(({ request, counterparty }) => (
              <Link key={request.id} to="/balances">
                <ListRow
                  title={counterparty?.display_name ?? 'Someone'}
                  subtitle="Says they've settled up — needs your confirmation"
                  trailing={<StatusBadge label="Review" variant="info" />}
                />
              </Link>
            ))}
          </div>
        </>
      ) : null}

      <SectionHeader title="Active bets" />
      <div className="mt-two flex flex-col gap-two">
        {activeBets.length === 0 ? (
          <EmptyState title="No active bets" description="Propose one from the Add button below." />
        ) : (
          activeBets.map((bet) => (
            <Link key={bet.id} to={`/bet/${bet.id}`}>
              <ListRow title={bet.title} />
            </Link>
          ))
        )}
      </div>

      {resolvedBets.length > 0 ? (
        <>
          <SectionHeader title="Recently resolved" />
          <div className="mt-two flex flex-col gap-two">
            {resolvedBets.map((bet) => (
              <Link key={bet.id} to={`/bet/${bet.id}`}>
                <ListRow
                  title={bet.title}
                  trailing={
                    <StatusBadge label={bet.status === 'tied' ? 'Tied' : 'Resolved'} variant={bet.status === 'tied' ? 'neutral' : 'success'} />
                  }
                />
              </Link>
            ))}
          </div>
        </>
      ) : null}

      <SectionHeader title="Your groups" />
      <div className="mt-two flex flex-col gap-two">
        {activeGroups.length === 0 ? (
          <EmptyState title="No groups yet" description="Create one to start tracking bets with friends." />
        ) : (
          activeGroups.map((group) => (
            <Link key={group.id} to={`/group/${group.id}`}>
              <ListRow title={group.name} />
            </Link>
          ))
        )}
      </div>

      <SectionHeader title="Shortcuts" />
      <div className="mt-two flex flex-col gap-two">
        <Link to="/friends" className="rounded-large bg-surface p-three shadow-card">
          <p className="font-display font-bold">Friends</p>
          <p className="text-sm text-text-secondary">Search for friends, manage requests, and invite people.</p>
        </Link>
        <Link to="/currencies" className="rounded-large bg-surface p-three shadow-card">
          <p className="font-display font-bold">Currencies</p>
          <p className="text-sm text-text-secondary">Browse built-in currencies and create your own.</p>
        </Link>
      </div>

      <BottomNav />
    </main>
  );
}
