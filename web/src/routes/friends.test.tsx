import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { useMyBalances } from '@/hooks/use-ledger';
import {
  useBlockUser,
  useCancelFriendRequest,
  useFriends,
  useMutualFriendCount,
  useRespondFriendRequest,
  useSearchUsername,
  useSendFriendRequest,
} from '@/hooks/use-friends';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';

import { FriendsScreen } from './friends';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-profile', () => ({ useProfile: vi.fn() }));
vi.mock('@/hooks/use-ledger', () => ({ useMyBalances: vi.fn() }));
vi.mock('@/hooks/use-friends', () => ({
  useFriends: vi.fn(),
  useMutualFriendCount: vi.fn(),
  useSendFriendRequest: vi.fn(),
  useRespondFriendRequest: vi.fn(),
  useCancelFriendRequest: vi.fn(),
  useBlockUser: vi.fn(),
  useSearchUsername: vi.fn(),
}));

function renderScreen() {
  return render(
    <MemoryRouter>
      <FriendsScreen />
    </MemoryRouter>,
  );
}

describe('FriendsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useProfile).mockReturnValue({
      data: { id: 'u1', username: 'alice', display_name: 'Alice' } as never,
      isLoading: false,
    } as never);
    vi.mocked(useFriends).mockReturnValue({
      incomingRequests: [],
      outgoingRequests: [],
      friends: [],
      isLoading: false,
    });
    vi.mocked(useMyBalances).mockReturnValue({ rows: [], isLoading: false });
    vi.mocked(useMutualFriendCount).mockReturnValue({ data: 0 } as never);
    vi.mocked(useSendFriendRequest).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useRespondFriendRequest).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useCancelFriendRequest).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useBlockUser).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useSearchUsername).mockReturnValue({
      data: [],
      mutate: vi.fn(),
      isPending: false,
    } as never);
  });

  it('sends a friend request for a search result', async () => {
    const sendFriendRequest = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    };
    vi.mocked(useSendFriendRequest).mockReturnValue(sendFriendRequest as never);
    vi.mocked(useSearchUsername).mockReturnValue({
      data: [{ id: 'u2', username: 'bob', display_name: 'Bob' }],
      mutate: vi.fn(),
      isPending: false,
    } as never);

    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(sendFriendRequest.mutateAsync).toHaveBeenCalledWith('u2');
  });

  it('shows "Already friends" instead of Add for an existing friend', () => {
    vi.mocked(useFriends).mockReturnValue({
      incomingRequests: [],
      outgoingRequests: [],
      friends: [
        { friendship: { id: 'f1' }, profile: { id: 'u2', username: 'bob', display_name: 'Bob' } },
      ],
      isLoading: false,
    } as never);
    vi.mocked(useSearchUsername).mockReturnValue({
      data: [{ id: 'u2', username: 'bob', display_name: 'Bob' }],
      mutate: vi.fn(),
      isPending: false,
    } as never);

    renderScreen();

    expect(screen.getByText('Already friends')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
  });

  it('accepts an incoming friend request', async () => {
    const respondFriendRequest = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    };
    vi.mocked(useRespondFriendRequest).mockReturnValue(respondFriendRequest as never);
    vi.mocked(useFriends).mockReturnValue({
      incomingRequests: [
        { friendship: { id: 'f1' }, profile: { id: 'u2', username: 'bob', display_name: 'Bob' } },
      ],
      outgoingRequests: [],
      friends: [],
      isLoading: false,
    } as never);

    renderScreen();

    // Requests use "Add" to accept, matching design_handoff_noshot/screens/12-friends.png.
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(respondFriendRequest.mutateAsync).toHaveBeenCalledWith({
      friendshipId: 'f1',
      accept: true,
    });
  });

  it('blocks an existing friend', async () => {
    const blockUser = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
    vi.mocked(useBlockUser).mockReturnValue(blockUser as never);
    vi.mocked(useFriends).mockReturnValue({
      incomingRequests: [],
      outgoingRequests: [],
      friends: [
        { friendship: { id: 'f1' }, profile: { id: 'u2', username: 'bob', display_name: 'Bob' } },
      ],
      isLoading: false,
    } as never);

    renderScreen();

    // Block is now an icon-only button; its accessible name includes the friend's name.
    await userEvent.click(screen.getByRole('button', { name: 'Block Bob' }));
    expect(blockUser.mutateAsync).toHaveBeenCalledWith('u2');
  });

  it('shows the empty state when there are no friends', () => {
    renderScreen();
    expect(screen.getByText('No friends yet')).toBeInTheDocument();
    expect(
      screen.getByText('Tap Add friend to copy your invite link and send it to someone.'),
    ).toBeInTheDocument();
  });

  it('copies the invite link when "Add friend" is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Add friend' }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/alice`);
    expect(await screen.findByRole('button', { name: 'Link copied!' })).toBeInTheDocument();
  });

  it('hides the search bar until the search button is tapped', async () => {
    renderScreen();

    expect(screen.queryByPlaceholderText('Search by @username')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByPlaceholderText('Search by @username')).toBeInTheDocument();
  });

  it('shows what a friend owes you, compacted, and "Settled" for an even friend', () => {
    vi.mocked(useFriends).mockReturnValue({
      incomingRequests: [],
      outgoingRequests: [],
      friends: [
        { friendship: { id: 'f1' }, profile: { id: 'u2', username: 'bob', display_name: 'Bob' } },
        { friendship: { id: 'f2' }, profile: { id: 'u3', username: 'cy', display_name: 'Cy' } },
      ],
      isLoading: false,
    } as never);
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
