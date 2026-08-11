import { Link } from 'react-router';

import { BottomNav } from '@/components/bottom-nav';
import { Avatar } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { StatusPill } from '@/components/ui/status-pill';
import { useMyWagers, type MyWagerRow } from '@/hooks/use-wager';
import { useSession } from '@/hooks/use-session';

/**
 * Read-only list of bets made through the new create flow (the `wagers`
 * table). Accepting/settling aren't built for this system yet, so every row
 * is 'pending'; this exists so a freshly-sent bet is actually visible instead
 * of vanishing after the "Sent!" screen.
 */
export function MyWagersScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { wagers, isLoading } = useMyWagers(userId);

  function stakeLabel(row: MyWagerRow): string | null {
    if (row.myStake == null) return null;
    if (row.wager.currency_kind === 'money') return `💵 ${row.myStake}`;
    if (row.currency) return `${row.currency.icon ?? '🎯'} ${row.myStake} ${row.currency.name}`;
    return `${row.myStake}`;
  }

  return (
    <main className="mx-auto max-w-app p-four pb-28">
      <BackButton />

      <h1 className="mt-three font-display text-screen-title font-extrabold tracking-display-tight">
        Your bets
      </h1>
      <p className="mt-two text-text-secondary">
        Bets you&rsquo;ve created. Accepting and settling are coming soon.
      </p>

      <div className="mt-four flex flex-col gap-two">
        {isLoading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : wagers.length === 0 ? (
          <EmptyState
            icon="bet"
            title="No bets yet"
            description="Create one and it'll show up here."
            action={
              <Link to="/create" className="mt-two text-sm font-bold text-grape-ink">
                Create a bet
              </Link>
            }
          />
        ) : (
          wagers.map((row) => (
            <ListRow
              key={row.wager.id}
              leading={
                row.counterparty ? (
                  <Avatar id={row.counterparty.id} name={row.counterparty.display_name} />
                ) : undefined
              }
              title={row.wager.event}
              subtitle={
                row.counterparty
                  ? `${row.iAmCreator ? 'You vs' : 'vs'} ${row.counterparty.display_name}`
                  : undefined
              }
              trailing={
                <>
                  {stakeLabel(row) ? (
                    <span className="font-mono text-sm text-text-secondary">{stakeLabel(row)}</span>
                  ) : null}
                  <StatusPill variant="pending" label="Pending" />
                </>
              }
            />
          ))
        )}
      </div>

      <BottomNav />
    </main>
  );
}
