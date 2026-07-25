import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { useCreateWager } from '@/hooks/use-wager';
import { useCurrencies } from '@/hooks/use-currencies';
import { useFriends } from '@/hooks/use-friends';
import { useSession } from '@/hooks/use-session';

import { CreateScreen } from './create';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-wager', () => ({ useCreateWager: vi.fn() }));
vi.mock('@/hooks/use-currencies', () => ({ useCurrencies: vi.fn() }));
vi.mock('@/hooks/use-friends', () => ({ useFriends: vi.fn() }));

function renderScreen() {
  return render(
    <MemoryRouter>
      <CreateScreen />
    </MemoryRouter>,
  );
}

/** Fills every field "Send bet" requires except whatever the caller still
 * wants to exercise: event, rival, and the default money stake. */
async function fillCommonFields() {
  await userEvent.type(screen.getByPlaceholderText('Who does the dishes this week?'), 'Lakers win');
  await userEvent.click(screen.getByRole('button', { name: /Bob/ }));
}

describe('CreateScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useFriends).mockReturnValue({
      friends: [
        { friendship: { id: 'f1' }, profile: { id: 'u2', username: 'bob', display_name: 'Bob' } },
      ],
      incomingRequests: [],
      outgoingRequests: [],
      isLoading: false,
    } as never);
    vi.mocked(useCreateWager).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
    } as never);
    vi.mocked(useCurrencies).mockReturnValue({
      data: [
        {
          id: 'cur-chore',
          name: 'Chore',
          icon: '🧹',
          is_builtin: true,
          moderation_status: 'approved',
          created_at: '2026-07-01T00:00:00Z',
        },
        {
          id: 'cur-mine',
          name: 'My Custom Thing',
          icon: null,
          is_builtin: false,
          moderation_status: 'approved',
          created_at: '2026-07-20T00:00:00Z',
        },
      ],
      isLoading: false,
    } as never);
  });

  it('keeps Send bet disabled until event, rival, and a valid stake are filled', async () => {
    renderScreen();

    const submit = screen.getByRole('button', { name: /^Send bet/ });
    expect(submit).toBeDisabled();

    await fillCommonFields();

    expect(submit).toBeEnabled();
  });

  it('shows nothing extra when Line is off, and submits with no modifiers set', async () => {
    const createWager = { mutate: vi.fn(), isPending: false, isSuccess: false };
    vi.mocked(useCreateWager).mockReturnValue(createWager as never);

    renderScreen();

    expect(screen.queryByPlaceholderText('e.g. 56.5')).not.toBeInTheDocument();
    expect(screen.queryByText(/Which side are you taking/i)).not.toBeInTheDocument();

    await fillCommonFields();
    await userEvent.click(screen.getByRole('button', { name: 'Send bet to Bob' }));

    expect(createWager.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'Lakers win',
        rivalId: 'u2',
        stakeAmount: 5,
        currencyKind: 'money',
        currencyId: null,
        deadline: null,
        oddsNumerator: null,
        oddsDenominator: null,
        oddsFavorsUserId: null,
        lineValue: null,
        lineCreatorPosition: null,
      }),
      expect.anything(),
    );
  });

  it('requires picking a suggested currency (own first, then built-ins) when Custom is selected', async () => {
    const createWager = { mutate: vi.fn(), isPending: false, isSuccess: false };
    vi.mocked(useCreateWager).mockReturnValue(createWager as never);

    renderScreen();

    await fillCommonFields();
    await userEvent.click(screen.getByRole('button', { name: /Custom/ }));

    const submit = screen.getByRole('button', { name: /^Send bet/ });
    expect(submit).toBeDisabled();

    // The caller's own previously-created currency should be offered
    // alongside built-ins, not just a single freeform text box.
    const mine = screen.getByRole('button', { name: /My Custom Thing/ });
    expect(mine).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chore/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+ New' })).toHaveAttribute('href', '/currencies');

    await userEvent.click(mine);
    expect(submit).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Send bet to Bob' }));
    expect(createWager.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ currencyKind: 'custom', currencyId: 'cur-mine' }),
      expect.anything(),
    );
  });

  it('sends the line value and the creator\'s over/under position', async () => {
    const createWager = { mutate: vi.fn(), isPending: false, isSuccess: false };
    vi.mocked(useCreateWager).mockReturnValue(createWager as never);

    renderScreen();

    await fillCommonFields();
    await userEvent.click(screen.getByRole('switch', { name: 'Line' }));
    await userEvent.type(screen.getByPlaceholderText('e.g. 56.5'), '56.5');
    await userEvent.click(screen.getByRole('button', { name: 'Under' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send bet to Bob' }));

    expect(createWager.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ lineValue: 56.5, lineCreatorPosition: 'under' }),
      expect.anything(),
    );
  });

  it('sends the odds ratio and who it favors, defaulting to favoring the creator', async () => {
    const createWager = { mutate: vi.fn(), isPending: false, isSuccess: false };
    vi.mocked(useCreateWager).mockReturnValue(createWager as never);

    renderScreen();

    await fillCommonFields();
    await userEvent.click(screen.getByRole('switch', { name: 'Uneven odds' }));

    expect(screen.getByText(/You give 15 if you lose/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Send bet to Bob' }));

    expect(createWager.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        oddsNumerator: 3,
        oddsDenominator: 1,
        oddsFavorsUserId: 'u1',
      }),
      expect.anything(),
    );
  });

  it('shows a success screen with a way back home once the wager is created', async () => {
    vi.mocked(useCreateWager).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: true,
    } as never);

    renderScreen();

    expect(screen.getByText('Bet sent to your rival!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View your bets' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/home');
  });
});
