import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import { useApproveBetVersion, useBetDetail } from '@/hooks/use-bets';
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
  useWithdrawBet: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useEditPendingBetDetails: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useCreateOrCounterBet: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));
vi.mock('@/hooks/use-currencies', () => ({
  useCurrencies: vi.fn(() => ({ data: [] })),
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
    vi.mocked(useProofAssets).mockReturnValue({ assets: [], isLoading: false });
    vi.mocked(useSubmitReport).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as never);
  });

  it('has no chat or polls, but still lets a participant attach proof', () => {
    mockBetDetail();

    renderScreen();

    expect(screen.queryByPlaceholderText('Message…')).not.toBeInTheDocument();
    expect(screen.queryByText(/New poll/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add proof photo/i })).toBeInTheDocument();
  });

  it('offers Accept/Decline and no proof-photo upload while a proposal is pending', () => {
    mockBetDetail({
      bet: { ...BET, status: 'pending_acceptance' as const },
      roster: [{ ...ROSTER[0], approval: undefined }],
    } as never);

    renderScreen();

    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add proof photo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('shows the opponent in one line instead of a VS card and a participants list', () => {
    mockBetDetail();

    renderScreen();

    expect(screen.queryByText('VS')).not.toBeInTheDocument();
    expect(screen.queryByText('Participants')).not.toBeInTheDocument();
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

  it('celebrates acceptance and redirects to Active when approving activates the bet', async () => {
    const activeBet = { ...BET, status: 'active' as const };
    const mutateAsync = vi.fn().mockResolvedValue(activeBet);
    vi.mocked(useApproveBetVersion).mockReturnValue({ mutateAsync, isPending: false } as never);

    mockBetDetail({
      bet: { ...BET, status: 'pending_acceptance' as const },
      roster: [{ ...ROSTER[0], approval: undefined }],
    } as never);

    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    // The acceptance animation shows...
    expect(await screen.findByText('Bet accepted!')).toBeInTheDocument();

    // ...and continuing lands them on the Active tab.
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/bets?tab=active');
  });

  it('sends the settler to the dedicated settle page', () => {
    mockBetDetail({
      roster: TWO_PERSON_ROSTER,
      sides: [TWO_PERSON_ROSTER[0].side, TWO_PERSON_ROSTER[1].side],
    } as never);

    renderScreen();

    // No inline outcome picker any more -- just the button.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Settle bet' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/bet/bet-1/settle');
  });

  it('keeps Cancel bet in the more-options menu, behind a confirmation', () => {
    mockBetDetail();

    renderScreen();

    expect(screen.queryByRole('button', { name: 'Cancel bet' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cancel bet' }));
    expect(screen.getByText('Propose cancelling this bet?')).toBeInTheDocument();
  });

  it('offers Delete bet in the menu for your own pending proposal', () => {
    mockBetDetail({
      bet: { ...BET, status: 'pending_acceptance' as const },
    } as never);

    renderScreen();

    expect(screen.queryByRole('button', { name: 'Delete bet' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete bet' }));
    expect(screen.getByText('Delete this bet?')).toBeInTheDocument();
  });

  it('opens the report dialog for the bet from the more-options menu', () => {
    mockBetDetail();

    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Report this bet' }));

    expect(screen.getByText('Report this')).toBeInTheDocument();
  });
});
