import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Avatar } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { useMyBets } from '@/hooks/use-bets';
import { useFriends } from '@/hooks/use-friends';
import { useSession } from '@/hooks/use-session';
import { Icons } from '@/lib/icons';

/**
 * Screen 1 of the Splitwise-"Add expense"-style two-screen create flow:
 * single-select rival picker. Tapping a row advances straight to Screen 2
 * (create-bet-details, /create/:rivalId) -- there's no "Next" button and no
 * committed selection state here, since the navigation itself *is* the
 * selection. The search input intentionally has no autoFocus: the recents
 * list below it is the fast path for the common case of betting someone
 * you've bet before, and popping the keyboard immediately would cover it.
 */
export function CreatePickRivalScreen() {
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user.id;

  const { friends, isLoading } = useFriends(userId);
  const { bets } = useMyBets(userId);

  const [query, setQuery] = useState('');

  // "Most recently bet with first": useMyBets already returns bets ordered
  // newest-first (by bet_participants.created_at), so walking it in order
  // and taking each opponent's first appearance gives recency order for
  // free. Friends with no shared bet history are appended after, in
  // useFriends' own order.
  const orderedFriends = useMemo(() => {
    const friendById = new Map(friends.map((f) => [f.profile.id, f]));
    const seen = new Set<string>();
    const ordered: typeof friends = [];

    for (const bet of bets) {
      const opponentId = bet.opponent?.id;
      if (!opponentId || seen.has(opponentId)) continue;
      const friend = friendById.get(opponentId);
      if (!friend) continue;
      seen.add(opponentId);
      ordered.push(friend);
    }

    for (const friend of friends) {
      if (seen.has(friend.profile.id)) continue;
      seen.add(friend.profile.id);
      ordered.push(friend);
    }

    return ordered;
  }, [friends, bets]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleFriends = normalizedQuery
    ? orderedFriends.filter(
        ({ profile }) =>
          profile.display_name.toLowerCase().includes(normalizedQuery) ||
          profile.username.toLowerCase().includes(normalizedQuery),
      )
    : orderedFriends;

  return (
    <main className="mx-auto flex max-w-app flex-col p-four pb-16">
      <div className="flex items-center justify-between">
        <BackButton label="Cancel" />
        <h1 className="font-display text-lg font-extrabold">Who&rsquo;s the bet with?</h1>
        <div className="w-16" />
      </div>

      <div className="pointer-events-none sticky top-0 z-10 mt-four bg-bg pt-one pb-three">
        <div className="pointer-events-auto flex items-center gap-two rounded-pill border border-line bg-surface px-four py-three">
          <Icons.search size={18} strokeWidth={1.75} className="shrink-0 text-text-faint" />
          <input
            placeholder="Search friends"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
          />
        </div>
      </div>

      {isLoading ? null : visibleFriends.length === 0 ? (
        normalizedQuery ? (
          <p className="mt-four text-center text-sm text-text-faint">
            No friends match &ldquo;{query}&rdquo;
          </p>
        ) : (
          <EmptyState
            icon="friends"
            title="No friends yet"
            description="Add a friend to start a bet with them."
            action={
              <Link to="/friends" className="text-sm font-bold text-grape-ink">
                Find friends
              </Link>
            }
          />
        )
      ) : (
        <div className="flex flex-col gap-two">
          {visibleFriends.map(({ profile }) => (
            <ListRow
              key={profile.id}
              onClick={() => navigate(`/create/${profile.id}`)}
              leading={<Avatar id={profile.id} name={profile.display_name} />}
              title={profile.display_name}
              subtitle={`@${profile.username}`}
            />
          ))}
        </div>
      )}
    </main>
  );
}
