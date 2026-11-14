import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';

import { useMyBets } from '@/hooks/use-bets';
import { useBlockUser, useFriends, useHeadToHeadRecords } from '@/hooks/use-friends';
import { useMyBalances } from '@/hooks/use-ledger';
import { useSession } from '@/hooks/use-session';

import { FriendProfileScreen } from './friend-profile';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-bets', () => ({ useMyBets: vi.fn() }));
vi.mock('@/hooks/use-ledger', () => ({ useMyBalances: vi.fn() }));
vi.mock('@/hooks/use-friends', () => ({
  useFriends: vi.fn(),
  useHeadToHeadRecords: vi.fn(),
  useBlockUser: vi.fn(),
}));

const bob = { id: 'u2', username: 'bob', display_name: 'Bob Smith' };

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/friend/:userId" element={<FriendProfileScreen />} />
        <Route path="/friends" element={<p>friends list</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FriendProfileScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useFriends).mockReturnValue({
      incomingRequests: [],
      outgoingRequests: [],
      friends: [{ friendship: { id: 'f1' }, profile: bob }],
      isLoading: false,
    } as never);
    vi.mocked(useMyBets).mockReturnValue({ resolvedBets: [] } as never);
    vi.mocked(useHeadToHeadRecords).mockReturnValue(new Map([['u2', { won: 3, lost: 1 }]]));
    vi.mocked(useMyBalances).mockReturnValue({ rows: [], isLoading: false });
    vi.mocked(useBlockUser).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    } as never);
  });

  it('shows the friend, their record, and a New bet link', () => {
    renderAt('/friend/u2');
    expect(screen.getByRole('heading', { name: 'Bob Smith' })).toBeInTheDocument();
    expect(screen.getByText(/you lead/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /New bet with Bob/ })).toHaveAttribute(
      'href',
      '/create/u2',
    );
  });

  it('lists what is owed either way', () => {
    vi.mocked(useMyBalances).mockReturnValue({
      isLoading: false,
      rows: [
        {
          balance: { counterparty_id: 'u2', group_id: null, currency_id: 'c1', net_amount: 4 },
          currency: { id: 'c1', name: 'Coffees', icon: null },
        },
      ],
    } as never);
    renderAt('/friend/u2');
    expect(screen.getByText('Coffees')).toBeInTheDocument();
    expect(screen.getByText('They owe you')).toBeInTheDocument();
  });

  it('only blocks after a confirmation, then returns to the list', async () => {
    const blockUser = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
    vi.mocked(useBlockUser).mockReturnValue(blockUser as never);
    renderAt('/friend/u2');

    await userEvent.click(screen.getByRole('button', { name: 'Block Bob' }));
    expect(blockUser.mutateAsync).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Block' }));
    expect(blockUser.mutateAsync).toHaveBeenCalledWith('u2');
    expect(await screen.findByText('friends list')).toBeInTheDocument();
  });

  it('can back out of the block confirmation', async () => {
    renderAt('/friend/u2');
    await userEvent.click(screen.getByRole('button', { name: 'Block Bob' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep as friend' }));
    expect(screen.queryByRole('button', { name: 'Keep as friend' })).not.toBeInTheDocument();
  });

  it('says so when the person is not a friend', () => {
    renderAt('/friend/nope');
    expect(screen.getByText('Not on your friends list')).toBeInTheDocument();
  });
});
