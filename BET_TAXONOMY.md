# Bet taxonomy — proposal (2026-11-13)

Answers `BET_TAXONOMY_HANDOFF.md`. Status: **proposal for review, nothing below is built** except
the lifecycle in "Shared rules", which shipped in `20261113090000_bet_lifecycle.sql`.

## The idea in one paragraph

Every bet people describe is the same five building blocks: **a question**, **people in roles**,
**a verdict rule**, **stakes**, and **timing**. The handoff's 8 axes collapse into these five
because three of them are derived (who receives the stake follows from roles; "what failure
means" follows from the question; payout shape follows from stakes + timing). Two _families_ —
**Contests** (people stake against each other) and **Pledges** (one person stakes on themselves, a
friend referees) — are just two presets of the same blocks, so the engine stays one engine while
the UI can treat them as different things.

## The five building blocks

| Block               | Values                                                                                                                                                                                    | Today                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **1. Question**     | _sides_ (A vs B, custom labels) · _yes/no_ ("did Alex do it?") · _line_ (over/under N)                                                                                                    | sides + line exist; yes/no = two sides                    |
| **2. Roles**        | _opponent_ (has a side, stakes) · _referee_ (decides, no side, no stake) · _beneficiary_ (receives a forfeit: the referee, or an off-app cause)                                           | opponents only — every participant must stake (see below) |
| **3. Verdict rule** | one rule for everything: **a report against your own interest is final; a report in your favour needs the other side's OK, or 48h of silence**. Referee reports count as neutral → final. | shipped for contests (option C)                           |
| **4. Stakes**       | kind: _money_ · _countable_ (N coffees) · _task_ (free text: "do the dishes for a week", "donate $20 to X") — shape: _even_ · _odds_ · _per-miss_ · _escalating_                          | money + countable, even + odds                            |
| **5. Timing**       | _open_ (decide any time) · _deadline_ (verdict date) · _rounds_ (weekly check-ins, each a small verdict)                                                                                  | open + deadline (deadline has no behaviour yet)           |

Why the verdict rule matters: it's the one piece that has to be right for every type, and the
"against your own interest = final" asymmetry works unchanged for pledges — a pledger saying "I
failed" is instantly final, "I did it" needs the referee (or silence).

## Taxonomy table — every type from the handoff on the blocks

| Type                            | Example                                    | Question            | Roles                           | Verdict                                                           | Stakes                    | Timing          |
| ------------------------------- | ------------------------------------------ | ------------------- | ------------------------------- | ----------------------------------------------------------------- | ------------------------- | --------------- |
| **Contests**                    |                                            |                     |                                 |                                                                   |                           |                 |
| Even bet                        | "Celtics win tonight, 1 meal"              | sides               | 2 opponents                     | either reports, other confirms                                    | any, even                 | open / deadline |
| Odds                            | "3:1 I beat you at pool"                   | sides               | 2 opponents                     | same                                                              | any, odds                 | open / deadline |
| Over/under                      | "Over 2.5 goals"                           | line                | 2 opponents                     | same                                                              | any, even/odds            | deadline        |
| Custom outcome                  | "It snows before Dec 1"                    | sides (labels)      | 2 opponents                     | same                                                              | any                       | deadline        |
| Reverse ("bet you can't")       | "Bet you can't run a 5k by June"           | yes/no              | 2 opponents (one is the doer)   | same                                                              | any                       | deadline        |
| **Pledges**                     |                                            |                     |                                 |                                                                   |                           |                 |
| Do-by-date                      | "Report done by Fri or I owe you $10"      | yes/no              | pledger + referee (beneficiary) | pledger "failed" = final; "did it" needs referee; referee = final | pledger only              | deadline        |
| Quit / avoid                    | "No soda for 30 days"                      | yes/no (inverted)   | same                            | same; a "failed" report can come any time before the deadline     | pledger only              | deadline        |
| Number target                   | "Run 50 miles this month"                  | yes/no at threshold | same                            | same                                                              | pledger only              | deadline        |
| Streak / habit                  | "Gym 3×/week for a month"                  | yes/no per round    | same                            | same, per round                                                   | pledger only, per miss    | rounds          |
| Show-up                         | "On time every Tuesday dinner"             | yes/no per round    | same                            | same, per round                                                   | per miss                  | rounds          |
| Escalating                      | $5, $10, $20 per miss                      | yes/no per round    | same                            | same                                                              | per miss, escalating      | rounds          |
| Charity / anti-charity          | "Fail → I donate $20 to X"                 | yes/no              | pledger + referee (verifies)    | same; settle-up = referee confirms the donation                   | task ("donate $20 to X")  | deadline        |
| Dare / forfeit                  | "Fail → I sing at karaoke"                 | yes/no              | pledger + referee               | same                                                              | task                      | deadline        |
| **Back burner (keep possible)** |                                            |                     |                                 |                                                                   |                           |                 |
| Group contest / pot             | "Everyone in, winner takes the pot"        | sides               | N opponents                     | referee or vote (schema exists)                                   | pot                       | deadline        |
| Group pledge                    | "Everyone commits; pot to those who do it" | yes/no each         | N pledgers + referee            | referee                                                           | pot split among successes | deadline        |

So the whole long tail is **2 presets × 3 question shapes × 3 stake kinds × 3 timings**, not 15
special cases. "Reverse" is a plain contest; "charity" and "dare" are just the _task_ stake kind;
"streak", "show-up" and "escalating" are the _rounds_ timing.

## What each needs in the product

**Create — start from intent, not a type picker.** First screen asks one thing: _"Who's it
with?"_ (already the rival picker) then _"What kind?"_ with two big choices: **"Bet against
them"** (contest — today's flow) and **"Hold me to something"** (pledge). Everything else stays
behind "More options", as now.

- Pledge create = one sentence: "I will \_\_\_ by [date], or I \_\_\_ [stake]." Rounds appear only if
  they tap "Repeat weekly".
- Stake field becomes: amount + currency (today) **or** "Something else…" → free text task
  ("do the dishes for a week").

**Bet page** — same layout, two headers: contest "You vs Bob"; pledge "Bob is keeping you honest"
with a countdown. Rounds show as a row of dots (✓ ✗ ·).

**Who won? page** — contest: today's page. Pledge: one question, **"Did Alex do it?" → Yes / No**
(referee) or **"I did it" / "I didn't make it"** (pledger). Same lifecycle underneath.

**Settle up** — money/countable as today. A **task** debt shows as "Alex owes you: do the dishes
for a week" with **Mark done** (debtor) → **Confirm** (creditor) — the same propose/confirm shape
as redemption today.

## Data model — minimum changes to today's schema

The current engine already models sides, odds, lines, versions, approvals, the new lifecycle and
the ledger. Four additions cover everything above:

1. **Referee role (needed for every pledge).** Today every participant must stake:
   `bet_commitments` requires `stake_quantity > 0` and `payout_if_win > 0`, and the BET-05 check
   caps a winner's payout at what the other side staked. A pledge's referee stakes nothing, so it
   doesn't fit (this answers the handoff's open question: **no, it isn't just UI**). Change: add
   `'referee'` to `bet_participant_role`, allow a referee row with no side and no commitment, and
   have `create_or_counter_bet` skip BET-05 for the "did it" side of a pledge (the pledger is never
   paid; they just don't pay). Verdict: referee reports are final; the pledger's reports follow
   the self-interest rule.
2. **Task stakes.** Add `bet_commitments.stake_text` (nullable) and one built-in currency, **Task**
   (quantity always 1). The ledger stays numeric: a lost task bet posts `1 Task` owed, and the bet
   carries the words. Settle-up reuses `request_redemption` / confirm for "Mark done". Charity
   forfeits are tasks owed to the referee, who confirms the donation.
3. **Bet kind.** `bets.kind` = `contest | pledge` — purely for the UI (headers, wording, which Who
   won? questions to ask). No behaviour should branch on it that the roles don't already decide.
4. **Rounds (later phase).** `bet_rounds (bet_id, round_no, due_at, status, result_submission_id)`;
   each round runs the same report/confirm/lock-in lifecycle and posts its own ledger entry on a
   miss (stake from a per-round schedule for escalating). The bet ends after the last round.

RPCs touched: `create_or_counter_bet` (referee, stake_text, kind), `submit_bet_result` /
`confirm_bet_result` (referee = final; per-round variants in phase 3), `_finalize_bet_resolution`
(task stakes post `1 Task`; pledges post only the pledger's stake to the referee). All stay
`SECURITY DEFINER` + RLS-only reads, per the server authority model. Each change needs
`supabase/tests` coverage.

## Rules for the handoff's product cases

| Case                    | Rule                                                                                                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deadline optional?      | Contest: optional. Pledge: required (it _is_ the bet).                                                                                                                                                                                                    |
| At the deadline         | Contest: "The deadline has passed — time to call it" on the bet page (**shipped**). Pledge: referee asked "Did Alex do it?". Push reminders need a server schedule (pg_cron), not built.                                                                  |
| Long overdue            | "Overdue" label after 7 days; never auto-decided — nobody has reported, so there's nothing to lock in.                                                                                                                                                    |
| Unanswered proposal     | Expires after 7 days → voided "Expired" (**shipped**).                                                                                                                                                                                                    |
| Reported, no answer     | Locks in after 48h (**shipped** for contests). Open question for pledges: the handoff suggested "silence ≠ success". With the self-interest rule, silence only ever locks in the _pledger's_ "I did it" — recommend 48h same as contests for consistency. |
| Mistakes after final    | Not built. Proposed: "Propose a correction" — either side proposes a different outcome, the other accepts, server posts reversal + new ledger entries (`reversal_of` exists).                                                                             |
| Inconclusive            | Active: propose cancel (mutual). Disputed: call it off (either side). Both void with nothing owed (**shipped**).                                                                                                                                          |
| Void states             | Declined / Withdrawn / Cancelled / Called off / Expired (**shipped**).                                                                                                                                                                                    |
| Self-pledge with no one | Not allowed: a pledge needs a referee. Honor-system pledges add nothing a notes app doesn't.                                                                                                                                                              |
| Stake wording           | Countable: "Loser buys 2 coffees". Money: "Loser pays $10". Task: the text itself, "Loser does the dishes for a week".                                                                                                                                    |

## Phased plan

1. **Pledge: do-by-date with a referee** — referee role, `bets.kind`, pledge create sentence, "Did
   Alex do it?" verdict. The use case people keep describing; touches the fewest tables.
2. **Task stakes** — `stake_text` + Task currency + "Mark done" settle-up. Unlocks dares, chores,
   and charity forfeits for both families.
3. **Rounds** — streaks, show-up, escalating. Biggest change; only after 1–2 prove out.
4. **Corrections after final**, then group bets (schema already partly there).

## Decisions for you

1. Two families with an intent-first create screen ("Bet against them" / "Hold me to something")
   — OK?
2. Pledge silence after "I did it": lock in after 48h (recommended) or wait for the referee?
3. Phase order above — pledges first, or task stakes first (smaller, helps existing contests)?
