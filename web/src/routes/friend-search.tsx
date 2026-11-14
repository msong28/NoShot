import { useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import {
  useFriends,
  useMutualFriendCount,
  useSearchUsername,
  useSendFriendRequest,
} from '@/hooks/use-friends';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';
import { Icons } from '@/lib/icons';

// The server rejects queries under 3 characters, and rate-limits to 20
// searches/minute -- so this screen searches on submit (Enter / the key
// on a mobile keyboard), not on every keystroke.
const MIN_QUERY_LENGTH = 3;
const MAX_RECENTS = 5;

function recentsKey(userId: string | undefined) {
  return `noshot:recent-friend-searches:${userId}`;
}

function loadRecents(userId: string | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(recentsKey(userId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function saveRecents(userId: string | undefined, recents: string[]) {
  try {
    localStorage.setItem(recentsKey(userId), JSON.stringify(recents));
  } catch {
    // Storage blocked/full: recents are a convenience, so just skip them.
  }
}

function UsernameWithMutual({ username, otherUserId }: { username: string; otherUserId: string }) {
  const { data: mutualCount } = useMutualFriendCount(otherUserId);
  return (
    <>
      @{username}
      {mutualCount ? ` · ${mutualCount} mutual` : ''}
    </>
  );
}

/** Full-screen friend search. Opened from the Friends header's search button. */
export function FriendSearchScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { friends, outgoingRequests } = useFriends(userId);
  const sendFriendRequest = useSendFriendRequest(userId);
  const searchUsername = useSearchUsername();

  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [recents, setRecents] = useState<string[]>(() => loadRecents(userId));
  const [error, setError] = useState<string | null>(null);

  function runSearch(term: string) {
    const value = term.trim();
    if (value.length < MIN_QUERY_LENGTH) return;
    setError(null);
    setQuery(value);
    setSubmitted(value);
    const next = [value, ...recents.filter((r) => r !== value)].slice(0, MAX_RECENTS);
    setRecents(next);
    saveRecents(userId, next);
    searchUsername.mutate(value, {
      onError: (err) => setError(getErrorMessage(err, 'Search failed')),
    });
  }

  function clear() {
    setQuery('');
    setSubmitted(null);
    setError(null);
    searchUsername.reset();
  }

  const friendIds = new Set(friends.map((f) => f.profile.id));
  const outgoingIds = new Set(outgoingRequests.map((r) => r.profile.id));
  const results = (searchUsername.data ?? []).filter((p) => p.id !== userId);
  const showResults = submitted !== null && !searchUsername.isPending && !error;

  return (
    <main className="mx-auto max-w-app p-four">
      <BackButton label="Friends" />

      <form
        role="search"
        className="mt-two flex items-center gap-two rounded-pill border border-line bg-surface px-four py-three"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
      >
        <Icons.search size={18} strokeWidth={1.75} className="shrink-0 text-text-faint" />
        <input
          type="search"
          enterKeyHint="search"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Search friends by username"
          placeholder="Search by @username"
          value={query}
          onChange={(e) => setQuery(e.target.value.replace(/^@/, ''))}
          className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clear}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-surface-sunken text-text-secondary"
          >
            <Icons.close size={14} strokeWidth={2.25} />
          </button>
        ) : null}
      </form>

      <InlineError message={error} />

      {searchUsername.isPending ? <p className="mt-four text-text-secondary">Searching…</p> : null}

      {showResults && results.length > 0 ? (
        <div className="mt-three flex flex-col gap-two">
          {results.map((profile) => (
            <ListRow
              key={profile.id}
              leading={<Avatar id={profile.id} name={profile.display_name} />}
              title={profile.display_name}
              subtitle={<UsernameWithMutual username={profile.username} otherUserId={profile.id} />}
              trailing={
                friendIds.has(profile.id) ? (
                  <span className="text-sm text-text-faint">Already friends</span>
                ) : outgoingIds.has(profile.id) ? (
                  <span className="text-sm text-text-faint">Request sent</span>
                ) : (
                  <Button
                    variant="primary"
                    className="px-three py-one text-xs"
                    onClick={() =>
                      sendFriendRequest
                        .mutateAsync(profile.id)
                        .catch((err: unknown) =>
                          setError(getErrorMessage(err, 'Could not send request')),
                        )
                    }
                  >
                    Add
                  </Button>
                )
              }
            />
          ))}
        </div>
      ) : null}

      {showResults && results.length === 0 ? (
        <div className="mt-four">
          <EmptyState
            icon="friends"
            title={`No one found for “${submitted}”`}
            description="Check the spelling, or go back and tap Add friend to copy your invite link."
          />
        </div>
      ) : null}

      {submitted === null && !searchUsername.isPending ? (
        recents.length > 0 ? (
          <section className="mt-four" aria-label="Recent searches">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-secondary">Recent</h2>
              <button
                type="button"
                onClick={() => {
                  setRecents([]);
                  saveRecents(userId, []);
                }}
                className="text-sm font-bold text-grape-ink"
              >
                Clear
              </button>
            </div>
            <div className="mt-two flex flex-col gap-one">
              {recents.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => runSearch(term)}
                  className="flex items-center gap-two rounded-medium px-two py-two text-left text-sm"
                >
                  <Icons.search size={16} strokeWidth={1.75} className="text-text-faint" />@{term}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <p className="mt-four text-center text-sm text-text-secondary">
            Type at least {MIN_QUERY_LENGTH} letters of a username, then press search.
          </p>
        )
      ) : null}
    </main>
  );
}
