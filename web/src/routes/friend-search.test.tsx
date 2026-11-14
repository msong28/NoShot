import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import {
  useFriends,
  useMutualFriendCount,
  useSearchUsername,
  useSendFriendRequest,
} from '@/hooks/use-friends';
import { useSession } from '@/hooks/use-session';

import { FriendSearchScreen } from './friend-search';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-friends', () => ({
  useFriends: vi.fn(),
  useMutualFriendCount: vi.fn(),
  useSearchUsername: vi.fn(),
  useSendFriendRequest: vi.fn(),
}));

const bob = { id: 'u2', username: 'bob', display_name: 'Bob' };

function setup(search: { data?: unknown[]; mutate?: ReturnType<typeof vi.fn> } = {}) {
  const mutate = search.mutate ?? vi.fn();
  vi.mocked(useSearchUsername).mockReturnValue({
    data: search.data,
    mutate,
    reset: vi.fn(),
    isPending: false,
  } as never);
  render(
    <MemoryRouter>
      <FriendSearchScreen />
    </MemoryRouter>,
  );
  return { mutate };
}

describe('FriendSearchScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useFriends).mockReturnValue({
      incomingRequests: [],
      outgoingRequests: [],
      friends: [],
      isLoading: false,
    } as never);
    vi.mocked(useMutualFriendCount).mockReturnValue({ data: 0 } as never);
    vi.mocked(useSendFriendRequest).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    } as never);
  });

  it('autofocuses the field and explains the 3-letter minimum', () => {
    setup();
    expect(screen.getByRole('searchbox')).toHaveFocus();
    expect(screen.getByText(/at least 3 letters/i)).toBeInTheDocument();
  });

  it('does not search for fewer than 3 characters', async () => {
    const { mutate } = setup();
    await userEvent.type(screen.getByRole('searchbox'), 'bo{Enter}');
    expect(mutate).not.toHaveBeenCalled();
  });

  it('searches on Enter, stripping a leading @', async () => {
    const { mutate } = setup();
    await userEvent.type(screen.getByRole('searchbox'), '@bob{Enter}');
    expect(mutate).toHaveBeenCalledWith('bob', expect.anything());
  });

  it('remembers recent searches and offers to clear them', async () => {
    localStorage.setItem('noshot:recent-friend-searches:u1', JSON.stringify(['carol']));
    setup();
    expect(screen.getByRole('button', { name: '@carol' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('button', { name: '@carol' })).not.toBeInTheDocument();
  });

  it('shows results with an Add button after a search, and a helpful empty state', async () => {
    setup({ data: [bob] });
    await userEvent.type(screen.getByRole('searchbox'), 'bob{Enter}');
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('shows a no-results message that points at the invite link', async () => {
    setup({ data: [] });
    await userEvent.type(screen.getByRole('searchbox'), 'zzz{Enter}');
    expect(screen.getByText(/No one found for/)).toBeInTheDocument();
    expect(screen.getByText(/copy your invite link/i)).toBeInTheDocument();
  });

  it('clears the field with the clear button', async () => {
    setup();
    await userEvent.type(screen.getByRole('searchbox'), 'bob');
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });
});
