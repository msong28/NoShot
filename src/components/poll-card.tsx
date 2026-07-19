import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Spacing } from '@/constants/theme';
import type { Poll, PollOption, PollVote } from '@/lib/poll';

type PollCardProps = {
  poll: Poll;
  options: PollOption[];
  votes: PollVote[];
  userId: string | undefined;
  onVote: (optionId: string) => void;
  onClose: () => void;
};

/** Shared between the bet detail screen (bet-scoped polls) and the group
 * detail screen (group-scoped polls) -- the poll/option/vote shape and
 * behaviour are identical either way. */
export function PollCard({ poll, options, votes, userId, onVote, onClose }: PollCardProps) {
  const myVoteOptionIds = new Set(
    votes.filter((v) => v.voter_id === userId).map((v) => v.option_id),
  );
  const isCreator = poll.creator_id === userId;
  const isClosed = !!poll.closed_at;

  return (
    <Card style={styles.card}>
      <ThemedText type="smallBold">{poll.question}</ThemedText>
      {options.map((option) => {
        const count = votes.filter((v) => v.option_id === option.id).length;
        const isMine = myVoteOptionIds.has(option.id);
        return (
          <View key={option.id} style={styles.optionRow}>
            <ThemedText type="bodySM" style={styles.optionLabel}>
              {option.label} · {count} vote{count === 1 ? '' : 's'}
            </ThemedText>
            {!isClosed ? (
              <Button variant={isMine ? 'accent' : 'muted'} onPress={() => onVote(option.id)}>
                {isMine ? 'Voted' : 'Vote'}
              </Button>
            ) : isMine ? (
              <StatusBadge label="Your vote" variant="info" />
            ) : null}
          </View>
        );
      })}
      {isClosed ? (
        <StatusBadge label="Closed" variant="neutral" />
      ) : isCreator ? (
        <Button variant="muted" onPress={onClose}>
          Close poll
        </Button>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.one,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  optionLabel: {
    flex: 1,
  },
});
