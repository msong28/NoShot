import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CategoryPicker } from '@/components/category-picker';
import { PollCard } from '@/components/poll-card';
import { PollCreateForm } from '@/components/poll-create-form';
import { ReportDialog } from '@/components/report-dialog';
import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import type { CurrencyCategory } from '@/lib/currency';
import { useChatAuthorProfiles, useChatMessages, usePostChatMessage } from '@/hooks/use-chat';
import { useCreateCurrency, useCurrencies } from '@/hooks/use-currencies';
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

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { group, members } = useGroupDetail(groupId);
  const inviteToGroup = useInviteToGroup(groupId);
  const removeMember = useRemoveMember(groupId);
  const archiveGroup = useArchiveGroup(groupId);
  const leaveGroup = useLeaveGroup(userId);
  const search = useSearchUsername();
  const currencies = useCurrencies({ groupId: groupId as string });
  const createCurrency = useCreateCurrency({ groupId: groupId as string });
  const chatMessages = useChatMessages(groupId as string);
  const chatAuthorProfiles = useChatAuthorProfiles(groupId as string);
  const postChatMessage = usePostChatMessage(groupId as string);
  const pollScope = useMemo(() => ({ groupId: groupId as string }), [groupId]);
  const { polls } = usePolls(pollScope);
  const createPoll = useCreatePoll(pollScope);
  const voteOnPoll = useVoteOnPoll(pollScope);
  const closePoll = useClosePoll(pollScope);

  const [query, setQuery] = useState('');
  const [currencyName, setCurrencyName] = useState('');
  const [currencyCategory, setCurrencyCategory] = useState<CurrencyCategory>('custom');
  const [actionError, setActionError] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [chatBody, setChatBody] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [reportChatMessageId, setReportChatMessageId] = useState<string | null>(null);

  const me = members.find((row) => row.profile.id === userId);
  const isOwner = me?.member.role === 'owner' && me.member.status === 'active';

  function runAction(action: Promise<unknown>) {
    setActionError(null);
    action.catch((err: unknown) => setActionError(getErrorMessage(err, 'Something went wrong')));
  }

  function handleCreateCurrency() {
    setActionError(null);
    createCurrency.mutate(
      { name: currencyName, category: currencyCategory },
      {
        onSuccess: () => setCurrencyName(''),
        onError: (err) => setActionError(getErrorMessage(err, 'Failed to create currency')),
      },
    );
  }

  function handlePostChat() {
    setChatError(null);
    postChatMessage.mutate(chatBody, {
      onSuccess: () => setChatBody(''),
      onError: (err) => setChatError(getErrorMessage(err, 'Failed to send message')),
    });
  }

  return (
    <Screen>
      <Button variant="muted" onPress={() => router.back()}>
        Back
      </Button>
      <ThemedText type="headingXL">{group?.name ?? 'Group'}</ThemedText>
      {group?.status === 'archived' ? (
        <ThemedText type="bodySM" themeColor="textSecondary">
          This group is archived.
        </ThemedText>
      ) : null}

      <SectionHeader title="Chat" />
      {(chatMessages.data ?? []).length === 0 ? (
        <ThemedText type="bodySM" themeColor="textMuted">
          {chatMessages.isLoading ? 'Loading…' : 'No messages yet.'}
        </ThemedText>
      ) : (
        (chatMessages.data ?? []).map((message) => {
          const author = chatAuthorProfiles.get(message.author_id);
          return (
            <ListRow
              key={message.id}
              leading={author ? <Avatar id={author.id} name={author.display_name} /> : undefined}
              title={author?.display_name ?? 'Someone'}
              subtitle={message.body}
              trailing={
                <View style={styles.chatTrailing}>
                  {message.moderation_status === 'pending_review' ? (
                    <StatusBadge label="Pending review" variant="warning" />
                  ) : null}
                  <Button variant="ghost" onPress={() => setReportChatMessageId(message.id)}>
                    Report
                  </Button>
                </View>
              }
            />
          );
        })
      )}
      {me?.member.status === 'active' ? (
        <>
          <InlineError message={chatError} />
          <TextField
            label="Message"
            placeholder="Say something to the group"
            value={chatBody}
            onChangeText={setChatBody}
          />
          <Button variant="primary" onPress={handlePostChat} disabled={!chatBody.trim()}>
            Send
          </Button>
        </>
      ) : null}

      <SectionHeader title="Polls" />
      {polls.map(({ poll, options, votes }) => (
        <PollCard
          key={poll.id}
          poll={poll}
          options={options}
          votes={votes}
          userId={userId}
          onVote={(optionId) => runAction(voteOnPoll.mutateAsync({ pollId: poll.id, optionId }))}
          onClose={() => runAction(closePoll.mutateAsync(poll.id))}
        />
      ))}
      {me?.member.status === 'active' ? (
        <PollCreateForm
          disabled={createPoll.isPending}
          onSubmit={(input) => runAction(createPoll.mutateAsync(input))}
        />
      ) : null}

      <SectionHeader title="Invite by username" />
      <TextField
        label="Username"
        variant="search"
        placeholder="Search by username"
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          if (text.trim().length >= 3) search.mutate(text.trim());
        }}
        autoCapitalize="none"
      />
      {(search.data ?? []).map((result) => (
        <ListRow
          key={result.id}
          leading={<Avatar id={result.id} name={result.display_name} />}
          title={result.display_name}
          subtitle={`@${result.username}`}
          trailing={
            <Button onPress={() => runAction(inviteToGroup.mutateAsync(result.id))}>Invite</Button>
          }
        />
      ))}

      <InlineError message={actionError} />

      <SectionHeader title="Members" />
      {members.map(({ member, profile }) => (
        <ListRow
          key={profile.id}
          leading={<Avatar id={profile.id} name={profile.display_name} />}
          title={profile.display_name}
          subtitle={`@${profile.username}`}
          trailing={
            <>
              {member.role === 'owner' ? <StatusBadge label="Owner" variant="info" /> : null}
              {member.status === 'invited' ? (
                <StatusBadge label="Invited" variant="warning" />
              ) : null}
              {isOwner && member.status === 'active' && profile.id !== userId ? (
                <Button
                  variant="muted"
                  onPress={() => runAction(removeMember.mutateAsync(profile.id))}
                >
                  Remove
                </Button>
              ) : null}
            </>
          }
        />
      ))}

      <SectionHeader title="Group currencies" />
      <TextField
        label="New currency name"
        placeholder="e.g. House Points"
        value={currencyName}
        onChangeText={setCurrencyName}
      />
      <CategoryPicker value={currencyCategory} onChange={setCurrencyCategory} />
      <Button variant="primary" onPress={handleCreateCurrency} disabled={!currencyName.trim()}>
        Add currency
      </Button>
      {(currencies.data ?? []).map((currency) => (
        <ListRow
          key={currency.id}
          leading={currency.icon ? <ThemedText>{currency.icon}</ThemedText> : undefined}
          title={currency.name}
          trailing={
            currency.moderation_status === 'pending_review' ? (
              <StatusBadge label="Pending review" variant="warning" />
            ) : undefined
          }
        />
      ))}

      {me?.member.status === 'active' ? (
        <Button variant="muted" onPress={() => setShowLeaveConfirm(true)}>
          Leave group
        </Button>
      ) : null}
      {isOwner ? (
        <Button variant="muted" onPress={() => setShowArchiveConfirm(true)}>
          Archive group
        </Button>
      ) : null}

      <ConfirmationDialog
        visible={showLeaveConfirm}
        title="Leave this group?"
        description="You'll lose access to its currencies and future bets."
        confirmLabel="Leave"
        destructive
        onConfirm={() => {
          setShowLeaveConfirm(false);
          runAction(leaveGroup.mutateAsync(groupId as string));
        }}
        onCancel={() => setShowLeaveConfirm(false)}
      />
      <ConfirmationDialog
        visible={showArchiveConfirm}
        title="Archive this group?"
        description="Members will no longer be able to act on it."
        confirmLabel="Archive"
        destructive
        onConfirm={() => {
          setShowArchiveConfirm(false);
          runAction(archiveGroup.mutateAsync());
        }}
        onCancel={() => setShowArchiveConfirm(false)}
      />

      <ReportDialog
        visible={reportChatMessageId !== null}
        targetType="chat_message"
        targetId={reportChatMessageId}
        onClose={() => setReportChatMessageId(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chatTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
