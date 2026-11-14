import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';

import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { shareInviteLink } from '@/lib/invite-link';

import { AddFriendScreen } from './add-friend';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-profile', () => ({ useProfile: vi.fn() }));
vi.mock('@/lib/invite-link', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/invite-link')>()),
  shareInviteLink: vi.fn(),
}));

function renderScreen() {
  render(
    <MemoryRouter initialEntries={['/friends/add']}>
      <Routes>
        <Route path="/friends/add" element={<AddFriendScreen />} />
        <Route path="/friends/search" element={<p>search screen</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AddFriendScreen', () => {
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
  });

  it('goes to search', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /Search by username/ }));
    expect(screen.getByText('search screen')).toBeInTheDocument();
  });

  it('copies the invite link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: /Copy invite link/ }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/alice`);
    expect(await screen.findByText('Link copied!')).toBeInTheDocument();
  });

  it('opens the share sheet for the invite link', async () => {
    vi.mocked(shareInviteLink).mockResolvedValue('shared');
    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: /Share invite link/ }));
    expect(shareInviteLink).toHaveBeenCalledWith('alice', 'Alice');
  });
});
