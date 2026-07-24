# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Two apps, one Supabase backend

This repo contains **two independent frontends against the same Supabase project** (`noshot-dev`, ref `tckpbwvzxxovnsvdtwee`):

- **Root (`src/`)** — the original Expo Router / React Native app (iOS, Android, and Expo-web). Path-aliased via `@/*` → `src/*`.
- **`web/`** — a separate React + Vite + `react-router` (not Expo Router) SPA, wrapped for iOS distribution via Capacitor, deployed to Cloudflare (see `web/wrangler.toml`, `not_found_handling = "single-page-application"`). It has its own `package.json`, `node_modules`, `tsconfig.json`, and test runner (Vitest, not Jest). Path-aliased via `@/*` → `web/src/*`.

The two share almost identical domain logic (`src/lib/*.ts` vs `web/src/lib/*.ts`, `src/hooks/use-*.ts` vs `web/src/hooks/use-*.ts`) but are **not** code-shared — a fix to a bug in one usually needs the same fix ported to the other by hand. When working on a feature, check whether the equivalent file exists in both trees.

Root `.env` uses `EXPO_PUBLIC_*` var names; `web/.env` uses `VITE_*` names for the same underlying values. Never put the Supabase service-role key in either — only the anon key belongs client-side (RLS enforces authorization, not key secrecy).

`ARCHITECTURE.md`'s "one-codebase principle" (single Expo Router app for iOS/Android/web) describes the **root app's** target shape and predates the `web/` port — treat `HANDOFF_WEB_PORT.md` as the authoritative, up-to-date status doc for `web/` instead.

## Commands

Root app (run from repo root):
```
npm run start         # expo start
npm run ios / android / web
npm run lint          # expo lint
npm run typecheck     # tsc --noEmit
npm test              # jest
npm test -- <path>    # run a single test file
npm run test:watch
npm run test:db       # spins up a throwaway local Postgres, applies supabase/migrations/*, runs supabase/tests/*.sql
npm run format / format:check
```

Web app (run from `web/`):
```
npm run dev           # vite dev server
npm run build         # vite build
npm run typecheck     # tsc --noEmit
npm test              # vitest run
npm run test:watch    # vitest
npm run cap:sync      # build + npx cap sync ios
npm run cap:open:ios
```

CI (`.github/workflows/ci.yml`) only runs the **root** app's `format:check`, `lint`, `typecheck`, `test`, and `test:db` — it does not currently build or test `web/`. When changing `web/`, run its checks locally.

`npm run test:db` needs `initdb`/`postgres`/`psql` on `PATH` (e.g. `brew install postgresql@17`); it does not use Docker or `supabase start`. It builds a minimal stand-in for the Supabase-managed parts of the schema (`auth.users`, `anon`/`authenticated` roles, `auth.uid()`) before applying migrations, so pure-Postgres SQL logic can be tested without a running Supabase instance.

## Server authority model (applies to both frontends)

This is the load-bearing rule for any change touching bets, money, or moderation: **authoritative results, payouts, obligations, and ledger mutations are never controlled exclusively by the client.**

- Tables like `bet_versions`, `bet_approvals`, `bet_result_submissions`/`confirmations`, `dispute_resolutions`, `ledger_entries`, `obligation_allocations`, `redemption_requests`, `moderation_actions`, `audit_events` have RLS that denies direct client INSERT/UPDATE — all writes go through `SECURITY DEFINER` RPC functions.
- Every such function validates `auth.uid()` against the acting party, checks current state/version (stale-version writes are rejected, not silently reapplied), sets `search_path`, and does `REVOKE ALL ... FROM PUBLIC` + explicit `GRANT EXECUTE ... TO authenticated`.
- `ledger_entries` and `audit_events` are append-only (a trigger rejects `UPDATE`/`DELETE`); corrections are new reversal rows.
- Admin status (`admin_users` table) and moderation state are always checked server-side — never inferred from a client-supplied flag or email.
- Storage (proof photos) is private; access is via signed URLs gated by the same authorization checks as the owning bet/group.
- Content moderation is a deterministic keyword/pattern filter (`src/lib/moderation.ts` / `web/src/lib/moderation.ts`) applied client-side for fast UX feedback **and** server-side as the actual enforcement gate — the client check is advisory only, never trust it alone.

Any new mutation that touches money, bet state, or moderation should follow this pattern; treat a direct client write to one of the RPC-only tables as a bug.

## Backend structure (`supabase/`)

- `supabase/migrations/*.sql` — timestamp-ordered, one concern per migration (extensions/enums → tables → RLS → functions → grants). Default-deny RLS is added in the *same* migration that creates a table — never add a table without a policy set alongside it.
- `supabase/tests/*.sql` — one test file per migration/feature area, run via `npm run test:db`.
- `supabase/seed.sql` — local-dev-only demo data, never run against a real project.
- `supabase/functions/send-push/` — the one Edge Function (push notifications via OneSignal); the OneSignal REST key lives only in the function's own secrets, never in client env files.

## Key docs to check before large changes

- `HANDOFF_WEB_PORT.md` — running, dated log of `web/`'s status; each session appends rather than rewrites, and explicitly says to trust the top-most "Status as of" section over older ones below it if they conflict.
- `ARCHITECTURE.md` — target architecture for the root app (navigation IA, styling approach, data layer, server authority model, admin surface, testing strategy).
- `DECISIONS.md` — open items needing sign-off, store/legal risks, and a decided-and-why log; check before revisiting something that looks like it was already decided.
- `PROJECT_STATUS.md` / `IMPLEMENTATION_PLAN.md` — milestone tracking for the root app; not currently updated for `web/` work.

## Expo version note

Expo has changed significantly across versions — read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing Expo code (this repo pins Expo SDK 57 / React Native 0.86 new-architecture-only / React 19.2 / TypeScript 6).
