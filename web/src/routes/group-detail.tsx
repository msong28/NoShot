import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { ConfirmationDialog } from '@/components/ui/confirm-dialog';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import { useSearchUsername } from '@/hooks/use-friends';
import {
  useArchiveGroup,
  useGroupDetail,
  useInviteToGroup,
  useLeaveGroup,
  useRemoveMember,
} from '@/hooks/use-groups';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';

export function GroupDetailScreen() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user.id;

  const { group, members, isLoading } = useGroupDetail(groupId);
  const inviteToGroup = useInviteToGroup(groupId);
  const removeMember = useRemoveMember(groupId);
  const archiveGroup = useArchiveGroup(groupId);
  const leaveGroup = useLeaveGroup(userId);
  const searchUsername = useSearchUsername();

  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState(false);
  const [pendingLeave, setPendingLeave] = useState(false);

  function run(promise: Promise<unknown>) {
    setError(null);
    promise.catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  if (isLoading || !group) {
    return (
      <main className="mx-auto max-w-app p-four">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="font-display text-sm text-text-secondary"
        >
          ← Back
        </button>
        <p className="mt-four text-text-secondary">Loading…</p>
      </main>
    );
  }

  const myMembership = members.find((m) => m.member.user_id === userId);
  const isOwner = myMembership?.member.role === 'owner';

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="font-display text-sm text-text-secondary"
      >
        ← Back
      </button>

      <h1 className="mt-three font-display text-2xl font-extrabold">{group.name}</h1>
      {group.status === 'archived' ? (
        <p className="mt-two text-sm text-text-faint">Archived</p>
      ) : null}

      <InlineError message={error} />

      <SectionHeader title="Members" />
      <div className="mt-two flex flex-col gap-two">
        {members.map(({ member, profile }) => (
          <ListRow
            key={member.user_id}
            title={profile.display_name}
            subtitle={`@${profile.username}${member.role === 'owner' ? ' · Owner' : ''}`}
            trailing={
              isOwner && member.user_id !== userId ? (
                <button
                  type="button"
                  onClick={() => run(removeMember.mutateAsync(member.user_id))}
                  className="font-display text-sm font-bold text-danger"
                >
                  Remove
                </button>
              ) : undefined
            }
          />
        ))}
      </div>

      {group.status === 'active' ? (
        <>
          <SectionHeader title="Invite someone" />
          <div className="mt-two flex flex-col gap-two">
            <div className="flex gap-two">
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
            {(searchUsername.data ?? []).map((profile) => (
              <ListRow
                key={profile.id}
                title={profile.display_name}
                subtitle={`@${profile.username}`}
                trailing={
                  members.some((m) => m.member.user_id === profile.id) ? (
                    <span className="text-sm text-text-faint">Already a member</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => run(inviteToGroup.mutateAsync(profile.id))}
                      className="rounded-pill bg-primary px-three py-one font-display text-sm font-bold text-on-primary"
                    >
                      Invite
                    </button>
                  )
                }
              />
            ))}
          </div>
        </>
      ) : null}

      <SectionHeader title="Danger zone" />
      <div className="mt-two flex flex-col gap-two">
        <button
          type="button"
          onClick={() => setPendingLeave(true)}
          className="self-start rounded-pill bg-surface-sunken px-four py-two font-display font-bold text-text-secondary"
        >
          Leave group
        </button>
        {isOwner && group.status === 'active' ? (
          <button
            type="button"
            onClick={() => setPendingArchive(true)}
            className="self-start rounded-pill bg-danger-bg px-four py-two font-display font-bold text-danger"
          >
            Archive group
          </button>
        ) : null}
      </div>

      <ConfirmationDialog
        visible={pendingLeave}
        title="Leave this group?"
        description="You'll need a new invite to rejoin."
        confirmLabel="Leave"
        destructive
        onConfirm={() => {
          run(leaveGroup.mutateAsync(groupId as string));
          setPendingLeave(false);
          navigate('/groups', { replace: true });
        }}
        onCancel={() => setPendingLeave(false)}
      />
      <ConfirmationDialog
        visible={pendingArchive}
        title="Archive this group?"
        description="Members keep their shared history, but no new bets can be created in it."
        confirmLabel="Archive"
        destructive
        onConfirm={() => {
          run(archiveGroup.mutateAsync());
          setPendingArchive(false);
        }}
        onCancel={() => setPendingArchive(false)}
      />
    </main>
  );
}
