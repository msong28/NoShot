import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Avatar } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/inline-error';
import { useCreateOrCounterBet } from '@/hooks/use-bets';
import { useCurrencies } from '@/hooks/use-currencies';
import { useFriends } from '@/hooks/use-friends';
import { useMyGroups } from '@/hooks/use-groups';
import { useSession } from '@/hooks/use-session';
import { ResolutionMethods, type BetResolutionMethod } from '@/lib/bet';
import { getErrorMessage } from '@/lib/errors';

/** "Decided by" segment copy for our real 3 resolution methods. The mock's
 * own options (Both confirm / Proof / Poll) don't map onto this schema --
 * Proof/Poll are evidence *features* already on the bet-detail tabs, not
 * decision methods -- so these use ResolutionMethods' real values/labels
 * with a short chip word + emoji instead of copying the mismatched copy. */
const DECIDED_BY: Record<BetResolutionMethod, { emoji: string; short: string }> = {
  participant_submission: { emoji: '🤝', short: 'Both confirm' },
  judge: { emoji: '⚖️', short: 'Judge' },
  group_vote: { emoji: '🗳️', short: 'Group vote' },
};

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
  const [resolutionMethod, setResolutionMethod] =
    useState<BetResolutionMethod>('participant_submission');
  const [judgeId, setJudgeId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);

  const currenciesScope = groupId ? { groupId } : { ownerUserId: userId as string };
  const { data: currencies } = useCurrencies(currenciesScope);
  const [currencyId, setCurrencyId] = useState('');

  const stake = Number.parseFloat(stakeQuantity);
  const opponentName = friends.find((f) => f.profile.id === opponentId)?.profile.display_name;
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

  function submit(isDraft: boolean) {
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
        isDraft,
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
      <div className="flex items-center justify-between">
        <BackButton label="Cancel" />
        <h1 className="font-display text-lg font-extrabold">New bet</h1>
        <Button
          variant="secondary"
          className="px-three py-one text-sm"
          disabled={!canSubmit}
          onClick={() => submit(true)}
        >
          Draft
        </Button>
      </div>

      <div className="mt-four flex flex-col gap-four">
        <div>
          <p className="mb-two text-sm font-bold text-text-secondary">What&rsquo;s the bet?</p>
          <input
            placeholder="Who does the dishes this week?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-medium border border-line bg-surface p-three focus:border-grape focus:outline-none"
          />
        </div>

        <textarea
          placeholder="Details (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-medium border border-line bg-surface p-three"
        />

        <div>
          <p className="mb-two text-sm font-bold text-text-secondary">Pick your rival</p>
          <div className="flex gap-three overflow-x-auto pb-one">
            {friends.map(({ profile }) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => setOpponentId(profile.id)}
                className="flex shrink-0 flex-col items-center gap-one"
              >
                <span
                  className={`rounded-pill ${opponentId === profile.id ? 'ring-2 ring-grape ring-offset-2 ring-offset-bg' : ''}`}
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

        {activeGroups.length > 0 ? (
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="rounded-medium border border-line bg-surface p-three"
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
            placeholder="If you win (e.g. Lakers)"
            value={sideALabel}
            onChange={(e) => setSideALabel(e.target.value)}
            className="min-w-0 flex-1 rounded-medium border border-line bg-surface p-three"
          />
          <input
            placeholder="If they win (e.g. Celtics)"
            value={sideBLabel}
            onChange={(e) => setSideBLabel(e.target.value)}
            className="min-w-0 flex-1 rounded-medium border border-line bg-surface p-three"
          />
        </div>

        <div>
          <p className="mb-two text-sm text-text-secondary">Which side are you taking?</p>
          <div className="flex gap-two">
            <Button
              variant={mySide === 'a' ? 'primary' : 'secondary'}
              className="flex-1"
              onClick={() => setMySide('a')}
            >
              {sideALabel.trim() || 'Side A'}
            </Button>
            <Button
              variant={mySide === 'b' ? 'primary' : 'secondary'}
              className="flex-1"
              onClick={() => setMySide('b')}
            >
              {sideBLabel.trim() || 'Side B'}
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-two text-sm font-bold text-text-secondary">Loser&rsquo;s stake</p>
          <div className="flex flex-wrap gap-two">
            {(currencies ?? []).map((currency) => {
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
                  {selected ? ` ×${stakeQuantity || '1'}` : ''}
                </button>
              );
            })}
            <Link
              to="/currencies"
              className="rounded-pill border border-dashed border-line px-three py-two text-sm font-bold text-text-faint"
            >
              + Custom
            </Link>
          </div>
          <div className="mt-two flex items-center gap-two">
            <span className="text-sm text-text-secondary">×</span>
            <input
              placeholder="Quantity"
              value={stakeQuantity}
              onChange={(e) => setStakeQuantity(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              className="w-24 rounded-medium border border-line bg-surface p-two text-sm"
            />
            <span className="text-xs text-text-faint">
              Symmetric bet · both sides risk the same stake
            </span>
          </div>
        </div>

        <div>
          <p className="mb-two text-sm font-bold text-text-secondary">Decided by</p>
          <div className="flex gap-two">
            {ResolutionMethods.map((m) => {
              const selected = resolutionMethod === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setResolutionMethod(m.value)}
                  title={m.label}
                  className={`flex-1 rounded-medium px-two py-three text-center text-sm font-bold ${
                    selected ? 'bg-ink text-bg' : 'border border-line bg-surface text-ink'
                  }`}
                >
                  <span className="block">{DECIDED_BY[m.value].emoji}</span>
                  {DECIDED_BY[m.value].short}
                </button>
              );
            })}
          </div>
        </div>

        {resolutionMethod === 'judge' ? (
          <select
            value={judgeId}
            onChange={(e) => setJudgeId(e.target.value)}
            className="rounded-medium border border-line bg-surface p-three"
          >
            <option value="">Who&rsquo;s the judge?</option>
            {friends.map(({ profile }) => (
              <option key={profile.id} value={profile.id}>
                {profile.display_name}
              </option>
            ))}
          </select>
        ) : null}

        <div>
          <p className="mb-two text-sm text-text-secondary">Deadline (optional)</p>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="rounded-medium border border-line bg-surface p-three"
          />
        </div>

        <InlineError message={error} />

        <Button variant="primary" fullWidth disabled={!canSubmit} onClick={() => submit(false)}>
          {createBet.isPending
            ? 'Sending…'
            : opponentName
              ? `Send bet to ${opponentName}`
              : 'Send bet'}
        </Button>
      </div>
    </main>
  );
}
