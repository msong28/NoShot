import { useState } from 'react';
import { Link } from 'react-router';

import { Avatar } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import {
  useBlockUser,
  useCancelFriendRequest,
  useFriends,
  useRespondFriendRequest,
  useSearchUsername,
  useSendFriendRequest,
} from '@/hooks/use-friends';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';

export function FriendsScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { incomingRequests, outgoingRequests, friends, isLoading } = useFriends(userId);
  const sendFriendRequest = useSendFriendRequest(userId);
  const respondFriendRequest = useRespondFriendRequest(userId);
  const cancelFriendRequest = useCancelFriendRequest(userId);
  const blockUser = useBlockUser(userId);
  const searchUsername = useSearchUsername();

  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  function run(promise: Promise<unknown>) {
    setError(null);
    promise.catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  const friendIds = new Set(friends.map((f) => f.profile.id));
  const outgoingIds = new Set(outgoingRequests.map((r) => r.profile.id));

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <BackButton />

      <h1 className="mt-three font-display text-2xl font-extrabold">Friends</h1>
      <Link to="/obligations" className="mt-two inline-block text-sm font-bold text-secondary">
        Manual obligations
      </Link>

      <InlineError message={error} />

      <SectionHeader title="Find people" />
      <div className="mt-two flex gap-two">
        <input
          placeholder="Search by username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-medium bg-surface p-three shadow-card"
        />
        <button
          type="button"
          disabled={!query.trim() || searchUsername.isPending}
          onClick={() => searchUsername.mutate(query.trim())}
          className="rounded-pill bg-primary px-four py-two font-display font-bold text-on-primary disabled:opacity-60"
        >
          Search
        </button>
      </div>
      <div className="mt-two flex flex-col gap-two">
        {(searchUsername.data ?? [])
          .filter((profile) => profile.id !== userId)
          .map((profile) => (
            <ListRow
              key={profile.id}
              leading={<Avatar id={profile.id} name={profile.display_name} />}
              title={profile.display_name}
              subtitle={`@${profile.username}`}
              trailing={
                friendIds.has(profile.id) ? (
                  <span className="text-sm text-text-faint">Already friends</span>
                ) : outgoingIds.has(profile.id) ? (
                  <span className="text-sm text-text-faint">Request sent</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => run(sendFriendRequest.mutateAsync(profile.id))}
                    className="rounded-pill bg-primary px-three py-one font-display text-sm font-bold text-on-primary"
                  >
                    Add
                  </button>
                )
              }
            />
          ))}
      </div>

      {incomingRequests.length > 0 ? (
        <>
          <SectionHeader title="Requests" />
          <div className="mt-two flex flex-col gap-two">
            {incomingRequests.map(({ friendship, profile }) => (
              <ListRow
                key={friendship.id}
                leading={<Avatar id={profile.id} name={profile.display_name} />}
                title={profile.display_name}
                subtitle={`@${profile.username}`}
                trailing={
                  <div className="flex gap-two">
                    <button
                      type="button"
                      onClick={() =>
                        run(
                          respondFriendRequest.mutateAsync({
                            friendshipId: friendship.id,
                            accept: true,
                          }),
                        )
                      }
                      className="rounded-pill bg-primary px-three py-one font-display text-sm font-bold text-on-primary"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        run(
                          respondFriendRequest.mutateAsync({
                            friendshipId: friendship.id,
                            accept: false,
                          }),
                        )
                      }
                      className="rounded-pill bg-surface-sunken px-three py-one font-display text-sm font-bold text-text-secondary"
                    >
                      Decline
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
          <SectionHeader title="Sent" />
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
                    className="font-display text-sm font-bold text-text-secondary"
                  >
                    Cancel
                  </button>
                }
              />
            ))}
          </div>
        </>
      ) : null}

      <SectionHeader title="Your friends" />
      <div className="mt-two flex flex-col gap-two">
        {isLoading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : friends.length === 0 ? (
          <EmptyState icon="friends" title="No friends yet" description="Search above to add some." />
        ) : (
          friends.map(({ friendship, profile }) => (
            <ListRow
              key={friendship.id}
              leading={<Avatar id={profile.id} name={profile.display_name} />}
              title={profile.display_name}
              subtitle={`@${profile.username}`}
              trailing={
                <button
                  type="button"
                  onClick={() => run(blockUser.mutateAsync(profile.id))}
                  className="font-display text-sm font-bold text-danger"
                >
                  Block
                </button>
              }
            />
          ))
        )}
      </div>
    </main>
  );
}
