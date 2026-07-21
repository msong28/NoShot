# Handoff: NoShot web port ("screenporting")

Originally written 2026-07-20; updated after a second work session that night, and again
after a third session the next day. This file is a snapshot, not a plan — verify anything
below against the actual code before relying on it. **Trust this "Status as of" section
over anything below it that contradicts it** — the sections further down are historical
and partly stale now.

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
  a "Settle up" button. **Simplification**: settle-up always redeems the *full* outstanding
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
