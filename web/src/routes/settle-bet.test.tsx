import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import { useBetDetail, useProposeCancelBet, useSubmitBetResult } from '@/hooks/use-bets';
import { useUploadProof } from '@/hooks/use-proof';
import { useSession } from '@/hooks/use-session';

import { SettleBetScreen } from './settle-bet';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-bets', () => ({
  useBetDetail: vi.fn(),
  useSubmitBetResult: vi.fn(),
  useProposeCancelBet: vi.fn(),
}));
vi.mock('@/hooks/use-proof', () => ({ useUploadProof: vi.fn() }));

const BET = {
  id: 'bet-1',
  title: 'Pool tonight',
  status: 'active' as const,
  resolved_outcome_key: null,
};

const side = (id: string, label: string, key: string) => ({ id, label, outcome_key: key });
const commit = { stake_quantity: 5, payout_if_win: 5, currencies: { name: 'bucks', icon: '💵' } };

function roster(mySide = side('s1', 'You', 'creator'), theirSide = side('s2', 'Bob', 'rival')) {
  return [
    {
      participant: { id: 'p1', user_id: 'u1' },
      profile: { id: 'u1', display_name: 'Alice' },
      side: mySide,
      commitment: commit,
    },
    {
      participant: { id: 'p2', user_id: 'u2' },
      profile: { id: 'u2', display_name: 'Bob' },
      side: theirSide,
      commitment: commit,
    },
  ];
}

function Probe() {
  const l = useLocation();
  return <div data-testid="location">{l.pathname + l.search}</div>;
}

function setup(opts: { bet?: object; roster?: unknown[]; submissions?: unknown[] } = {}) {
  const submit = { mutateAsync: vi.fn(), isPending: false };
  const cancel = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
  vi.mocked(useSubmitBetResult).mockReturnValue(submit as never);
  vi.mocked(useProposeCancelBet).mockReturnValue(cancel as never);
  vi.mocked(useUploadProof).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  vi.mocked(useBetDetail).mockReturnValue({
    bet: { ...BET, ...opts.bet },
    roster: opts.roster ?? roster(),
    resultSubmissions: opts.submissions ?? [],
    isLoading: false,
  } as never);
  render(
    <MemoryRouter initialEntries={['/bet/bet-1/settle']}>
      <Routes>
        <Route path="/bet/:betId/settle" element={<SettleBetScreen />} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
  return { submit, cancel };
}

describe('SettleBetScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
  });

  it('offers I won / they won / tie / call it off, with Settle disabled until one is picked', () => {
    setup();
    expect(screen.getByRole('radio', { name: 'I won' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Bob won' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'It was a tie' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /call it off/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settle bet' })).toBeDisabled();
  });

  it('uses the real side labels for lines and custom win conditions', () => {
    setup({
      roster: roster(side('s1', 'Over 2.5', 'over'), side('s2', 'Under 2.5', 'under')),
    });
    expect(screen.getByRole('radio', { name: 'Over 2.5 wins' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Under 2.5 wins' })).toBeInTheDocument();
  });

  it('asks for confirmation, then submits and reveals the result', async () => {
    const { submit } = setup();
    submit.mutateAsync.mockResolvedValue({
      ...BET,
      status: 'resolved',
      resolved_outcome_key: 'creator',
    });

    fireEvent.click(screen.getByRole('radio', { name: 'I won' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settle bet' }));
    expect(submit.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText('This is final', { exact: false })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Settle it' }));
    expect(await screen.findByText('You won!')).toBeInTheDocument();
    expect(submit.mutateAsync).toHaveBeenCalledWith({
      outcomeKey: 'creator',
      rationale: undefined,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/bets?tab=done');
  });

  it('proposes cancelling instead of settling when it was inconclusive', async () => {
    const { submit, cancel } = setup();

    fireEvent.click(screen.getByRole('radio', { name: /call it off/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Propose calling it off' }));
    fireEvent.click(screen.getByRole('button', { name: 'Propose' }));

    await vi.waitFor(() => expect(cancel.mutateAsync).toHaveBeenCalled());
    expect(submit.mutateAsync).not.toHaveBeenCalled();
    expect(await screen.findByTestId('location')).toHaveTextContent('/bet/bet-1');
  });

  it('bounces back to the bet if it is not settleable', () => {
    setup({ bet: { status: 'resolved' } });
    expect(screen.getByTestId('location')).toHaveTextContent('/bet/bet-1');
  });

  it('waits for the session instead of bouncing back to the bet (first-tick null session)', () => {
    vi.mocked(useSession).mockReturnValue({ session: null, isLoading: false } as never);
    setup();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
  });
});
