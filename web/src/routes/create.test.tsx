import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { useCreateOrCounterBet } from '@/hooks/use-bets';
import { useCurrencies } from '@/hooks/use-currencies';
import { useFriends } from '@/hooks/use-friends';
import { useMyGroups } from '@/hooks/use-groups';
import { useSession } from '@/hooks/use-session';

import { CreateScreen } from './create';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-bets', () => ({ useCreateOrCounterBet: vi.fn() }));
vi.mock('@/hooks/use-currencies', () => ({ useCurrencies: vi.fn() }));
vi.mock('@/hooks/use-friends', () => ({ useFriends: vi.fn() }));
vi.mock('@/hooks/use-groups', () => ({ useMyGroups: vi.fn() }));

function renderScreen() {
  return render(
    <MemoryRouter>
      <CreateScreen />
    </MemoryRouter>,
  );
}

/** Fills every field the "Send bet" button requires except whatever the
 * caller still wants to exercise. */
async function fillCommonFields() {
  await userEvent.type(screen.getByPlaceholderText('Who does the dishes this week?'), 'Lakers win');
  await userEvent.click(screen.getByRole('button', { name: /Bob/ }));
  await userEvent.type(screen.getByPlaceholderText('If you win (e.g. Lakers)'), 'Lakers');
  await userEvent.type(screen.getByPlaceholderText('If they win (e.g. Celtics)'), 'Celtics');
  await userEvent.click(screen.getByRole('button', { name: /Dollars/ }));
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
    vi.mocked(useMyGroups).mockReturnValue({
      activeGroups: [],
      pendingInvites: [],
      isLoading: false,
    } as never);
    vi.mocked(useCurrencies).mockReturnValue({
      data: [{ id: 'cur1', name: 'Dollars', icon: null }],
      isLoading: false,
    } as never);
    vi.mocked(useCreateOrCounterBet).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
  });

  it('keeps Send bet disabled until the required fields are filled', async () => {
    renderScreen();

    const submit = screen.getByRole('button', { name: /^Send bet/ });
    expect(submit).toBeDisabled();

    await fillCommonFields();

    expect(submit).toBeEnabled();
  });

  it('submits with even-money stakes on both sides and navigates to the new bet', async () => {
    const createBet = {
      mutate: vi.fn((_input, opts) => opts.onSuccess({ id: 'bet-9' })),
      isPending: false,
    };
    vi.mocked(useCreateOrCounterBet).mockReturnValue(createBet as never);

    renderScreen();

    await fillCommonFields();
    await userEvent.click(screen.getByRole('button', { name: 'Send bet to Bob' }));

    expect(createBet.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Lakers win',
        isDraft: false,
        sides: [
          { outcomeKey: 'a', label: 'Lakers' },
          { outcomeKey: 'b', label: 'Celtics' },
        ],
        participants: [
          expect.objectContaining({
            userId: 'u1',
            outcomeKey: 'a',
            oddsNumerator: 1,
            oddsDenominator: 1,
          }),
          expect.objectContaining({
            userId: 'u2',
            outcomeKey: 'b',
            oddsNumerator: 1,
            oddsDenominator: 1,
          }),
        ],
      }),
      expect.anything(),
    );
  });

  it('requires a judge to be picked when the judge resolution method is selected', async () => {
    renderScreen();

    await fillCommonFields();
    await userEvent.click(screen.getByRole('button', { name: /Judge/ }));

    const submit = screen.getByRole('button', { name: /^Send bet/ });
    expect(submit).toBeDisabled();

    await userEvent.selectOptions(screen.getByDisplayValue('Who’s the judge?'), 'u2');
    expect(submit).toBeEnabled();
  });
});
