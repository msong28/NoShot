import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

import { RequireProfile } from './require-profile';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-profile', () => ({ useProfile: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn().mockResolvedValue(undefined) } },
}));

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/" element={<div>Sign-in page</div>} />
        <Route path="/setup-profile" element={<div>Setup profile page</div>} />
        <Route element={<RequireProfile />}>
          <Route path="/protected" element={<div>Protected content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the outlet for an active profile', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useProfile).mockReturnValue({
      data: { id: 'u1', status: 'active' } as never,
      isLoading: false,
    } as never);

    renderGuard();

    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('redirects to setup-profile when no profile exists yet', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useProfile).mockReturnValue({ data: null, isLoading: false } as never);

    renderGuard();

    expect(screen.getByText('Setup profile page')).toBeInTheDocument();
  });

  it('routes a deleted profile to setup-profile to reactivate, without signing out', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useProfile).mockReturnValue({
      data: { id: 'u1', status: 'deleted' } as never,
      isLoading: false,
    } as never);

    renderGuard();

    expect(screen.getByText('Setup profile page')).toBeInTheDocument();
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('signs out and blocks access for a suspended profile', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useProfile).mockReturnValue({
      data: { id: 'u1', status: 'suspended' } as never,
      isLoading: false,
    } as never);

    renderGuard();

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('moves on to the sign-in page once the session actually clears', () => {
    vi.mocked(useProfile).mockReturnValue({
      data: { id: 'u1', status: 'suspended' } as never,
      isLoading: false,
    } as never);

    // First render: session still present, signOut() is in flight.
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    const { rerender } = renderGuard();
    expect(screen.queryByText('Sign-in page')).not.toBeInTheDocument();

    // Second render: useSession now reflects the cleared session.
    vi.mocked(useSession).mockReturnValue({ session: null, isLoading: false });
    rerender(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/" element={<div>Sign-in page</div>} />
          <Route path="/setup-profile" element={<div>Setup profile page</div>} />
          <Route element={<RequireProfile />}>
            <Route path="/protected" element={<div>Protected content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Sign-in page')).toBeInTheDocument();
  });
});
