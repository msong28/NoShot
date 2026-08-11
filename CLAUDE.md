# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Two apps, one Supabase backend

This repo contains **two independent frontends against the same Supabase project** (`noshot-dev`, ref `tckpbwvzxxovnsvdtwee`):

- **Root (`src/`)** — the original Expo Router / React Native app (iOS, Android, and Expo-web). Path-aliased via `@/*` → `src/*`.
- **`web/`** — a separate React + Vite + `react-router` (not Expo Router) SPA, wrapped for iOS distribution via Capacitor, deployed to Cloudflare (see `web/wrangler.toml`, `not_found_handling = "single-page-application"`). It has its own `package.json`, `node_modules`, `tsconfig.json`, and test runner (Vitest, not Jest). Path-aliased via `@/*` → `web/src/*`.

The two share the same domain logic _shape_ (`src/lib/*.ts` vs `web/src/lib/*.ts`, `src/hooks/use-*.ts` vs `web/src/hooks/use-*.ts`) but are **not** code-shared — a fix to a bug in one usually needs the same fix ported to the other by hand. Before editing, check whether the equivalent file exists in both trees; increasingly it does not.

**`web/` is where active development happens and the trees have measurably diverged.** `src/` has not been touched since 2026-07-22 (`c81aa05`); every commit since then is `web/`-only. Features that exist only in `web/`:

- the wager/create-a-bet flow (`web/src/lib/wager.ts`, `web/src/hooks/use-wager.ts`, `web/src/routes/my-wagers.tsx`) plus the two-screen Splitwise-style creation flow — `/create` = `routes/create-pick-rival.tsx` (single-select rival picker), `/create/:rivalId` = `routes/create-bet-details.tsx` (event, stake, optional modifiers behind a "More betting options" toggle) — **no root-tree equivalent at all**
- a `/home` dashboard screen, bet-accept / settle reveal animations (`web/src/components/ui/confirm-reveal.tsx`, `settle-reveal.tsx`)
- route guards (`protected-route`, `require-admin`, `require-profile`, `require-session-no-profile`) — no file-route equivalent on the root side

So "port the fix to the other tree" is the default assumption, but verify the counterpart exists first rather than inventing one.

Root `.env` uses `EXPO_PUBLIC_*` var names; `web/.env` uses `VITE_*` names for the same underlying values (plus native-only `VITE_GOOGLE_*_CLIENT_ID` and `VITE_ONESIGNAL_APP_ID`). See both `.env.example` files. Never put the Supabase service-role key in either — only the anon key belongs client-side (RLS enforces authorization, not key secrecy).

`ARCHITECTURE.md`'s "one-codebase principle" (single Expo Router app for iOS/Android/web) describes the **root app's** target shape and predates the `web/` port. `HANDOFF_WEB_PORT.md` is the narrative status log for `web/`, but its newest dated section lags the actual code — read it for context, then trust `git log` and the code itself.

## Frontend data layer (same convention in both trees)

- **Data access is React Query on top of typed hooks.** Every domain area has a `hooks/use-*.ts` (e.g. `use-bets`, `use-groups`, `use-ledger`, `use-proof`, `use-polls`) that wraps the Supabase client — reads as `useQuery`, mutations as `useMutation` calling the `SECURITY DEFINER` RPCs described under "Server authority model." Components don't call `supabase.from(...)` directly; go through (or add) a hook.
- **Routing differs.** Root uses **expo-router** file-based routes under `src/app/` (`(auth)`, `(tabs)`, `bet/`, `group/`, `admin/`, `invite/`). Web declares every route explicitly in `web/src/App.tsx`, one module per screen under `web/src/routes/`, with guard components as layout routes wrapping groups of children.
- Session/auth flows through `use-session`; admin gating uses `use-admin` (server-checked, per the authority model — never a client flag).
- **`useSession()` starts every fresh mount at `session === null` for one tick** before `getSession()` resolves, and this has already caused real bugs: any hook fed `session?.user.id` (e.g. `useFriends(userId)`) briefly looks like "loaded, and the answer is empty." Never let a redirect/bounce-back guard fire on that state — gate it on `!!userId` (and the query's own loading flag) as `create-bet-details.tsx:61` does, or use `isLoading`.
- **Exception to "everything goes through a hook + RPC": genuinely device-local, non-authoritative UI state.** `use-custom-bet-templates.ts` keeps the user's saved bet titles in `localStorage` keyed per user id, deliberately unsynced. That's the bar for skipping the server — a personal quick-fill convenience, never bet state, money, or moderation.

## Styling: two implementations of one token set

Both trees implement the same design system (`design_handoff_noshot 2/README.md`, "Splitwise clarity + Partiful energy"; see also `DESIGN_SYSTEM.md`) with the same **new-semantic-tokens + legacy-aliases** pattern, so old class/style names keep resolving after a re-skin:

- **Root**: `src/constants/theme.ts` (plus `typography.ts`, `shadows.ts`, `motion.ts`, `breakpoints.ts`, `component-variants.ts`) consumed via `StyleSheet`; theme state in `src/providers/theme-provider.tsx` (persisted through AsyncStorage) + `use-theme` / `use-color-scheme`.
- **Web**: Tailwind v4 (`@tailwindcss/vite`, no config file) with tokens declared as CSS custom properties in `web/src/styles/index.css`; theme state in `use-theme-mode`.

Animation is web-only and uses `motion` (`motion/react`), not Reanimated: `components/ui/sheet.tsx` (the shared full-height bottom-sheet chrome behind the create flow's recent-bets and currency pickers), `confirm-reveal.tsx`, `settle-reveal.tsx`, `onboarding-carousel.tsx`. Anything that animates on unmount must be wrapped in `AnimatePresence` — a plain `visible ? … : null` only animates the mount.

Source-of-truth token names are the README's (`bg`, `ink`, `grape`, `lime`, `up`, `down`, `gold`, `surface`, `line`, …); legacy names (`background`, `primary`, `success`, `danger`, …) are aliases onto them. **Dark mode is a token swap only** — one set of values per mode, never duplicated component styles. Web's dark variant is attribute-driven: `@custom-variant dark (&:where([data-theme='dark'], …))`, so `data-theme` on the root element is what flips it, not `prefers-color-scheme` alone.

## Capacitor: `web/` runs in two environments

`web/` is both a browser SPA and a native iOS app, so several modules branch on `Capacitor.isNativePlatform()`: `lib/auth/oauth.ts` and `lib/auth/deep-link.ts` (native Google/Apple sign-in via `@capgo/capacitor-social-login` vs browser OAuth redirect), `lib/native-photo.ts` (`@capacitor/camera` vs `<input type="file">`), `lib/push/onesignal.ts` (native-only), `lib/invite-link.ts`, `routes/auth-callback.tsx`, `routes/bet-detail.tsx`. When touching auth, photos, push, or links, handle **both** paths — the browser path is the one the dev server exercises, so native regressions are easy to miss.

## Commands

Root app (run from repo root):

```
npm run start         # expo start
npm run ios / android / web
npm run lint          # expo lint
npm run typecheck     # tsc --noEmit (tsconfig excludes web/)
npm test              # jest
npm test -- <path>    # single test file
npm run test:watch
npm run test:db       # throwaway local Postgres, applies supabase/migrations/*, runs supabase/tests/*.sql
npm run format / format:check
```

Web app (run from `web/`):

```
npm run dev           # vite dev server
npm run build         # vite build
npm run typecheck     # tsc --noEmit
npm test              # vitest run
npm test -- <path>    # single test file
npm run test:watch
npm run cap:sync      # build + npx cap sync ios
npm run cap:open:ios
```

CI (`.github/workflows/ci.yml`) runs only root scripts: `format:check`, `lint`, `typecheck`, `test`, `test:db`. It never builds or tests `web/` — run `web/`'s own checks locally when you change it.

**But root `format:check` does cover `web/`**: it is `prettier --check .` from the repo root, and `.prettierignore` excludes only build/vendor dirs (`node_modules/`, `.expo/`, `dist/`, `web-build/`, `ios/`, `android/`, `package-lock.json`, `supabase/.temp|.branches`) — not `web/src`. `web/`'s `package.json` has no format script, so web files are easy to leave unformatted and thereby fail root CI. After editing `web/`, run `npm run format` (or `npx prettier --write web/src/...`) from the repo root. Likewise root `lint`/`typecheck` do **not** cover `web/` — its tsconfig `include`s only `src`, `vite.config.ts`, `capacitor.config.ts`, and there is no ESLint setup under `web/` at all.

`npm run test:db` needs `initdb`/`postgres`/`psql` on `PATH` (e.g. `brew install postgresql@17`); it does not use Docker or `supabase start`. It builds a minimal stand-in for the Supabase-managed parts of the schema (`auth.users`, `anon`/`authenticated` roles, `auth.uid()`) before applying migrations, so pure-Postgres SQL logic can be tested without a running Supabase instance.

## Testing conventions

- **SQL is the primary test surface** — `supabase/tests/*.sql`, one file per migration/feature area, and it's the most thoroughly covered layer. Any change to an RPC or RLS policy should come with (or update) a test here.
- **`web/`** has meaningful frontend coverage: Vitest + jsdom + `@testing-library/react`, globals enabled, setup in `web/src/test/setup.ts`, tests colocated as `*.test.ts(x)` beside the module. Route-level tests (`routes/*.test.tsx`) rendering a screen with mocked hooks are the established pattern — follow it for new screens.
- **jsdom is structurally blind to a whole class of web bugs**: overlays/sticky bars swallowing taps (no layout or hit-testing), animation and `AnimatePresence` timing, and anything Capacitor-native. A green Vitest run is not evidence the screen works — the create-flow bugs in `facbd6f` were both found by clicking through a real browser against live Supabase, not by tests.
- **Root** has only a couple of component tests (`src/components/**/*.test.tsx`) using `jest-expo` and the shared helper `src/test/render.tsx`. Jest's `moduleNameMapper` handles `@/`, CSS, and AsyncStorage mocking (`jest.config.js`) — new native tests generally need nothing extra.

## Server authority model (applies to both frontends)

This is the load-bearing rule for any change touching bets, money, or moderation: **authoritative results, payouts, obligations, and ledger mutations are never controlled exclusively by the client.**

- Tables like `bet_versions`, `bet_approvals`, `bet_result_submissions`/`confirmations`, `dispute_resolutions`, `ledger_entries`, `obligation_allocations`, `redemption_requests`, `moderation_actions`, `audit_events` have RLS that denies direct client INSERT/UPDATE — all writes go through `SECURITY DEFINER` RPC functions.
- Every such function validates `auth.uid()` against the acting party, checks current state/version (stale-version writes are rejected, not silently reapplied), sets `search_path`, and does `REVOKE ALL ... FROM PUBLIC` + explicit `GRANT EXECUTE ... TO authenticated`.
- `ledger_entries` and `audit_events` are append-only (a trigger rejects `UPDATE`/`DELETE`); corrections are new reversal rows.
- Admin status (`admin_users` table) and moderation state are always checked server-side — never inferred from a client-supplied flag or email.
- Storage (proof photos) is private; access is via signed URLs gated by the same authorization checks as the owning bet/group.
- Content moderation is a deterministic keyword/pattern filter (`src/lib/moderation.ts` / `web/src/lib/moderation.ts`) applied client-side for fast UX feedback **and** server-side as the actual enforcement gate — the client check is advisory only, never trust it alone.
- Mutation rate limits are enforced in SQL too (`20260723120000_mutation_rate_limits.sql`, `20260723140000_additional_rate_limits.sql`, `20260723150000_proof_storage_rate_limit.sql`) — new mutating RPCs should consider whether they need a limit.

Any new mutation that touches money, bet state, or moderation should follow this pattern; treat a direct client write to one of the RPC-only tables as a bug.

## Backend structure (`supabase/`)

- `supabase/migrations/*.sql` — timestamp-ordered, one concern per migration (extensions/enums → tables → RLS → functions → grants). Default-deny RLS is added in the _same_ migration that creates a table — never add a table without a policy set alongside it.
- `supabase/tests/*.sql` — one test file per migration/feature area, run via `npm run test:db`.
- `supabase/seed.sql` — local-dev-only demo data, never run against a real project.
- `supabase/functions/send-push/` — the one Edge Function (push notifications via OneSignal); the OneSignal REST key lives only in the function's own secrets, never in client env files.

**Migrations in this repo are not automatically applied to the live `noshot-dev` project.** Live schema has drifted from `supabase/migrations/` before, and that drift is the usual cause of "works against local Postgres / passes `test:db`, broken in the deployed app" bugs. When a symptom looks like a missing function, column, or grant, check whether the relevant migration was ever applied live before debugging the frontend.

## Key docs to check before large changes

- `HANDOFF_WEB_PORT.md` — dated log of `web/`'s status; each session appends rather than rewrites. Trust the top-most "Status as of" section over older ones, and `git log` over all of them.
- `ARCHITECTURE.md` — target architecture for the root app (navigation IA, styling approach, data layer, server authority model, admin surface, testing strategy).
- `DESIGN_SYSTEM.md` + `design_handoff_noshot 2/README.md` — token definitions and component specs both trees implement.
- `DECISIONS.md` — open items needing sign-off, store/legal risks, and a decided-and-why log; check before revisiting something that looks already decided.
- `PROJECT_STATUS.md` / `IMPLEMENTATION_PLAN.md` / `UI_IMPLEMENTATION_PLAN.md` — milestone tracking for the root app; not updated for `web/` work.
- `README.md` is unmodified `create-expo-app` boilerplate — no project-specific information.

## Expo version note

Expo has changed significantly across versions — read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing Expo code (this repo pins Expo SDK 57 / React Native 0.86 new-architecture-only / React 19.2 / TypeScript 6).
