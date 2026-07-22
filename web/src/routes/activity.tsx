import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { BottomNav } from '@/components/bottom-nav';
import { EmptyState } from '@/components/ui/empty-state';
import { IconTile } from '@/components/ui/icon-tile';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import { useMyBets } from '@/hooks/use-bets';
import { useFriends } from '@/hooks/use-friends';
import { useMyGroups } from '@/hooks/use-groups';
import { useMyRedemptions } from '@/hooks/use-redemption';
import { useSession } from '@/hooks/use-session';
import { Icons, type IconName } from '@/lib/icons';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function NeedsYouRow({
  to,
  icon,
  danger,
  title,
  subtitle,
}: {
  to: string;
  icon: IconName;
  danger?: boolean;
  title: string;
  subtitle: string;
}) {
  const Icon = Icons[icon];
  const ForwardIcon = Icons.forward;
  return (
    <Link to={to}>
      <ListRow
        leading={
          <IconTile>
            <Icon size={18} strokeWidth={1.75} />
          </IconTile>
        }
        title={title}
        subtitle={subtitle}
        borderColorClassName={danger ? 'border-danger' : 'border-grape'}
        trailing={<ForwardIcon size={18} className="text-text-faint" />}
      />
    </Link>
  );
}

type ActivityEvent = {
  id: string;
  timestamp: string;
  tone: 'success' | 'neutral';
  icon: IconName;
  text: ReactNode;
};

export function ActivityScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { incomingRequests, friends } = useFriends(userId);
  const { pendingInvites } = useMyGroups(userId);
  const { pendingBets, cancellationPendingBets, resolutionPendingBets, resolvedBets } =
    useMyBets(userId);
  const { needsMyConfirmation, resolved: resolvedRedemptions } = useMyRedemptions(userId);

  const disputedBets = resolutionPendingBets.filter((bet) => bet.status === 'disputed');
  const awaitingConfirmationBets = resolutionPendingBets.filter((bet) => bet.status !== 'disputed');

  const needsYouCount =
    pendingBets.length +
    disputedBets.length +
    awaitingConfirmationBets.length +
    cancellationPendingBets.length +
    incomingRequests.length +
    pendingInvites.length +
    needsMyConfirmation.length;

  const events: ActivityEvent[] = [
    ...resolvedBets
      .filter((bet) => bet.status === 'resolved' || bet.status === 'tied')
      .map((bet): ActivityEvent => ({
        id: `bet-${bet.id}`,
        timestamp: bet.resolved_at ?? bet.created_at,
        tone: bet.status === 'resolved' && bet.iWon ? 'success' : 'neutral',
        icon: 'bet',
        text:
          bet.status === 'tied' ? (
            <>
              &ldquo;{bet.title}&rdquo; <strong>ended in a tie</strong>
            </>
          ) : bet.iWon ? (
            <>
              You <strong>won</strong> &ldquo;{bet.title}&rdquo;
            </>
          ) : (
            <>
              You <strong>lost</strong> &ldquo;{bet.title}&rdquo;
            </>
          ),
      })),
    ...resolvedRedemptions
      .filter((r) => r.request.status === 'confirmed')
      .map((r): ActivityEvent => ({
        id: `redemption-${r.request.id}`,
        timestamp: r.request.responded_at ?? r.request.created_at,
        tone: 'neutral',
        icon: 'balances',
        text: (
          <>
            You and <strong>{r.counterparty?.display_name ?? 'someone'}</strong> settled up
          </>
        ),
      })),
    ...friends
      .filter((f) => f.friendship.responded_at)
      .map((f): ActivityEvent => ({
        id: `friend-${f.friendship.id}`,
        timestamp: f.friendship.responded_at as string,
        tone: 'neutral',
        icon: 'friends',
        text: (
          <>
            You and <strong>{f.profile.display_name}</strong> became friends
          </>
        ),
      })),
    ...incomingRequests.map(({ friendship, profile }): ActivityEvent => ({
      id: `request-${friendship.id}`,
      timestamp: friendship.created_at,
      tone: 'neutral',
      icon: 'friends',
      text: (
        <>
          <strong>{profile.display_name}</strong> sent you a friend request
        </>
      ),
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  return (
    <main className="mx-auto max-w-app p-four pb-28">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-screen-title font-extrabold tracking-display-tight">
          You
        </h1>
        <Link
          to="/account"
          aria-label="Settings"
          className="flex h-10 w-10 items-center justify-center rounded-pill border border-line bg-surface"
        >
          <Icons.settings size={20} strokeWidth={1.75} className="text-text-secondary" />
        </Link>
      </div>

      {needsYouCount > 0 ? (
        <>
          <SectionHeader title="Needs you" badge={needsYouCount} />
          <div className="mt-two flex flex-col gap-two">
            {pendingBets.map((bet) => (
              <NeedsYouRow
                key={bet.id}
                to={`/bet/${bet.id}`}
                icon="bet"
                title={bet.title}
                subtitle="Bet proposal · tap to respond"
              />
            ))}
            {disputedBets.map((bet) => (
              <NeedsYouRow
                key={bet.id}
                to={`/bet/${bet.id}`}
                icon="dispute"
                danger
                title="Result disputed"
                subtitle={`"${bet.title}" · review`}
              />
            ))}
            {awaitingConfirmationBets.map((bet) => (
              <NeedsYouRow
                key={bet.id}
                to={`/bet/${bet.id}`}
                icon="bet"
                title="Confirm the result"
                subtitle={`"${bet.title}" · your move`}
              />
            ))}
            {cancellationPendingBets.map((bet) => (
              <NeedsYouRow
                key={bet.id}
                to={`/bet/${bet.id}`}
                icon="bet"
                title="Cancel request"
                subtitle={`"${bet.title}" · respond`}
              />
            ))}
            {incomingRequests.map(({ friendship, profile }) => (
              <NeedsYouRow
                key={friendship.id}
                to="/friends"
                icon="friends"
                title={`${profile.display_name} sent a friend request`}
                subtitle="Tap to respond"
              />
            ))}
            {pendingInvites.map((invite) => (
              <NeedsYouRow
                key={invite.group_id}
                to="/groups"
                icon="groups"
                title={`Invited to ${invite.groups.name}`}
                subtitle="Tap to respond"
              />
            ))}
            {needsMyConfirmation.map(({ request, counterparty }) => (
              <NeedsYouRow
                key={request.id}
                to="/balances"
                icon="balances"
                title={`${counterparty?.display_name ?? 'Someone'} says they settled up`}
                subtitle="Needs your confirmation"
              />
            ))}
          </div>
        </>
      ) : null}

      <SectionHeader title="Recent activity" />
      <div className="mt-two flex flex-col gap-three">
        {events.length === 0 ? (
          <EmptyState
            icon="activity"
            title="Nothing yet"
            description="Activity will show up here as it happens."
          />
        ) : (
          events.map((event) => {
            const Icon = Icons[event.icon];
            return (
              <div key={event.id} className="flex items-center gap-three">
                <IconTile tone={event.tone}>
                  <Icon size={16} strokeWidth={1.75} />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{event.text}</p>
                  <p className="font-mono text-xs text-text-faint">{timeAgo(event.timestamp)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <BottomNav />
    </main>
  );
}
