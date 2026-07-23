import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';

import { RequireSessionNoProfile } from './require-session-no-profile';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-profile', () => ({ useProfile: vi.fn() }));

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/setup-profile']}>
      <Routes>
        <Route path="/" element={<div>Sign-in page</div>} />
        <Route path="/home" element={<div>Home page</div>} />
        <Route element={<RequireSessionNoProfile />}>
          <Route path="/setup-profile" element={<div>Setup profile content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireSessionNoProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the outlet when there is no profile yet', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useProfile).mockReturnValue({ data: null, isLoading: false } as never);

    renderGuard();

    expect(screen.getByText('Setup profile content')).toBeInTheDocument();
  });

  // Regression test: RequireProfile deliberately sends a deleted profile to
  // /setup-profile to reactivate it. If this guard treated that row as
  // "already set up" and bounced to /home, the two guards would bounce a
  // deleted account back and forth forever -- exactly what happened before
  // this fix (a blank crashed page after a brief loading flash).
  it('renders the outlet for a deleted profile too, so reactivation is reachable', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useProfile).mockReturnValue({
      data: { id: 'u1', status: 'deleted' } as never,
      isLoading: false,
    } as never);

    renderGuard();

    expect(screen.getByText('Setup profile content')).toBeInTheDocument();
  });

  it('redirects to /home for an already-active profile', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useProfile).mockReturnValue({
      data: { id: 'u1', status: 'active' } as never,
      isLoading: false,
    } as never);

    renderGuard();

    expect(screen.getByText('Home page')).toBeInTheDocument();
  });

  it('redirects to sign-in when there is no session', () => {
    vi.mocked(useSession).mockReturnValue({ session: null, isLoading: false });
    vi.mocked(useProfile).mockReturnValue({ data: null, isLoading: false } as never);

    renderGuard();

    expect(screen.getByText('Sign-in page')).toBeInTheDocument();
  });
});
