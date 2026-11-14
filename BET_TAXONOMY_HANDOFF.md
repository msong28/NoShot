# Bet taxonomy — handoff brief

**Goal.** Produce a taxonomy that maps **every kind of bet people could want to make** onto a small
set of building blocks, so that creating, accepting, tracking and settling any of them is as easy
as possible. The output is a design (and a data-model proposal), not code. Read
`CHANGELOG_WEB.md` first — it holds the design principles and what's been built.

**Why this matters.** Today we have one template (two people, even or odds/line stakes) and it
already strains: "Chore × 3" is a bad way to say "loser does the dishes for a week", a
self-accountability bet ("if I don't finish this by Friday I owe you $10") doesn't fit at all, and
several screens each special-case a different kind of bet. We want one structure that stays simple
for users while covering the long tail.

## What exists today (so you don't re-invent it)

- **A bet** = a title + description + optional deadline + a list of **sides** (who/what can win:
  you vs them, over/under a number, or custom win-condition labels) + a **commitment** per
  participant (stake quantity in a _currency_, plus odds).
- **Currencies** are the stake unit: built-in Money, Meal, Coffee, Gift, Favour, Chore, Harmless
  Dare, plus user-made ones. So a stake is always "N of a currency" — never free text.
- **Resolution methods** in the schema: `participant_submission` (the only one the app creates),
  `judge`, `group_vote`. Plain 1v1 bets are settled **by whoever reports the result, and it is
  final immediately** (a deliberate product decision, see `DECISIONS.md`). Tie is a reserved
  outcome.
- **Lifecycle:** draft → pending_acceptance → active → resolved / tied; also cancellation_pending
  (needs the other side to agree) and voided (declined or withdrawn — both look the same today).
- **Money:** resolving a bet posts append-only ledger entries; corrections are reversal entries.
  Balances and "settle up" (redemption) sit on top of the ledger.
- **Server rules you must respect** (`CLAUDE.md` → "Server authority model"): results, payouts and
  ledger mutations are never client-authoritative; everything goes through `SECURITY DEFINER`
  RPCs with RLS. Any new bet type must say how its result is agreed and who can change it.
- Group bets exist in the schema but are **back-burnered** — ignore them unless the taxonomy
  needs the case to stay open.

## The idea to explore: two families

1. **Contests** (what we have): two people disagree about an outcome and stake against each other —
   even bets, odds, over/under lines, custom win conditions.
2. **Pledges** (new): one person commits to _doing or not doing_ something and stakes what they'll
   forfeit if they fail; the other person is a **referee / beneficiary**, not an opponent.
   Example: "I'll finish the report by Friday or I owe you $10."

Pledges should be **a different thing in the UI** (one sentence to create, a countdown to a verdict
date, "Cy is keeping you honest") but ideally **reuse the same engine** underneath (sides = "I did
it" / "I didn't", only the pledger stakes). **Unverified:** whether the server allows a
counterparty who stakes nothing. Check `create_or_counter_bet` and the stake constraints first;
if not, that's a small migration.

Prior art for pledges (promotional help pages — directional only):
[stickK: how it works](https://stickk.zendesk.com/hc/en-us/articles/206833157) (goal + deadline +
stake, referee added after), and Beeminder (a graphed goal where derailing costs money).

## Pledge types to cover (seed list — extend it)

| Type                        | Example                                         | What makes it different                                   |
| --------------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| Do-by-date                  | "Finish the report by Friday or owe you $10"    | one deadline, binary verdict                              |
| Quit / avoid                | "No soda for 30 days"                           | you fail by **doing** the thing; needs a check-in cadence |
| Streak / habit              | "Gym 3×/week for a month"                       | recurring, each miss costs a stake                        |
| Number target               | "Run 50 miles this month"                       | progress is numeric, verdict is threshold                 |
| Show-up                     | "On time to every Tuesday dinner"               | many small verdicts                                       |
| Escalating                  | $5, then $10, then $20 per miss                 | stake changes over time                                   |
| Charity forfeit             | stake goes to a cause (or an "anti-charity")    | recipient isn't a person in the app                       |
| Group pledge                | everyone commits; pot goes to those who succeed | multi-party                                               |
| Dare / forfeit              | failing means doing a dare instead of paying    | stake is a task                                           |
| Reverse ("I bet you can't") | you stake against **their** goal                | really a contest on someone else's pledge                 |

## Axes to define (each bet type = a choice on every axis)

1. **Who's involved:** 1 + referee / 2 / group.
2. **Who decides the result:** both agree / one reports (today) / a referee / a judge / a vote /
   self-reported.
3. **How it's verified:** word of mouth / photo / data.
4. **Timing:** one deadline / recurring / open-ended.
5. **Stake kind:** money / countable thing / forfeit-task (free text + duration) / donation.
6. **Who receives the stake:** the opponent / the referee / a charity / a shared pot.
7. **Payout shape:** even / odds / line / escalating / winner-takes-pot.
8. **What failure means:** missed the deadline / did the forbidden thing / lost the contest.

## Product cases that need rules (please decide these)

**Deadlines** — today a deadline is only small text on the bet page; nothing happens when it
passes. Proposed rules to evaluate:

| Moment                     | Contest                                       | Pledge                                                                               |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| Created                    | optional                                      | required (it _is_ the bet)                                                           |
| 24h before                 | reminder to both                              | reminder to the pledger                                                              |
| At the deadline            | prompt "ready to settle?" (don't auto-settle) | prompt the **referee**: "Did {name} do it? Yes / No"                                 |
| Long overdue (e.g. 7 days) | show "Overdue" badge; never silently void     | referee reminded; **no auto-verdict** (silence ≠ success) unless both sides opted in |
| Proposal never answered    | expires after N days → voided "expired"       | same                                                                                 |

**Verdicts and mistakes** — settling is final today. Decide: correction flow (either side proposes,
other accepts, server posts reversal entries); and whether "inconclusive" is its own state or just a
mutual cancel (shipped as mutual cancel).

**Stake wording** — a bet must read as a natural sentence ("Loser does the dishes for a week"),
not "Chore × 1". Define the stake kinds and how each renders in a list row, on the bet page and in
the ledger.

**Void states** — "voided" currently covers declined, withdrawn and cancelled bets; users can't
tell which. Probably three labels.

**Self-pledge safety** — if you're your own verifier the app is trust-based; decide whether a
pledge needs a referee, or allows honor-system with the stake going to a friend.

## Deliverables

1. A **taxonomy table**: every bet type × the 8 axes, with a one-line example each.
2. For each type: **create flow** (fewest possible questions — consider starting from _intent_,
   "what's going on?", not from a type picker), **bet page** layout, **settle** flow, **ledger
   result**.
3. A **data-model proposal** that maps types onto the existing schema (or lists the minimum
   migration) and says which RPCs change, honoring the server authority model.
4. **Rules** for the product cases above.
5. A **phased plan**: what ships first (suggest: Pledge "do-by-date" with a referee — it's the use
   case people keep describing).

## Constraints & preferences already stated by the owner

- Make the process **as easy as possible**; avoid screens full of text and repeated information.
- Settling and other money moments get **their own page** with one question.
- Risky actions live in a "⋯" menu behind a confirmation.
- Group bets and contacts import are deprioritized.
- Everything has a stated reason — add your reasoning to `CHANGELOG_WEB.md` so decisions are
  traceable and can be pushed back on.
