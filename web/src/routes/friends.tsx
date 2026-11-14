import { useState } from 'react';
import { Link } from 'react-router';

import { BottomNav } from '@/components/bottom-nav';
import { DebtChip } from '@/components/ui/debt-chip';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import {
  useBlockUser,
  useCancelFriendRequest,
  useFriends,
  useMutualFriendCount,
  useRespondFriendRequest,
  useSearchUsername,
  useSendFriendRequest,
} from '@/hooks/use-friends';
import { useMyBalances } from '@/hooks/use-ledger';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';
import { Icons } from '@/lib/icons';
import { getInviteLink } from '@/lib/invite-link';

/** "@handle · N mutual" -- omits the mutual clause entirely at 0 or while
 * loading, same "don't show a meaningless zero" rule as HeadToHead. */
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
 * biggest open balance. Amounts are compacted ("1.2K") and the currency name
 * is truncated so a big number or a long custom-currency name can't blow the
 * row layout; any further balances collapse into "+N". Links to /balances,
 * where Settle up lives. Renders "Settled" when nothing is open. */
function FriendBalanceChip({ balances }: { balances: FriendBalance[] | undefined }) {
  if (!balances || balances.length === 0) {
    return <span className="text-xs text-text-faint">Settled</span>;
  }
  const top = balances.reduce((a, b) => (Math.abs(b.net) > Math.abs(a.net) ? b : a));
  const extra = balances.length - 1;
  const label = `${compact.format(Math.abs(top.net))} ${top.currencyName}${extra > 0 ? ` +${extra}` : ''}`;
  return (
    <Link
      to="/balances"
      aria-label={`${top.net > 0 ? 'They owe you' : 'You owe them'} ${label}`}
      className="block max-w-[9rem] truncate"
    >
      <DebtChip direction={top.net > 0 ? 'up' : 'down'} label={label} />
    </Link>
  );
}

export function FriendsScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: myProfile } = useProfile(userId);
  const { incomingRequests, outgoingRequests, friends, isLoading } = useFriends(userId);
  const { rows: balanceRows } = useMyBalances(userId);
  const balancesByFriend = new Map<string, FriendBalance[]>();
  for (const { balance, currency } of balanceRows) {
    if (balance.net_amount === 0) continue;
    const list = balancesByFriend.get(balance.counterparty_id) ?? [];
    list.push({ net: balance.net_amount, currencyName: currency?.name ?? 'favor' });
    balancesByFriend.set(balance.counterparty_id, list);
  }
  const sendFriendRequest = useSendFriendRequest(userId);
  const respondFriendRequest = useRespondFriendRequest(userId);
  const cancelFriendRequest = useCancelFriendRequest(userId);
  const blockUser = useBlockUser(userId);
  const searchUsername = useSearchUsername();

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  function run(promise: Promise<unknown>) {
    setError(null);
    promise.catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  async function handleAddFriend() {
    if (!myProfile) return;
    try {
      await navigator.clipboard.writeText(getInviteLink(myProfile.username));
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1500);
    } catch {
      setError("Couldn't copy your invite link");
    }
  }

  const friendIds = new Set(friends.map((f) => f.profile.id));
  const outgoingIds = new Set(outgoingRequests.map((r) => r.profile.id));
  const searchResults = (searchUsername.data ?? []).filter((profile) => profile.id !== userId);

  return (
    <main className="mx-auto max-w-app p-four pb-28">
      <div className="flex items-center justify-between gap-two">
        <button
          type="button"
          aria-label="Search"
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen((open) => !open)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-surface-sunken text-ink"
        >
          <Icons.search size={18} strokeWidth={2} />
        </button>
        <h1 className="font-display text-screen-title font-extrabold tracking-display-tight">
          Friends
        </h1>
        <button
          type="button"
          onClick={handleAddFriend}
          className="shrink-0 rounded-pill bg-grape px-three py-two text-sm font-bold text-on-grape"
        >
          {inviteCopied ? 'Link copied!' : 'Add friend'}
        </button>
      </div>

      <Link to="/obligations" className="mt-two inline-block text-sm font-bold text-grape-ink">
        Manual obligations
      </Link>

      <InlineError message={error} />

      {searchOpen ? (
        <div className="mt-three flex items-center gap-two rounded-pill border border-line bg-surface px-four py-three">
          <Icons.search size={18} strokeWidth={1.75} className="shrink-0 text-text-faint" />
          <input
            id="friend-search"
            autoFocus
            placeholder="Search by @username"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) searchUsername.mutate(query.trim());
            }}
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
          />
          <button
            type="button"
            disabled={!query.trim() || searchUsername.isPending}
            onClick={() => searchUsername.mutate(query.trim())}
            className="shrink-0 text-sm font-bold text-grape-ink disabled:opacity-40"
          >
            Search
          </button>
        </div>
      ) : null}

      {searchResults.length > 0 ? (
        <div className="mt-two flex flex-col gap-two">
          {searchResults.map((profile) => (
            <ListRow
              key={profile.id}
              leading={<Avatar id={profile.id} name={profile.display_name} />}
              title={profile.display_name}
              subtitle={<UsernameWithMutual username={profile.username} otherUserId={profile.id} />}
              trailing={
                friendIds.has(profile.id) ? (
                  <span className="text-sm text-text-faint">Already friends</span>
                ) : outgoingIds.has(profile.id) ? (
                  <span className="text-sm text-text-faint">Request sent</span>
                ) : (
                  <Button
                    variant="primary"
                    className="px-three py-one text-xs"
                    onClick={() => run(sendFriendRequest.mutateAsync(profile.id))}
                  >
                    Add
                  </Button>
                )
              }
            />
          ))}
        </div>
      ) : null}

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

      <SectionHeader title="Your friends" count={friends.length} />
      <div className="mt-two flex flex-col gap-two">
        {isLoading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : friends.length === 0 ? (
          <EmptyState
            icon="friends"
            title="No friends yet"
            description="Tap Add friend to copy your invite link and send it to someone."
          />
        ) : (
          friends.map(({ friendship, profile }) => (
            <ListRow
              key={friendship.id}
              leading={<Avatar id={profile.id} name={profile.display_name} />}
              title={profile.display_name}
              subtitle={`@${profile.username}`}
              trailing={
                <div className="flex items-center gap-three">
                  <FriendBalanceChip balances={balancesByFriend.get(profile.id)} />
                  <button
                    type="button"
                    aria-label={`Block ${profile.display_name}`}
                    onClick={() => run(blockUser.mutateAsync(profile.id))}
                    className="shrink-0 text-text-faint"
                  >
                    <Icons.block size={16} strokeWidth={1.75} />
                  </button>
                </div>
              }
            />
          ))
        )}
      </div>

      <BottomNav showCreate={false} />
    </main>
  );
}
