import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { useCreateCurrency, useCurrencies } from '@/hooks/use-currencies';
import { useSession } from '@/hooks/use-session';

import { CurrenciesScreen } from './currencies';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-currencies', () => ({
  useCurrencies: vi.fn(),
  useCreateCurrency: vi.fn(),
}));

function renderScreen() {
  return render(
    <MemoryRouter>
      <CurrenciesScreen />
    </MemoryRouter>,
  );
}

describe('CurrenciesScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useCreateCurrency).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  });

  it('splits built-in and custom currencies into their own sections', () => {
    vi.mocked(useCurrencies).mockReturnValue({
      data: [
        { id: 'c1', name: 'Dollars', category: 'money', is_builtin: true, moderation_status: 'visible' },
        { id: 'c2', name: 'Push-ups', category: 'custom', is_builtin: false, moderation_status: 'visible' },
      ],
      isLoading: false,
    } as never);

    renderScreen();

    expect(screen.getByText('Built-in')).toBeInTheDocument();
    expect(screen.getByText('Dollars')).toBeInTheDocument();
    expect(screen.getByText('Yours')).toBeInTheDocument();
    expect(screen.getByText('Push-ups')).toBeInTheDocument();
  });

  it('flags a pending-review custom currency instead of its category', () => {
    vi.mocked(useCurrencies).mockReturnValue({
      data: [
        {
          id: 'c2',
          name: 'Push-ups',
          category: 'custom',
          is_builtin: false,
          moderation_status: 'pending_review',
        },
      ],
      isLoading: false,
    } as never);

    renderScreen();

    expect(screen.getByText('Pending review')).toBeInTheDocument();
  });

  it('creates a currency with the chosen name and category', async () => {
    const createCurrency = { mutate: vi.fn(), isPending: false };
    vi.mocked(useCreateCurrency).mockReturnValue(createCurrency as never);
    vi.mocked(useCurrencies).mockReturnValue({ data: [], isLoading: false } as never);

    renderScreen();

    await userEvent.type(screen.getByPlaceholderText('Name (e.g. Coffee runs)'), 'Chores');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(createCurrency.mutate).toHaveBeenCalledWith(
      { name: 'Chores', category: 'custom' },
      expect.anything(),
    );
  });

  it('disables Create until a name is entered', () => {
    vi.mocked(useCurrencies).mockReturnValue({ data: [], isLoading: false } as never);

    renderScreen();

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });
});
