export type Poll = {
  id: string;
  bet_id: string | null;
  group_id: string | null;
  creator_id: string;
  question: string;
  allow_multiple: boolean;
  created_at: string;
  closed_at: string | null;
};

export type PollOption = {
  id: string;
  poll_id: string;
  label: string;
  position: number;
};

export type PollVote = {
  id: string;
  poll_id: string;
  option_id: string;
  voter_id: string;
  created_at: string;
};
