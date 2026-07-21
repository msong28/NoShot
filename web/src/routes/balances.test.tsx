import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { useMyBalances } from '@/hooks/use-ledger';
import {
  useCancelRedemption,
  useConfirmRedemption,
  useDeclineRedemption,
  useMyRedemptions,
  useOutstandingObligations,
  useRequestRedemption,
} from '@/hooks/use-redemption';
import { useSession } from '@/hooks/use-session';

import { BalancesScreen } from './balances';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-ledger', () => ({ useMyBalances: vi.fn() }));
vi.mock('@/hooks/use-redemption', () => ({
  useMyRedemptions: vi.fn(),
  useConfirmRedemption: vi.fn(),
  useDeclineRedemption: vi.fn(),
  useCancelRedemption: vi.fn(),
  useOutstandingObligations: vi.fn(),
  useRequestRedemption: vi.fn(),
}));

function renderScreen() {
  return render(
    <MemoryRouter>
      <BalancesScreen />
    </MemoryRouter>,
  );
}

describe('BalancesScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useMyBalances).mockReturnValue({ rows: [], isLoading: false } as never);
    vi.mocked(useMyRedemptions).mockReturnValue({
      needsMyConfirmation: [],
      waitingOnThem: [],
      isLoading: false,
    } as never);
    vi.mocked(useConfirmRedemption).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useDeclineRedemption).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useCancelRedemption).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useOutstandingObligations).mockReturnValue({ data: [], isLoading: false } as never);
    vi.mocked(useRequestRedemption).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  });

  it('shows the settled-up empty state', () => {
    renderScreen();
    expect(screen.getByText('All settled up')).toBeInTheDocument();
  });

  it('lets someone owed money settle up with a full allocation', async () => {
    vi.mocked(useMyBalances).mockReturnValue({
      rows: [
        {
          balance: { counterparty_id: 'u2', currency_id: 'cur1', group_id: null, net_amount: -20 },
          counterparty: { id: 'u2', username: 'bob', display_name: 'Bob' },
          currency: { id: 'cur1', name: 'Dollars' },
        },
      ],
      isLoading: false,
    } as never);
    vi.mocked(useOutstandingObligations).mockReturnValue({
      data: [{ source_entry_id: 'e1', outstanding_amount: 20 }],
      isLoading: false,
    } as never);
    const requestRedemption = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
    vi.mocked(useRequestRedemption).mockReturnValue(requestRedemption as never);

    renderScreen();

    expect(screen.getByText('You owe 20 Dollars')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Settle up' }));

    expect(requestRedemption.mutateAsync).toHaveBeenCalledWith([
      { source_entry_id: 'e1', amount: 20 },
    ]);
  });

  it('confirms a redemption someone else says they paid', async () => {
    const confirmRedemption = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
    vi.mocked(useConfirmRedemption).mockReturnValue(confirmRedemption as never);
    vi.mocked(useMyRedemptions).mockReturnValue({
      needsMyConfirmation: [
        { request: { id: 'r1', amount: 15 }, counterparty: { id: 'u2', display_name: 'Bob' } },
      ],
      waitingOnThem: [],
      isLoading: false,
    } as never);

    renderScreen();

    expect(screen.getByText('Says they paid 15')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(confirmRedemption.mutateAsync).toHaveBeenCalledWith('r1');
  });

  it('cancels a redemption request waiting on the other person', async () => {
    const cancelRedemption = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
    vi.mocked(useCancelRedemption).mockReturnValue(cancelRedemption as never);
    vi.mocked(useMyRedemptions).mockReturnValue({
      needsMyConfirmation: [],
      waitingOnThem: [
        { request: { id: 'r2', amount: 5 }, counterparty: { id: 'u2', display_name: 'Bob' } },
      ],
      isLoading: false,
    } as never);

    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancelRedemption.mutateAsync).toHaveBeenCalledWith('r2');
  });
});
