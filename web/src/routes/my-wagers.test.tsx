import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { useMyWagers } from '@/hooks/use-wager';
import { useSession } from '@/hooks/use-session';

import { MyWagersScreen } from './my-wagers';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-wager', () => ({ useMyWagers: vi.fn() }));

function renderScreen() {
  return render(
    <MemoryRouter>
      <MyWagersScreen />
    </MemoryRouter>,
  );
}

describe('MyWagersScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
  });

  it('shows an empty state with a way to create when there are no bets', () => {
    vi.mocked(useMyWagers).mockReturnValue({ wagers: [], isLoading: false });

    renderScreen();

    expect(screen.getByText('No bets yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a bet' })).toHaveAttribute('href', '/create');
  });

  it('renders a row with the event, the rival, the stake, and a pending pill', () => {
    vi.mocked(useMyWagers).mockReturnValue({
      isLoading: false,
      wagers: [
        {
          wager: {
            id: 'w1',
            event: 'Lakers win tonight',
            currency_kind: 'money',
            currency_id: null,
          } as never,
          iAmCreator: true,
          counterparty: { id: 'u2', username: 'bob', display_name: 'Bob' },
          myStake: 5,
          theirStake: 5,
          currency: null,
        },
      ],
    });

    renderScreen();

    expect(screen.getByText('Lakers win tonight')).toBeInTheDocument();
    expect(screen.getByText('You vs Bob')).toBeInTheDocument();
    expect(screen.getByText('💵 5')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows the custom currency name and icon for a non-money stake', () => {
    vi.mocked(useMyWagers).mockReturnValue({
      isLoading: false,
      wagers: [
        {
          wager: {
            id: 'w2',
            event: 'Loser does dishes',
            currency_kind: 'custom',
            currency_id: 'cur-chore',
          } as never,
          iAmCreator: false,
          counterparty: { id: 'u3', username: 'cara', display_name: 'Cara' },
          myStake: 2,
          theirStake: 2,
          currency: { id: 'cur-chore', name: 'Chore', icon: '🧹' } as never,
        },
      ],
    });

    renderScreen();

    expect(screen.getByText('vs Cara')).toBeInTheDocument();
    expect(screen.getByText('🧹 2 Chore')).toBeInTheDocument();
  });
});
