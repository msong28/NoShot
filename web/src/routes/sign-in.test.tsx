import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { useSession } from '@/hooks/use-session';
import { signInWithProvider } from '@/lib/auth/oauth';

import { SignInScreen } from './sign-in';

// Explicit factories, not bare automocks: an automock still imports the real
// module to infer its shape, which would import the real supabase.ts and
// throw on the missing env vars this test environment doesn't set.
vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/lib/auth/oauth', () => ({ signInWithProvider: vi.fn() }));

describe('SignInScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invokes the shared oauth helper for google', async () => {
    vi.mocked(useSession).mockReturnValue({ session: null, isLoading: false });
    vi.mocked(signInWithProvider).mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <SignInScreen />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(signInWithProvider).toHaveBeenCalledWith('google');
  });

  it('invokes the shared oauth helper for apple', async () => {
    vi.mocked(useSession).mockReturnValue({ session: null, isLoading: false });
    vi.mocked(signInWithProvider).mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <SignInScreen />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: /continue with apple/i }));
    expect(signInWithProvider).toHaveBeenCalledWith('apple');
  });

  it('redirects to /profile when already signed in', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <SignInScreen />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
  });
});
