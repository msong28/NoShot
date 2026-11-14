# Web app change log & proposals

Traceable record of decisions for `web/` (the active app). Newest first. Each entry says
**what** changed, **why**, and **where** (commit / files). For the older narrative history
see `HANDOFF_WEB_PORT.md`; for already-decided items see `DECISIONS.md`.

---

## 2026-11-13

### 1. Friends page redesign — `1bfaea0`

**What**

- Header is now: search button (left) · "Friends" title · **Add friend** button (right).
- Search bar is hidden until the search button is tapped (it autofocuses when opened).
- **Add friend** only copies your invite link (`/invite/<username>`) and shows "Link copied!".
  It no longer opens the native share sheet.
- The per-friend win–loss score (e.g. `3–1 you lead`) is replaced by a **balance chip**: what
  that friend owes you (↑ green) or you owe them (↓ amber), or "Settled" when nothing is open.
- The round "+" create button in the bottom nav is hidden on this screen only
  (`<BottomNav showCreate={false} />`).

**Why**

- _Balance over score:_ a score is trivia; a balance is actionable (you can settle it). The
  chip links to `/balances`, where Settle up already lives.
- _The "big number breaks the UI" concern is handled in the chip itself:_ amounts are compacted
  (`12,500` → `12.5K`), the label truncates at a fixed max width (`max-w-[9rem]`), only the
  friend's single largest balance is shown, and the rest collapse into `+N`. Direction is
  always arrow + color + label together (README "Debt chip" rule), never color alone.
- _Search hidden by default / copy-only invite:_ simplest possible first-run screen. Invite
  by link is the main way to add a friend; username search is still there but out of the way.
- _Hid the "+" here:_ interpreted from "remove the + signal" — **assumption**, revert by
  removing `showCreate={false}` in `routes/friends.tsx` if you meant something else.

**Files:** `web/src/routes/friends.tsx`, `friends.test.tsx`, `components/bottom-nav.tsx`.
Data comes from the existing `useMyBalances` hook (`get_my_balances` RPC) — no new backend.

**Known limits**

- Balances are per-currency, so a friend with several open currencies shows only the biggest
  one plus `+N`. Full breakdown is on `/balances` (and, if built, the friend page below).
- The chip links to the shared `/balances` page, not a per-friend view (there isn't one yet —
  see the proposal below).
- Not yet checked in a browser against live data.

### 2. Landing page at `/` — `daa6c7c`

**What**

- New public landing page (`routes/landing.tsx`): Brick mascot, headline, **Get started**
  (→ `/sign-up`), **I already have an account** (→ `/sign-in`), a 3-step "How it works", and
  legal links. Signed-in visitors are redirected to `/home`.
- Sign-in moved from `/` to `/sign-in`.
- Route guards (`protected-route`, `require-profile`, `require-admin`,
  `require-session-no-profile`), the back-to-sign-in links, and the invite page's Sign in
  button now point at `/sign-in`.

**Why**

- There was no front door: `/` was the sign-in form. A landing page explains the product to
  people arriving from an invite link or the open web.
- Guards were pointed at `/sign-in` (not `/`) so the "account suspended" message
  (`location.state.authMessage`) still lands on the screen that displays it.
- Sign-out and delete-account still go to `/` (landing), which is the natural "you're out" page.

**Open:** copy and emoji icons are first-draft placeholders; dark mode not yet eyeballed;
the Cloudflare deploy hasn't been confirmed to serve `/sign-in` (SPA fallback should cover it).

### 3. `web-port` merged into `master` — `dd2cbf9` (fast-forward)

**What:** `master` was 0 ahead / 59 behind `web-port`, so it was fast-forwarded (PR #1 closed
as merged). `web-port` and `master` currently point at the same commits.

**Why:** all development was already happening on `web-port`; `master` was ~weeks stale and
`src/` (the old Expo app) differs by only 4 files.

### 4. `CLAUDE.md` tidy-ups

Removed a drifting line number and the boilerplate-README bullet, and added a "verify in a
real browser, then prettier" step to the jsdom caveat. **Why:** jsdom can't see overlays,
animation timing, or native behavior; line numbers go stale.

---

## Proposal (not built): clickable friends → head-to-head page

### The idea

Tap a friend → a page showing, for just the two of you:

1. the current **score** against each other,
2. results of **games** like pool (and other things you keep score on),
3. **money / favors owed** each way, with a **Settle up** action.

### Recommendation: don't build a separate "scores" system — hang everything off bets

NoShot already has the pieces; the friend page is mostly an **aggregation view** over them:

| Need                    | Already exists                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A contest with a winner | Bets (`bets`, `bet_participants`) resolved through the settlement RPCs; `MyBet.iWon`; `useHeadToHeadRecords` (the score we just removed from the list) |
| What each of you staked | `wagers` / `wager_stakes`, currencies incl. built-in Money (`20260725050000_money_stake_currency.sql`) and custom ones                                 |
| Who owes whom           | `ledger_entries` → `get_my_balances` RPC → `useMyBalances`; per-pair entries via `useLedgerEntriesBetween`                                             |
| Settling                | `useOutstandingObligations` + `useRequestRedemption` / confirm / decline (`redemption_requests`, `obligation_allocations`)                             |

**Why not a free-form scoreboard table the clients write to?** Project rule
(`CLAUDE.md` → "Server authority model"): results and anything feeding money are never
client-authoritative. A "pool: I won 8–5" entry that either person can edit unilaterally is
exactly that bug. Modeling a game as a **bet with a stake of 0 / bragging rights** reuses the
existing propose → accept → report-result → confirm/dispute flow, so scores are agreed by
both people and auditable for free.

### Suggested phases

**Phase 1 — Friend page from existing data (no migration).**
Route `/friend/:userId` (inside the protected/profile guard). Sections:

- _Header:_ avatar, name, @handle, mutual friends.
- _Head-to-head:_ W–L–ties from resolved bets between the two of you (reuse
  `useHeadToHeadRecords` logic, filtered to two-person bets).
- _Balances:_ every open currency (this is where the multi-currency list that the chip
  truncates gets shown in full), each with a **Settle up** button (existing redemption flow).
- _History:_ shared bets, newest first, linking to `/bet/:id`; plus "New bet with <name>"
  → `/create/:rivalId` (route already exists).
- Make friend rows on `/friends` tappable → this page (the chip keeps its own `/balances`
  link, or points here instead). Careful: the row already contains a Block button, so use a
  link on the title/avatar area, not a wrapping `<button>`.

**Phase 2 — Per-game scores (small migration).**
To get "pool: you lead 7–4" rather than one lump total, bets need a **game/tag**
(e.g. pool, darts, ping-pong, custom). Smallest option: a nullable `game` text (or a small
`games` table with moderation like currencies) on the wager/bet, picked on the create screen,
with the friend page grouping records by it. Moderation filter applies to free-text tags
(see `web/src/lib/moderation.ts`, plus the server-side gate).

**Phase 3 — Real scorelines / series (bigger).**
If you want the actual score (8–5) or "first to 5 frames", add score fields to the **result
submission** (`bet_result_submissions` → server-validated, confirmed by the other side, in a
`SECURITY DEFINER` RPC with a rate limit), and optionally a "series" grouping several bets.
Only worth it once Phase 2 shows people actually use game tags.

### Decisions to make before building

1. Is a pool game with **no stake** allowed today? (Is a zero-stake / "bragging rights"
   currency valid in `create_wager`?) If not, that's a prerequisite.
2. Page URL: by user id (`/friend/:id`) vs. username (`/u/:username`, shareable).
3. Phase 2 tagging: fixed list of games vs. free text (free text needs moderation).
4. Should "Settle up" live on this page or keep deferring to `/balances`?

### UI notes

- Keep one primary action per state: **Settle up** when money is owed, otherwise **New bet**.
- Lead with the head-to-head line and balance chip (the two things the list already shows),
  then details below — and reuse `ListRow`, `DebtChip`, `SectionHeader`, `EmptyState`.
- Same overflow rules as the chip: compact big numbers, truncate long currency names.
- Empty state for friends with no shared bets: a single "Make your first bet" prompt.

### Sources / confidence

This proposal is grounded in this repo's schema and hooks (read above), plus general
patterns from expense-splitting apps (per-friend net balance + activity feed). **No external
web research was done** — say the word and I'll look at how comparable apps handle
head-to-head records and game tracking before Phase 2.
