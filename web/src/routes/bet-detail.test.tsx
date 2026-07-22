import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { useBetDetail } from '@/hooks/use-bets';
import { useComments, usePostComment } from '@/hooks/use-comments';
import { useClosePoll, useCreatePoll, usePolls, useVoteOnPoll } from '@/hooks/use-polls';
import { useProofAssets, useUploadProof } from '@/hooks/use-proof';
import { useSubmitReport } from '@/hooks/use-reports';
import { useSession } from '@/hooks/use-session';

import { BetDetailScreen } from './bet-detail';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-bets', () => ({
  useBetDetail: vi.fn(),
  useApproveBetVersion: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useApproveCancelBet: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useConfirmBetResult: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useProposeCancelBet: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useResolveDispute: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useSubmitBetResult: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useTriggerRandomFallback: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useVoteOnDispute: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));
vi.mock('@/hooks/use-comments', () => ({
  useComments: vi.fn(),
  usePostComment: vi.fn(),
}));
vi.mock('@/hooks/use-polls', () => ({
  usePolls: vi.fn(),
  useCreatePoll: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useVoteOnPoll: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useClosePoll: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));
vi.mock('@/hooks/use-proof', () => ({
  useProofAssets: vi.fn(),
  useUploadProof: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));
vi.mock('@/hooks/use-reports', () => ({
  useSubmitReport: vi.fn(),
}));

const BET = {
  id: 'bet-1',
  creator_id: 'u1',
  group_id: null,
  title: 'Will it rain tomorrow',
  description: 'Weather bet',
  current_version: 1,
  status: 'active' as const,
  deadline: null,
  resolution_method: 'participant_submission' as const,
  judge_id: null,
  random_fallback_enabled: false,
  created_at: '2026-01-01T00:00:00Z',
  activated_at: '2026-01-01T00:00:00Z',
  resolved_at: null,
  resolved_outcome_key: null,
};

const ROSTER = [
  {
    participant: {
      id: 'p1',
      bet_id: 'bet-1',
      user_id: 'u1',
      side_id: 's1',
      role: 'creator' as const,
      participation_status: 'active' as const,
      created_at: '2026-01-01T00:00:00Z',
    },
    profile: { id: 'u1', username: 'alice', display_name: 'Alice' },
    side: { id: 's1', bet_id: 'bet-1', version_no: 1, label: 'Yes', outcome_key: 'yes' },
    commitment: undefined,
    approval: {
      id: 'a1',
      bet_id: 'bet-1',
      version_no: 1,
      user_id: 'u1',
      decision: 'approved' as const,
      created_at: '2026-01-01T00:00:00Z',
    },
  },
];

function mockBetDetail(overrides: Partial<ReturnType<typeof useBetDetail>> = {}) {
  vi.mocked(useBetDetail).mockReturnValue({
    bet: BET,
    sides: [ROSTER[0].side],
    roster: ROSTER,
    participantProfiles: [ROSTER[0].profile],
    cancellationApprovals: [],
    resultSubmissions: [],
    resultConfirmations: [],
    disputeVotes: [],
    disputeResolution: undefined,
    isLoading: false,
    ...overrides,
  } as never);
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/bet/bet-1']}>
      <Routes>
        <Route path="/bet/:betId" element={<BetDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BetDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useComments).mockReturnValue({ comments: [], isLoading: false });
    vi.mocked(usePostComment).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    vi.mocked(usePolls).mockReturnValue({ polls: [], isLoading: false });
    vi.mocked(useProofAssets).mockReturnValue({ assets: [], isLoading: false });
    vi.mocked(useSubmitReport).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as never);
  });

  it('renders comments and lets a participant post one', () => {
    mockBetDetail();
    vi.mocked(useComments).mockReturnValue({
      comments: [
        {
          comment: {
            id: 'c1',
            bet_id: 'bet-1',
            author_id: 'u1',
            body: 'Good luck',
            moderation_status: 'visible' as never,
            created_at: '2026-01-01T00:00:00Z',
            removed_at: null,
          },
          author: { id: 'u1', username: 'alice', display_name: 'Alice' },
        },
      ],
      isLoading: false,
    });

    renderScreen();

    expect(screen.getByText('Good luck')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Message…')).toBeInTheDocument();
  });

  it('hides the comment and poll-create forms for a non-participant', () => {
    mockBetDetail();
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'stranger' } } as never,
      isLoading: false,
    });

    renderScreen();

    expect(screen.queryByPlaceholderText('Message…')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('New poll question')).not.toBeInTheDocument();
  });

  it('renders an uploaded proof image and its caption', () => {
    mockBetDetail();
    vi.mocked(useProofAssets).mockReturnValue({
      assets: [
        {
          asset: {
            id: 'proof-1',
            bet_id: 'bet-1',
            uploader_id: 'u1',
            storage_path: 'bet-1/u1-1.jpg',
            mime_type: 'image/jpeg',
            size_bytes: 100,
            caption: 'Screenshot',
            moderation_status: 'visible' as never,
            created_at: '2026-01-01T00:00:00Z',
          },
          signedUrl: 'https://example.com/signed.jpg',
        },
      ],
      isLoading: false,
    });

    renderScreen();

    expect(screen.getByText('Screenshot')).toBeInTheDocument();
    expect(screen.getByAltText('Screenshot')).toHaveAttribute(
      'src',
      'https://example.com/signed.jpg',
    );
  });

  it('renders a poll with its options', () => {
    mockBetDetail();
    vi.mocked(usePolls).mockReturnValue({
      polls: [
        {
          poll: {
            id: 'poll-1',
            bet_id: 'bet-1',
            group_id: null,
            creator_id: 'u1',
            question: 'Who wins?',
            allow_multiple: false,
            created_at: '2026-01-01T00:00:00Z',
            closed_at: null,
          },
          options: [{ id: 'o1', poll_id: 'poll-1', label: 'Team A', position: 0 }],
          votes: [],
        },
      ],
      isLoading: false,
    });

    renderScreen();

    expect(screen.getByText('Who wins?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Team A0' })).toBeInTheDocument();
  });

  it('opens the report dialog for the bet when Report is clicked', () => {
    mockBetDetail();

    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Report' }));

    expect(screen.getByText('Report this')).toBeInTheDocument();
  });
});
