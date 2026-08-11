import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Avatar } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { ConfirmReveal } from '@/components/ui/confirm-reveal';
import { Eyebrow } from '@/components/ui/eyebrow';
import { InlineError } from '@/components/ui/inline-error';
import { Sheet } from '@/components/ui/sheet';
import { useCreateOrCounterBet, useMyBets } from '@/hooks/use-bets';
import { useCurrencies } from '@/hooks/use-currencies';
import { useCustomBetTemplates } from '@/hooks/use-custom-bet-templates';
import { useFriends } from '@/hooks/use-friends';
import { useSession } from '@/hooks/use-session';
import { MONEY_CURRENCY_ID } from '@/lib/currency';
import { getErrorMessage } from '@/lib/errors';
import { Icons } from '@/lib/icons';
import { buildBetInput, computeOddsStakes } from '@/lib/wager';

/** How many distinct past event titles to offer in the "recent bets" sheet. */
const MAX_RECENT_BETS = 10;

/**
 * Screen 2 of the Splitwise-"Add expense"-style create flow: event + stake,
 * laid out like Splitwise's description/amount rows, each with a tappable
 * icon button opening a full-height sheet. All mapping/validation/mutation
 * logic is unchanged from the previous single-screen create.tsx; only the
 * layout and the rival source (a route param instead of in-page state)
 * changed. The optional modifiers (win conditions, line, odds, deadline)
 * aren't part of the Splitwise mock but are kept behind a "More betting
 * options" toggle so no existing capability is lost.
 */
export function CreateBetDetailsScreen() {
  const { rivalId = '' } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user.id;

  const { friends, isLoading: friendsLoading } = useFriends(userId);
  const { bets } = useMyBets(userId);
  const createBet = useCreateOrCounterBet(userId);
  const { data: currencies } = useCurrencies({ ownerUserId: userId as string });
  const {
    templates: customBetTemplates,
    addTemplate: addCustomBetTemplate,
    removeTemplate: removeCustomBetTemplate,
  } = useCustomBetTemplates(userId);

  const rival = friends.find((f) => f.profile.id === rivalId)?.profile;
  const rivalName = rival?.display_name;

  // A direct/stale URL to a rival who isn't (or no longer is) a friend has
  // nothing to show -- bounce back to the picker once friends have loaded.
  // Gated on userId too: useSession() starts every fresh mount at
  // session=null before its effect resolves the real (already-authenticated)
  // session, which otherwise made useFriends(undefined) report "loaded, no
  // friends" for one tick and bounce back before the real data ever arrived
  // -- exactly what made tapping a rival on Screen 1 look like a no-op.
  useEffect(() => {
    if (!!userId && !friendsLoading && rivalId && !rival) {
      navigate('/create', { replace: true });
    }
  }, [userId, friendsLoading, rivalId, rival, navigate]);

  const [event, setEvent] = useState('');

  const [stakeAmount, setStakeAmount] = useState('');
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
  const [recentBetsOpen, setRecentBetsOpen] = useState(false);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [newCustomBet, setNewCustomBet] = useState('');

  const stake = Number.parseFloat(stakeAmount);
  const stakeValid = Number.isFinite(stake) && stake > 0;
  const currencyValid = currencyKind === 'money' || !!currencyId;

  const approvedCurrencies = (currencies ?? []).filter((c) => c.moderation_status === 'approved');
  // useCurrencies already orders by sort_order (the "Manage stakes" screen's
  // reorder controls), so no client-side re-sort here -- that ordering is
  // exactly what should surface in this picker.
  const ownCurrencies = approvedCurrencies.filter((c) => !c.is_builtin);
  const builtinCurrencies = approvedCurrencies.filter(
    (c) => c.is_builtin && c.id !== MONEY_CURRENCY_ID,
  );
  const pickableCurrencies = [...ownCurrencies, ...builtinCurrencies];

  const selectedCurrency =
    currencyKind === 'custom' ? pickableCurrencies.find((c) => c.id === currencyId) : undefined;
  const selectedCurrencyIcon = currencyKind === 'money' ? '💵' : (selectedCurrency?.icon ?? '🎯');
  const selectedCurrencyLabel =
    currencyKind === 'money' ? 'Money' : (selectedCurrency?.name ?? 'Custom');

  // Distinct past event titles this user has authored, newest first (bets
  // is already ordered that way), for the recent-bets quick-fill sheet.
  const recentBetTitles = useMemo(() => {
    const seen = new Set<string>();
    const titles: string[] = [];
    for (const bet of bets) {
      if (bet.creator_id !== userId) continue;
      if (seen.has(bet.title)) continue;
      seen.add(bet.title);
      titles.push(bet.title);
      if (titles.length >= MAX_RECENT_BETS) break;
    }
    return titles;
  }, [bets, userId]);

  const lineNumber = Number.parseFloat(lineValue);
  const lineValid = !lineEnabled || (Number.isFinite(lineNumber) && lineValue.trim().length > 0);

  const winMine = winConditionMine.trim();
  const winTheirs = winConditionTheirs.trim();
  const winConditionsValid = !winConditionsEnabled || (winMine.length > 0 && winTheirs.length > 0);

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
    !!rival &&
    event.trim().length > 0 &&
    stakeValid &&
    currencyValid &&
    lineValid &&
    winConditionsValid &&
    oddsValid &&
    deadlineValid &&
    !createBet.isPending;

  function submit() {
    if (!userId || !rival || !canSubmit) return;
    setError(null);

    createBet.mutate(
      buildBetInput({
        creatorId: userId,
        rivalId,
        rivalName: rivalName ?? 'Rival',
        event: event.trim(),
        description: '',
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

  // On send, show the confirmation animation; tapping continue drops the
  // creator on their Pending bets so they see proof it went through -- same
  // click-to-continue reveal used everywhere else in the app.
  if (createBet.isSuccess) {
    return (
      <ConfirmReveal
        emoji="🤝"
        title={`Sent to ${rivalName ?? 'your rival'}!`}
        subtitle="Waiting for them to accept…"
        onDone={() => navigate('/bets?tab=pending', { replace: true })}
      />
    );
  }

  if (!rival) return null;

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <div className="flex items-center justify-between">
        <BackButton label="Cancel" />
        <h1 className="font-display text-lg font-extrabold">New bet</h1>
        <div className="w-16" />
      </div>

      <button
        type="button"
        onClick={() => navigate('/create')}
        className="mt-four inline-flex items-center gap-two rounded-pill border border-line bg-surface py-one pr-three pl-one"
      >
        <Avatar id={rival.id} name={rival.display_name} size="sm" />
        <span className="text-sm font-bold">{rival.display_name}</span>
        <Icons.close size={14} strokeWidth={2} className="text-text-faint" />
      </button>

      <div className="mt-four flex flex-col gap-four">
        <div className="flex items-center gap-three">
          <button
            type="button"
            onClick={() => setRecentBetsOpen(true)}
            aria-label="Recent bets"
            className="flex shrink-0 items-center justify-center rounded-medium border border-line bg-surface-sunken p-four text-text-secondary"
          >
            <Icons.activity size={24} strokeWidth={1.75} />
          </button>
          <input
            placeholder="What’s the bet?"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            maxLength={200}
            className="w-full rounded-medium border border-line bg-surface p-four text-base outline-none focus:border-grape placeholder:text-text-faint"
          />
        </div>

        <div className="flex items-center gap-three">
          <button
            type="button"
            onClick={() => setCurrencySheetOpen(true)}
            aria-label="Choose stake currency"
            className="flex shrink-0 items-center justify-center rounded-medium border border-line bg-surface-sunken p-four"
          >
            <span className="text-2xl leading-none">{selectedCurrencyIcon}</span>
          </button>
          <div className="flex w-full items-center gap-two rounded-medium border border-line bg-surface p-four">
            <input
              placeholder="What are you wagering?"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              className="w-full bg-transparent text-base outline-none placeholder:text-text-faint"
            />
            <span className="shrink-0 text-base font-bold text-text-secondary">
              {selectedCurrencyLabel}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMoreOptionsOpen((v) => !v)}
          className="flex items-center gap-one self-start text-base font-bold text-grape-ink"
        >
          More betting options
          <Icons.disclosure
            size={18}
            strokeWidth={2}
            className={moreOptionsOpen ? 'rotate-180' : ''}
          />
        </button>

        {moreOptionsOpen ? (
          <>
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
          </>
        ) : null}

        <InlineError message={error} />

        <Button
          variant="primary"
          fullWidth
          disabled={!canSubmit}
          onClick={submit}
          className="py-five text-xl"
        >
          {createBet.isPending ? 'Sending…' : 'Send bet'}
        </Button>
      </div>

      <Sheet visible={recentBetsOpen} title="Recent bets" onClose={() => setRecentBetsOpen(false)}>
        <Eyebrow>Recents</Eyebrow>
        {recentBetTitles.length === 0 ? (
          <p className="text-sm text-text-faint">
            Bets you create will show up here for quick reuse.
          </p>
        ) : (
          recentBetTitles.map((title) => (
            <button
              key={title}
              type="button"
              onClick={() => {
                setEvent(title);
                setRecentBetsOpen(false);
              }}
              className="rounded-medium border border-line bg-surface p-three text-left text-sm font-bold"
            >
              {title}
            </button>
          ))
        )}

        <Eyebrow className="mt-two">Custom</Eyebrow>
        {customBetTemplates.length === 0 ? (
          <p className="text-sm text-text-faint">Save a bet below to reuse it here anytime.</p>
        ) : (
          customBetTemplates.map((title) => (
            <div key={title} className="flex items-center gap-two">
              <button
                type="button"
                onClick={() => {
                  setEvent(title);
                  setRecentBetsOpen(false);
                }}
                className="flex-1 rounded-medium border border-line bg-surface p-three text-left text-sm font-bold"
              >
                {title}
              </button>
              <button
                type="button"
                aria-label={`Remove "${title}" from custom bets`}
                onClick={() => removeCustomBetTemplate(title)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-surface-sunken text-text-secondary"
              >
                <Icons.close size={14} strokeWidth={2} />
              </button>
            </div>
          ))
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addCustomBetTemplate(newCustomBet);
            setNewCustomBet('');
          }}
          className="flex items-center gap-two"
        >
          <input
            placeholder="Add one you want to repeat"
            value={newCustomBet}
            onChange={(e) => setNewCustomBet(e.target.value)}
            maxLength={200}
            className="w-full rounded-medium border border-line bg-surface p-three text-sm outline-none focus:border-grape placeholder:text-text-faint"
          />
          <button
            type="submit"
            disabled={!newCustomBet.trim()}
            aria-label="Add custom bet"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-grape text-on-grape disabled:opacity-40"
          >
            <Icons.add size={18} strokeWidth={2} />
          </button>
        </form>
      </Sheet>

      <Sheet
        visible={currencySheetOpen}
        title="Stake currency"
        onClose={() => setCurrencySheetOpen(false)}
      >
        <button
          type="button"
          onClick={() => {
            setCurrencyKind('money');
            setCurrencyId('');
            setCurrencySheetOpen(false);
          }}
          className={`flex items-center gap-three rounded-medium border p-three text-left ${
            currencyKind === 'money' ? 'border-grape bg-grape-soft' : 'border-line bg-surface'
          }`}
        >
          <span className="text-xl">💵</span>
          <span className="flex-1 text-sm font-bold">Money</span>
          {currencyKind === 'money' ? (
            <Icons.check size={18} strokeWidth={2} className="text-grape-ink" />
          ) : null}
        </button>
        {pickableCurrencies.map((currency) => {
          const selected = currencyKind === 'custom' && currencyId === currency.id;
          return (
            <button
              key={currency.id}
              type="button"
              onClick={() => {
                setCurrencyKind('custom');
                setCurrencyId(currency.id);
                setCurrencySheetOpen(false);
              }}
              className={`flex items-center gap-three rounded-medium border p-three text-left ${
                selected ? 'border-grape bg-grape-soft' : 'border-line bg-surface'
              }`}
            >
              <span className="text-xl">{currency.icon ?? '🎯'}</span>
              <span className="flex-1 text-sm font-bold">{currency.name}</span>
              {selected ? (
                <Icons.check size={18} strokeWidth={2} className="text-grape-ink" />
              ) : null}
            </button>
          );
        })}
        <Link
          to="/currencies"
          className="rounded-medium border border-dashed border-line p-three text-center text-sm font-bold text-text-faint"
        >
          + Create new currency
        </Link>
      </Sheet>
    </main>
  );
}
