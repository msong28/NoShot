import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { useSession } from '@/hooks/use-session';
import { signInWithProvider } from '@/lib/auth/oauth';
import { supabase } from '@/lib/supabase';

import { SignInScreen } from './sign-in';

// Explicit factories, not bare automocks: an automock still imports the real
// module to infer its shape, which would import the real supabase.ts and
// throw on the missing env vars this test environment doesn't set.
vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/lib/auth/oauth', () => ({ signInWithProvider: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: vi.fn() } },
}));

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

  it('signs in with email and password', async () => {
    vi.mocked(useSession).mockReturnValue({ session: null, isLoading: false });
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: {},
      error: null,
    } as never);

    render(
      <MemoryRouter>
        <SignInScreen />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('Email'), 'dave@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'hunter2!!');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'dave@example.com',
      password: 'hunter2!!',
    });
  });

  it('shows the password sign-in error', async () => {
    vi.mocked(useSession).mockReturnValue({ session: null, isLoading: false });
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    } as never);

    render(
      <MemoryRouter>
        <SignInScreen />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('Email'), 'dave@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument();
  });

  it('shows the reason RequireProfile sent it here, e.g. a suspended account', () => {
    vi.mocked(useSession).mockReturnValue({ session: null, isLoading: false });

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/', state: { authMessage: 'This account has been suspended.' } },
        ]}
      >
        <SignInScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText('This account has been suspended.')).toBeInTheDocument();
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
