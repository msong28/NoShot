import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { BetRow } from '@/components/bet-row';
import { BottomNav } from '@/components/bottom-nav';
import { EmptyState } from '@/components/ui/empty-state';
import { useMyBets, type MyBet } from '@/hooks/use-bets';
import { useSession } from '@/hooks/use-session';

type Filter = 'all' | 'active' | 'pending' | 'done';

const FILTERS: Filter[] = ['all', 'active', 'pending', 'done'];

/** Reads the initial tab from `?tab=` so other screens can deep-link into a
 * bucket (e.g. the create flow drops you on `?tab=pending` after sending). */
function filterFromParam(value: string | null): Filter {
  return FILTERS.includes(value as Filter) ? (value as Filter) : 'all';
}

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

export function BetsScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>(() => filterFromParam(searchParams.get('tab')));

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
          filtered.map((bet) => <BetRow key={bet.id} bet={bet} />)
        )}
      </div>

      <BottomNav />
    </main>
  );
}
