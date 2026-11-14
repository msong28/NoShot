# Web app change log & proposals

Traceable record of decisions for `web/` (the active app). Newest first. Each entry says
**what** changed, **why**, and **where** (commit / files). For the older narrative history
see `HANDOFF_WEB_PORT.md`; for already-decided items see `DECISIONS.md`.

---

## Design philosophy (read this to push back)

The rules behind the changes below. If a decision feels wrong, find the principle it came from
and argue with that — it's easier to change a principle than to re-litigate every screen.

1. **One place per thing.** Every fact should appear once, where you'd look for it. Repeats
   (a VS card _and_ a participants list _and_ the title all naming the same opponent) make a
   screen feel busy and make you wonder which one is the real one.
   _Applied to:_ bet page opponent line, participants list, friend page owing the bet list.
   _Push back if:_ you want redundancy for glanceability.
2. **Show what you can act on, not trivia.** A balance you can settle beats a win–loss score;
   proposals waiting on you beat a history log. Lists lead with "what needs me".
   _Applied to:_ friends list chip, friend page "Waiting on you", Accept/Decline up front.
   _Push back if:_ you'd rather see bragging stats at a glance.
3. **Dangerous or rare actions live in a "⋯" menu and are confirmed — never sitting on the
   screen.** Block/Unfriend (friend page) and Report (bet page) are two taps away: ⋯ → pick →
   "Are you sure?" sheet that says what will happen. This matches what Facebook, X and Snapchat do
   (overflow menu on a profile → confirmation; Unfriend is the lighter option, Block the
   stronger one that also removes the friendship). Research caveat: no formal UX guideline
   turned up, just consistent app behavior.
   _Push back if:_ you want faster access (e.g. swipe actions).
4. **Don't ship features nobody asked for or can explain.** Bet chat and polls had no clear job
   ("what does new poll mean?"). Hidden, not deleted, so they can come back.
   _Push back if:_ you want a social layer; the code is still in the repo.
5. **Say the real verb.** "Accept / Decline", not "Approve"; "You receive / You pay", not
   abstract "If you win / lose". Plain words for a friends-and-bets audience.
   _Push back if:_ you want a more playful or more formal tone.
6. **Context decides what's shown.** Photo-proof only matters once a bet is running, so it
   doesn't appear while you're deciding whether to accept. Side labels only show when they say
   something ("Over 2.5"), not when they're "You".
   _Push back if:_ you want every control always visible.
7. **Pick one alignment.** A screen is either left-aligned like a list or centered like a
   hero — mixing the two reads as a mistake. Detail pages (a single bet, a single friend) are
   hero/centered; lists are left-aligned.
   _Push back if:_ you prefer left-aligned detail pages.
8. **Respect the server rules.** Anything involving results/money stays server-authoritative
   (see `CLAUDE.md`), which is why scores are modeled as bets and block (not a client-side
   "remove friend") is the only removal that exists.
9. **Back-burner on purpose.** Group bets, contacts import and a true "Remove friend" are
   deferred, not forgotten (see Open items).

### Open items / back burner

- Group bets (deprioritized by request).
- Contacts import (needs native plugin + server matching design).
- True "Remove friend" (needs a migration; today it's Block).
- Renegotiate button next to Accept/Decline.
- Per-game scores (pool etc.) and a real scoreboard — see the proposal at the end.

---

## 2026-11-13

### 0000000. ⋯ menus, real Unfriend, calmer bet page

- **Removed the Block button from the bottom of the friend page.** The friend page and the bet
  page each have a **⋯** button (top right). Friend: **Unfriend** / **Block Alex**; bet:
  **Report this bet**. Every risky choice then opens a confirmation sheet that says what will
  happen. Principle 3.
- **Unfriend is new and real.** Previously the only way to remove a friend was Block (which
  also hides you from each other's search). New SQL function `remove_friend()`
  (`supabase/migrations/20260801090000_remove_friend.sql`, tests in
  `supabase/tests/remove_friend.test.sql`, passing in `npm run test:db`) ends an accepted
  friendship without creating a block; either side can send a new request later.
  **⚠️ This migration is NOT applied to `noshot-dev` yet** — until it is, Unfriend will show an
  error in the app (the same "live backend drift" caveat as in `CLAUDE.md`).
- **Bet page decluttered.** The status pill moved out of the middle to the top-right (beside
  the ⋯), taking the deadline with it, so the centered hero is just avatar → "is challenging
  you" → title → description. "On the line" cards now have one dominant number with small
  "If you win / you receive" and "If you lose / you pay" captions instead of long all-caps
  sentences.

---

### 000000. Bet page polish: centered hero, Accept/Decline, clearer stakes, no "+"

- **Centered hero.** Status → opponent avatar + "Cy Okafor is challenging you" → title →
  description are one centered stack; "On the line" is centered too. Before, the title/status
  were left-aligned over centered cards, which read as "centered but not". (Principle 7.)
- **Accept / Decline** replace Approve / Decline, full-width side by side. A _Renegotiate_
  button is a future third option (open items). Principle 5.
- **Clearer stakes:** "IF YOU WIN, YOU RECEIVE …" / "IF YOU LOSE, YOU PAY …". Assumption: you
  said "if you lose you receive" — read as "pay"; tell me if you meant something else.
- **No "+" button.** The "+" was the web photo-attach button. Proof photo upload is now a
  labeled **Add proof photo** button that only appears once a bet is running (not for
  pending/draft). Question for you: remove proof upload entirely? Settling currently has no
  other evidence mechanism. (Principle 6.)
- **Friend page "Waiting on you":** 4+ items now scroll **vertically** inside a fixed-height
  list (about 3 rows tall) instead of sideways.

---

### 00000. Simpler bet page; "Waiting on you" slider

**Bet detail page (`routes/bet-detail.tsx`)**

- **Removed chat messages and polls** from the bet page (UI only). Why: nobody asked for them,
  "New poll" was unexplained, and a message thread on a two-person bet duplicates real
  conversation. The comment/poll hooks, tables and components (`poll-card`, `poll-create-form`,
  `use-comments`, `use-polls`) are untouched, so they can come back — they're just unused here.
- **Kept photo proof** (attach button + proof images in the feed): it's evidence for settling,
  not chat. The sticky composer is now just the attach button.
- **"You VS Cy" card → one line.** "Cy Okafor is challenging you" while a proposal is waiting on
  you, otherwise "vs Cy Okafor". Why: the card repeated the title area.
- **Removed the Participants list on two-person bets** (it repeated the header and the "On the
  line" payout cards). It still shows for 3+ person bets. For two-person bets, a small
  "Your side / Their side" card appears **only** when the side labels carry information (an
  over/under line or custom win conditions); default labels ("You", names) are hidden.
- Open question for later: whether the opponent line is needed at all once bets are reached
  from a friend's page.

**Friend page:** "Waiting on you" stacks up to 3 rows; with 4+ it becomes a horizontal
snap-scroll row (cards at 85% width so the next one peeks).

**Group bets:** deprioritized for now (back burner); nothing built or removed.

---

### 0000. Shared bets on the friend page

- `/friend/:userId` now lists your **one-on-one** bets with that friend in three sections:
  **Waiting on you** (proposals to accept, results to confirm, cancellations; grape-bordered),
  **In progress** (active, plus proposals you sent), and **History** (settled/voided, latest 5
  with "See all N").
- The bet row was extracted from `routes/bets.tsx` into `components/bet-row.tsx` so the Bets tab
  and the friend page render identical rows.
- **Why:** the friend page is meant to be the one place for a relationship; before this, a
  proposal from Alex showed on Home/Bets but not on Alex's page.
- **Limit:** group bets (`group_id` set) are excluded, same rule as the head-to-head record.

---

### 000. Blocked users → Settings; quieter friends header (uncommitted → see git log)

- **Blocked users moved off the friends page** to Settings → Account → **Blocked users**
  (`/blocked`, `routes/blocked-users.tsx`) with the same Unblock action.
- **Friends page header:** the visible "Friends" title is gone (the bottom-nav tab and screen
  context already say it); it stays as a screen-reader-only `<h1>`. Header is now just search
  (left) and **Add friend** (right).
- **"Manual obligations"** link is now small, faint, underlined text instead of a bold purple link.

---

### 00. Add-friends page, nav fixes (uncommitted)

- **Bug fix — missing "+" button:** the bottom nav's create "+" vanished on `/friends` because I
  had hidden it there (`showCreate={false}`) from a misreading of "remove the + signal". Reverted
  and the prop deleted; the nav is identical on every screen again.
- **Friends tab icon:** was `UserPlus` (a person with a +), which also made the tab look like
  "add friend". Now `User` (single person), distinct from Groups (`Users`). `UserPlus` kept as
  `Icons.addFriend`. Also changes the friends empty-state icon.
- **Add friends page** (`/friends/add`, `routes/add-friend.tsx`): the header **Add friend** button
  now opens it instead of copying immediately. Options: **Search by username** (→
  `/friends/search`), **Copy invite link**, **Share invite link** (native share sheet →
  Messages/WhatsApp/contacts; falls back to copying on desktop).
- **Contacts import is NOT built.** The browser Contact Picker API is Android-Chrome-only; iOS
  needs a Capacitor contacts plugin + permission strings, and matching contacts to users needs a
  server RPC that takes phone numbers/emails (privacy + rate-limit design). The share sheet is the
  stand-in for now.

---

### 0. Friends becomes a real friends hub: search screen, friend page, safer Block (uncommitted)

**What**

- **Whole row is tappable.** Each friend row is now a link to `/friend/:userId` (`ListRow` gained a
  `to` prop). The balance chip inside it is display-only (a link inside a link is invalid HTML).
- **New friend page** (`routes/friend-profile.tsx`): avatar/name/@handle, head-to-head record, a
  **New bet with …** button (`/create/:id`), the full per-currency balance list, and **Block** at
  the very bottom behind a confirmation sheet. This is the Phase 1 page from the proposal below,
  minus shared-bet history.
- **Block removed from the list.** It was one mis-tap from a real, hard-to-undo action.
- **New search screen** (`/friends/search`, `routes/friend-search.tsx`) opened by the header
  search button. The friends page no longer shows search results inline.
- **Blocked section + Unblock** at the bottom of the friends page (needed anyway: blocking hides
  someone from search, and there was no way back in the UI).
- Friends page is now list-first: Requests → Your friends → Sent → Blocked.

**Why (and what the research said)**

Search UI follows common mobile-search guidance ([Algolia](https://www.algolia.com/blog/ux/mobile-search-ux-best-practices/),
[Experro](https://www.experro.com/blog/mobile-search-best-practices/),
[Screensdesign](https://screensdesign.com/articles/mobile-app-search-screen-examples/)):
full-screen with autofocus and keyboard ready, `type="search"` + search key, a clear (x) button,
a useful empty state instead of a blank panel, recent searches, and no dead-end "no results"
(ours points to the invite link). Caveats: those sources are mostly vendor blogs, not usability
research.

Two choices come from our backend, not the research: search runs **on submit, not per keystroke**,
because `search_profiles_by_username` requires ≥3 characters and rate-limits to 20/minute. Recent
searches live in `localStorage` per user (device-local convenience, same exception as
`use-custom-bet-templates`).

Friend page placement follows what I found on profile pages: keep block/remove **out of the
primary action row, behind a confirmation** (a Miro profile template and Facebook/Messenger help
pages say the same); the sources were thin and none is an authoritative design guide.

**Important behavior to know**

- There is **no "remove friend" RPC** — only `block_user`, which sets the friendship to
  `cancelled` and records a block. So "removing" a friend = blocking them. Un-blocking does
  **not** restore the friendship; you must send a new request and they must accept. A true
  "Remove friend" (no block) would need a new migration.
- Bets/ledger balances are not deleted by a block.

**Files:** `routes/friends.tsx`, `friend-search.tsx`, `friend-profile.tsx` (+ tests),
`components/ui/list-row.tsx`, `hooks/use-friends.ts` (`useBlockedUsers`, `useUnblockUser`),
`App.tsx` (two routes).

**Not done / open:** shared-bet history on the friend page; a real "Remove friend"; browser
check against live data.

---

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
