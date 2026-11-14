import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { useBlockedUsers, useUnblockUser } from '@/hooks/use-friends';
import { useSession } from '@/hooks/use-session';

import { BlockedUsersScreen } from './blocked-users';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-friends', () => ({ useBlockedUsers: vi.fn(), useUnblockUser: vi.fn() }));

describe('BlockedUsersScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
  });

  it('shows an empty state', () => {
    vi.mocked(useBlockedUsers).mockReturnValue({ blocked: [], isLoading: false });
    vi.mocked(useUnblockUser).mockReturnValue({ mutateAsync: vi.fn() } as never);
    render(
      <MemoryRouter>
        <BlockedUsersScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText('No one blocked')).toBeInTheDocument();
  });

  it('unblocks someone', async () => {
    const unblock = { mutateAsync: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(useUnblockUser).mockReturnValue(unblock as never);
    vi.mocked(useBlockedUsers).mockReturnValue({
      blocked: [{ id: 'u2', profile: { id: 'u2', username: 'bob', display_name: 'Bob' } }],
      isLoading: false,
    } as never);
    render(
      <MemoryRouter>
        <BlockedUsersScreen />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Unblock' }));
    expect(unblock.mutateAsync).toHaveBeenCalledWith('u2');
  });
});
