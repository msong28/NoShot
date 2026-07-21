# Handoff: NoShot web port ("screenporting")

Written 2026-07-20 for whoever picks this up next (Codex). This was in progress as a
background task; nothing here has been committed, and no one has been told it's done.
This file is a snapshot, not a plan — verify anything below against the actual code
before relying on it, since it was reconstructed from the working tree rather than from
the original task's own notes.

## What this is

A standalone React + Vite + Capacitor port of the Expo/React Native app's screens, living
in `web/` at the repo root (currently untracked — `git status` shows it as `?? web/`).
Same Supabase backend as the native app (`noshot-dev`, ref `tckpbwvzxxovnsvdtwee`),
targeting browser + a Capacitor iOS wrapper (`web/ios/`) rather than Expo. Not referenced
anywhere in `IMPLEMENTATION_PLAN.md` or `PROJECT_STATUS.md` — this was ad hoc work, not
one of the numbered milestones.

Stack: Vite 8, React 19, react-router 8, TanStack Query 5, Tailwind 4, Capacitor 8,
Vitest 4 + Testing Library. Fully standalone — no root workspace config references it;
`cd web && npm install` / `npm run dev` is all it needs. `web/.env` already has real
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` values filled in (gitignored, so it won't
show in diffs — confirmed present, not just `.env.example`).

Confirmed working right now:
- `npm run dev` boots cleanly on Vite, serves HTTP 200.
- `npm test` (Vitest): 3 files, 10 tests, all passing.
- `npm run typecheck`: **2 errors**, both in `src/routes/home.tsx` (see below).

## Immediate bugs to fix first

1. **`EmptyState` prop mismatch** — `src/components/ui/empty-state.tsx` only accepts
   `{ title, description }`, but `src/routes/home.tsx` calls it twice (lines ~101, ~132)
   with an extra `icon="bet"` / `icon="groups"` prop that doesn't exist on the component.
   Either add an `icon` prop to `EmptyState` (the native app's version at
   `src/components/ui/empty-state.tsx` in the root Expo app takes one — check there for
   the icon set/behavior to mirror) or drop the prop from the two call sites. This is the
   entire typecheck failure right now — fixing it gets `npm run typecheck` to clean.

2. **Router is way behind the screens that already exist.** `web/src/App.tsx` only
   mounts three routes: `/` (sign-in), `/auth/callback`, and `/profile`. But
   `web/src/routes/` already has finished-looking files for `home.tsx`, `activity.tsx`,
   `account.tsx`, `groups.tsx`, and `setup-profile.tsx` that aren't wired into the
   `<Routes>` table at all — they're dead code until someone adds the `<Route>` entries
   (and presumably a shared layout, since `BottomNav` expects `/home`, `/groups`,
   `/activity`, `/account` to all exist as siblings under it).

## Screens ported vs. not yet started

Ported (file exists in `web/src/routes/`): sign-in, auth-callback, home, activity,
account, groups (list only), profile, setup-profile, protected-route.

**Not started** — these exist as native screens under `src/app/` (root Expo app) but have
no web equivalent yet:
- `bet/[betId]` — bet detail. Linked to from `home.tsx` and `groups.tsx` already
  (`/bet/:id`), so those links currently 404.
- `group/[groupId]` — group detail. Same story, linked from `home.tsx`/`groups.tsx`
  already (`/group/:id`).
- `admin/` (report queue `admin/index.tsx` + `admin/report/[reportId].tsx`) — the whole
  Milestone 13 trust & safety admin surface.
- `create.tsx` — new bet/poll creation. `bottom-nav.tsx`'s `+` button already navigates
  to `/create`.
- `balances.tsx` — linked from `home.tsx` (`/balances`) already.
- `currencies.tsx` — linked from `home.tsx` (`/currencies`) already.
- `friends.tsx` — linked from `home.tsx` (`/friends`) already.
- `delete-account.tsx` — linked from `account.tsx` (`/delete-account`) already.
- `invite/[username].tsx` — invite preview (reachable pre-auth in the native app; see the
  comment left in `src/app/_layout.tsx` about FR-04).
- `obligations.tsx` — manual obligations (Milestone 10).
- Legal pages: `community-guidelines.tsx`, `privacy-policy.tsx`, `terms.tsx` — all three
  linked from `account.tsx` already (`/privacy-policy`, `/terms`,
  `/community-guidelines`).
- `(auth)/sign-up.tsx` — only sign-in exists on web so far, no sign-up screen.
- `design-system.tsx` — internal/dev-only in the native app; lowest priority, may not be
  worth porting at all.

So every link currently in the ported screens that points somewhere unbuilt (`/bet/:id`,
`/group/:id`, `/create`, `/balances`, `/currencies`, `/friends`, `/delete-account`,
`/privacy-policy`, `/terms`, `/community-guidelines`) will 404 until that route exists —
these are the natural next screens to build, roughly in the order the links already
demand them.

Hooks/lib layer looks further along than the routes layer: `web/src/hooks/` already has
`use-admin`, `use-bets`, `use-chat`, `use-comments`, `use-currencies`, `use-friends`,
`use-groups`, `use-ledger`, `use-manual-obligations`, `use-polls`, `use-proof`,
`use-redemption`, `use-reports` — i.e., the data layer for most of the unbuilt screens
above may already exist and just need a screen wired on top, not new Supabase queries
from scratch. Worth checking each hook before assuming a screen needs backend work too.

## Unrelated changes currently sitting in the same working tree

Three unrelated pieces of uncommitted work are mixed into `git status` right now — don't
let them get swept into a web-port commit by accident:

1. **Root `package.json`/`package-lock.json`/`app.json`/`PROJECT_STATUS.md`** — from a
   native iOS device-testing session (2026-07-18), documented in detail in
   `PROJECT_STATUS.md`'s "Native iOS testing session" section. Unrelated to the web port.
2. **Staged rename** `src/app/(admin)/*` → `src/app/admin/*` — a bug fix for an infinite
   redirect loop (a parenthesized route group's `index.tsx` was colliding with
   `(tabs)/index.tsx` on `/`). Already staged, has its own explanatory comment in the
   diff of `src/app/_layout.tsx`. Also unrelated to the web port, but touches the native
   app's `admin` naming — if the web port's own `admin/` routes get built, no naming
   collision risk since they live in a completely separate `web/` tree.
3. The web port itself (`web/`, untracked) — the actual subject of this handoff.

## Suggested next steps, in order

1. Fix the two `EmptyState`/`icon` typecheck errors in `home.tsx` (trivial).
2. Wire the five already-built-but-unmounted routes (`home`, `activity`, `account`,
   `groups`, `setup-profile`) into `App.tsx`, likely behind a shared layout that renders
   `BottomNav`.
3. Build the linked-but-missing screens in the order the existing links demand them —
   `bet/[betId]` and `group/[groupId]` first (linked from the most places), then
   `create`, `balances`, `currencies`, `friends`, `delete-account`, the three legal pages.
4. Decide whether `web/` should get its own section in `PROJECT_STATUS.md` /
   `IMPLEMENTATION_PLAN.md` once it's further along — right now it's undocumented there.
