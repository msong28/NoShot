import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import { useMyBets } from '@/hooks/use-bets';
import { useFriends } from '@/hooks/use-friends';
import { useSession } from '@/hooks/use-session';

import { CreatePickRivalScreen } from './create-pick-rival';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-bets', () => ({ useMyBets: vi.fn() }));
vi.mock('@/hooks/use-friends', () => ({ useFriends: vi.fn() }));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/create']}>
      <Routes>
        <Route path="/create" element={<CreatePickRivalScreen />} />
        <Route path="/create/:rivalId" element={<LocationProbe />} />
        <Route path="/friends" element={<div>Friends screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const bob = { id: 'u2', username: 'bob', display_name: 'Bob' };
const carol = { id: 'u3', username: 'carol', display_name: 'Carol' };
const dave = { id: 'u4', username: 'dave', display_name: 'Dave' };

describe('CreatePickRivalScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
  });

  it('does not autofocus the search input, so the recents list is the fast path', () => {
    vi.mocked(useFriends).mockReturnValue({
      friends: [{ friendship: { id: 'f1' }, profile: bob }],
      isLoading: false,
    } as never);
    vi.mocked(useMyBets).mockReturnValue({ bets: [] } as never);

    renderScreen();

    expect(screen.getByPlaceholderText('Search friends')).not.toHaveFocus();
  });

  it('orders friends by most-recently-bet-with-first, ahead of friends with no bet history', () => {
    vi.mocked(useFriends).mockReturnValue({
      friends: [
        { friendship: { id: 'f-carol' }, profile: carol },
        { friendship: { id: 'f-bob' }, profile: bob },
        { friendship: { id: 'f-dave' }, profile: dave },
      ],
      isLoading: false,
    } as never);
    // useMyBets already returns bets newest-first; Dave was bet with most
    // recently even though Carol appears first in the raw friends list.
    vi.mocked(useMyBets).mockReturnValue({
      bets: [
        { opponent: { id: 'u4', username: 'dave', display_name: 'Dave' } },
        { opponent: { id: 'u2', username: 'bob', display_name: 'Bob' } },
        { opponent: { id: 'u4', username: 'dave', display_name: 'Dave' } },
      ],
    } as never);

    renderScreen();

    const rows = screen
      .getAllByRole('button')
      .filter((el) => el.textContent?.match(/Dave|Bob|Carol/));
    const names = rows.map((el) => el.textContent);
    expect(names[0]).toContain('Dave');
    expect(names[1]).toContain('Bob');
    expect(names[2]).toContain('Carol');
  });

  it('advances straight to the details screen for the tapped rival, with no Next button', async () => {
    vi.mocked(useFriends).mockReturnValue({
      friends: [{ friendship: { id: 'f1' }, profile: bob }],
      isLoading: false,
    } as never);
    vi.mocked(useMyBets).mockReturnValue({ bets: [] } as never);

    renderScreen();

    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Bob'));

    expect(screen.getByTestId('location')).toHaveTextContent('/create/u2');
  });

  it('filters the list by name or username as the user types', async () => {
    vi.mocked(useFriends).mockReturnValue({
      friends: [
        { friendship: { id: 'f-bob' }, profile: bob },
        { friendship: { id: 'f-carol' }, profile: carol },
      ],
      isLoading: false,
    } as never);
    vi.mocked(useMyBets).mockReturnValue({ bets: [] } as never);

    renderScreen();

    await userEvent.type(screen.getByPlaceholderText('Search friends'), 'car');

    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('shows an empty state with a link to Friends when there are no friends yet', () => {
    vi.mocked(useFriends).mockReturnValue({ friends: [], isLoading: false } as never);
    vi.mocked(useMyBets).mockReturnValue({ bets: [] } as never);

    renderScreen();

    expect(screen.getByText('No friends yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find friends' })).toHaveAttribute('href', '/friends');
  });
});
