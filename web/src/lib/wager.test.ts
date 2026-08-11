import { describe, expect, it } from 'vitest';

import { buildBetInput, type WagerFormInput } from './wager';

const base: WagerFormInput = {
  creatorId: 'creator',
  rivalId: 'rival',
  rivalName: 'Bob',
  event: 'Lakers win',
  description: '',
  currencyId: 'cur-1',
  stakeAmount: 5,
  deadline: null,
  odds: null,
  line: null,
  winConditions: null,
};

/** The funding rule create_or_counter_bet enforces (BET-05): for every side,
 * the sum of winners' payout_if_win must not exceed the losers' staked pool.
 * payout_if_win = stake * denom / num. We assert the mapping always satisfies
 * it, since a violation would make the RPC reject an otherwise-valid bet. */
function assertFunded(input: ReturnType<typeof buildBetInput>) {
  const payout = (p: (typeof input.participants)[number]) =>
    (p.stakeQuantity * p.oddsDenominator) / p.oddsNumerator;
  for (const side of input.sides) {
    const winners = input.participants.filter((p) => p.outcomeKey === side.outcomeKey);
    const losers = input.participants.filter((p) => p.outcomeKey !== side.outcomeKey);
    const winnerPayout = winners.reduce((sum, p) => sum + payout(p), 0);
    const loserPool = losers.reduce((sum, p) => sum + p.stakeQuantity, 0);
    expect(winnerPayout).toBeLessThanOrEqual(loserPool);
  }
}

describe('buildBetInput', () => {
  it('maps an even bet to symmetric 1:1 stakes on generic you/rival sides', () => {
    const out = buildBetInput(base);

    expect(out.title).toBe('Lakers win');
    expect(out.groupId).toBeNull();
    expect(out.resolutionMethod).toBe('participant_submission');
    expect(out.sides).toEqual([
      { outcomeKey: 'creator', label: 'You' },
      { outcomeKey: 'rival', label: 'Bob' },
    ]);
    expect(out.participants).toEqual([
      {
        userId: 'creator',
        outcomeKey: 'creator',
        currencyId: 'cur-1',
        stakeQuantity: 5,
        oddsNumerator: 1,
        oddsDenominator: 1,
      },
      {
        userId: 'rival',
        outcomeKey: 'rival',
        currencyId: 'cur-1',
        stakeQuantity: 5,
        oddsNumerator: 1,
        oddsDenominator: 1,
      },
    ]);
    assertFunded(out);
  });

  it('turns a line into over/under sides with the creator on their position', () => {
    const out = buildBetInput({ ...base, line: { value: 56.5, position: 'under' } });

    expect(out.sides).toEqual([
      { outcomeKey: 'over', label: 'Over 56.5' },
      { outcomeKey: 'under', label: 'Under 56.5' },
    ]);
    expect(out.participants[0]).toMatchObject({ userId: 'creator', outcomeKey: 'under' });
    expect(out.participants[1]).toMatchObject({ userId: 'rival', outcomeKey: 'over' });
    assertFunded(out);
  });

  it('labels the sides with custom win conditions while keeping creator/rival keys', () => {
    const out = buildBetInput({
      ...base,
      winConditions: { creatorLabel: 'Maya comes late', rivalLabel: 'Maya does not' },
    });

    expect(out.sides).toEqual([
      { outcomeKey: 'creator', label: 'Maya comes late' },
      { outcomeKey: 'rival', label: 'Maya does not' },
    ]);
    expect(out.participants[0]).toMatchObject({ userId: 'creator', outcomeKey: 'creator' });
    expect(out.participants[1]).toMatchObject({ userId: 'rival', outcomeKey: 'rival' });
    assertFunded(out);
  });

  it('lets a line take precedence over win conditions when both are set', () => {
    const out = buildBetInput({
      ...base,
      line: { value: 56.5, position: 'over' },
      winConditions: { creatorLabel: 'Maya comes late', rivalLabel: 'Maya does not' },
    });

    expect(out.sides).toEqual([
      { outcomeKey: 'over', label: 'Over 56.5' },
      { outcomeKey: 'under', label: 'Under 56.5' },
    ]);
    assertFunded(out);
  });

  it('re-expresses 3:1 odds favoring the creator so the favored side risks more to win less', () => {
    const out = buildBetInput({
      ...base,
      odds: { numerator: 3, denominator: 1, favorsCreator: true },
    });

    // Favored creator: stakes 15 (3x base), payout 15*1/3 = 5 (the rival's stake).
    expect(out.participants[0]).toMatchObject({
      userId: 'creator',
      stakeQuantity: 15,
      oddsNumerator: 3,
      oddsDenominator: 1,
    });
    expect(out.participants[1]).toMatchObject({
      userId: 'rival',
      stakeQuantity: 5,
      oddsNumerator: 1,
      oddsDenominator: 3,
    });
    assertFunded(out);
  });

  it('mirrors the odds onto the rival when the bet favors them', () => {
    const out = buildBetInput({
      ...base,
      odds: { numerator: 2, denominator: 1, favorsCreator: false },
    });

    expect(out.participants[0]).toMatchObject({
      userId: 'creator',
      stakeQuantity: 5,
      oddsNumerator: 1,
      oddsDenominator: 2,
    });
    expect(out.participants[1]).toMatchObject({
      userId: 'rival',
      stakeQuantity: 10,
      oddsNumerator: 2,
      oddsDenominator: 1,
    });
    assertFunded(out);
  });
});
