import { useState } from 'react';
import { useNavigate } from 'react-router';

import { InlineError } from '@/components/ui/inline-error';
import { useCreateOrCounterBet } from '@/hooks/use-bets';
import { useCurrencies } from '@/hooks/use-currencies';
import { useFriends } from '@/hooks/use-friends';
import { useMyGroups } from '@/hooks/use-groups';
import { useSession } from '@/hooks/use-session';
import { ResolutionMethods, type BetResolutionMethod } from '@/lib/bet';
import { getErrorMessage } from '@/lib/errors';

/**
 * A focused MVP of bet creation: one opponent, even-money stakes on both
 * sides (odds locked at 1:1). The native app's full wizard also supports
 * uneven odds, multi-way bets, and counteroffers — not ported yet, see
 * HANDOFF_WEB_PORT.md.
 */
export function CreateScreen() {
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user.id;

  const { friends } = useFriends(userId);
  const { activeGroups } = useMyGroups(userId);
  const createBet = useCreateOrCounterBet(userId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [opponentId, setOpponentId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [sideALabel, setSideALabel] = useState('');
  const [sideBLabel, setSideBLabel] = useState('');
  const [mySide, setMySide] = useState<'a' | 'b'>('a');
  const [stakeQuantity, setStakeQuantity] = useState('1');
  const [resolutionMethod, setResolutionMethod] = useState<BetResolutionMethod>(
    'participant_submission',
  );
  const [judgeId, setJudgeId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);

  const currenciesScope = groupId ? { groupId } : { ownerUserId: userId as string };
  const { data: currencies } = useCurrencies(currenciesScope);
  const [currencyId, setCurrencyId] = useState('');

  const stake = Number.parseFloat(stakeQuantity);
  const canSubmit =
    !!userId &&
    !!opponentId &&
    title.trim().length > 0 &&
    sideALabel.trim().length > 0 &&
    sideBLabel.trim().length > 0 &&
    !!currencyId &&
    Number.isFinite(stake) &&
    stake > 0 &&
    (resolutionMethod !== 'judge' || !!judgeId) &&
    !createBet.isPending;

  function handleSubmit() {
    if (!userId || !canSubmit) return;
    setError(null);

    const opponentSide = mySide === 'a' ? 'b' : 'a';

    createBet.mutate(
      {
        groupId: groupId || null,
        title: title.trim(),
        description: description.trim(),
        deadline: deadline ? new Date(deadline).toISOString() : null,
        resolutionMethod,
        judgeId: resolutionMethod === 'judge' ? judgeId : null,
        randomFallbackEnabled: true,
        sides: [
          { outcomeKey: 'a', label: sideALabel.trim() },
          { outcomeKey: 'b', label: sideBLabel.trim() },
        ],
        participants: [
          {
            userId,
            outcomeKey: mySide,
            currencyId,
            stakeQuantity: stake,
            oddsNumerator: 1,
            oddsDenominator: 1,
          },
          {
            userId: opponentId,
            outcomeKey: opponentSide,
            currencyId,
            stakeQuantity: stake,
            oddsNumerator: 1,
            oddsDenominator: 1,
          },
        ],
      },
      {
        onSuccess: (bet) => navigate(`/bet/${bet.id}`, { replace: true }),
        onError: (err) => setError(getErrorMessage(err, 'Could not create the bet')),
      },
    );
  }

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="font-display text-sm text-text-secondary"
      >
        ← Cancel
      </button>

      <h1 className="mt-three font-display text-2xl font-extrabold">New bet</h1>

      <div className="mt-four flex flex-col gap-three">
        <input
          placeholder="What's the bet? (e.g. Lakers win tonight)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-medium bg-surface p-three shadow-card"
        />
        <textarea
          placeholder="Details (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-medium bg-surface p-three shadow-card"
        />

        <select
          value={opponentId}
          onChange={(e) => setOpponentId(e.target.value)}
          className="rounded-medium bg-surface p-three shadow-card"
        >
          <option value="">Who's the other side?</option>
          {friends.map(({ profile }) => (
            <option key={profile.id} value={profile.id}>
              {profile.display_name}
            </option>
          ))}
        </select>

        {activeGroups.length > 0 ? (
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="rounded-medium bg-surface p-three shadow-card"
          >
            <option value="">Not tied to a group</option>
            {activeGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        ) : null}

        <div className="flex gap-two">
          <input
            placeholder="Side A (e.g. Lakers)"
            value={sideALabel}
            onChange={(e) => setSideALabel(e.target.value)}
            className="flex-1 rounded-medium bg-surface p-three shadow-card"
          />
          <input
            placeholder="Side B (e.g. Celtics)"
            value={sideBLabel}
            onChange={(e) => setSideBLabel(e.target.value)}
            className="flex-1 rounded-medium bg-surface p-three shadow-card"
          />
        </div>

        <div>
          <p className="mb-two text-sm text-text-secondary">Which side are you taking?</p>
          <div className="flex gap-two">
            <button
              type="button"
              onClick={() => setMySide('a')}
              className={`flex-1 rounded-pill px-four py-two font-display font-bold ${mySide === 'a' ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-text-secondary'}`}
            >
              {sideALabel.trim() || 'Side A'}
            </button>
            <button
              type="button"
              onClick={() => setMySide('b')}
              className={`flex-1 rounded-pill px-four py-two font-display font-bold ${mySide === 'b' ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-text-secondary'}`}
            >
              {sideBLabel.trim() || 'Side B'}
            </button>
          </div>
        </div>

        <div className="flex gap-two">
          <input
            placeholder="Stake (each side risks the same)"
            value={stakeQuantity}
            onChange={(e) => setStakeQuantity(e.target.value.replace(/[^0-9.]/g, ''))}
            inputMode="decimal"
            className="flex-1 rounded-medium bg-surface p-three shadow-card"
          />
          <select
            value={currencyId}
            onChange={(e) => setCurrencyId(e.target.value)}
            className="flex-1 rounded-medium bg-surface p-three shadow-card"
          >
            <option value="">Currency…</option>
            {(currencies ?? []).map((currency) => (
              <option key={currency.id} value={currency.id}>
                {currency.name}
              </option>
            ))}
          </select>
        </div>

        <select
          value={resolutionMethod}
          onChange={(e) => setResolutionMethod(e.target.value as BetResolutionMethod)}
          className="rounded-medium bg-surface p-three shadow-card"
        >
          {ResolutionMethods.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        {resolutionMethod === 'judge' ? (
          <select
            value={judgeId}
            onChange={(e) => setJudgeId(e.target.value)}
            className="rounded-medium bg-surface p-three shadow-card"
          >
            <option value="">Who's the judge?</option>
            {friends.map(({ profile }) => (
              <option key={profile.id} value={profile.id}>
                {profile.display_name}
              </option>
            ))}
          </select>
        ) : null}

        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="rounded-medium bg-surface p-three shadow-card"
        />

        <InlineError message={error} />

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="rounded-pill bg-primary px-four py-three font-display font-bold text-on-primary disabled:opacity-60"
        >
          {createBet.isPending ? 'Proposing…' : 'Propose bet'}
        </button>
      </div>
    </main>
  );
}
