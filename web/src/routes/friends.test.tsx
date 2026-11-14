import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';

import {
  useCancelFriendRequest,
  useFriends,
  useMutualFriendCount,
  useRespondFriendRequest,
} from '@/hooks/use-friends';
import { useMyBalances } from '@/hooks/use-ledger';
import { useSession } from '@/hooks/use-session';

import { FriendsScreen } from './friends';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-ledger', () => ({ useMyBalances: vi.fn() }));
vi.mock('@/hooks/use-friends', () => ({
  useFriends: vi.fn(),
  useMutualFriendCount: vi.fn(),
  useRespondFriendRequest: vi.fn(),
  useCancelFriendRequest: vi.fn(),
}));

const bob = { id: 'u2', username: 'bob', display_name: 'Bob' };

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/friends']}>
      <Routes>
        <Route path="/friends" element={<FriendsScreen />} />
        <Route path="/friends/search" element={<p>search screen</p>} />
        <Route path="/friends/add" element={<p>add page</p>} />
        <Route path="/friend/:userId" element={<p>friend page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function withFriends(friends: { friendship: { id: string }; profile: typeof bob }[]) {
  vi.mocked(useFriends).mockReturnValue({
    incomingRequests: [],
    outgoingRequests: [],
    friends,
    isLoading: false,
  } as never);
}

describe('FriendsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    withFriends([]);
    vi.mocked(useMyBalances).mockReturnValue({ rows: [], isLoading: false });
    vi.mocked(useMutualFriendCount).mockReturnValue({ data: 0 } as never);
    vi.mocked(useRespondFriendRequest).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useCancelFriendRequest).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
  });

  it('accepts an incoming friend request', async () => {
    const respondFriendRequest = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    };
    vi.mocked(useRespondFriendRequest).mockReturnValue(respondFriendRequest as never);
    vi.mocked(useFriends).mockReturnValue({
      incomingRequests: [{ friendship: { id: 'f1' }, profile: bob }],
      outgoingRequests: [],
      friends: [],
      isLoading: false,
    } as never);

    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(respondFriendRequest.mutateAsync).toHaveBeenCalledWith({
      friendshipId: 'f1',
      accept: true,
    });
  });

  it('makes the whole friend row a link to their page, with no block button on the list', async () => {
    withFriends([{ friendship: { id: 'f1' }, profile: bob }]);

    renderScreen();

    expect(screen.queryByRole('button', { name: /block/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /Bob/ }));
    expect(screen.getByText('friend page')).toBeInTheDocument();
  });

  it('shows the empty state when there are no friends', () => {
    renderScreen();
    expect(screen.getByText('No friends yet')).toBeInTheDocument();
  });

  it('opens the Add friends page from the header button', async () => {
    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Add friend' }));
    expect(screen.getByText('add page')).toBeInTheDocument();
  });

  it('opens the search screen from the header search button', async () => {
    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByText('search screen')).toBeInTheDocument();
  });

  it('shows what a friend owes you, compacted, and "Settled" for an even friend', () => {
    withFriends([
      { friendship: { id: 'f1' }, profile: bob },
      { friendship: { id: 'f2' }, profile: { id: 'u3', username: 'cy', display_name: 'Cy' } },
    ]);
    vi.mocked(useMyBalances).mockReturnValue({
      isLoading: false,
      rows: [
        {
          balance: { counterparty_id: 'u2', group_id: null, currency_id: 'c1', net_amount: 12500 },
          currency: { id: 'c1', name: 'Coffees', icon: null },
        },
        {
          balance: { counterparty_id: 'u2', group_id: null, currency_id: 'c2', net_amount: -3 },
          currency: { id: 'c2', name: 'Beers', icon: null },
        },
      ],
    } as never);

    renderScreen();

    expect(screen.getByLabelText('They owe you 12.5K Coffees +1')).toBeInTheDocument();
    expect(screen.getByText('Settled')).toBeInTheDocument();
  });
});
