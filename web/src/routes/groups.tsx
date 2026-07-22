import { useState } from 'react';
import { Link } from 'react-router';

import { BackButton } from '@/components/ui/back-button';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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
    <main className="mx-auto max-w-app p-four pb-16">
      <BackButton />

      <h1 className="mt-three font-display text-screen-title font-extrabold tracking-display-tight">
        Groups
      </h1>
      <p className="mt-two text-text-secondary">
        Group bets, split with everyone chipping in.
      </p>

      <SectionHeader title="Create a group" />
      <div className="mt-two flex flex-col gap-two rounded-large border border-line bg-surface p-three">
        <input
          placeholder="Group name (e.g. Roommates)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-medium border border-line bg-bg p-three"
        />
        <InlineError message={error} />
        <Button disabled={!name.trim() || createGroup.isPending} onClick={handleCreate}>
          {createGroup.isPending ? 'Creating…' : 'Create group'}
        </Button>
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
                      onClick={() =>
                        runAction(
                          respondToInvite.mutateAsync({ groupId: invite.group_id, accept: true }),
                        )
                      }
                      className="rounded-pill bg-grape px-three py-one text-sm font-bold text-on-grape"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          respondToInvite.mutateAsync({ groupId: invite.group_id, accept: false }),
                        )
                      }
                      className="rounded-pill bg-surface-sunken px-three py-one text-sm font-bold text-text-secondary"
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
          {activeGroups.map((group) => (
            <Link key={group.id} to={`/group/${group.id}`}>
              <ListRow
                leading={<Avatar id={group.id} name={group.name} />}
                title={group.name}
                trailing={<Icons.forward size={18} className="shrink-0 text-text-faint" />}
              />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
