import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { useDeleteAccountRequest } from '@/hooks/use-account-deletion';
import { supabase } from '@/lib/supabase';

import { DeleteAccountScreen } from './delete-account';

vi.mock('@/hooks/use-account-deletion', () => ({ useDeleteAccountRequest: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn().mockResolvedValue(undefined) } },
}));

describe('DeleteAccountScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps the delete button disabled until DELETE is typed', async () => {
    vi.mocked(useDeleteAccountRequest).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    render(
      <MemoryRouter>
        <DeleteAccountScreen />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: 'Delete my account' });
    expect(button).toBeDisabled();

    await userEvent.type(screen.getByRole('textbox'), 'delete');
    expect(button).toBeDisabled();

    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.type(screen.getByRole('textbox'), 'DELETE');
    expect(button).toBeEnabled();
  });

  it('shows the done state and signs out on confirmation', async () => {
    const mutate = vi.fn((_input, opts) => opts.onSuccess());
    vi.mocked(useDeleteAccountRequest).mockReturnValue({ mutate, isPending: false } as never);

    render(
      <MemoryRouter>
        <DeleteAccountScreen />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByRole('textbox'), 'DELETE');
    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }));

    expect(await screen.findByText('Deletion requested')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('shows an error message when the deletion request fails', async () => {
    const mutate = vi.fn((_input, opts) => opts.onError(new Error('nope')));
    vi.mocked(useDeleteAccountRequest).mockReturnValue({ mutate, isPending: false } as never);

    render(
      <MemoryRouter>
        <DeleteAccountScreen />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByRole('textbox'), 'DELETE');
    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }));

    expect(await screen.findByText('nope')).toBeInTheDocument();
  });
});
