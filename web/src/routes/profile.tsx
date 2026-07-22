import { useState } from 'react';
import { Link } from 'react-router';

import { Avatar } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { IconTile } from '@/components/ui/icon-tile';
import { ListRow } from '@/components/ui/list-row';
import { StatusPill } from '@/components/ui/status-pill';
import { useMyBets, type MyBet } from '@/hooks/use-bets';
import { useMyBalances } from '@/hooks/use-ledger';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { Icons } from '@/lib/icons';

/** README §"Trophies": 3 shaped tiles, grape/up/neutral tinted, a bold
 * short value + label. The mock's specific badges (step count, achievement
 * unlocks) have no backing data anywhere, so these show real numbers
 * derived from resolved bets instead of fictional gamification. */
function TrophyTile({
  tone,
  value,
  label,
}: {
  tone: 'grape' | 'up' | 'neutral';
  value: string;
  label: string;
}) {
  const toneClasses = {
    grape: 'bg-grape-soft text-grape-ink',
    up: 'bg-up-soft text-up-ink',
    neutral: 'bg-neutral-soft text-text-secondary',
  }[tone];
  return (
    <div className="flex flex-col items-center gap-two rounded-large border border-line bg-surface p-three text-center">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-medium font-display text-sm font-extrabold ${toneClasses}`}
      >
        {value}
      </div>
      <p className="text-xs font-bold text-text-secondary">{label}</p>
    </div>
  );
}

function statusFor(bet: MyBet): 'won' | 'lost' | 'tied' {
  if (bet.status === 'tied') return 'tied';
  return bet.iWon ? 'won' : 'lost';
}

export function ProfileScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile, isLoading, error } = useProfile(userId);
  const { resolvedBets } = useMyBets(userId);
  const { rows: balanceRows } = useMyBalances(userId);
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return <p className="p-four text-text-secondary">Loading profile…</p>;
  }

  if (error) {
    return (
      <p role="alert" className="p-four text-danger">
        Couldn&rsquo;t load your profile.
      </p>
    );
  }

  if (!profile) {
    return <p className="p-four text-text-secondary">No profile found for this account yet.</p>;
  }

  const won = resolvedBets.filter((b) => b.status === 'resolved' && b.iWon).length;
  const lost = resolvedBets.filter((b) => b.status === 'resolved' && b.iWon === false).length;
  const tied = resolvedBets.filter((b) => b.status === 'tied').length;

  const sortedRecent = [...resolvedBets].sort(
    (a, b) =>
      new Date(b.resolved_at ?? b.created_at).getTime() -
      new Date(a.resolved_at ?? a.created_at).getTime(),
  );

  let currentStreak = 0;
  for (const bet of sortedRecent) {
    if (bet.status === 'resolved' && bet.iWon) currentStreak += 1;
    else break;
  }

  // Currencies are never combined (DESIGN_SYSTEM.md §1) -- same count-based
  // "favors" approach as Home, not a summed currency amount.
  const owedToYouCount = balanceRows.filter((r) => r.balance.net_amount > 0).length;
  const youOweCount = balanceRows.filter((r) => r.balance.net_amount < 0).length;
  const netFavors = owedToYouCount - youOweCount;
  const distinctFriends = new Set(balanceRows.map((r) => r.balance.counterparty_id)).size;

  const since = new Date(profile.created_at).toLocaleDateString(undefined, {
    month: 'short',
    year: '2-digit',
  });

  async function handleShare() {
    const url = `${window.location.origin}/invite/${profile!.username}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <div className="flex items-center justify-between">
        <BackButton />
        <p className="font-mono text-eyebrow tracking-eyebrow font-bold uppercase text-text-faint">
          Profile
        </p>
        <Link
          to="/account"
          aria-label="Settings"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border border-line bg-surface"
        >
          <Icons.settings size={18} strokeWidth={1.75} className="text-text-secondary" />
        </Link>
      </div>

      <div className="mt-three flex flex-col items-center text-center">
        <div className="rounded-pill ring-4 ring-surface">
          <Avatar id={profile.id} name={profile.display_name} size="xl" />
        </div>
        <h1 className="mt-three font-display text-screen-title font-extrabold tracking-display-tight">
          {profile.display_name}
        </h1>
        <p className="mt-half font-mono text-sm text-text-secondary">
          @{profile.username} · since {since}
        </p>
        <div className="mt-three flex gap-two">
          <Link to="/edit-profile">
            <Button variant="primary" className="px-four py-two text-sm">
              Edit profile
            </Button>
          </Link>
          <Button variant="secondary" className="px-four py-two text-sm" onClick={handleShare}>
            {copied ? 'Copied!' : 'Share'}
          </Button>
        </div>
      </div>

      <div className="mt-four rounded-large bg-[#1C1917] p-four text-white shadow-card dark:bg-black">
        <div className="grid grid-cols-3 divide-x divide-white/10 text-center">
          <div>
            <p className="font-mono text-2xl font-extrabold text-up">{won}</p>
            <p className="text-eyebrow tracking-eyebrow font-bold uppercase text-white/60">Won</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-extrabold text-down">{lost}</p>
            <p className="text-eyebrow tracking-eyebrow font-bold uppercase text-white/60">Lost</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-extrabold text-white/80">{tied}</p>
            <p className="text-eyebrow tracking-eyebrow font-bold uppercase text-white/60">Tied</p>
          </div>
        </div>
        <p className="mt-three border-t border-white/10 pt-three text-center text-sm text-white/70">
          {currentStreak > 0 ? `🔥 ${currentStreak} win streak` : 'No active streak'}
          {' · '}
          {netFavors > 0 ? `+${netFavors}` : netFavors} favors up across {distinctFriends} friend
          {distinctFriends === 1 ? '' : 's'}
        </p>
      </div>

      <div className="mt-four flex items-baseline justify-between">
        <h2 className="font-display text-section font-bold">Trophies</h2>
      </div>
      <div className="mt-two grid grid-cols-3 gap-two">
        <TrophyTile tone="grape" value={String(won)} label="Total wins" />
        <TrophyTile
          tone="up"
          value={currentStreak > 0 ? `W${currentStreak}` : '0'}
          label="Win streak"
        />
        <TrophyTile tone="neutral" value={String(resolvedBets.length)} label="Bets played" />
      </div>

      <div className="mt-four flex items-baseline justify-between">
        <h2 className="font-display text-section font-bold">Recent</h2>
        <Link to="/bets" className="text-sm font-bold text-grape-ink">
          See all
        </Link>
      </div>
      <div className="mt-two flex flex-col gap-two">
        {sortedRecent.length === 0 ? (
          <p className="text-sm text-text-secondary">No resolved bets yet.</p>
        ) : (
          sortedRecent.slice(0, 5).map((bet) => {
            const Icon = Icons.bet;
            return (
              <Link key={bet.id} to={`/bet/${bet.id}`}>
                <ListRow
                  leading={
                    <IconTile>
                      <Icon size={18} strokeWidth={1.75} />
                    </IconTile>
                  }
                  title={bet.title}
                  subtitle={bet.description || undefined}
                  trailing={<StatusPill variant={statusFor(bet)} />}
                />
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}
