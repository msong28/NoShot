import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { useMyBets } from '@/hooks/use-bets';
import {
  useBlockUser,
  useCancelFriendRequest,
  useFriends,
  useHeadToHeadRecords,
  useMutualFriendCount,
  useRespondFriendRequest,
  useSearchUsername,
  useSendFriendRequest,
} from '@/hooks/use-friends';
import { useSession } from '@/hooks/use-session';

import { FriendsScreen } from './friends';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-bets', () => ({ useMyBets: vi.fn() }));
vi.mock('@/hooks/use-friends', () => ({
  useFriends: vi.fn(),
  useHeadToHeadRecords: vi.fn(),
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
    vi.mocked(useFriends).mockReturnValue({
      incomingRequests: [],
      outgoingRequests: [],
      friends: [],
      isLoading: false,
    });
    vi.mocked(useMyBets).mockReturnValue({ resolvedBets: [] } as never);
    vi.mocked(useHeadToHeadRecords).mockReturnValue(new Map());
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
    expect(screen.getByText('Search above to add some.')).toBeInTheDocument();
  });
});
