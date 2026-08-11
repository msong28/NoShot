import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

import { SignUpScreen } from './sign-up';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signUp: vi.fn() } },
}));

describe('SignUpScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({ session: null, isLoading: false });
  });

  it('shows the confirmation-sent state when signUp returns no session', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { session: null },
      error: null,
    } as never);

    render(
      <MemoryRouter>
        <SignUpScreen />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('Email'), 'dave@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenoughpw');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'dave@example.com',
      password: 'longenoughpw',
      options: {
        // Dynamic, not hardcoded: the confirmation link must come back to
        // whatever origin the user signed up on (LAN IP, preview deploy, prod).
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });

  it('shows the signUp error', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { session: null },
      error: { message: 'Email already registered' },
    } as never);

    render(
      <MemoryRouter>
        <SignUpScreen />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('Email'), 'dave@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenoughpw');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Email already registered')).toBeInTheDocument();
  });

  it('disables submit until the password is long enough', () => {
    render(
      <MemoryRouter>
        <SignUpScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  });

  it('redirects to /home when already signed in', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={['/sign-up']}>
        <SignUpScreen />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument();
  });
});
