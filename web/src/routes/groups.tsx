import { useState } from 'react';
import { Link } from 'react-router';

import { BottomNav } from '@/components/bottom-nav';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import { useCreateGroup, useMyGroups, useRespondToGroupInvite } from '@/hooks/use-groups';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';
import { Icons } from '@/lib/icons';

export function GroupsScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { activeGroups, pendingInvites } = useMyGroups(userId);
  const createGroup = useCreateGroup(userId);
  const respondToInvite = useRespondToGroupInvite(userId);

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    createGroup.mutate(name, {
      onSuccess: () => setName(''),
      onError: (err) => setError(getErrorMessage(err, 'Failed to create group')),
    });
  }

  function runAction(action: Promise<unknown>) {
    setError(null);
    action.catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  return (
    <main className="mx-auto max-w-app p-four pb-28">
      <h1 className="font-display text-2xl font-extrabold">Groups</h1>
      <p className="mt-two text-text-secondary">
        Your groups, with per-currency net indicators and active-bet counts, will live here.
      </p>

      <div className="mt-four flex flex-col gap-two">
        <input
          placeholder="Group name (e.g. Roommates)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-medium bg-surface p-three shadow-card"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={!name.trim() || createGroup.isPending}
          className="self-start rounded-pill bg-primary px-four py-two font-display font-bold text-on-primary disabled:opacity-60"
        >
          Create group
        </button>
        <InlineError message={error} />
      </div>

      {pendingInvites.length > 0 ? (
        <>
          <SectionHeader title="Invites" />
          <div className="mt-two flex flex-col gap-two">
            {pendingInvites.map((invite) => (
              <ListRow
                key={invite.group_id}
                leading={<Avatar id={invite.group_id} name={invite.groups.name} />}
                title={invite.groups.name}
                trailing={
                  <div className="flex gap-two">
                    <button
                      type="button"
                      onClick={() => runAction(respondToInvite.mutateAsync({ groupId: invite.group_id, accept: true }))}
                      className="rounded-pill bg-primary px-three py-one font-display text-sm font-bold text-on-primary"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => runAction(respondToInvite.mutateAsync({ groupId: invite.group_id, accept: false }))}
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

      <SectionHeader title="Your groups" />
      {activeGroups.length === 0 ? (
        <div className="mt-two">
          <EmptyState icon="groups" title="No groups yet" description="Create one above." />
        </div>
      ) : (
        <div className="mt-two flex flex-col gap-two">
          {activeGroups.map((group) => {
            const ForwardIcon = Icons.forward;
            return (
              <Link key={group.id} to={`/group/${group.id}`}>
                <ListRow
                  leading={<Avatar id={group.id} name={group.name} />}
                  title={group.name}
                  trailing={<ForwardIcon size={18} className="text-text-faint" />}
                />
              </Link>
            );
          })}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
