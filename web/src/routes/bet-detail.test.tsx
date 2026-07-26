import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import { useApproveBetVersion, useBetDetail, useSubmitBetResult } from '@/hooks/use-bets';
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

/** A second participant plus a commitment on `u1`, so the settle UI has two
 * outcomes to pick from and the reveal has a stake amount to showcase. */
const TWO_PERSON_ROSTER = [
  {
    ...ROSTER[0],
    commitment: {
      id: 'com1',
      stake_quantity: 5,
      payout_if_win: 5,
      currencies: { name: 'bucks', icon: '💵' },
    },
  },
  {
    participant: {
      id: 'p2',
      bet_id: 'bet-1',
      user_id: 'u2',
      side_id: 's2',
      role: 'participant' as const,
      participation_status: 'active' as const,
      created_at: '2026-01-01T00:00:00Z',
    },
    profile: { id: 'u2', username: 'bob', display_name: 'Bob' },
    side: { id: 's2', bet_id: 'bet-1', version_no: 1, label: 'No', outcome_key: 'no' },
    commitment: {
      id: 'com2',
      stake_quantity: 5,
      payout_if_win: 5,
      currencies: { name: 'bucks', icon: '💵' },
    },
    approval: undefined,
  },
];

/** Renders wherever the settle flow redirects, so a test can assert it lands
 * on the Done bets. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/bet/bet-1']}>
      <Routes>
        <Route path="/bet/:betId" element={<BetDetailScreen />} />
        <Route path="*" element={<LocationProbe />} />
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

  it('celebrates acceptance and redirects to Active when approving activates the bet', async () => {
    const activeBet = { ...BET, status: 'active' as const };
    const mutateAsync = vi.fn().mockResolvedValue(activeBet);
    vi.mocked(useApproveBetVersion).mockReturnValue({ mutateAsync, isPending: false } as never);

    mockBetDetail({
      bet: { ...BET, status: 'pending_acceptance' as const },
      roster: [{ ...ROSTER[0], approval: undefined }],
    } as never);

    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    // The acceptance animation shows...
    expect(await screen.findByText('Bet accepted!')).toBeInTheDocument();

    // ...and continuing lands them on the Active tab.
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/bets?tab=active');
  });

  it('reveals the result on settle and then drops the settler on their Done bets', async () => {
    const resolvedBet = {
      ...BET,
      status: 'resolved' as const,
      resolved_outcome_key: 'no',
      resolved_at: '2026-01-02T00:00:00Z',
    };
    const mutateAsync = vi.fn().mockResolvedValue(resolvedBet);
    vi.mocked(useSubmitBetResult).mockReturnValue({ mutateAsync, isPending: false } as never);

    mockBetDetail({
      roster: TWO_PERSON_ROSTER,
      sides: [TWO_PERSON_ROSTER[0].side, TWO_PERSON_ROSTER[1].side],
    } as never);

    renderScreen();

    // Settle with the outcome that loses it for u1.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'no' } });
    fireEvent.click(screen.getByRole('button', { name: 'Settle bet' }));

    // The reveal showcases the loss (and what they owe), for every outcome.
    expect(await screen.findByText('You lost')).toBeInTheDocument();
    expect(screen.getByText('YOU OWE BOB')).toBeInTheDocument();

    // Continuing lands them on the Done tab as proof it settled.
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/bets?tab=done');
  });

  it('opens the report dialog for the bet when Report is clicked', () => {
    mockBetDetail();

    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Report' }));

    expect(screen.getByText('Report this')).toBeInTheDocument();
  });
});
