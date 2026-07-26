import { useState } from 'react';
import { Link } from 'react-router';

import { BottomNav } from '@/components/bottom-nav';
import { DebtChip } from '@/components/ui/debt-chip';
import { EmptyState } from '@/components/ui/empty-state';
import { IconTile } from '@/components/ui/icon-tile';
import { ListRow } from '@/components/ui/list-row';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import { useMyBets, type MyBet } from '@/hooks/use-bets';
import { useSession } from '@/hooks/use-session';
import { Icons } from '@/lib/icons';

/** The bet's own currency icon (real, per-bet data) instead of a generic
 * flag glyph for every row -- falls back to the flag icon while the
 * enrichment query is still loading or absent. */
function BetIconTile({ bet }: { bet: MyBet }) {
  const currencyIcon = bet.myCommitment?.currencies?.icon;
  const Icon = Icons.bet;
  return <IconTile>{currencyIcon ?? <Icon size={18} strokeWidth={1.75} />}</IconTile>;
}

function betSubtitle(bet: MyBet): string | undefined {
  if (bet.opponent) return `vs ${bet.opponent.display_name}`;
  return bet.description || undefined;
}

type Filter = 'all' | 'active' | 'pending' | 'done';

/**
 * Which lifecycle bucket a bet belongs to on this page. This is a plain
 * status classification -- unlike the hook's `pendingBets`/`activeBets`, which
 * carry "awaiting your action" semantics (a bet you created and already
 * approved is dropped from `pendingBets`). The Bets page is a browser of all
 * your bets by lifecycle, so a bet you just sent must still show under Pending.
 * Returns null for statuses that don't map to a tab (e.g. voided) -- those
 * appear only under "All".
 */
export function betCategory(status: MyBet['status']): Exclude<Filter, 'all'> | null {
  switch (status) {
    case 'draft':
    case 'pending_acceptance':
      return 'pending';
    case 'active':
    case 'cancellation_pending':
    case 'pending_result':
    case 'disputed':
      return 'active';
    case 'resolved':
    case 'tied':
      return 'done';
    default:
      return null;
  }
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-pill px-three py-two text-sm font-bold whitespace-nowrap ${
        active ? 'bg-ink text-bg' : 'border border-line bg-surface text-ink'
      }`}
    >
      {label} {count}
    </button>
  );
}

/** Status pill + "your move" sub-label for whichever lifecycle state a bet
 * is actually in -- covers every BetStatus value, not just the four the
 * mock depicts, so nothing in the real data renders unlabeled. */
function statusFor(bet: MyBet): { variant: StatusPillVariant; label?: string; yourMove?: boolean } {
  switch (bet.status) {
    case 'pending_acceptance':
      return { variant: 'pending' };
    case 'active':
      return { variant: 'active' };
    case 'disputed':
      return { variant: 'disputed', yourMove: true };
    case 'pending_result':
      return { variant: 'active', label: 'Submitted' };
    case 'cancellation_pending':
      return { variant: 'active', label: 'Cancel pending' };
    case 'tied':
      return { variant: 'tied' };
    case 'resolved':
      return bet.iWon ? { variant: 'won' } : { variant: 'lost' };
    default:
      return { variant: 'tied', label: bet.status };
  }
}

export function BetsScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const [filter, setFilter] = useState<Filter>('all');

  const { bets } = useMyBets(userId);

  const activeBets = bets.filter((bet) => betCategory(bet.status) === 'active');
  const pendingBets = bets.filter((bet) => betCategory(bet.status) === 'pending');
  const doneBets = bets.filter((bet) => betCategory(bet.status) === 'done');

  const filtered =
    filter === 'all'
      ? bets
      : filter === 'active'
        ? activeBets
        : filter === 'pending'
          ? pendingBets
          : doneBets;

  const isDone = (bet: MyBet) => bet.status === 'resolved' || bet.status === 'tied';

  return (
    <main className="mx-auto max-w-app p-four pb-28">
      <h1 className="font-display text-screen-title font-extrabold tracking-display-tight">
        All bets
      </h1>

      <div className="mt-three flex gap-two overflow-x-auto pb-one">
        <FilterChip
          label="All"
          count={bets.length}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <FilterChip
          label="Active"
          count={activeBets.length}
          active={filter === 'active'}
          onClick={() => setFilter('active')}
        />
        <FilterChip
          label="Pending"
          count={pendingBets.length}
          active={filter === 'pending'}
          onClick={() => setFilter('pending')}
        />
        <FilterChip
          label="Done"
          count={doneBets.length}
          active={filter === 'done'}
          onClick={() => setFilter('done')}
        />
      </div>

      <div className="mt-three flex flex-col gap-two">
        {filtered.length === 0 ? (
          <EmptyState
            icon="bet"
            title="No bets here"
            description="Nothing matches this filter yet."
          />
        ) : (
          filtered.map((bet) => {
            const status = statusFor(bet);
            return (
              <Link
                key={bet.id}
                to={`/bet/${bet.id}`}
                className={isDone(bet) ? 'opacity-[0.72]' : ''}
              >
                <ListRow
                  leading={<BetIconTile bet={bet} />}
                  title={bet.title}
                  subtitle={betSubtitle(bet)}
                  borderColorClassName={
                    status.variant === 'disputed' ? 'border-danger' : 'border-line'
                  }
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <StatusPill variant={status.variant} label={status.label} />
                      {status.yourMove ? (
                        <span className="text-xs font-bold text-danger-ink">your move</span>
                      ) : null}
                      {bet.status === 'resolved' && bet.myCommitment ? (
                        <DebtChip
                          direction={bet.iWon ? 'up' : 'down'}
                          label={`${
                            bet.iWon
                              ? bet.myCommitment.payout_if_win
                              : bet.myCommitment.stake_quantity
                          } ${bet.myCommitment.currencies?.name ?? ''}`}
                        />
                      ) : null}
                    </div>
                  }
                />
              </Link>
            );
          })
        )}
      </div>

      <BottomNav />
    </main>
  );
}
