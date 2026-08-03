import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import { useCreateOrCounterBet, useMyBets } from '@/hooks/use-bets';
import { useCurrencies } from '@/hooks/use-currencies';
import { useFriends } from '@/hooks/use-friends';
import { useSession } from '@/hooks/use-session';
import { MONEY_CURRENCY_ID } from '@/lib/currency';

import { CreateBetDetailsScreen } from './create-bet-details';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-bets', () => ({ useCreateOrCounterBet: vi.fn(), useMyBets: vi.fn() }));
vi.mock('@/hooks/use-currencies', () => ({ useCurrencies: vi.fn() }));
vi.mock('@/hooks/use-friends', () => ({ useFriends: vi.fn() }));

/** Renders the location the create flow redirects to on success, so tests can
 * assert where the "Sent!" animation drops the user. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderScreen(initialPath = '/create/u2') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/create/:rivalId" element={<CreateBetDetailsScreen />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillEvent() {
  await userEvent.type(screen.getByPlaceholderText('What’s the bet?'), 'Lakers win');
}

async function fillStake(amount = '5') {
  await userEvent.type(screen.getByPlaceholderText('What are you wagering?'), amount);
}

describe('CreateBetDetailsScreen', () => {
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
      isLoading: false,
    } as never);
    vi.mocked(useMyBets).mockReturnValue({ bets: [] } as never);
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

  it('shows the rival as a chip and keeps Send bet disabled until event and a valid stake are filled', async () => {
    renderScreen();

    expect(screen.getByText('Bob')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Send bet' });
    expect(submit).toBeDisabled();

    await fillEvent();
    expect(submit).toBeDisabled();

    await fillStake();
    expect(submit).toBeEnabled();
  });

  it('tapping the rival chip returns to the picker', async () => {
    renderScreen();

    await userEvent.click(screen.getByText('Bob'));

    expect(screen.getByTestId('location')).toHaveTextContent('/create');
  });

  it('both the recent-bets and currency icon buttons show a visible chevron', () => {
    renderScreen();

    const recentBetsButton = screen.getByLabelText('Recent bets');
    const currencyButton = screen.getByLabelText('Choose stake currency');

    // Recent bets: a clock glyph plus the chevron. Currency: an emoji glyph
    // (not an svg) plus the chevron -- either way, the chevron itself must
    // render, since a bare glyph with no chevron is Splitwise's own defect.
    expect(recentBetsButton.querySelectorAll('svg').length).toBe(2);
    expect(currencyButton.querySelectorAll('svg').length).toBe(1);
    expect(currencyButton.textContent).toContain('💵');
  });

  it('opens a sheet of past bet titles and prefills the event field on tap', async () => {
    vi.mocked(useMyBets).mockReturnValue({
      bets: [
        { creator_id: 'u1', title: 'Leafs win tonight' },
        { creator_id: 'u1', title: 'Coffee run bet' },
        { creator_id: 'u2', title: 'Not mine, should be excluded' },
      ],
    } as never);

    renderScreen();

    await userEvent.click(screen.getByLabelText('Recent bets'));
    expect(screen.getByText('Recent bets', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.queryByText('Not mine, should be excluded')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Coffee run bet'));

    expect(screen.getByPlaceholderText('What’s the bet?')).toHaveValue('Coffee run bet');
    expect(screen.queryByText('Recent bets', { selector: 'h2' })).not.toBeInTheDocument();
  });

  it('shows an empty state in the recent-bets sheet when the user has no bet history', async () => {
    renderScreen();

    await userEvent.click(screen.getByLabelText('Recent bets'));

    expect(screen.getByText('No recent bets yet')).toBeInTheDocument();
  });

  it('hides the optional modifiers behind a "More betting options" toggle', async () => {
    renderScreen();

    expect(screen.queryByText('Win conditions (optional)')).not.toBeInTheDocument();
    expect(screen.queryByText('Line (optional)')).not.toBeInTheDocument();
    expect(screen.queryByText('Uneven odds (optional)')).not.toBeInTheDocument();
    expect(screen.queryByText('Deadline (optional)')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'More betting options' }));

    expect(screen.getByText('Win conditions (optional)')).toBeInTheDocument();
    expect(screen.getByText('Line (optional)')).toBeInTheDocument();
    expect(screen.getByText('Uneven odds (optional)')).toBeInTheDocument();
    expect(screen.getByText('Deadline (optional)')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'More betting options' }));
    expect(screen.queryByText('Win conditions (optional)')).not.toBeInTheDocument();
  });

  it('maps a modifier-free bet onto the bet engine as symmetric even-odds stakes', async () => {
    const createBet = { mutate: vi.fn(), isPending: false, isSuccess: false };
    vi.mocked(useCreateOrCounterBet).mockReturnValue(createBet as never);

    renderScreen();
    await fillEvent();
    await fillStake();
    await userEvent.click(screen.getByRole('button', { name: 'Send bet' }));

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
          expect.objectContaining({
            userId: 'u1',
            currencyId: MONEY_CURRENCY_ID,
            stakeQuantity: 5,
          }),
          expect.objectContaining({
            userId: 'u2',
            currencyId: MONEY_CURRENCY_ID,
            stakeQuantity: 5,
          }),
        ],
      }),
      expect.anything(),
    );
  });

  it('picking a currency from the sheet sets the stake unit and is required before submit', async () => {
    const createBet = { mutate: vi.fn(), isPending: false, isSuccess: false };
    vi.mocked(useCreateOrCounterBet).mockReturnValue(createBet as never);

    renderScreen();
    await fillEvent();
    await fillStake();

    await userEvent.click(screen.getByLabelText('Choose stake currency'));
    expect(screen.getByRole('link', { name: '+ Create new currency' })).toHaveAttribute(
      'href',
      '/currencies',
    );

    await userEvent.click(screen.getByText('My Custom Thing'));

    await userEvent.click(screen.getByRole('button', { name: 'Send bet' }));
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
    await fillEvent();
    await fillStake();
    await userEvent.click(screen.getByRole('button', { name: 'More betting options' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Line' }));
    await userEvent.type(screen.getByPlaceholderText('e.g. 56.5'), '56.5');
    await userEvent.click(screen.getByRole('button', { name: 'Under' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send bet' }));

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
    await fillEvent();
    await fillStake();
    await userEvent.click(screen.getByRole('button', { name: 'More betting options' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Uneven odds' }));

    expect(screen.getByText(/You give 15 if you lose/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Send bet' }));

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

  it('shows a "Sent to [name]" confirmation and then redirects to the pending tab on continue', async () => {
    vi.mocked(useCreateOrCounterBet).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: true,
    } as never);

    renderScreen();

    expect(screen.getByText('Sent to Bob!')).toBeInTheDocument();
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/bets?tab=pending');
  });

  it('redirects back to the picker if the rival in the URL is not a friend', () => {
    vi.mocked(useFriends).mockReturnValue({ friends: [], isLoading: false } as never);

    renderScreen('/create/u2');

    expect(screen.getByTestId('location')).toHaveTextContent('/create');
  });
});
