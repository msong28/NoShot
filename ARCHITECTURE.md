# NoShot — Architecture

Status: Milestones 0 (repo & tooling foundation) and 1 (Supabase bootstrap + email/password auth) implemented; Milestone 2+ not yet started. This document describes the target architecture for the MVP described in `NoShot_PRD.docx`. It will be revised as milestones complete; material changes should be logged in `DECISIONS.md`.

## 1. Confirmed baseline (audited 2026-07-14, updated after Milestone 1)

| Layer                 | Version                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Expo SDK              | 57.0.4                                                                                    |
| Expo Router           | 57.0.4                                                                                    |
| React Native          | 0.86.0 (New Architecture only — there is no old-architecture fallback in this RN version) |
| React                 | 19.2.3                                                                                    |
| TypeScript            | 6.0.3                                                                                     |
| Reanimated / Worklets | 4.5.0 / 0.10.0                                                                            |
| Package manager       | npm                                                                                       |
| `expo-doctor`         | 20/20 checks passed                                                                       |

The project started as the stock `create-expo-app` template: a single Expo Router app under `src/app`, path-aliased via `@/*`, with `typedRoutes` and `reactCompiler` experiments on, and a hand-rolled `ThemedText`/`ThemedView` token system (`src/constants/theme.ts`). As of Milestone 0: the tab bar now uses a cross-platform `expo-router/ui`-based component (`src/components/app-tabs.tsx`, see §3) instead of the original `NativeTabs`; Jest + RNTL, ESLint + Prettier, and a GitHub Actions CI workflow are in place; a `src/components/ui` primitive set (`Button`, `Card`, `Badge`, `TextField`) exists. As of Milestone 1: a real linked Supabase project (`noshot-dev`) exists with a `profiles` migration + RLS deployed; `src/lib/supabase.ts` wires up the client (secure session storage per §5); email/password sign-up/sign-in/sign-out and a minimal profile-setup screen work end-to-end, gated by `Stack.Protected`-based routing (see §3 sibling doc updates as they land). No CI runs yet (no remote pushed).

## 2. One-codebase principle

Per project instructions, one Expo Router app serves iOS, Android, and responsive web. There is no separate admin package or monorepo split. The admin surface (Section 7) is a route group in the same app, gated by a server-verified claim, and is expected to primarily be used from web.

## 3. Navigation

**Done (Milestone 0):** replaced `NativeTabs` (`expo-router/unstable-native-tabs`) with a headless, cross-platform tab bar built on `expo-router/ui` (`Tabs`/`TabList`/`TabTrigger`/`TabSlot`) — see `src/components/app-tabs.tsx`. Rationale and verification notes in `DECISIONS.md`. IA, per PRD §7.1:

- Home — net position summary, pending approvals, recent activity
- Groups — group list with per-currency net indicators
- Add — not a persistent screen; opens the bet/manual-obligation creation flow as a modal/stack route
- Activity — invites, approvals, results, disputes, settlements, moderation notices
- Account — profile, blocked users, privacy, delete account, sign out

Balances are surfaced inline (Home, Friend detail, Group detail), not as their own tab, matching the PRD.

## 4. Styling

**Decision:** keep and extend the existing token-based system (`ThemedText`, `ThemedView`, `src/constants/theme.ts`) rather than introducing NativeWind. It already works across platforms, avoids an extra dependency and a Tailwind-class rewrite of the scaffold, and the PRD explicitly allows "NativeWind or a small token-based styling layer." We'll grow it with: a black-base / vibrant-accent palette, per-currency-category color+icon mapping, a shared primitive library (`Button`, `Card`, `Badge`, `Avatar`, `StatusPill`, `AmountDisplay`), and Reanimated-based motion primitives. Revisit only if the token system becomes a bottleneck.

## 5. Client data layer

- `@supabase/supabase-js` for auth, Postgres access, Storage, and Realtime.
- `@tanstack/react-query` on top of it for caching, mutation state, and optimistic UI around Supabase queries and RPC calls.
- Session persistence via `expo-secure-store` (native) / an equivalent secure web strategy — no tokens in plain AsyncStorage.
- A typed RPC client wrapper so every privileged mutation (see §6) has a typed TS function instead of ad hoc `.rpc('name', {...})` calls scattered through the UI.

## 6. Server authority model

This is the load-bearing rule from the project instructions: **authoritative results, payouts, obligations, and ledger mutations are never controlled exclusively by the client.**

- **RPC-only tables** (no direct client INSERT/UPDATE, enforced by RLS denying those and only `SECURITY DEFINER` functions permitted): `bet_versions`, `bet_approvals`, `bet_result_submissions`, `bet_result_confirmations`, `dispute_resolutions`, `ledger_entries`, `obligation_allocations`, `manual_obligation_proposals` (approval step), `redemption_requests`, `moderation_actions`, `audit_events`.
- **Direct-insert, RLS-governed tables** (no state-machine or money implication): `comments`, `chat_messages`, `polls`/`poll_options`/`poll_votes`, `proof_assets` metadata (upload itself goes through Storage policies), `reports`, friend/group invitations at the request (not approval-finalizing) step.
- Every `SECURITY DEFINER` function: sets `search_path`, validates `auth.uid()` against the acting party, validates current state/version (optimistic-concurrency style — stale version is rejected, not silently reapplied), and has `REVOKE ALL ... FROM PUBLIC` followed by an explicit `GRANT EXECUTE ... TO authenticated`.
- Admin status lives in a dedicated table (e.g. `admin_users`) checked server-side — never inferred from email or a client-supplied flag.
- Storage buckets are private; access is via signed URLs whose issuance is itself gated by the same authorization checks as the owning bet/group.

## 7. Admin surface

A route group (e.g. `src/app/(admin)/`) in the same app, intended for web use, gated by an `is_admin` check performed server-side (RLS + RPC), not a client-side flag. No separate deployable app unless the admin surface later proves it needs independent release cadence or a different data-access shape.

## 8. Backend/Postgres structure

- `supabase/migrations/*.sql` — deterministic, timestamp-ordered, one concern per migration (extensions/enums → tables → RLS → functions → seed-safe grants).
- `supabase/seed.sql` — local-dev-only demo data (never run against a real/prod project).
- Default-deny RLS on every table from the first migration that creates it — a table is never created without a same-migration policy set.
- Ledger is append-only: a trigger rejects `UPDATE`/`DELETE` on `ledger_entries` and `audit_events`; corrections are new rows (reversals), never edits.

## 9. Moderation

**Decision:** ship MVP with a self-hosted, deterministic tiered keyword/pattern filter (hard-block / warn+queue / permit, per PRD §10.2) implemented once and called from both a client-side pre-submit check (fast UX feedback) and a server-side authoritative gate (the actual enforcement — client check is advisory only). This avoids requiring a paid ML moderation account before MVP. The interface is written so a real moderation API (OpenAI moderation, Perspective, AWS Comprehend, etc.) can be substituted behind the same function signature later without touching call sites. Tracked as an open risk in `DECISIONS.md` (#2) — regex/keyword filtering is weaker than ML and will need revisiting before wide release.

## 10. Analytics & error monitoring

Both are adapter interfaces (`src/services/analytics`, `src/services/monitoring`) with a no-op/local default, matching the PRD's "no-op local implementations" delivery requirement:

- Analytics: first-party `analytics_events` Postgres table + adapter, not a third-party SaaS, so no external account is required to start collecting the PRD §12 event list. A SaaS adapter can be swapped in later behind the same interface.
- Monitoring: no-op by default; a Sentry (or similar) adapter is added once the user provisions an account and supplies a DSN.

## 11. Testing strategy

| Layer                                                          | Tool                                                                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (odds/payout math, balance aggregation, allocation logic) | Jest + `jest-expo`                                                                                                                          |
| Component                                                      | Jest + React Native Testing Library                                                                                                         |
| DB/RLS/RPC integration                                         | Scripted tests against a local `supabase start` instance (pgTAP and/or supabase-js-driven scripts asserting unauthorized reads/writes fail) |
| Web e2e                                                        | Playwright                                                                                                                                  |
| Native e2e (iOS/Android)                                       | Maestro (chosen over Detox — no native rebuild cycle required, works against Expo dev/preview builds)                                       |
| CI                                                             | GitHub Actions: lint, typecheck, unit tests, migration-apply + RLS test job on every PR; e2e as a separate, slower job                      |

## 12. What still requires external accounts/credentials

See `IMPLEMENTATION_PLAN.md` and `DECISIONS.md` for the milestone-by-milestone breakdown. Summary: Supabase project, Google Cloud OAuth clients, Apple Developer Program + Sign in with Apple config, Expo/EAS account (build/submit phase), App Store Connect + Google Play Console (submission phase), optionally a domain (deep-link universal/app links), optionally Sentry and/or an analytics SaaS, and legal counsel for final ToS/Privacy Policy/Community Guidelines text.
