import { useState } from 'react';
import { Link } from 'react-router';

import { BottomNav } from '@/components/bottom-nav';
import { OnboardingCarousel } from '@/components/onboarding-carousel';
import { AttentionCard } from '@/components/ui/attention-card';
import { Avatar } from '@/components/ui/avatar';
import { Brick } from '@/components/ui/brick';
import { Button } from '@/components/ui/button';
import { DebtChip } from '@/components/ui/debt-chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Eyebrow } from '@/components/ui/eyebrow';
import { IconTile } from '@/components/ui/icon-tile';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';
import { useApproveBetVersion, useMyBets, type MyBet } from '@/hooks/use-bets';
import { useFriends } from '@/hooks/use-friends';
import { useMyGroups } from '@/hooks/use-groups';
import { useMyBalances } from '@/hooks/use-ledger';
import { useProfile } from '@/hooks/use-profile';
import { useMyRedemptions } from '@/hooks/use-redemption';
import { useSession } from '@/hooks/use-session';
import type { Bet } from '@/lib/bet';
import { Icons, type IconName } from '@/lib/icons';
import { shareInviteLink } from '@/lib/invite-link';

function IconBubble({ icon }: { icon: IconName }) {
  const Icon = Icons[icon];
  return (
    <IconTile>
      <Icon size={18} strokeWidth={1.75} />
    </IconTile>
  );
}

/** The bet's own currency icon (real, per-bet data) instead of a generic
 * flag glyph for every row -- falls back to the flag icon while the
 * enrichment query is still loading or the bet has no currency (shouldn't
 * happen in practice, but commitments can be null momentarily). */
function BetIconTile({ bet }: { bet: MyBet }) {
  const currencyIcon = bet.myCommitment?.currencies?.icon;
  if (currencyIcon) return <IconTile>{currencyIcon}</IconTile>;
  return <IconBubble icon="bet" />;
}

function betSubtitle(bet: MyBet): string | undefined {
  if (bet.opponent) return `vs ${bet.opponent.display_name}`;
  return bet.description || undefined;
}

const INTRO_SEEN_STORAGE_KEY = 'noshot-seen-intro';

function todayEyebrow() {
  const now = new Date();
  const weekday = now.toLocaleDateString(undefined, { weekday: 'short' });
  const month = now.toLocaleDateString(undefined, { month: 'short' });
  return `${weekday} · ${month} ${now.getDate()}`.toUpperCase();
}

/** The one attention card that's a real decision, not just a link out --
 * mirrors the Approve/Decline action bet-detail.tsx already offers, just
 * surfaced here too using the same existing mutation. */
function PendingBetAttentionCard({ bet, userId }: { bet: Bet; userId: string | undefined }) {
  const approveBetVersion = useApproveBetVersion(bet.id, userId);

  return (
    <AttentionCard
      variant="grape"
      icon={<IconBubble icon="betPending" />}
      eyebrow="Approve bet"
      title={bet.title}
      subtitle={bet.description || 'Bet proposal awaiting your response'}
    >
      <Button
        variant="primary"
        className="flex-1 px-three py-two text-xs"
        disabled={approveBetVersion.isPending}
        onClick={() =>
          approveBetVersion.mutate({ versionNo: bet.current_version, decision: 'approved' })
        }
      >
        Accept
      </Button>
      <Button
        variant="secondary"
        className="flex-1 px-three py-two text-xs"
        disabled={approveBetVersion.isPending}
        onClick={() =>
          approveBetVersion.mutate({ versionNo: bet.current_version, decision: 'declined' })
        }
      >
        Pass
      </Button>
    </AttentionCard>
  );
}

function LinkAttentionCard({
  to,
  icon,
  eyebrow,
  title,
  subtitle,
}: {
  to: string;
  icon: IconName;
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <AttentionCard
      variant="grape"
      icon={<IconBubble icon={icon} />}
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
    >
      <Link to={to} className="w-full">
        <Button variant="primary" fullWidth className="py-two text-xs">
          Review
        </Button>
      </Link>
    </AttentionCard>
  );
}

function DisputedAttentionCard({ bet }: { bet: Bet }) {
  return (
    <AttentionCard
      variant="danger"
      icon={<IconBubble icon="dispute" />}
      eyebrow="Disputed"
      title={bet.title}
      subtitle="Result disputed — your move"
    >
      <Link to={`/bet/${bet.id}`} className="w-full">
        <Button variant="ink" fullWidth className="py-two text-xs">
          Review
        </Button>
      </Link>
    </AttentionCard>
  );
}

export function HomeScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);

  const { incomingRequests } = useFriends(userId);
  const { activeGroups, pendingInvites } = useMyGroups(userId);
  const {
    bets,
    activeBets,
    pendingBets,
    cancellationPendingBets,
    resolutionPendingBets,
    resolvedBets,
  } = useMyBets(userId);
  const { rows: balanceRows } = useMyBalances(userId);
  const { needsMyConfirmation: redemptionsNeedingConfirmation } = useMyRedemptions(userId);

  const disputedBets = resolutionPendingBets.filter((bet) => bet.status === 'disputed');
  const awaitingConfirmationBets = resolutionPendingBets.filter((bet) => bet.status !== 'disputed');

  const attentionCount =
    incomingRequests.length +
    pendingInvites.length +
    pendingBets.length +
    cancellationPendingBets.length +
    resolutionPendingBets.length +
    redemptionsNeedingConfirmation.length;

  // Currencies are never combined (DESIGN_SYSTEM.md §1), so "favors" here
  // counts distinct debts rather than summing incompatible units.
  const owedToYouRows = balanceRows.filter((r) => r.balance.net_amount > 0);
  const youOweRows = balanceRows.filter((r) => r.balance.net_amount < 0);
  const distinctFriends = new Set(balanceRows.map((r) => r.balance.counterparty_id)).size;
  const netFavors = owedToYouRows.length - youOweRows.length;

  const firstName = profile?.display_name?.split(' ')[0] ?? 'there';

  const [showIntro, setShowIntro] = useState(
    () => typeof window !== 'undefined' && !window.localStorage.getItem(INTRO_SEEN_STORAGE_KEY),
  );

  function dismissIntro() {
    window.localStorage.setItem(INTRO_SEEN_STORAGE_KEY, 'true');
    setShowIntro(false);
  }

  const [inviteCopied, setInviteCopied] = useState(false);

  async function handleInvite() {
    if (!profile) return;
    const result = await shareInviteLink(profile.username, profile.display_name);
    if (result === 'copied') {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1500);
    }
  }

  // README screen 3f: the onboarding-finale empty state, not just an inline
  // "no active bets" card -- shown whenever the caller has never had any
  // bet at all (any status), matching the mock's fresh-account framing.
  if (bets.length === 0) {
    return (
      <main className="mx-auto max-w-app p-four pb-28">
        <h1 className="font-display text-screen-title font-extrabold tracking-display-tight">
          Welcome, {firstName} 🎉
        </h1>

        {showIntro ? <OnboardingCarousel firstName={firstName} onDone={dismissIntro} /> : null}

        <div className="mt-four flex flex-col items-center gap-two rounded-large bg-[#1C1917] p-five text-center text-white shadow-card dark:bg-black">
          <Brick size={78} variant="default" />
          <p className="font-display text-lg font-extrabold">No bets yet</p>
          <p className="text-sm text-white/70">
            Add a friend and settle something the fun way. No shot they say no.
          </p>
        </div>

        <SectionHeader title="Get started" />
        <div className="mt-two grid grid-cols-2 gap-two">
          <div className="rounded-large border border-line bg-surface p-three">
            <IconTile>👥</IconTile>
            <p className="mt-two font-bold">Add friends</p>
            <p className="text-sm text-text-secondary">You need a rival to bet.</p>
            <Button
              variant="primary"
              fullWidth
              className="mt-two py-two text-sm"
              onClick={handleInvite}
            >
              {inviteCopied ? 'Link copied!' : 'Invite'}
            </Button>
          </div>
          <div className="rounded-large border border-line bg-surface p-three">
            <IconTile tone="success">🎯</IconTile>
            <p className="mt-two font-bold">Set stakes</p>
            <p className="text-sm text-text-secondary">Chores, coffee, dares.</p>
            <Link to="/currencies" className="mt-two block">
              <Button variant="secondary" fullWidth className="py-two text-sm">
                Customize
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-three flex items-center gap-three rounded-medium border border-dashed border-line p-[13px] opacity-60">
          <IconTile>🧽</IconTile>
          <div className="min-w-0 flex-1">
            <p className="truncate text-row-title font-bold">Your first bet lands here</p>
            <p className="truncate text-subline text-text-secondary">
              preview · once you invite someone
            </p>
          </div>
        </div>

        <BottomNav />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-app p-four pb-28">
      <div className="flex items-start justify-between gap-three">
        <div>
          <Eyebrow>{todayEyebrow()}</Eyebrow>
          <h1 className="font-display text-screen-title font-extrabold tracking-display-tight">
            Yo, {firstName}
          </h1>
        </div>
        {profile ? <Avatar id={profile.id} name={profile.display_name} size="lg" /> : null}
      </div>

      {attentionCount > 0 ? (
        <>
          <div className="mt-four flex items-center gap-two">
            <span className="text-lg">👋</span>
            <h2 className="font-display text-section font-bold">Your move</h2>
            <span className="rounded-pill bg-grape-soft px-two py-half text-xs font-bold text-grape-ink">
              {attentionCount}
            </span>
          </div>
          <div className="mt-two flex gap-three overflow-x-auto pb-one">
            {pendingBets.map((bet) => (
              <PendingBetAttentionCard key={bet.id} bet={bet} userId={userId} />
            ))}
            {disputedBets.map((bet) => (
              <DisputedAttentionCard key={bet.id} bet={bet} />
            ))}
            {awaitingConfirmationBets.map((bet) => (
              <LinkAttentionCard
                key={bet.id}
                to={`/bet/${bet.id}`}
                icon="bet"
                eyebrow="Confirm result"
                title={bet.title}
                subtitle="Result awaiting your confirmation"
              />
            ))}
            {cancellationPendingBets.map((bet) => (
              <LinkAttentionCard
                key={bet.id}
                to={`/bet/${bet.id}`}
                icon="bet"
                eyebrow="Cancel request"
                title={bet.title}
                subtitle="Someone wants to cancel this bet"
              />
            ))}
            {incomingRequests.map(({ friendship, profile: requester }) => (
              <LinkAttentionCard
                key={friendship.id}
                to="/friends"
                icon="friends"
                eyebrow="Friend request"
                title={requester.display_name}
                subtitle="Wants to be friends"
              />
            ))}
            {pendingInvites.map((invite) => (
              <LinkAttentionCard
                key={invite.group_id}
                to="/groups"
                icon="groups"
                eyebrow="Group invite"
                title={invite.groups.name}
                subtitle="Invited you to a group"
              />
            ))}
            {redemptionsNeedingConfirmation.map(({ request, counterparty }) => (
              <LinkAttentionCard
                key={request.id}
                to="/balances"
                icon="balances"
                eyebrow="Confirm settled"
                title={counterparty?.display_name ?? 'Someone'}
                subtitle="Says they've settled up"
              />
            ))}
          </div>
        </>
      ) : null}

      <div className="relative mt-four overflow-hidden rounded-large bg-[#1C1917] p-four text-white shadow-card dark:bg-black">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-pill bg-lime opacity-20 blur-3xl"
        />
        <Eyebrow color="text-white/50">Your standing</Eyebrow>
        <div className="mt-one flex items-baseline gap-two">
          <span className="font-display text-hero font-extrabold tracking-display-tight text-lime">
            {netFavors > 0 ? `+${netFavors}` : netFavors}
          </span>
          <span className="text-row-title font-bold">favors {netFavors < 0 ? 'down' : 'up'}</span>
        </div>
        <p className="text-subline text-white/60">
          across {distinctFriends} friend{distinctFriends === 1 ? '' : 's'}
        </p>
        <div className="mt-three grid grid-cols-2 gap-two">
          <div className="rounded-medium bg-white/5 p-three">
            <p className="text-subline text-white/60">They owe you</p>
            <p className="font-mono text-2xl font-bold text-up">{owedToYouRows.length}</p>
          </div>
          <div className="rounded-medium bg-white/5 p-three">
            <p className="text-subline text-white/60">You owe</p>
            <p className="font-mono text-2xl font-bold text-down">{youOweRows.length}</p>
          </div>
        </div>
      </div>

      <div className="mt-three">
        <Link to="/balances">
          <Button variant="secondary" fullWidth>
            🤝 Settle
          </Button>
        </Link>
      </div>

      <SectionHeader title="Active bets" count={activeBets.length} />
      <div className="mt-two flex flex-col gap-two">
        {activeBets.length === 0 ? (
          <EmptyState
            icon="bet"
            title="No active bets"
            description="Propose one from the Add button below."
          />
        ) : (
          activeBets.map((bet) => (
            <Link key={bet.id} to={`/bet/${bet.id}`}>
              <ListRow
                leading={<BetIconTile bet={bet} />}
                title={bet.title}
                subtitle={betSubtitle(bet)}
                trailing={<StatusPill variant="active" />}
              />
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
                  leading={<BetIconTile bet={bet} />}
                  title={bet.title}
                  subtitle={betSubtitle(bet)}
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <StatusPill
                        variant={bet.status === 'tied' ? 'tied' : bet.iWon ? 'won' : 'lost'}
                      />
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
            ))}
          </div>
        </>
      ) : null}

      <div className="mt-four flex items-baseline justify-between">
        <h2 className="font-display text-section font-bold">Your groups</h2>
        <Link to="/groups" className="text-sm font-bold text-grape-ink">
          See all
        </Link>
      </div>
      <div className="mt-two flex flex-col gap-two">
        {activeGroups.length === 0 ? (
          <EmptyState
            icon="groups"
            title="No groups yet"
            description="Create one to start tracking bets with friends."
            action={
              <Link to="/groups">
                <Button variant="primary" className="mt-one px-four py-two text-sm">
                  Create a group
                </Button>
              </Link>
            }
          />
        ) : (
          activeGroups.map((group) => (
            <Link key={group.id} to={`/group/${group.id}`}>
              <ListRow leading={<IconBubble icon="groups" />} title={group.name} />
            </Link>
          ))
        )}
      </div>

      <SectionHeader title="Shortcuts" />
      <div className="mt-two flex flex-col gap-two">
        <Link to="/friends" className="rounded-large border border-line bg-surface p-three">
          <p className="font-bold">Friends</p>
          <p className="text-sm text-text-secondary">
            Search for friends, manage requests, and invite people.
          </p>
        </Link>
        <Link to="/currencies" className="rounded-large border border-line bg-surface p-three">
          <p className="font-bold">Currencies</p>
          <p className="text-sm text-text-secondary">
            Browse built-in currencies and create your own.
          </p>
        </Link>
      </div>

      <BottomNav />
    </main>
  );
}
