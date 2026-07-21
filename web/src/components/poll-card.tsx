import { StatusBadge } from '@/components/ui/badge';
import type { Poll, PollOption, PollVote } from '@/lib/poll';

export function PollCard({
  poll,
  options,
  votes,
  userId,
  onVote,
  onClose,
}: {
  poll: Poll;
  options: PollOption[];
  votes: PollVote[];
  userId: string | undefined;
  onVote: (optionId: string) => void;
  onClose: () => void;
}) {
  const myVoteOptionIds = new Set(
    votes.filter((v) => v.voter_id === userId).map((v) => v.option_id),
  );
  const isCreator = poll.creator_id === userId;
  const isClosed = !!poll.closed_at;

  return (
    <div className="flex flex-col gap-one rounded-large bg-surface p-three shadow-card">
      <p className="font-display font-bold">{poll.question}</p>
      {options.map((option) => {
        const count = votes.filter((v) => v.option_id === option.id).length;
        const isMine = myVoteOptionIds.has(option.id);
        return (
          <div key={option.id} className="flex items-center justify-between gap-two">
            <p className="min-w-0 flex-1 truncate text-sm">
              {option.label} · {count} vote{count === 1 ? '' : 's'}
            </p>
            {!isClosed ? (
              <button
                type="button"
                onClick={() => onVote(option.id)}
                className={`rounded-pill px-three py-one font-display text-sm font-bold ${
                  isMine ? 'bg-secondary text-on-secondary' : 'bg-surface-sunken text-text-secondary'
                }`}
              >
                {isMine ? 'Voted' : 'Vote'}
              </button>
            ) : isMine ? (
              <StatusBadge label="Your vote" variant="info" />
            ) : null}
          </div>
        );
      })}
      {isClosed ? (
        <StatusBadge label="Closed" variant="neutral" />
      ) : isCreator ? (
        <button
          type="button"
          onClick={onClose}
          className="self-start rounded-pill bg-surface-sunken px-three py-one font-display text-sm font-bold text-text-secondary"
        >
          Close poll
        </button>
      ) : null}
    </div>
  );
}
