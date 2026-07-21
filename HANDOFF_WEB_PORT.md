# Handoff: NoShot web port ("screenporting")

Originally written 2026-07-20; updated the same night after a second work session. This
file is a snapshot, not a plan — verify anything below against the actual code before
relying on it. **Trust this "Status as of" section over anything below it that contradicts
it** — the sections further down are historical and partly stale now.

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
   building on top of it.
2. `admin/` is the largest remaining gap tied to an already-shipped milestone
   (Milestone 13) — probably the highest-value next build.
3. `obligations.tsx` and `invite/[username]` are the other two fully-unstarted screens.
4. Consider whether `create.tsx`'s even-money-only simplification is acceptable long-term
   or needs the odds-editing UI — this is a product call, not just an engineering gap.
5. Add test coverage for the screens built this session — right now only the three
   pre-existing test files exist.
6. Decide whether `web/` should get its own section in `PROJECT_STATUS.md` /
   `IMPLEMENTATION_PLAN.md` — still undocumented there.
