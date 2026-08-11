import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { useIsAdmin } from '@/hooks/use-admin';
import { useSession } from '@/hooks/use-session';

import { RequireAdmin } from './require-admin';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-admin', () => ({ useIsAdmin: vi.fn() }));

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<p>sign-in</p>} />
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<p>admin queue</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAdmin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects to sign-in when there is no session', () => {
    vi.mocked(useSession).mockReturnValue({ session: null, isLoading: false });
    vi.mocked(useIsAdmin).mockReturnValue({ data: undefined, isLoading: false } as never);

    renderGuard();

    expect(screen.getByText('sign-in')).toBeInTheDocument();
    expect(screen.queryByText('admin queue')).not.toBeInTheDocument();
  });

  it('redirects to sign-in when signed in but not an admin', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useIsAdmin).mockReturnValue({ data: false, isLoading: false } as never);

    renderGuard();

    expect(screen.getByText('sign-in')).toBeInTheDocument();
  });

  it('renders the nested route for an admin', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useIsAdmin).mockReturnValue({ data: true, isLoading: false } as never);

    renderGuard();

    expect(screen.getByText('admin queue')).toBeInTheDocument();
  });
});
