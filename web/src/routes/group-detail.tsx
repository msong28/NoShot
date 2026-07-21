import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { PollCard } from '@/components/poll-card';
import { PollCreateForm } from '@/components/poll-create-form';
import { ReportDialog } from '@/components/report-dialog';
import { StatusBadge } from '@/components/ui/badge';
import { ConfirmationDialog } from '@/components/ui/confirm-dialog';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import { useChatAuthorProfiles, useChatMessages, usePostChatMessage } from '@/hooks/use-chat';
import { useSearchUsername } from '@/hooks/use-friends';
import {
  useArchiveGroup,
  useGroupDetail,
  useInviteToGroup,
  useLeaveGroup,
  useRemoveMember,
} from '@/hooks/use-groups';
import { useClosePoll, useCreatePoll, usePolls, useVoteOnPoll } from '@/hooks/use-polls';
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
  const chatMessages = useChatMessages(groupId);
  const chatAuthorProfiles = useChatAuthorProfiles(groupId);
  const postChatMessage = usePostChatMessage(groupId);
  const pollScope = useMemo(() => ({ groupId }), [groupId]);
  const { polls } = usePolls(pollScope);
  const createPoll = useCreatePoll(pollScope);
  const voteOnPoll = useVoteOnPoll(pollScope);
  const closePoll = useClosePoll(pollScope);

  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState(false);
  const [pendingLeave, setPendingLeave] = useState(false);
  const [chatBody, setChatBody] = useState('');
  const [reportChatMessageId, setReportChatMessageId] = useState<string | null>(null);

  function run(promise: Promise<unknown>) {
    setError(null);
    promise.catch((err: unknown) => setError(getErrorMessage(err, 'Something went wrong')));
  }

  function handlePostChat() {
    setError(null);
    postChatMessage.mutate(chatBody, {
      onSuccess: () => setChatBody(''),
      onError: (err) => setError(getErrorMessage(err, 'Failed to send message')),
    });
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
  const isActiveMember = myMembership?.member.status === 'active';

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

      <SectionHeader title="Chat" />
      <div className="mt-two flex flex-col gap-two">
        {(chatMessages.data ?? []).length === 0 ? (
          <p className="text-sm text-text-faint">
            {chatMessages.isLoading ? 'Loading…' : 'No messages yet.'}
          </p>
        ) : (
          (chatMessages.data ?? []).map((message) => {
            const author = chatAuthorProfiles.get(message.author_id);
            return (
              <ListRow
                key={message.id}
                title={author?.display_name ?? 'Someone'}
                subtitle={message.body}
                trailing={
                  <div className="flex items-center gap-two">
                    {message.moderation_status === 'pending_review' ? (
                      <StatusBadge label="Pending review" variant="warning" />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setReportChatMessageId(message.id)}
                      className="font-display text-sm text-text-secondary"
                    >
                      Report
                    </button>
                  </div>
                }
              />
            );
          })
        )}
        {isActiveMember ? (
          <div className="flex gap-two">
            <input
              placeholder="Say something to the group"
              value={chatBody}
              onChange={(e) => setChatBody(e.target.value)}
              className="flex-1 rounded-medium bg-surface p-three shadow-card"
            />
            <button
              type="button"
              onClick={handlePostChat}
              disabled={!chatBody.trim() || postChatMessage.isPending}
              className="rounded-pill bg-primary px-four py-two font-display font-bold text-on-primary disabled:opacity-60"
            >
              Send
            </button>
          </div>
        ) : null}
      </div>

      <SectionHeader title="Polls" />
      <div className="mt-two flex flex-col gap-two">
        {polls.map(({ poll, options, votes }) => (
          <PollCard
            key={poll.id}
            poll={poll}
            options={options}
            votes={votes}
            userId={userId}
            onVote={(optionId) => run(voteOnPoll.mutateAsync({ pollId: poll.id, optionId }))}
            onClose={() => run(closePoll.mutateAsync(poll.id))}
          />
        ))}
        {isActiveMember ? (
          <PollCreateForm
            disabled={createPoll.isPending}
            onSubmit={(input) => run(createPoll.mutateAsync(input))}
          />
        ) : null}
      </div>

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

      <ReportDialog
        visible={reportChatMessageId !== null}
        targetType="chat_message"
        targetId={reportChatMessageId}
        onClose={() => setReportChatMessageId(null)}
      />
    </main>
  );
}
