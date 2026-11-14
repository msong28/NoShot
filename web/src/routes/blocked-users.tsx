import { useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { useBlockedUsers, useUnblockUser } from '@/hooks/use-friends';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';

/** Settings → Blocked users. Unblocking only lifts the block; it doesn't
 * bring the friendship back (send a new request from search). */
export function BlockedUsersScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { blocked, isLoading } = useBlockedUsers(userId);
  const unblockUser = useUnblockUser(userId);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-app p-four">
      <BackButton label="Settings" />
      <h1 className="mt-three font-display text-screen-title font-extrabold tracking-display-tight">
        Blocked users
      </h1>
      <p className="mt-one text-text-secondary">
        Unblocking lets you find each other again. You&rsquo;d need to become friends again.
      </p>

      <InlineError message={error} />

      <div className="mt-four flex flex-col gap-two">
        {isLoading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : blocked.length === 0 ? (
          <EmptyState icon="friends" title="No one blocked" description="Nobody's on this list." />
        ) : (
          blocked.map(({ id, profile }) => (
            <ListRow
              key={id}
              leading={<Avatar id={id} name={profile?.display_name ?? '?'} />}
              title={profile?.display_name ?? 'Unknown user'}
              subtitle={profile ? `@${profile.username}` : undefined}
              trailing={
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    unblockUser
                      .mutateAsync(id)
                      .catch((err: unknown) => setError(getErrorMessage(err, 'Could not unblock')));
                  }}
                  className="text-sm font-bold text-grape-ink"
                >
                  Unblock
                </button>
              }
            />
          ))
        )}
      </div>
    </main>
  );
}
