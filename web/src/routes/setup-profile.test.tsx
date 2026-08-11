import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { useInvalidateProfile, useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

import { SetupProfileScreen } from './setup-profile';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-profile', () => ({
  useProfile: vi.fn(),
  useInvalidateProfile: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

function renderScreen() {
  return render(
    <MemoryRouter>
      <SetupProfileScreen />
    </MemoryRouter>,
  );
}

async function fillOutForm() {
  await userEvent.type(screen.getByPlaceholderText('Maya Chen'), 'Alice Again');
  await userEvent.type(screen.getByPlaceholderText('@maya'), 'alice_again');
  await userEvent.selectOptions(screen.getByRole('combobox'), '2000');
  await userEvent.click(screen.getByRole('checkbox'));
}

describe('SetupProfileScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useInvalidateProfile).mockReturnValue(vi.fn().mockResolvedValue(undefined));
    // get_invite_preview's debounced availability check -- always "available"
    // so it never blocks canSubmit in these tests.
    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === 'get_invite_preview') {
        return Promise.resolve({ data: [], error: null }) as never;
      }
      return Promise.resolve({ data: null, error: null }) as never;
    });
  });

  it('inserts a brand-new profile row for a user with no existing profile', async () => {
    vi.mocked(useProfile).mockReturnValue({ data: null, isLoading: false } as never);
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as never);

    renderScreen();
    expect(screen.getByText('Set up your player')).toBeInTheDocument();

    await fillOutForm();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', display_name: 'Alice Again', username: 'alice_again' }),
    );
    expect(supabase.rpc).not.toHaveBeenCalledWith('reactivate_account_request', expect.anything());
  });

  it('reactivates instead of inserting when the existing profile is deleted', async () => {
    vi.mocked(useProfile).mockReturnValue({
      data: { id: 'u1', status: 'deleted' } as never,
      isLoading: false,
    } as never);
    const insertMock = vi.fn();
    vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as never);

    renderScreen();
    expect(screen.getByText('Set up your player again')).toBeInTheDocument();

    await fillOutForm();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(supabase.rpc).toHaveBeenCalledWith('reactivate_account_request', {
      p_display_name: 'Alice Again',
      p_username: 'alice_again',
      p_birth_year: 2000,
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('shows the reactivation RPC error message', async () => {
    vi.mocked(useProfile).mockReturnValue({
      data: { id: 'u1', status: 'deleted' } as never,
      isLoading: false,
    } as never);
    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === 'get_invite_preview') {
        return Promise.resolve({ data: [], error: null }) as never;
      }
      return Promise.resolve({
        data: null,
        error: { message: 'that username is already taken' },
      }) as never;
    });

    renderScreen();
    await fillOutForm();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('that username is already taken')).toBeInTheDocument();
  });
});
