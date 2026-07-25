import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { useCreateOrCounterBet } from '@/hooks/use-bets';
import { useCurrencies } from '@/hooks/use-currencies';
import { useFriends } from '@/hooks/use-friends';
import { useSession } from '@/hooks/use-session';
import { MONEY_CURRENCY_ID } from '@/lib/currency';

import { CreateScreen } from './create';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-bets', () => ({ useCreateOrCounterBet: vi.fn() }));
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
    vi.mocked(useCreateOrCounterBet).mockReturnValue({
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

  it('maps a modifier-free money bet onto the bet engine as symmetric even-odds stakes', async () => {
    const createBet = { mutate: vi.fn(), isPending: false, isSuccess: false };
    vi.mocked(useCreateOrCounterBet).mockReturnValue(createBet as never);

    renderScreen();

    expect(screen.queryByPlaceholderText('e.g. 56.5')).not.toBeInTheDocument();

    await fillCommonFields();
    await userEvent.click(screen.getByRole('button', { name: 'Send bet to Bob' }));

    expect(createBet.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Lakers win',
        groupId: null,
        resolutionMethod: 'participant_submission',
        isDraft: false,
        sides: [
          { outcomeKey: 'creator', label: 'You' },
          { outcomeKey: 'rival', label: 'Bob' },
        ],
        participants: [
          {
            userId: 'u1',
            outcomeKey: 'creator',
            currencyId: MONEY_CURRENCY_ID,
            stakeQuantity: 5,
            oddsNumerator: 1,
            oddsDenominator: 1,
          },
          {
            userId: 'u2',
            outcomeKey: 'rival',
            currencyId: MONEY_CURRENCY_ID,
            stakeQuantity: 5,
            oddsNumerator: 1,
            oddsDenominator: 1,
          },
        ],
      }),
      expect.anything(),
    );
  });

  it('requires picking a suggested currency (own first, then built-ins) when Custom is selected', async () => {
    const createBet = { mutate: vi.fn(), isPending: false, isSuccess: false };
    vi.mocked(useCreateOrCounterBet).mockReturnValue(createBet as never);

    renderScreen();

    await fillCommonFields();
    await userEvent.click(screen.getByRole('button', { name: /Custom/ }));

    const submit = screen.getByRole('button', { name: /^Send bet/ });
    expect(submit).toBeDisabled();

    const mine = screen.getByRole('button', { name: /My Custom Thing/ });
    expect(mine).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chore/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+ New' })).toHaveAttribute('href', '/currencies');

    await userEvent.click(mine);
    expect(submit).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Send bet to Bob' }));
    expect(createBet.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        participants: expect.arrayContaining([
          expect.objectContaining({ userId: 'u1', currencyId: 'cur-mine' }),
          expect.objectContaining({ userId: 'u2', currencyId: 'cur-mine' }),
        ]),
      }),
      expect.anything(),
    );
  });

  it('turns a line into over/under sides with the creator on their chosen position', async () => {
    const createBet = { mutate: vi.fn(), isPending: false, isSuccess: false };
    vi.mocked(useCreateOrCounterBet).mockReturnValue(createBet as never);

    renderScreen();

    await fillCommonFields();
    await userEvent.click(screen.getByRole('switch', { name: 'Line' }));
    await userEvent.type(screen.getByPlaceholderText('e.g. 56.5'), '56.5');
    await userEvent.click(screen.getByRole('button', { name: 'Under' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send bet to Bob' }));

    expect(createBet.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        sides: [
          { outcomeKey: 'over', label: 'Over 56.5' },
          { outcomeKey: 'under', label: 'Under 56.5' },
        ],
        participants: [
          expect.objectContaining({ userId: 'u1', outcomeKey: 'under' }),
          expect.objectContaining({ userId: 'u2', outcomeKey: 'over' }),
        ],
      }),
      expect.anything(),
    );
  });

  it('re-expresses 3:1 odds favoring the creator as per-participant stakes and odds', async () => {
    const createBet = { mutate: vi.fn(), isPending: false, isSuccess: false };
    vi.mocked(useCreateOrCounterBet).mockReturnValue(createBet as never);

    renderScreen();

    await fillCommonFields();
    await userEvent.click(screen.getByRole('switch', { name: 'Uneven odds' }));

    expect(screen.getByText(/You give 15 if you lose/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Send bet to Bob' }));

    expect(createBet.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        participants: [
          expect.objectContaining({
            userId: 'u1',
            stakeQuantity: 15,
            oddsNumerator: 3,
            oddsDenominator: 1,
          }),
          expect.objectContaining({
            userId: 'u2',
            stakeQuantity: 5,
            oddsNumerator: 1,
            oddsDenominator: 3,
          }),
        ],
      }),
      expect.anything(),
    );
  });

  it('shows a success screen with a way back home once the bet is created', async () => {
    vi.mocked(useCreateOrCounterBet).mockReturnValue({
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
