import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Avatar } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { ConfirmationDialog } from '@/components/ui/confirm-dialog';
import { DebtChip } from '@/components/ui/debt-chip';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import { useMyBets } from '@/hooks/use-bets';
import { useBlockUser, useFriends, useHeadToHeadRecords } from '@/hooks/use-friends';
import { useMyBalances } from '@/hooks/use-ledger';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

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
  const { resolvedBets } = useMyBets(userId);
  const headToHead = useHeadToHeadRecords(userId, resolvedBets);
  const blockUser = useBlockUser(userId);

  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const record = headToHead.get(friend.id);
  const hasRecord = !!record && (record.won > 0 || record.lost > 0);

  async function handleBlock() {
    setError(null);
    try {
      await blockUser.mutateAsync(friend!.id);
      navigate('/friends', { replace: true });
    } catch (err) {
      setConfirmingBlock(false);
      setError(getErrorMessage(err, 'Could not block this person'));
    }
  }

  return (
    <main className="mx-auto max-w-app p-four pb-six">
      <BackButton label="Friends" />

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

      <div className="mt-six border-t border-line pt-four">
        <button
          type="button"
          onClick={() => setConfirmingBlock(true)}
          className="w-full rounded-[16px] border border-line py-three text-sm font-bold text-danger-ink"
        >
          Block {friend.display_name.split(' ')[0]}
        </button>
      </div>

      <ConfirmationDialog
        visible={confirmingBlock}
        destructive
        title={`Block ${friend.display_name}?`}
        description="They'll be removed from your friends and won't be able to find you or send requests. You can unblock them later from the Friends page, but you'd need to be friends again."
        confirmLabel="Block"
        cancelLabel="Keep as friend"
        onConfirm={handleBlock}
        onCancel={() => setConfirmingBlock(false)}
      />
    </main>
  );
}
