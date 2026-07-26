import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Avatar } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/inline-error';
import { useCreateOrCounterBet } from '@/hooks/use-bets';
import { useCurrencies } from '@/hooks/use-currencies';
import { useFriends } from '@/hooks/use-friends';
import { useSession } from '@/hooks/use-session';
import { MONEY_CURRENCY_ID } from '@/lib/currency';
import { getErrorMessage } from '@/lib/errors';
import { buildBetInput, computeOddsStakes } from '@/lib/wager';

/** A curated slice of the shared currencies table for the "Custom" stake
 * picker: the caller's own previously-created ones first (most recent
 * first, since those are the "options we've previously added"), then
 * built-ins filling any remaining slots -- capped well below the full list
 * so it doesn't turn into the wall of chips the old create.tsx had. */
const MAX_CURRENCY_SUGGESTIONS = 6;

/**
 * Ground-up rebuild of bet creation (see conversation for the full design
 * discussion): a wager is Event + Rival + Stakes, plus three independently
 * optional modifiers (deadline, odds, line). No modifier contributes
 * anything when it's off -- in particular, off-Line means there's no
 * side-naming step at all, since resolution/winner-declaration is out of
 * scope for creation. "Side" only ever exists as a byproduct of Line
 * (over/under) or Odds (favored/unfavored).
 */
export function CreateScreen() {
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user.id;

  const { friends } = useFriends(userId);
  const createBet = useCreateOrCounterBet(userId);
  const { data: currencies } = useCurrencies({ ownerUserId: userId as string });

  const [event, setEvent] = useState('');
  const [description, setDescription] = useState('');
  const [rivalId, setRivalId] = useState('');

  const [stakeAmount, setStakeAmount] = useState('5');
  const [currencyKind, setCurrencyKind] = useState<'money' | 'custom'>('money');
  const [currencyId, setCurrencyId] = useState('');

  const [lineEnabled, setLineEnabled] = useState(false);
  const [lineValue, setLineValue] = useState('');
  const [linePosition, setLinePosition] = useState<'over' | 'under'>('over');

  const [winConditionsEnabled, setWinConditionsEnabled] = useState(false);
  const [winConditionMine, setWinConditionMine] = useState('');
  const [winConditionTheirs, setWinConditionTheirs] = useState('');

  const [oddsEnabled, setOddsEnabled] = useState(false);
  const [oddsNumerator, setOddsNumerator] = useState('3');
  const [oddsDenominator, setOddsDenominator] = useState('1');
  const [oddsFavorsCreator, setOddsFavorsCreator] = useState(true);

  const [deadlineEnabled, setDeadlineEnabled] = useState(false);
  const [deadline, setDeadline] = useState('');

  const [error, setError] = useState<string | null>(null);

  const rival = friends.find((f) => f.profile.id === rivalId)?.profile;
  const rivalName = rival?.display_name;

  const stake = Number.parseFloat(stakeAmount);
  const stakeValid = Number.isFinite(stake) && stake > 0;
  const currencyValid = currencyKind === 'money' || !!currencyId;

  const approvedCurrencies = (currencies ?? []).filter((c) => c.moderation_status === 'approved');
  const ownCurrencies = approvedCurrencies
    .filter((c) => !c.is_builtin)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const builtinCurrencies = approvedCurrencies.filter(
    (c) => c.is_builtin && c.id !== MONEY_CURRENCY_ID,
  );
  const suggestedCurrencies = [...ownCurrencies, ...builtinCurrencies].slice(
    0,
    MAX_CURRENCY_SUGGESTIONS,
  );

  const lineNumber = Number.parseFloat(lineValue);
  const lineValid = !lineEnabled || (Number.isFinite(lineNumber) && lineValue.trim().length > 0);

  const winMine = winConditionMine.trim();
  const winTheirs = winConditionTheirs.trim();
  const winConditionsValid =
    !winConditionsEnabled || (winMine.length > 0 && winTheirs.length > 0);

  const oddsNum = Number.parseFloat(oddsNumerator);
  const oddsDenom = Number.parseFloat(oddsDenominator);
  const oddsValid =
    !oddsEnabled ||
    (Number.isFinite(oddsNum) && oddsNum > 0 && Number.isFinite(oddsDenom) && oddsDenom > 0);

  const deadlineValid = !deadlineEnabled || deadline.trim().length > 0;

  const oddsPreview =
    oddsEnabled && oddsValid && stakeValid
      ? computeOddsStakes(stake, oddsNum, oddsDenom, oddsFavorsCreator)
      : null;

  // When Line is on, the favored-side picker reads Over/Under (whichever
  // position the creator picked); otherwise it reads You/{rival}. Either
  // way it drives the same oddsFavorsCreator boolean.
  const creatorSideLabel = lineEnabled
    ? linePosition === 'over'
      ? 'Over'
      : 'Under'
    : winConditionsEnabled && winMine
      ? winMine
      : 'You';
  const rivalSideLabel = lineEnabled
    ? linePosition === 'over'
      ? 'Under'
      : 'Over'
    : winConditionsEnabled && winTheirs
      ? winTheirs
      : (rivalName ?? 'Rival');

  const canSubmit =
    !!userId &&
    !!rivalId &&
    event.trim().length > 0 &&
    stakeValid &&
    currencyValid &&
    lineValid &&
    winConditionsValid &&
    oddsValid &&
    deadlineValid &&
    !createBet.isPending;

  function submit() {
    if (!userId || !canSubmit) return;
    setError(null);

    createBet.mutate(
      buildBetInput({
        creatorId: userId,
        rivalId,
        rivalName: rivalName ?? 'Rival',
        event: event.trim(),
        description: description.trim(),
        currencyId: currencyKind === 'money' ? MONEY_CURRENCY_ID : currencyId,
        stakeAmount: stake,
        deadline: deadlineEnabled && deadline ? new Date(deadline).toISOString() : null,
        odds: oddsEnabled
          ? { numerator: oddsNum, denominator: oddsDenom, favorsCreator: oddsFavorsCreator }
          : null,
        line: lineEnabled ? { value: lineNumber, position: linePosition } : null,
        winConditions:
          winConditionsEnabled && !lineEnabled
            ? { creatorLabel: winMine, rivalLabel: winTheirs }
            : null,
      }),
      {
        onError: (err) => setError(getErrorMessage(err, 'Could not create the bet')),
      },
    );
  }

  if (createBet.isSuccess) {
    return (
      <main className="mx-auto flex min-h-screen max-w-app flex-col items-center justify-center gap-four p-four text-center">
        <p className="font-display text-lg font-extrabold">Bet sent to {rivalName ?? 'your rival'}!</p>
        <p className="text-text-secondary">They'll need to accept it before it's on.</p>
        <Button variant="primary" onClick={() => navigate('/bets', { replace: true })}>
          View your bets
        </Button>
        <Link to="/home" replace className="text-sm font-bold text-text-secondary">
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <div className="flex items-center justify-between">
        <BackButton label="Cancel" />
        <h1 className="font-display text-lg font-extrabold">New bet</h1>
        <div className="w-16" />
      </div>

      <div className="mt-four flex flex-col gap-four">
        <div>
          <p className="mb-two text-sm font-bold text-text-secondary">What&rsquo;s the event?</p>
          <input
            placeholder="Who does the dishes this week?"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            maxLength={200}
            className="w-full rounded-medium border border-line bg-surface p-three focus:border-grape focus:outline-none"
          />
          <textarea
            placeholder="Details (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            className="mt-two w-full rounded-medium border border-line bg-surface p-three"
          />
        </div>

        <div>
          <p className="mb-two text-sm font-bold text-text-secondary">Pick your rival</p>
          <div className="flex gap-three overflow-x-auto pb-one">
            {friends.map(({ profile }) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => setRivalId(profile.id)}
                className="flex shrink-0 flex-col items-center gap-one"
              >
                <span
                  className={`rounded-pill ${rivalId === profile.id ? 'ring-2 ring-grape ring-offset-2 ring-offset-bg' : ''}`}
                >
                  <Avatar id={profile.id} name={profile.display_name} size="lg" />
                </span>
                <span className="text-xs font-bold">{profile.display_name.split(' ')[0]}</span>
              </button>
            ))}
            <Link to="/friends" className="flex shrink-0 flex-col items-center gap-one">
              <span className="flex h-14 w-14 items-center justify-center rounded-pill border-2 border-dashed border-line text-text-faint">
                +
              </span>
              <span className="text-xs text-text-faint">More</span>
            </Link>
          </div>
        </div>

        <div>
          <p className="mb-two text-sm font-bold text-text-secondary">What are the stakes?</p>
          <div className="flex items-center gap-two">
            <input
              placeholder="Amount"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              className="w-24 rounded-medium border border-line bg-surface p-three"
            />
            <div className="flex gap-two">
              <button
                type="button"
                onClick={() => setCurrencyKind('money')}
                className={`rounded-pill px-three py-two text-sm font-bold ${
                  currencyKind === 'money'
                    ? 'bg-grape text-on-grape'
                    : 'border border-line bg-surface text-ink'
                }`}
              >
                💵 Money
              </button>
              <button
                type="button"
                onClick={() => setCurrencyKind('custom')}
                className={`rounded-pill px-three py-two text-sm font-bold ${
                  currencyKind === 'custom'
                    ? 'bg-grape text-on-grape'
                    : 'border border-line bg-surface text-ink'
                }`}
              >
                🎯 Custom
              </button>
            </div>
          </div>
          {currencyKind === 'custom' ? (
            <div className="mt-two flex flex-wrap gap-two">
              {suggestedCurrencies.map((currency) => {
                const selected = currencyId === currency.id;
                return (
                  <button
                    key={currency.id}
                    type="button"
                    onClick={() => setCurrencyId(currency.id)}
                    className={`rounded-pill px-three py-two text-sm font-bold ${
                      selected ? 'bg-grape text-on-grape' : 'border border-line bg-surface text-ink'
                    }`}
                  >
                    {currency.icon ?? '🎯'} {currency.name}
                  </button>
                );
              })}
              <Link
                to="/currencies"
                className="rounded-pill border border-dashed border-line px-three py-two text-sm font-bold text-text-faint"
              >
                + New
              </Link>
            </div>
          ) : null}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-text-secondary">Win conditions (optional)</p>
            <button
              type="button"
              role="switch"
              aria-checked={winConditionsEnabled}
              aria-label="Win conditions"
              onClick={() =>
                setWinConditionsEnabled((v) => {
                  if (!v) setLineEnabled(false);
                  return !v;
                })
              }
              className={`rounded-pill px-three py-one text-xs font-bold ${
                winConditionsEnabled
                  ? 'bg-grape text-on-grape'
                  : 'border border-line bg-surface text-text-secondary'
              }`}
            >
              {winConditionsEnabled ? 'On' : 'Off'}
            </button>
          </div>
          {winConditionsEnabled ? (
            <div className="mt-two flex flex-col gap-two">
              <div>
                <p className="mb-one text-xs font-bold text-text-faint">You win if…</p>
                <input
                  placeholder="e.g. Maya comes late"
                  value={winConditionMine}
                  onChange={(e) => setWinConditionMine(e.target.value)}
                  maxLength={50}
                  className="w-full rounded-medium border border-line bg-surface p-three focus:border-grape focus:outline-none"
                />
              </div>
              <div>
                <p className="mb-one text-xs font-bold text-text-faint">
                  {rivalName ?? 'They'} win{rivalName ? 's' : ''} if…
                </p>
                <input
                  placeholder="e.g. Maya does not"
                  value={winConditionTheirs}
                  onChange={(e) => setWinConditionTheirs(e.target.value)}
                  maxLength={50}
                  className="w-full rounded-medium border border-line bg-surface p-three focus:border-grape focus:outline-none"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-text-secondary">Line (optional)</p>
            <button
              type="button"
              role="switch"
              aria-checked={lineEnabled}
              aria-label="Line"
              onClick={() =>
                setLineEnabled((v) => {
                  if (!v) setWinConditionsEnabled(false);
                  return !v;
                })
              }
              className={`rounded-pill px-three py-one text-xs font-bold ${
                lineEnabled
                  ? 'bg-grape text-on-grape'
                  : 'border border-line bg-surface text-text-secondary'
              }`}
            >
              {lineEnabled ? 'On' : 'Off'}
            </button>
          </div>
          {lineEnabled ? (
            <div className="mt-two flex flex-col gap-two">
              <input
                placeholder="e.g. 56.5"
                value={lineValue}
                onChange={(e) => setLineValue(e.target.value.replace(/[^0-9.]/g, ''))}
                inputMode="decimal"
                className="w-full rounded-medium border border-line bg-surface p-three"
              />
              <div className="flex gap-two">
                <Button
                  variant={linePosition === 'over' ? 'primary' : 'secondary'}
                  className="flex-1"
                  onClick={() => setLinePosition('over')}
                >
                  Over
                </Button>
                <Button
                  variant={linePosition === 'under' ? 'primary' : 'secondary'}
                  className="flex-1"
                  onClick={() => setLinePosition('under')}
                >
                  Under
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-text-secondary">Uneven odds (optional)</p>
            <button
              type="button"
              role="switch"
              aria-checked={oddsEnabled}
              aria-label="Uneven odds"
              onClick={() => setOddsEnabled((v) => !v)}
              className={`rounded-pill px-three py-one text-xs font-bold ${
                oddsEnabled
                  ? 'bg-grape text-on-grape'
                  : 'border border-line bg-surface text-text-secondary'
              }`}
            >
              {oddsEnabled ? 'On' : 'Off'}
            </button>
          </div>
          {oddsEnabled ? (
            <div className="mt-two flex flex-col gap-two">
              <div className="flex items-center gap-two">
                <input
                  placeholder="3"
                  value={oddsNumerator}
                  onChange={(e) => setOddsNumerator(e.target.value.replace(/[^0-9]/g, ''))}
                  inputMode="numeric"
                  className="w-16 rounded-medium border border-line bg-surface p-two text-sm"
                />
                <span className="text-sm text-text-secondary">:</span>
                <input
                  placeholder="1"
                  value={oddsDenominator}
                  onChange={(e) => setOddsDenominator(e.target.value.replace(/[^0-9]/g, ''))}
                  inputMode="numeric"
                  className="w-16 rounded-medium border border-line bg-surface p-two text-sm"
                />
                <span className="text-xs text-text-faint">
                  &mdash; your stake above is the &ldquo;1&rdquo; side
                </span>
              </div>
              <div className="flex gap-two">
                <Button
                  variant={oddsFavorsCreator ? 'primary' : 'secondary'}
                  className="flex-1 py-two text-sm"
                  onClick={() => setOddsFavorsCreator(true)}
                >
                  Favoring {creatorSideLabel}
                </Button>
                <Button
                  variant={!oddsFavorsCreator ? 'primary' : 'secondary'}
                  className="flex-1 py-two text-sm"
                  onClick={() => setOddsFavorsCreator(false)}
                >
                  Favoring {rivalSideLabel}
                </Button>
              </div>
              {oddsPreview ? (
                <p className="text-xs text-text-faint">
                  You give {oddsPreview.creatorAmount} if you lose &middot; you win{' '}
                  {oddsPreview.rivalAmount} if you win
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-text-secondary">Deadline (optional)</p>
            <button
              type="button"
              role="switch"
              aria-checked={deadlineEnabled}
              aria-label="Deadline"
              onClick={() => setDeadlineEnabled((v) => !v)}
              className={`rounded-pill px-three py-one text-xs font-bold ${
                deadlineEnabled
                  ? 'bg-grape text-on-grape'
                  : 'border border-line bg-surface text-text-secondary'
              }`}
            >
              {deadlineEnabled ? 'On' : 'Off'}
            </button>
          </div>
          {deadlineEnabled ? (
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-two w-full rounded-medium border border-line bg-surface p-three"
            />
          ) : null}
        </div>

        <InlineError message={error} />

        <Button variant="primary" fullWidth disabled={!canSubmit} onClick={submit}>
          {createBet.isPending
            ? 'Sending…'
            : rivalName
              ? `Send bet to ${rivalName}`
              : 'Send bet'}
        </Button>
      </div>
    </main>
  );
}
