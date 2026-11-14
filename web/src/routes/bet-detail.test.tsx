import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import {
  useApproveBetVersion,
  useBetDetail,
  useCallOffBet,
  useConfirmBetResult,
  useRespondToBetAmendment,
} from '@/hooks/use-bets';
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
  useProposeBetAmendment: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useRespondToBetAmendment: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useWithdrawBetAmendment: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useCallOffBet: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
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
    pendingAmendment: null,
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

  it('has no chat, polls, or proof-photo button on the bet page (proof is added when settling)', () => {
    mockBetDetail();

    renderScreen();

    expect(screen.queryByPlaceholderText('Message…')).not.toBeInTheDocument();
    expect(screen.queryByText(/New poll/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add proof photo/i })).not.toBeInTheDocument();
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

  it('sends whoever is reporting to the dedicated Who won? page', () => {
    mockBetDetail({
      roster: TWO_PERSON_ROSTER,
      sides: [TWO_PERSON_ROSTER[0].side, TWO_PERSON_ROSTER[1].side],
    } as never);

    renderScreen();

    // No inline outcome picker any more -- just the button.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Who won?' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/bet/bet-1/result');
  });

  it("lets me confirm or dispute the other side's reported result", () => {
    const confirm = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
    vi.mocked(useConfirmBetResult).mockReturnValue(confirm as never);
    mockBetDetail({
      bet: {
        ...BET,
        status: 'pending_result',
        result_reported_by: 'u2',
        result_submission_id: 'sub-1',
        result_due_at: new Date(Date.now() + 47 * 3600000).toISOString(),
      },
      roster: TWO_PERSON_ROSTER,
      sides: [TWO_PERSON_ROSTER[0].side, TWO_PERSON_ROSTER[1].side],
      resultSubmissions: [
        { id: 'sub-1', submitter_id: 'u2', proposed_outcome_key: 'no', rationale: null },
      ],
    } as never);

    renderScreen();

    expect(screen.getByText('Bob says they won')).toBeInTheDocument();
    expect(screen.getByText(/Locks in in 2 days unless you dispute it/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Who won?' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'That’s right' }));
    expect(confirm.mutateAsync).toHaveBeenCalledWith({
      resultSubmissionId: 'sub-1',
      decision: 'approved',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dispute' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Dispute' }).at(-1)!);
    expect(confirm.mutateAsync).toHaveBeenLastCalledWith({
      resultSubmissionId: 'sub-1',
      decision: 'declined',
    });
  });

  it('shows the reporter a waiting state, not confirm buttons', () => {
    mockBetDetail({
      bet: {
        ...BET,
        status: 'pending_result',
        result_reported_by: 'u1',
        result_submission_id: 'sub-1',
        result_due_at: new Date(Date.now() + 47 * 3600000).toISOString(),
      },
      roster: TWO_PERSON_ROSTER,
      resultSubmissions: [
        { id: 'sub-1', submitter_id: 'u1', proposed_outcome_key: 'yes', rationale: null },
      ],
    } as never);

    renderScreen();

    expect(screen.getByText('You said you won')).toBeInTheDocument();
    expect(screen.getByText(/Waiting for Bob/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dispute' })).not.toBeInTheDocument();
  });

  it('offers re-reporting or calling it off on a disputed bet', () => {
    const callOff = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
    vi.mocked(useCallOffBet).mockReturnValue(callOff as never);
    mockBetDetail({ bet: { ...BET, status: 'disputed' }, roster: TWO_PERSON_ROSTER } as never);

    renderScreen();

    expect(screen.getByText('You don’t agree on who won')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Call it off' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Call it off' }).at(-1)!);
    expect(callOff.mutateAsync).toHaveBeenCalled();
  });

  it('shows an incoming change request and keeps the agreed terms until accepted', () => {
    const respond = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
    vi.mocked(useRespondToBetAmendment).mockReturnValue(respond as never);
    mockBetDetail({
      roster: TWO_PERSON_ROSTER,
      pendingAmendment: {
        id: 'am-1',
        bet_id: 'bet-1',
        proposed_by: 'u2',
        base_version: 1,
        title: BET.title,
        description: BET.description,
        deadline: null,
        sides: [],
        participants: [
          {
            user_id: 'u1',
            outcome_key: 'yes',
            currency_id: 'c',
            stake_quantity: 10,
            odds_numerator: 1,
            odds_denominator: 1,
          },
          {
            user_id: 'u2',
            outcome_key: 'no',
            currency_id: 'c',
            stake_quantity: 10,
            odds_numerator: 1,
            odds_denominator: 1,
          },
        ],
        status: 'pending',
        created_at: '2026-01-01T00:00:00Z',
        responded_at: null,
      },
    } as never);

    renderScreen();

    expect(screen.getByText('Bob wants to change this bet')).toBeInTheDocument();
    expect(screen.getByText('Your stake: 5 → 10')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep as is' }));
    expect(respond.mutateAsync).toHaveBeenCalledWith({ amendmentId: 'am-1', decision: 'declined' });
  });

  it('offers Propose a change in the menu on an active bet', () => {
    mockBetDetail({ roster: TWO_PERSON_ROSTER } as never);
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByRole('menuitem', { name: 'Propose a change' })).toBeInTheDocument();
  });

  it('says why a voided bet ended', () => {
    mockBetDetail({
      bet: { ...BET, status: 'voided', void_reason: 'called_off' },
      roster: TWO_PERSON_ROSTER,
    } as never);
    renderScreen();
    expect(screen.getByText(/called off after a dispute/)).toBeInTheDocument();
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
