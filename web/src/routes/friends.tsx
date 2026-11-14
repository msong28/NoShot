import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { BottomNav } from '@/components/bottom-nav';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DebtChip } from '@/components/ui/debt-chip';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import {
  useCancelFriendRequest,
  useFriends,
  useMutualFriendCount,
  useRespondFriendRequest,
} from '@/hooks/use-friends';
import { useMyBalances } from '@/hooks/use-ledger';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';
import { Icons } from '@/lib/icons';

/** "@handle · N mutual" -- omits the mutual clause entirely at 0 or while
 * loading ("don't show a meaningless zero"). */
function UsernameWithMutual({ username, otherUserId }: { username: string; otherUserId: string }) {
  const { data: mutualCount } = useMutualFriendCount(otherUserId);
  return (
    <>
      @{username}
      {mutualCount ? ` · ${mutualCount} mutual` : ''}
    </>
  );
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

type FriendBalance = { net: number; currencyName: string };

/** What one friend owes you (↑) or you owe them (↓), taken from their
 * biggest open balance. Amounts are compacted ("1.2K") and the label is
 * truncated so a big number or a long custom-currency name can't blow the
 * row layout; any further balances collapse into "+N". Sits inside a row
 * that links to the friend's page. "Settled" when nothing is open. */
function FriendBalanceChip({ balances }: { balances: FriendBalance[] | undefined }) {
  if (!balances || balances.length === 0) {
    return <span className="text-xs text-text-faint">Settled</span>;
  }
  const top = balances.reduce((a, b) => (Math.abs(b.net) > Math.abs(a.net) ? b : a));
  const extra = balances.length - 1;
  const label = `${compact.format(Math.abs(top.net))} ${top.currencyName}${extra > 0 ? ` +${extra}` : ''}`;
  return (
    <span
      role="img"
      aria-label={`${top.net > 0 ? 'They owe you' : 'You owe them'} ${label}`}
      className="block max-w-[9rem] truncate"
    >
      <DebtChip direction={top.net > 0 ? 'up' : 'down'} label={label} />
    </span>
  );
}

/** The home for your friends: pending requests, everyone you know (tap a row
 * for their page). Blocked people live in Settings → Blocked users. Finding new people lives on
 * the search screen (`/friends/search`) and the Add friend invite link. */
export function FriendsScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const navigate = useNavigate();

  const { incomingRequests, outgoingRequests, friends, isLoading } = useFriends(userId);
  const { rows: balanceRows } = useMyBalances(userId);
  const respondFriendRequest = useRespondFriendRequest(userId);
  const cancelFriendRequest = useCancelFriendRequest(userId);

  const balancesByFriend = new Map<string, FriendBalance[]>();
  for (const { balance, currency } of balanceRows) {
    if (balance.net_amount === 0) continue;
    const list = balancesByFriend.get(balance.counterparty_id) ?? [];
    list.push({ net: balance.net_amount, currencyName: currency?.name ?? 'favor' });
    balancesByFriend.set(balance.counterparty_id, list);
  }

  const [error, setError] = useState<string | null>(null);

  function run(promise: Promise<unknown>) {
    setError(null);
    promise.catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  return (
    <main className="mx-auto max-w-app p-four pb-28">
      <div className="flex items-center justify-between gap-two">
        <button
          type="button"
          aria-label="Search"
          onClick={() => navigate('/friends/search')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-surface-sunken text-ink"
        >
          <Icons.search size={18} strokeWidth={2} />
        </button>
        <h1 className="sr-only">Friends</h1>
        <button
          type="button"
          onClick={() => navigate('/friends/add')}
          className="shrink-0 rounded-pill bg-grape px-three py-two text-sm font-bold text-on-grape"
        >
          Add friend
        </button>
      </div>

      <Link to="/obligations" className="mt-three inline-block text-xs text-text-faint underline">
        Manual obligations
      </Link>

      <InlineError message={error} />

      {incomingRequests.length > 0 ? (
        <>
          <SectionHeader title="Requests" badge={incomingRequests.length} />
          <div className="mt-two flex flex-col gap-two">
            {incomingRequests.map(({ friendship, profile }) => (
              <ListRow
                key={friendship.id}
                leading={<Avatar id={profile.id} name={profile.display_name} />}
                title={profile.display_name}
                subtitle={
                  <UsernameWithMutual username={profile.username} otherUserId={profile.id} />
                }
                borderColorClassName="border-grape"
                className="shadow-attention"
                trailing={
                  <div className="flex items-center gap-two">
                    <Button
                      variant="primary"
                      className="px-three py-one text-xs"
                      onClick={() =>
                        run(
                          respondFriendRequest.mutateAsync({
                            friendshipId: friendship.id,
                            accept: true,
                          }),
                        )
                      }
                    >
                      Add
                    </Button>
                    <button
                      type="button"
                      aria-label={`Decline ${profile.display_name}`}
                      onClick={() =>
                        run(
                          respondFriendRequest.mutateAsync({
                            friendshipId: friendship.id,
                            accept: false,
                          }),
                        )
                      }
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-surface-sunken text-text-secondary"
                    >
                      <Icons.close size={16} strokeWidth={2} />
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        </>
      ) : null}

      <SectionHeader title="Your friends" count={friends.length} />
      <div className="mt-two flex flex-col gap-two">
        {isLoading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : friends.length === 0 ? (
          <EmptyState
            icon="friends"
            title="No friends yet"
            description="Tap Add friend to search for someone or send them your invite link."
          />
        ) : (
          friends.map(({ friendship, profile }) => (
            <ListRow
              key={friendship.id}
              to={`/friend/${profile.id}`}
              leading={<Avatar id={profile.id} name={profile.display_name} />}
              title={profile.display_name}
              subtitle={`@${profile.username}`}
              trailing={<FriendBalanceChip balances={balancesByFriend.get(profile.id)} />}
            />
          ))
        )}
      </div>

      {outgoingRequests.length > 0 ? (
        <>
          <SectionHeader title="Sent" count={outgoingRequests.length} />
          <div className="mt-two flex flex-col gap-two">
            {outgoingRequests.map(({ friendship, profile }) => (
              <ListRow
                key={friendship.id}
                leading={<Avatar id={profile.id} name={profile.display_name} />}
                title={profile.display_name}
                subtitle={`@${profile.username}`}
                trailing={
                  <button
                    type="button"
                    onClick={() => run(cancelFriendRequest.mutateAsync(friendship.id))}
                    className="text-sm font-bold text-text-secondary"
                  >
                    Cancel
                  </button>
                }
              />
            ))}
          </div>
        </>
      ) : null}

      <BottomNav />
    </main>
  );
}
