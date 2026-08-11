import { StatusPill } from '@/components/ui/status-pill';
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
  const totalVotes = votes.length;

  return (
    <div className="flex flex-col gap-two rounded-large border border-grape bg-surface p-three shadow-attention">
      <div className="flex items-center gap-two">
        <span className="text-lg">📊</span>
        <p className="font-display font-bold">{poll.question}</p>
      </div>
      {options.map((option) => {
        const count = votes.filter((v) => v.option_id === option.id).length;
        const isMine = myVoteOptionIds.has(option.id);
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        return (
          <button
            key={option.id}
            type="button"
            disabled={isClosed}
            onClick={() => onVote(option.id)}
            className="relative flex h-10 w-full items-center overflow-hidden rounded-medium bg-surface-sunken text-left disabled:cursor-default"
          >
            <div
              className="absolute inset-y-0 left-0 bg-grape-soft transition-[width]"
              style={{ width: `${pct}%` }}
            />
            <span className="relative flex w-full items-center justify-between px-three">
              <span className="truncate text-sm font-bold">
                {option.label}
                {isMine ? ' ✓' : ''}
              </span>
              <span className="shrink-0 font-mono text-sm font-bold text-text-secondary">
                {count}
              </span>
            </span>
          </button>
        );
      })}
      {isClosed ? (
        <StatusPill variant="tied" label="Closed" />
      ) : isCreator ? (
        <button
          type="button"
          onClick={onClose}
          className="self-start rounded-pill bg-surface-sunken px-three py-one text-sm font-bold text-text-secondary"
        >
          Close poll
        </button>
      ) : null}
    </div>
  );
}
