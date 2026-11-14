import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { BetRow } from '@/components/bet-row';
import { ActionSheet } from '@/components/ui/action-sheet';
import { Avatar } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { ConfirmationDialog } from '@/components/ui/confirm-dialog';
import { DebtChip } from '@/components/ui/debt-chip';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import { betCategory } from '@/routes/bets';
import { useMyBets, type MyBet } from '@/hooks/use-bets';
import {
  useBlockUser,
  useFriends,
  useHeadToHeadRecords,
  useRemoveFriend,
} from '@/hooks/use-friends';
import { useMyBalances } from '@/hooks/use-ledger';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';
import { Icons } from '@/lib/icons';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

const WAITING_STACK_LIMIT = 3;

function BetSection({
  title,
  bets,
  count,
  highlight = false,
  slideAbove,
}: {
  title: string;
  bets: MyBet[];
  count?: number;
  highlight?: boolean;
  /** Stack up to this many rows; more than that becomes a short, vertically scrolling list. */
  slideAbove?: number;
}) {
  const slides = slideAbove !== undefined && bets.length > slideAbove;
  return (
    <>
      <SectionHeader title={title} count={count ?? bets.length} />
      {slides ? (
        <div
          role="list"
          aria-label={`${title}, scroll for more`}
          className="mt-two flex max-h-[15.5rem] snap-y snap-mandatory flex-col gap-two overflow-y-auto pr-one"
        >
          {bets.map((bet) => (
            <div key={bet.id} role="listitem" className="snap-start">
              <BetRow bet={bet} highlight={highlight} showOpponent={false} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-two flex flex-col gap-two">
          {bets.map((bet) => (
            <BetRow key={bet.id} bet={bet} highlight={highlight} showOpponent={false} />
          ))}
        </div>
      )}
    </>
  );
}

/** One friend's page: who they are, how you stand (record + what's owed),
 * a way to start a bet, and -- deliberately tucked at the bottom behind a
 * confirmation -- the Block action that used to sit on every list row. */
export function FriendProfileScreen() {
  const { userId: friendId } = useParams<{ userId: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const navigate = useNavigate();

  const { friends, isLoading } = useFriends(userId);
  const { rows: balanceRows } = useMyBalances(userId);
  const { bets, resolvedBets, pendingBets, resolutionPendingBets, cancellationPendingBets } =
    useMyBets(userId);
  const headToHead = useHeadToHeadRecords(userId, resolvedBets);
  const blockUser = useBlockUser(userId);
  const removeFriend = useRemoveFriend(userId);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState<'unfriend' | 'block' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // useSession() is null for one tick on a fresh mount -- don't treat an
  // empty friends list as "not your friend" until we actually have a user
  // and the friends query has finished.
  if (!userId || isLoading) {
    return (
      <main className="mx-auto max-w-app p-four">
        <BackButton label="Friends" />
        <p className="mt-four text-text-secondary">Loading…</p>
      </main>
    );
  }

  const friend = friends.find((f) => f.profile.id === friendId)?.profile;
  if (!friend) {
    return (
      <main className="mx-auto max-w-app p-four">
        <BackButton label="Friends" />
        <div className="mt-four">
          <EmptyState
            icon="friends"
            title="Not on your friends list"
            description="This person isn't your friend (anymore), or the link is wrong."
          />
        </div>
      </main>
    );
  }

  const balances = balanceRows.filter(
    (r) => r.balance.counterparty_id === friend.id && r.balance.net_amount !== 0,
  );
  // One-on-one bets with this friend only: group bets (group_id set) aren't
  // attributable to a single friend, same rule as the head-to-head record.
  const withFriend = bets.filter((b) => !b.group_id && b.opponent?.id === friend.id);
  const needsMe = new Set(
    [...pendingBets, ...resolutionPendingBets, ...cancellationPendingBets].map((b) => b.id),
  );
  const waitingOnMe = withFriend.filter((b) => needsMe.has(b.id));
  const inProgress = withFriend.filter(
    (b) =>
      !needsMe.has(b.id) &&
      (betCategory(b.status) === 'active' || betCategory(b.status) === 'pending'),
  );
  const history = withFriend.filter(
    (b) =>
      !needsMe.has(b.id) &&
      betCategory(b.status) !== 'active' &&
      betCategory(b.status) !== 'pending',
  );
  const HISTORY_PREVIEW = 5;
  const shownHistory = showAllHistory ? history : history.slice(0, HISTORY_PREVIEW);
  const first = friend.display_name.split(' ')[0];
  const record = headToHead.get(friend.id);
  const hasRecord = !!record && (record.won > 0 || record.lost > 0);

  async function handleConfirm() {
    const action = confirming;
    if (!action) return;
    setError(null);
    try {
      if (action === 'block') await blockUser.mutateAsync(friend!.id);
      else await removeFriend.mutateAsync(friend!.id);
      navigate('/friends', { replace: true });
    } catch (err) {
      setConfirming(null);
      setError(getErrorMessage(err, `Could not ${action} this person`));
    }
  }

  return (
    <main className="mx-auto max-w-app p-four pb-six">
      <div className="flex items-center justify-between">
        <BackButton label="Friends" />
        <button
          type="button"
          aria-label="More options"
          onClick={() => setMenuOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-pill text-text-secondary"
        >
          <Icons.more size={22} strokeWidth={2} />
        </button>
      </div>

      <div className="mt-three flex flex-col items-center text-center">
        <Avatar id={friend.id} name={friend.display_name} size="xl" />
        <h1 className="mt-three font-display text-screen-title font-extrabold tracking-display-tight">
          {friend.display_name}
        </h1>
        <p className="text-text-secondary">@{friend.username}</p>
        {hasRecord ? (
          <p className="mt-two font-mono text-sm font-bold">
            {record.won}–{record.lost}{' '}
            <span className="font-sans font-normal text-text-secondary">
              {record.won > record.lost
                ? 'you lead'
                : record.won < record.lost
                  ? 'they lead'
                  : 'all even'}
            </span>
          </p>
        ) : null}
        <Link
          to={`/create/${friend.id}`}
          className="mt-three inline-flex w-full items-center justify-center rounded-[16px] bg-grape px-four py-three text-sm font-extrabold text-on-grape shadow-primary-button"
        >
          New bet with {friend.display_name.split(' ')[0]}
        </Link>
      </div>

      <InlineError message={error} />

      <SectionHeader title="Balances" />
      <div className="mt-two flex flex-col gap-two">
        {balances.length === 0 ? (
          <p className="text-sm text-text-secondary">All settled — nothing owed either way.</p>
        ) : (
          balances.map(({ balance, currency }) => (
            <ListRow
              key={`${balance.currency_id}:${balance.group_id ?? 'none'}`}
              to="/balances"
              title={currency?.name ?? 'Favor'}
              subtitle={balance.net_amount > 0 ? 'They owe you' : 'You owe them'}
              trailing={
                <DebtChip
                  direction={balance.net_amount > 0 ? 'up' : 'down'}
                  label={compact.format(Math.abs(balance.net_amount))}
                />
              }
            />
          ))
        )}
      </div>

      {waitingOnMe.length > 0 ? (
        <BetSection
          title="Waiting on you"
          bets={waitingOnMe}
          highlight
          slideAbove={WAITING_STACK_LIMIT}
        />
      ) : null}
      {inProgress.length > 0 ? <BetSection title="In progress" bets={inProgress} /> : null}
      {history.length > 0 ? (
        <>
          <BetSection title="History" bets={shownHistory} count={history.length} />
          {history.length > HISTORY_PREVIEW ? (
            <button
              type="button"
              onClick={() => setShowAllHistory((v) => !v)}
              className="mt-two w-full text-center text-sm font-bold text-grape-ink"
            >
              {showAllHistory ? 'Show less' : `See all ${history.length}`}
            </button>
          ) : null}
        </>
      ) : null}
      {withFriend.length === 0 ? (
        <p className="mt-four text-sm text-text-secondary">
          No bets with {friend.display_name.split(' ')[0]} yet.
        </p>
      ) : null}

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        actions={[
          {
            label: 'Unfriend',
            onSelect: () => {
              setMenuOpen(false);
              setConfirming('unfriend');
            },
          },
          {
            label: `Block ${first}`,
            destructive: true,
            onSelect: () => {
              setMenuOpen(false);
              setConfirming('block');
            },
          },
        ]}
      />

      <ConfirmationDialog
        visible={confirming === 'unfriend'}
        destructive
        title={`Unfriend ${friend.display_name}?`}
        description="You'll stop being friends, but your bets and balances stay. Either of you can send a new request later."
        confirmLabel="Unfriend"
        cancelLabel="Keep as friend"
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmationDialog
        visible={confirming === 'block'}
        destructive
        title={`Block ${friend.display_name}?`}
        description="They'll be removed from your friends and won't be able to find you or send requests. You can unblock them in Settings, but you'd need to become friends again."
        confirmLabel="Block"
        cancelLabel="Keep as friend"
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(null)}
      />
    </main>
  );
}
