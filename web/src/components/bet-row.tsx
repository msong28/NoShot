import { Link } from 'react-router';

import { DebtChip } from '@/components/ui/debt-chip';
import { IconTile } from '@/components/ui/icon-tile';
import { ListRow } from '@/components/ui/list-row';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import type { MyBet } from '@/hooks/use-bets';
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

/** One bet as a tappable list row (status pill, "your move", payout chip).
 * Shared by the Bets tab and a friend's page. */
export function BetRow({
  bet,
  highlight = false,
  showOpponent = true,
}: {
  bet: MyBet;
  highlight?: boolean;
  /** Off on a friend's own page, where "vs {that friend}" on every row is noise. */
  showOpponent?: boolean;
}) {
  const isDone = bet.status === 'resolved' || bet.status === 'tied';
  const status = statusFor(bet);
  return (
    <Link to={`/bet/${bet.id}`} className={isDone ? 'opacity-[0.72]' : ''}>
      <ListRow
        leading={<BetIconTile bet={bet} />}
        title={bet.title}
        subtitle={showOpponent ? betSubtitle(bet) : bet.description || undefined}
        borderColorClassName={
          status.variant === 'disputed'
            ? 'border-danger'
            : highlight
              ? 'border-grape'
              : 'border-line'
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
                  bet.iWon ? bet.myCommitment.payout_if_win : bet.myCommitment.stake_quantity
                } ${bet.myCommitment.currencies?.name ?? ''}`}
              />
            ) : null}
          </div>
        }
      />
    </Link>
  );
}
