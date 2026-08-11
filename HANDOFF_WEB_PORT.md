# Handoff: NoShot web port ("screenporting")

Originally written 2026-07-20; updated after a second work session that night, again
after a third session the next day, again after a fourth session later the same day, and
again after a fifth (interactive, not scheduled) session right after that, and again
after a sixth (interactive) session on 2026-07-27. This file is a snapshot, not a plan —
verify anything below against the actual code before relying on it. **Trust this "Status
as of" section over anything below it that contradicts it** — the sections further down
are historical and partly stale now.

## Status as of 2026-07-27 (sixth session — "Phase 1" fixes, branch `max-phase1-fixes`)

The two founders split up a punch list of fixes/changes during a sync. This session
(mine) took one half; the other founder is working the rest of the list solo on his own
branch, in parallel, directly in the app -- **if you're his Claude session, read the
"boundary with the other founder's work" note below before touching bet settlement,
debt-direction, or the home/favors hero card.**

Root `src/` (the original Expo app) has been abandoned as of this sync -- `web/` is the
only actively-developed frontend now. Don't bother porting fixes there.

**Built this session, all on branch `max-phase1-fixes` (based on `web-port`, not yet
merged), typecheck/test/DB-test clean throughout:**

- Fixed the rival-avatar selection ring getting clipped at the top on the create-bet
  screen (`web/src/routes/create.tsx`) -- an `overflow-x-auto` scroll container with no
  top padding was clipping the ring's box-shadow. Added `pt-one`.
- Removed the "no real money" line from the onboarding carousel copy
  (`web/src/components/onboarding-carousel.tsx`). Left the near-identical line in the
  invite-share text (`web/src/lib/invite-link.ts`) alone -- that's a separate surface,
  wasn't in scope.
- **Delete/withdraw a bet**: new `withdraw_bet(p_bet_id)` RPC
  (`supabase/migrations/20260727090000_bet_withdrawal.sql`, tested in
  `supabase/tests/bet_withdrawal.test.sql`) -- creator-only, only for `draft` (hard
  deletes, nothing was ever shared) or `pending_acceptance` (voids, same terminal state
  a decline reaches). An _active_ bet still goes through the existing
  `propose_cancel_bet`/`approve_cancel_bet` mutual-consent path, untouched. Wired into
  `bet-detail.tsx` as a "Delete bet" button.
- **Edit a pending bet's description/stake/currency**: no new RPC -- reuses the existing
  `create_or_counter_bet` counter-offer path (new hook
  `useEditPendingBetDetails` in `use-bets.ts`). Deliberately scoped to description/
  stake/currency only, _not_ odds/line/win-conditions -- those are stored as opaque
  label text on `bet_sides` with no structured line-value field, so editing them would
  mean regex-parsing numbers back out of strings, which felt too fragile to ship.
  Sides/odds are passed through byte-for-byte unchanged; only title/description/currency
  change, and stake scales proportionally to preserve the agreed odds ratio.
- **Emoji + management for custom currencies**: the `icon` column and insert plumbing
  already existed end-to-end, just needed a UI input (`currencies.tsx`). Added real
  delete/rename/reorder on top: new `sort_order` column, new RLS `update`/`delete`
  policies, and the insert-time moderation trigger now also fires on UPDATE — but only
  recomputes `moderation_status` when `name` actually changes, so an unrelated reorder
  can't silently undo an admin's `moderation_actions` block. See
  `supabase/migrations/20260727100000_currency_management.sql` /
  `supabase/tests/currency_management.test.sql` (12 assertions) if you need the exact
  RLS shape. `create.tsx`'s currency picker now reflects the user's manual `sort_order`
  instead of most-recent-first.
- **Bottom-nav "+" FAB**: turned out to already exist (`web/src/components/
bottom-nav.tsx`) and already be wired into every main tab screen. Just removed one
  redundant leftover inline "+ New bet" button on Home that duplicated it.
- **Double or nothing**: also no new RPC -- calls `create_or_counter_bet` fresh (not a
  counter) with the same title/sides/odds ratio as the resolved bet, stakes doubled, no
  deadline (the original's had already passed). Goes through the normal
  pending_acceptance → approval flow like any new bet, so it needs the other side's
  consent, not a one-tap auto-create. Either side (winner or loser) can propose it.
  Button lives in `bet-detail.tsx`'s Result section, shown once a bet is
  `resolved`/`tied`.
- Login screen: fixed the Apple/Google continue-button icon sizing (Apple's SVG has a
  portrait, non-square viewBox that was rendering visually smaller/thinner than
  Google's square one at the same nominal `size`) and bumped Apple's icon size a bit for
  optical parity. The residual few px of text-start misalignment between the two
  buttons is just "Apple" vs "Google" being different string lengths under center
  alignment -- normal, not a bug.
- "Humiliate button": searched the whole repo (`web/`, root `src/`, all docs) -- doesn't
  exist anywhere. Nothing to remove; presumably only existed in a design/plan.

**Boundary with the other founder's work (important if you're his Claude):** he's
solo-revamping, on his own branch: the favors/ledger hero view (who owes what), the
landing/pre-auth page, friend search, the settle page's layout, keeping "invite a
friend" visible after a friend's added, a currency-padding bug on custom currencies of a
certain size on phone, settle notifications, a settle button next to active bets, and
accept/renegotiate buttons on pending bets. Two things were explicitly _dropped_ from
this session's scope and left entirely to him: **who settles a debt (debtor vs
creditor direction logic)** and **editing a bet's outcome after the fact** -- both live
on the settle page he owns. This session's "edit bet details" only touches
description/stake/currency on a _not-yet-accepted_ bet, never a resolved one's outcome,
so there shouldn't be overlap -- but if you're about to touch `bet-detail.tsx`'s Result
section, the home screen's favors hero card, or anything settle-direction-related,
check with the humans first rather than assuming this file is exhaustive.

**Not yet done**: a new mascot to replace the current one (waiting on an asset from the
non-Claude founder, not a code task).

**Verification**: DB migration tests (`npm run test:db` from repo root) and the full
`web/` suite (`npm run typecheck`, `npm test`) were run clean after every change. No
live logged-in browser click-through against the real `noshot-dev` Supabase project was
done for the delete/edit-bet backend work specifically (would've needed a real
authenticated session + existing friend/bet) -- everything else that could be checked
visually in an unauthenticated or locally-served view was.

## Status as of 2026-07-21, later still (fifth session — the golden path is now verified)

This session did no new feature work — it did the thing every prior handoff flagged as
the #1 priority: actually clicked through the app in a real browser against live
Supabase (`noshot-dev`), using two throwaway test accounts (`noshot.web.test.a@example.com`
/ "Test Alice" / `@testalice`, and `noshot.web.test.b@example.com` / "Test Bob" /
`@testbob`, both password `TestPass123!`). **Every step of the golden path worked with no
bugs found**:

- Email/password sign-up → setup-profile → home, for both accounts.
- Username search, friend request, accept — including the home screen's "Needs your
  attention" section correctly surfacing the incoming request live.
- Created a bet ("Coffee run bet") from Alice against Bob via `/create` — real
  currencies loaded from Supabase into the picker, `create_or_counter_bet` succeeded,
  landed on `/bet/:id` with the correct roster/stakes/payouts and an "Awaiting approval"
  badge.
- Posted a comment (passed the moderation filter), created a poll and voted on it, and
  uploaded a proof photo (via a synthetic `File`/`DataTransfer` injected through
  `javascript_tool`, since the browser tool's file-picker automation is currently broken
  in this environment — not an app bug, worth knowing if a future session hits the same
  wall) — all rendered correctly, including the image itself loading back from Supabase
  Storage.
- Switched to Bob, confirmed the "This bet needs your approval" section only shows for
  the participant who hasn't responded yet (correctly absent for Alice, the creator, who
  auto-approves), approved it, watched the bet flip from "Awaiting approval" to "Active"
  and the Actions section switch to "Propose cancellation".
- Created a group ("Coffee Crew") as Bob, invited Alice by username, confirmed Alice saw
  it as a _pending invite_ to accept (not instant membership) on her `/groups` screen,
  accepted it, and sent chat messages both directions — both rendered live for both
  users.

No bugs surfaced anywhere in this pass. The one non-app caveat: the browser automation's
native file-upload tool (`file_upload`/`upload_image`) is broken in this environment
(rejects host filesystem paths, can't retrieve prior screenshots) — worked around it by
dispatching a synthetic `change` event on the file input directly via JS, which exercises
the same `useUploadProof` code path a real file picker would. If a future session needs to
test file upload and hits the same tool failure, that workaround is the way through it.

**Leftover test data in `noshot-dev`** (not cleaned up — flagging for whoever has
authority over that database): the two test accounts, their friendship, the "Coffee run
bet" (now active, with a comment/poll/vote/proof photo on it), and the "Coffee Crew" group
(with two chat messages). All clearly named `Test Alice`/`Test Bob`/`testalice`/`testbob`
so easy to identify and remove if this database needs to stay clean, but nobody has done
that cleanup yet.

**What this confirms about all four prior sessions' work**: the comments/polls/proof/chat
wiring, the sign-up/sign-in flows, the friend/group/bet lifecycles, and the auth guards
all actually work end-to-end, not just typecheck- and unit-test-clean. This was the
single biggest source of risk called out repeatedly across this file's history, and it's
now resolved for the happy path specifically. Edge cases (disputes, cancellations,
declines, blocking, admin actions, obligations, invite preview, delete-account) are still
only unit-test-verified, not browser-verified.

## Status as of 2026-07-21, later (fourth session)

Ran as an unattended scheduled session continuing from the third session's handoff. Worked
straight down that handoff's "Suggested next steps" list, in order. `npm run typecheck`,
`npm test`, and `npm run build` are all clean as of commit `8f551c4` (13 test files, 50
tests — up from 4/13). Every commit this session was typecheck+test+build-verified on its
own before moving to the next.

**What got built this session** (see git log on `web-port`):

- **Wired comments, polls, and proof into `bet-detail.tsx`**, and **chat and polls into
  `group-detail.tsx`** — this was flagged as the single largest remaining feature gap
  across all three prior sessions. All the hooks (`use-comments`, `use-chat`, `use-polls`,
  `use-proof`) and even the `PollCard`/`PollCreateForm`/`ReportDialog` components already
  existed unused in `web/` (leftover from the original scaffold commit) — this session's
  work was entirely wiring them into the two screens, following the native
  `src/app/bet/[betId].tsx` and `src/app/group/[groupId].tsx` layouts closely (same
  section order, same gating rules: forms only show for an active participant/member).
  One deviation: proof upload uses a plain `<input type="file">` since there's no native
  image-picker equivalent on web; `useUploadProof` already expected a `File` object, so
  no hook changes were needed.
- **Resolved the sign-up open question** from the third handoff ("check whether native's
  sign-up screen does anything OAuth-only sign-in doesn't already cover"): it does — native
  supports email+password sign-in/sign-up _in addition to_ Google/Apple OAuth, and web only
  had OAuth. Added a password field to the existing `sign-in.tsx` (using
  `supabase.auth.signInWithPassword`, same as native) and a new `sign-up.tsx` screen at
  `/sign-up` (using `supabase.auth.signUp`, including native's email-confirmation-pending
  state), so people without a Google/Apple account aren't locked out. `/sign-up` is mounted
  ungated in `App.tsx`, same tier as `/`.
- **Added test coverage for every screen that was missing it**: `bet-detail`,
  `group-detail` (covering the new comments/polls/proof/chat sections and their
  participant/member gating), `sign-in` (the new password path), `sign-up`,
  `delete-account`, `friends`, `currencies`, `balances`, `create`, and the three legal
  pages. All follow the existing pattern (mock hooks directly via `vi.mock`, per
  `require-admin.test.tsx`), not the supabase-mocking pattern `use-profile.test.tsx` uses —
  simpler for screen-level tests since these components each pull in 5-10 hooks.
  `design-system.tsx` and `profile.tsx` (the old unlinked placeholder) still have none, but
  neither is linked from the app.

**What's genuinely still missing** (not started at all):

- `design-system.tsx` — internal/dev-only on native, still lowest priority.
- Test coverage for `home`, `account`, `activity`, `groups`, `setup-profile`, `obligations`,
  `invite-preview`, `admin-reports`, `admin-report-detail`, `auth-callback`, and the three
  route guards other than `require-admin` — still untested. Not urgent (these are simpler
  screens than the ones just covered) but still a gap if a future session wants full
  coverage.
- `create.tsx`'s even-money-only simplification — still an open product question, not
  touched this session either.
- `web/` still isn't mentioned in `PROJECT_STATUS.md` / `IMPLEMENTATION_PLAN.md` — out of
  scope for this session (restricted to `web/` + this file).

**Not verified — same caveat, still unresolved, and now the clear #1 priority**: this
session's environment had no `web/.env` at all (not even the gitignored one with real
Supabase credentials the third session's handoff mentions), so there was no way to run the
dev server against live Supabase and click through anything — not even signing up a fresh
test account via the new email/password flow, which would otherwise have been the obvious
way to finally close this gap. `npm run typecheck`/`test`/`build` passing is necessary but
not sufficient, same as every prior handoff has said. If a future session has a real
`.env` and a browser, this is the highest-value thing to do: sign up (or sign in) →
setup-profile → home → create a bet against a friend → open it and post a comment, create
a poll, vote, upload a proof photo → open a group and send a chat message. All of that is
now code-complete and test-covered but has never rendered against a real backend.

**Suggested next steps for a fifth session, in order:**

1. If a real `web/.env` and a browser are both available, do the golden-path smoke test
   described just above before building anything else — it's been deferred across four
   sessions now purely for lack of credentials/a browser in the environment, not because
   it's hard.
2. Add test coverage for the remaining untested screens listed above (`home`, `account`,
   `activity`, `groups`, `setup-profile`, `obligations`, `invite-preview`, the two admin
   screens, `auth-callback`, and the three non-admin route guards) to close out coverage
   completely.
3. Revisit the `create.tsx` even-money-only simplification as a product decision.
4. Decide whether `web/` should get a section in `PROJECT_STATUS.md` / `IMPLEMENTATION_PLAN.md`.

## Status as of 2026-07-21 (third session)

Ran as an unattended scheduled session continuing from the second session's handoff.
`npm run typecheck`, `npm test`, and `npm run build` are all clean on `web-port` as of
commit `db05e6c` (4 test files, 13 tests — up from 3/10). Every `to="..."` link in
`web/src` was re-audited against `App.tsx`'s route table after adding routes; still no
dangling links.

**What got built this session** (see git log on `web-port`, each commit is
typecheck+test-verified on its own):

- `obligations.tsx` — manual obligation propose/approve/decline/cancel flow, ported from
  native `src/app/obligations.tsx` onto the existing `use-manual-obligations.ts` hook
  (previously unused). Linked from `friends.tsx` the same way the native app links to it.
  Mounted at `/obligations` behind `RequireProfile`.
- `invite-preview.tsx` — the `/invite/:username` preview screen, ported from native
  `src/app/invite/[username].tsx`. Reachable pre-auth (mounted ungated, alongside the
  legal pages) since that's the point of an invite link. Reuses `ReportDialog` for
  reporting the invited profile — this is the first place in `web/` that component gets
  used; it existed unused before this session. One deliberate deviation from native: native
  offers both "Create account" and "Sign in" buttons when signed out (linking to
  `/sign-up` and `/`); web only has a single OAuth-only sign-in screen at `/`, so the
  invite preview just links there. Worth revisiting if a real sign-up flow gets built.
- `require-admin.tsx`, `admin-reports.tsx`, `admin-report-detail.tsx` — the Milestone 13
  admin surface, ported from native's `(admin)` route group onto the existing
  `use-admin.ts` hook (previously unused). Report queue with status filter tabs
  (open/resolved/dismissed/all), and a detail view with evidence display plus
  remove-content/suspend-user/resolve/dismiss actions, each behind its own confirmation
  dialog. Mounted at `/admin` and `/admin/report/:reportId` behind a new `RequireAdmin`
  guard that mirrors native's client-side `is_admin()` check (UX only — every admin RPC
  and the `reports_select` RLS policy independently re-check server-side). Not linked from
  any nav menu, matching native, where it's reachable only by knowing the URL.
- A test for `RequireAdmin`'s three states (signed out, signed in but not admin, admin) —
  the first route-guard test in `web/`, styled after the existing `sign-in.test.tsx`.

**What's genuinely still missing** (not started at all):

- Comments, chat, and polls are still not integrated into `bet-detail.tsx` — the hooks
  (`use-comments`, `use-chat`, `use-polls`, `use-proof`) exist and are completely unused
  anywhere in `web/`. This is now the largest remaining gap.
- `(auth)/sign-up.tsx` — still no separate sign-up screen; still worth checking whether
  native's sign-up screen does anything OAuth-only sign-in doesn't already cover before
  building this.
- `design-system.tsx` — internal/dev-only on native, still lowest priority.
- Test coverage for the screens built in the second session (`bet-detail`, `group-detail`,
  `balances`, `currencies`, `friends`, `delete-account`, `create`, the legal pages) is
  still missing — only `RequireAdmin` got a test this session.
- `web/` still isn't mentioned in `PROJECT_STATUS.md` / `IMPLEMENTATION_PLAN.md`.
- `create.tsx`'s even-money-only simplification (see below, unchanged this session) —
  still an open product question, not touched.

**Not verified**: same caveat as the last handoff — nothing has been exercised in a real
browser against live Supabase. No browser was available in this session's environment to
smoke-test sign-in → setup-profile → home → create a bet → approve flow, or to click
through the three new screens (obligations, invite preview, admin). `npm run typecheck`,
`npm test`, and `npm run build` passing is necessary but not sufficient — this is the
single highest-priority thing for whoever picks this up next with a browser available.

## Status as of 2026-07-20 23:32 (second session)

Everything wired since the original handoff was written. Router now mounts every screen
that exists; every link in the app resolves to a real route (verified by grepping every
`to="..."` / `to={...}` in the codebase against `App.tsx`'s route table — no dangling
links left). `npm run typecheck` and `npm test` (3 files, 10 tests) are both clean on
the `web-port` branch as of commit `0f878fe`.

**What got built this session** (see git log on `web-port` for the individual commits,
each is typecheck+test-verified on its own):

- Fixed the `EmptyState`/`icon` typecheck errors (dropped the unsupported prop rather than
  building a web icon system for two call sites).
- Wired `home`, `activity`, `groups`, `account`, `setup-profile` into `App.tsx`, behind two
  new guard components (`require-profile.tsx`, `require-session-no-profile.tsx`) that
  mirror the native app's three-tier auth gate (no session → sign-in; session, no profile
  → setup-profile; session + profile → main app). Sign-in and the OAuth callback now land
  on `/home` instead of the legacy `/profile` placeholder.
- Built `bet-detail.tsx` — covers the core bet lifecycle (approve a pending version,
  propose/respond to cancellation, submit/confirm a result, disputes: judge ruling, group
  vote, random fallback) using the hooks already in `use-bets.ts`. **Does not** wire in
  comments, chat, polls, or proof uploads on a bet — those each have their own hook
  (`use-comments`, `use-chat`, `use-polls`, `use-proof`) but no UI anywhere yet.
- Built `group-detail.tsx` — member roster, owner-only remove, invite-by-username (reuses
  the friends search RPC), leave/archive.
- Built `balances.tsx` — net balances list, pending-redemption confirm/decline/cancel, and
  a "Settle up" button. **Simplification**: settle-up always redeems the _full_ outstanding
  amount with a counterparty in one shot; there's no UI to pick specific obligations or
  partially settle (the hook `useOutstandingObligations` + `Allocation[]` supports partial
  amounts, the UI just doesn't expose it yet). No "forgive obligation" UI either
  (`useForgiveObligation` exists, unused).
- Built `currencies.tsx` — built-in + personal currency list, create-your-own form. Only
  personal scope (`ownerUserId`); group-scoped currency browsing isn't wired anywhere.
- Built `friends.tsx` — username search, incoming/outgoing requests, friend list, block.
- Built `delete-account.tsx` — typed "DELETE" confirmation, matches the
  anonymize-not-delete model.
- Built `create.tsx` — **this is the biggest simplification, read carefully before
  trusting it as "done"**: it's a deliberately narrow MVP, not the native wizard. It only
  supports a single 1-on-1 opponent, two named sides, and **even-money (1:1 odds) for
  both participants** — there is no odds-editing UI at all. The native app's fuller wizard
  (uneven odds, multi-way/multi-participant bets, counteroffers, draft bets) is not
  ported. `useCreateOrCounterBet` itself supports all of that; only the web form is
  narrowed.
- Built the three legal pages (`privacy-policy.tsx`, `terms.tsx`, `community-guidelines.tsx`),
  reusing the exact copy from the native screens, mounted ungated (no auth required),
  matching the native app's own reasoning (store reviewers / signed-out visitors can read
  them).
- Fixed a real regression the web port itself caused: root `tsconfig.json` had no
  `exclude`, so root `tsc --noEmit` was sweeping up `web/src/**` too and resolving its
  `@/*` aliases against the wrong `src/` tree. Added `"exclude": ["node_modules", "web"]`
  to root `tsconfig.json` (committed to `web-port`, since it's a direct side effect of
  this branch's existence — but it touches a file outside `web/`, worth knowing if a
  future session is told to stay inside `web/` only).

**What's genuinely still missing** (not started at all):

- `admin/` — the whole Milestone 13 trust & safety report-queue surface (report list +
  report detail, remove content / suspend user / resolve / dismiss actions).
- `invite/[username]` — invite preview, reachable pre-auth on native.
- `obligations.tsx` — manual obligations (Milestone 10). `use-manual-obligations.ts`
  exists and is unused.
- `(auth)/sign-up.tsx` — only sign-in exists; there's no separate sign-up screen or flow
  distinction (OAuth-only sign-in may not need one — worth checking whether the native
  sign-up screen does anything OAuth doesn't already cover before building this).
- `design-system.tsx` — internal/dev-only on native, lowest priority, may not be worth
  porting.
- Comments, chat, and polls are not integrated into `bet-detail.tsx` at all — the hooks
  (`use-comments`, `use-chat`, `use-polls`, `use-proof`) exist and are completely unused
  anywhere in `web/`.

**Not verified**: nothing above has been exercised in a real browser against live
Supabase this session — `npm run typecheck` and `npm test` passing is necessary but not
sufficient. No new tests were added for any of the screens built this session (test count
is still 3 files / 10 tests, same as before — all pre-existing). If you have a browser
available, at minimum smoke-test: sign-in → setup-profile (new account) → home → creating
a bet against a friend → the bet detail screen's approve flow.

`profile.tsx` (the old placeholder screen, mounted at `/profile`) is still there,
unlinked from anywhere in the app, superseded by `account.tsx` + `home.tsx`. Left alone
rather than deleted — nothing depends on it, low risk either way.

## What this is (original, still accurate)

A standalone React + Vite + Capacitor port of the Expo/React Native app's screens, living
in `web/` at the repo root. Same Supabase backend as the native app (`noshot-dev`, ref
`tckpbwvzxxovnsvdtwee`), targeting browser + a Capacitor iOS wrapper (`web/ios/`) rather
than Expo. Not referenced anywhere in `IMPLEMENTATION_PLAN.md` or `PROJECT_STATUS.md` —
this was ad hoc work, not one of the numbered milestones. As of this session it lives on
its own branch, `web-port`, pushed to `origin/web-port` — not on `master`.

Stack: Vite 8, React 19, react-router 8, TanStack Query 5, Tailwind 4, Capacitor 8,
Vitest 4 + Testing Library. Fully standalone — no root workspace config references it;
`cd web && npm install` / `npm run dev` is all it needs. `web/.env` already has real
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` values filled in (gitignored).

## Unrelated changes that may still be sitting in the working tree

These were present in the working tree as uncommitted, unrelated changes when this
session started, and were deliberately left alone (not committed to `web-port`, not
touched):

1. **Root `package.json`/`package-lock.json`/`app.json`/`PROJECT_STATUS.md`** — from a
   native iOS device-testing session (2026-07-18), documented in
   `PROJECT_STATUS.md`'s "Native iOS testing session" section. Unrelated to the web port.
2. **`src/app/(admin)/*` → `src/app/admin/*` rename** — a bug fix for an infinite redirect
   loop on native, with its own explanatory comment in `src/app/_layout.tsx`'s diff.
   Unrelated to the web port.

If a fresh session is working from a plain `git clone` of `origin/web-port` rather than
continuing in the same local working tree, neither of these will be present at all —
they only matter if continuing locally in the original working directory.

## Suggested next steps, in order

1. If a browser is available, smoke-test the golden path end to end (see "Not verified"
   above) before building further — better to find something broken now than to keep
   building on top of it. This has been true across three sessions now and keeps getting
   deferred; it's the biggest source of risk in this whole branch.
2. Wire comments, chat, and polls into `bet-detail.tsx` — the hooks already exist
   (`use-comments`, `use-chat`, `use-polls`, `use-proof`) and are fully unused. This is now
   the largest remaining feature gap.
3. Consider whether `create.tsx`'s even-money-only simplification is acceptable long-term
   or needs the odds-editing UI — this is a product call, not just an engineering gap.
4. Add test coverage for the screens built in the second session (`bet-detail`,
   `group-detail`, `balances`, `currencies`, `friends`, `delete-account`, `create`, the
   legal pages) — only `sign-in`, `use-profile`, `oauth`, and (as of this session)
   `require-admin` have tests.
5. Decide whether `web/` should get its own section in `PROJECT_STATUS.md` /
   `IMPLEMENTATION_PLAN.md` — still undocumented there.
6. Check whether native's `(auth)/sign-up.tsx` does anything OAuth-only sign-in doesn't
   already cover; if not, `web/` doesn't need one either and this can be crossed off
   rather than built.
