import { useState } from 'react';
import { Link } from 'react-router';

import { BottomNav } from '@/components/bottom-nav';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import { useMyBets } from '@/hooks/use-bets';
import {
  useBlockUser,
  useCancelFriendRequest,
  useFriends,
  useHeadToHeadRecords,
  useMutualFriendCount,
  useRespondFriendRequest,
  useSearchUsername,
  useSendFriendRequest,
  type HeadToHeadRecord,
} from '@/hooks/use-friends';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';
import { Icons } from '@/lib/icons';
import { shareInviteLink } from '@/lib/invite-link';

/** README §"Debt chip"-style direction coding, applied to a friend's
 * win/loss record instead of a currency direction: up-green if the caller
 * leads, down-amber if behind, neutral if even. Omitted entirely when
 * they haven't played yet (0-0 isn't a meaningful record to show). */
/** "@handle · N mutual" -- omits the mutual clause entirely at 0 or while
 * loading, same "don't show a meaningless zero" rule as HeadToHead. */
function UsernameWithMutual({ username, otherUserId }: { username: string; otherUserId: string }) {
  const { data: mutualCount } = useMutualFriendCount(otherUserId);
  return (
    <>
      @{username}
      {mutualCount ? ` · ${mutualCount} mutual` : ''}
    </>
  );
}

function HeadToHead({ record }: { record?: HeadToHeadRecord }) {
  if (!record || (record.won === 0 && record.lost === 0)) return null;
  const leading = record.won > record.lost;
  const behind = record.won < record.lost;
  const label = leading ? 'you lead' : behind ? 'down' : 'even';
  const color = leading ? 'text-up-ink' : behind ? 'text-down-ink' : 'text-text-secondary';
  return (
    <div className="flex shrink-0 flex-col items-end">
      <span className="font-mono text-sm font-bold">
        {record.won}–{record.lost}
      </span>
      <span className={`text-xs font-bold ${color}`}>{label}</span>
    </div>
  );
}

export function FriendsScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: myProfile } = useProfile(userId);
  const { incomingRequests, outgoingRequests, friends, isLoading } = useFriends(userId);
  const { resolvedBets } = useMyBets(userId);
  const headToHead = useHeadToHeadRecords(userId, resolvedBets);
  const sendFriendRequest = useSendFriendRequest(userId);
  const respondFriendRequest = useRespondFriendRequest(userId);
  const cancelFriendRequest = useCancelFriendRequest(userId);
  const blockUser = useBlockUser(userId);
  const searchUsername = useSearchUsername();

  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  function run(promise: Promise<unknown>) {
    setError(null);
    promise.catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  async function handleInvite() {
    if (!myProfile) return;
    const result = await shareInviteLink(myProfile.username, myProfile.display_name);
    if (result === 'copied') {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1500);
    }
  }

  const friendIds = new Set(friends.map((f) => f.profile.id));
  const outgoingIds = new Set(outgoingRequests.map((r) => r.profile.id));
  const searchResults = (searchUsername.data ?? []).filter((profile) => profile.id !== userId);

  return (
    <main className="mx-auto max-w-app p-four pb-28">
      <div className="flex items-start justify-between gap-two">
        <h1 className="font-display text-screen-title font-extrabold tracking-display-tight">
          Friends
        </h1>
        <button
          type="button"
          onClick={handleInvite}
          className="mt-one shrink-0 text-sm font-bold text-grape-ink"
        >
          {inviteCopied ? 'Link copied!' : 'Invite a friend'}
        </button>
      </div>

      <Link to="/obligations" className="mt-one inline-block text-sm font-bold text-grape-ink">
        Manual obligations
      </Link>

      <InlineError message={error} />

      <div className="mt-three flex items-center gap-two rounded-pill border border-line bg-surface px-four py-three">
        <Icons.search size={18} strokeWidth={1.75} className="shrink-0 text-text-faint" />
        <input
          id="friend-search"
          placeholder="Search or add by @username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) searchUsername.mutate(query.trim());
          }}
          className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
        />
        <button
          type="button"
          disabled={!query.trim() || searchUsername.isPending}
          onClick={() => searchUsername.mutate(query.trim())}
          className="shrink-0 text-sm font-bold text-grape-ink disabled:opacity-40"
        >
          Search
        </button>
      </div>

      {searchResults.length > 0 ? (
        <div className="mt-two flex flex-col gap-two">
          {searchResults.map((profile) => (
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
                    onClick={() => run(sendFriendRequest.mutateAsync(profile.id))}
                  >
                    Add
                  </Button>
                )
              }
            />
          ))}
        </div>
      ) : null}

      {incomingRequests.length > 0 ? (
        <>
          <SectionHeader title="Requests" badge={incomingRequests.length} />
          <div className="mt-two flex flex-col gap-two">
            {incomingRequests.map(({ friendship, profile }) => (
              <ListRow
                key={friendship.id}
                leading={<Avatar id={profile.id} name={profile.display_name} />}
                title={profile.display_name}
                subtitle={
                  <UsernameWithMutual username={profile.username} otherUserId={profile.id} />
                }
                borderColorClassName="border-grape"
                className="shadow-attention"
                trailing={
                  <div className="flex items-center gap-two">
                    <Button
                      variant="primary"
                      className="px-three py-one text-xs"
                      onClick={() =>
                        run(
                          respondFriendRequest.mutateAsync({
                            friendshipId: friendship.id,
                            accept: true,
                          }),
                        )
                      }
                    >
                      Add
                    </Button>
                    <button
                      type="button"
                      aria-label={`Decline ${profile.display_name}`}
                      onClick={() =>
                        run(
                          respondFriendRequest.mutateAsync({
                            friendshipId: friendship.id,
                            accept: false,
                          }),
                        )
                      }
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-surface-sunken text-text-secondary"
                    >
                      <Icons.close size={16} strokeWidth={2} />
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        </>
      ) : null}

      {outgoingRequests.length > 0 ? (
        <>
          <SectionHeader title="Sent" count={outgoingRequests.length} />
          <div className="mt-two flex flex-col gap-two">
            {outgoingRequests.map(({ friendship, profile }) => (
              <ListRow
                key={friendship.id}
                leading={<Avatar id={profile.id} name={profile.display_name} />}
                title={profile.display_name}
                subtitle={`@${profile.username}`}
                trailing={
                  <button
                    type="button"
                    onClick={() => run(cancelFriendRequest.mutateAsync(friendship.id))}
                    className="text-sm font-bold text-text-secondary"
                  >
                    Cancel
                  </button>
                }
              />
            ))}
          </div>
        </>
      ) : null}

      <SectionHeader title="Your friends" count={friends.length} />
      <div className="mt-two flex flex-col gap-two">
        {isLoading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : friends.length === 0 ? (
          <EmptyState
            icon="friends"
            title="No friends yet"
            description="Search above, or send an invite link to someone who isn't on NoShot yet."
          />
        ) : (
          friends.map(({ friendship, profile }) => (
            <ListRow
              key={friendship.id}
              leading={<Avatar id={profile.id} name={profile.display_name} />}
              title={profile.display_name}
              subtitle={`@${profile.username}`}
              trailing={
                <div className="flex items-center gap-three">
                  <HeadToHead record={headToHead.get(profile.id)} />
                  <button
                    type="button"
                    aria-label={`Block ${profile.display_name}`}
                    onClick={() => run(blockUser.mutateAsync(profile.id))}
                    className="shrink-0 text-text-faint"
                  >
                    <Icons.block size={16} strokeWidth={1.75} />
                  </button>
                </div>
              }
            />
          ))
        )}
      </div>

      <BottomNav />
    </main>
  );
}
