# NoShot — Implementation Plan

Source of truth: `NoShot_PRD.docx`. Architecture: `ARCHITECTURE.md`. Open/resolved technical decisions: `DECISIONS.md`. Current state: `PROJECT_STATUS.md` (update both this file and that one after every milestone).

Rule for all milestones: complete and test one before starting the next. Each milestone below lists what I can do directly, what needs you at an external dashboard, and what credentials/info I'll need from you.

## Milestone map

| #   | Milestone                                      | Depends on | PRD refs                                      |
| --- | ---------------------------------------------- | ---------- | --------------------------------------------- |
| 0   | Repo & tooling foundation — **done**           | —          | §9.1, §14.1, §14.3                            |
| 1   | Supabase bootstrap + email/password auth       | 0          | AUTH-01..05, §9                               |
| 2   | Google + Apple sign-in                         | 1          | AUTH-01                                       |
| 3   | Friends & blocks                               | 1          | FR-01..05                                     |
| 4   | Groups & membership                            | 3          | GR-01..06                                     |
| 5   | Currencies                                     | 1          | §5.1                                          |
| 6   | Bet engine core (draft → versions → approvals) | 4, 5       | BET-01..10                                    |
| 7   | Bet cancellation                               | 6          | §5.2                                          |
| 8   | Resolution & disputes                          | 6          | RES-01..07 (needs Decision #2 resolved first) |
| 9   | Ledger & balances                              | 8          | BAL-01, 02, 08; §5.5                          |
| 10  | Manual obligations & adjustments               | 4, 5       | BAL-03, 04                                    |
| 11  | Redemption & forgiveness                       | 9          | BAL-05..07                                    |
| 12  | Social layer (comments, chat, polls, proof)    | 6, 4       | SOC-01..06                                    |
| 13  | Trust & safety (reports, moderation, admin)    | 12         | MOD-01..06                                    |
| 14  | Account deletion & privacy                     | 1          | AUTH-05, §9.5                                 |
| 15  | Accessibility, performance, observability      | all        | §11, §12                                      |
| 16  | Store readiness                                | all        | §10.5                                         |

This is deliberately finer-grained than the PRD's own 8 phases, so each milestone is small enough to fully test before moving on.

---

### Milestone 0 — Repo & tooling foundation — **done** (2026-07-14)

**Goal:** a clean, lintable, typed, tested-empty baseline with CI, before any product code.

Shipped: initial git commit of the scaffold; `.env.example` + gitignored `.env`; `@supabase/supabase-js`, `@tanstack/react-query`, `expo-secure-store` installed; Jest + `jest-expo` + RNTL configured with 4 passing tests; ESLint (`eslint-config-expo`) + Prettier reconciled; GitHub Actions CI workflow (format/lint/typecheck/test); `NativeTabs` replaced with a cross-platform `expo-router/ui`-based tab bar (Home, Groups, Add-as-modal, Activity, Account); design tokens expanded (accent/border/positive/negative colors, currency-category colors, radii); first `src/components/ui` primitives (`Button`, `Card`, `Badge`) with tests.

Verified: lint/typecheck/test/format all pass locally; `expo-doctor` 20/20; live-browser-tested on web (all 5 destinations + modal open/close, no console errors). **Not verified on iOS/Android** — no simulator/emulator was available in this environment this session. Full detail in `PROJECT_STATUS.md`.

Not done: CI hasn't actually run yet (no GitHub remote pushed).

### Milestone 1 — Supabase bootstrap + email/password auth

**Goal:** real backend, minimal account creation, first RLS test suite.

- I can do directly: write `supabase/migrations/0001_profiles.sql` (enums, `profiles` table, RLS: a user reads/writes only their own row), `supabase/seed.sql`, the Supabase client wrapper, secure session persistence, sign-up/sign-in/sign-out screens, minimal display-name+username setup screen, 16+ age-acknowledgement checkbox (self-attestation, no ID verification), and the first RLS integration test (unrelated user cannot read/write another profile).
- Needs you at a dashboard: create a Supabase project (pick region — recommend one close to your initial Canada/US users); in Supabase Auth settings, leave Google/Apple disabled for now; run `supabase link` / apply migrations against your project (I'll give exact commands).
- Credentials needed from you: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (both client-safe, go in `.env`, never committed). The service-role key is not needed client-side; if we need it for CI-run RLS tests later I'll ask for it as a GitHub Actions secret only.
- Done when: sign-up, sign-in, sign-out work end-to-end against your real Supabase project; RLS test proves cross-user profile access is denied.

### Milestone 2 — Google + Apple sign-in

- I can do directly: client-side OAuth flow wiring once provider credentials exist in Supabase's Auth settings; provider-linking UI.
- Needs you at a dashboard: Google Cloud Console (OAuth consent screen + Web/iOS/Android OAuth client IDs, matching bundle ID/package name and, for Android, a SHA-1 fingerprint I'll help you generate from your build); Apple Developer Program enrollment ($99/yr) + an App ID with "Sign in with Apple" capability + a Services ID/key for Supabase's Apple provider config; enter both providers' credentials into Supabase Auth settings.
- Credentials needed from you: Google OAuth client IDs (can live in app config, not secret); Apple Services ID/Team ID/Key ID/private key (go into Supabase dashboard only, never into the repo).
- Done when: Google and Apple sign-in both complete and create/link a `profiles` row.

### Milestone 3 — Friends & blocks

- I can do directly: entire milestone — `friendships`/`blocks` tables, RLS, RPC functions (send/accept/decline/cancel, block/unblock), rate-limited username search, Friends screen, invite deep link (custom scheme, no domain needed yet), QR invite.
- Needs you at a dashboard: nothing new.
- Credentials needed: none new.

### Milestone 4 — Groups & membership

- I can do directly: entire milestone — `groups`/`group_members`, RLS, RPC (create/invite/join/leave-guard/remove/archive), Groups list + Group detail screens.
- Needs you / credentials: none new.

### Milestone 5 — Currencies

- I can do directly: entire milestone — `currencies` table, built-in low-risk catalog (per PRD §10.2 "do not ship violent/sexual built-ins"), custom-currency creation with the Milestone-0 moderation filter applied, ownership scoping (user vs. group).
- Needs you / credentials: none new.

### Milestone 6 — Bet engine core

- I can do directly: `bets`/`bet_versions`/`bet_participants`/`bet_sides`/`bet_commitments`/`bet_approvals`, `create_or_counter_bet()`, `approve_bet_version()`, `propose_bet_amendment()`, payout-math unit tests (funded-payout validation, odds-ratio math), payout-preview UI, full creation wizard (§7.3 flow), counteroffer/negotiation UI.
- Needs you / credentials: none new.

### Milestone 7 — Bet cancellation

- I can do directly: `propose_cancel_bet()`/`approve_cancel_bet()`, UI affordances.

### Milestone 8 — Resolution & disputes

**Blocked on Decision #2 (random fallback) being resolved.**

- I can do directly, once Decision #2 is settled: result submission/confirmation tables, `submit_bet_result()`, `confirm_bet_result()`, `dispute_resolutions`, `resolve_dispute()`, disputed-state UI, judge/group-vote fallback UI.
- Needs you: pick option (a) or (b) in `DECISIONS.md` #2.

### Milestone 9 — Ledger & balances

- I can do directly: `ledger_entries` (append-only, trigger-enforced), `obligation_allocations`, atomic ledger writes inside `confirm_bet_result()`/`resolve_dispute()`, balance-aggregation queries/views, Balances UI with drill-down to source events, per-currency separation (never cross-currency netting), CAD/USD kept separate.

### Milestone 10 — Manual obligations & adjustments

- I can do directly: `manual_obligation_proposals`, propose/approve RPCs (ledger entries only after all affected approvals), UI.

### Milestone 11 — Redemption & forgiveness

- I can do directly: `redemption_requests`, `request_redemption()` (allocation reservation, double-spend prevention), `confirm_redemption()`, `forgive_obligation()`, Redeem UI (select obligations, partial/full).

### Milestone 12 — Social layer

- I can do directly: `comments`, `chat_messages` + Realtime subscriptions, `polls`/`poll_options`/`poll_votes`, `proof_assets` with private Storage bucket + signed URLs + client-side image compression.
- Needs you at a dashboard: confirm Storage bucket creation in Supabase (I'll give exact steps) and, if you want push-quality realtime at scale later, review Supabase plan/quota — not required for MVP dev.

### Milestone 13 — Trust & safety

- I can do directly: `reports`, `moderation_actions` (append-only), gated admin route group, report queue/actions UI, block enforcement across all surfaces, `audit_events` wiring for all high-value transitions.

### Milestone 14 — Account deletion & privacy

- I can do directly: `delete_account_request()`, anonymization workflow, session revocation, in-app deletion flow, privacy-policy/ToS/community-guidelines placeholders clearly marked "NOT LEGAL ADVICE — FOR COUNSEL REVIEW."
- Needs you: final legal text requires your counsel; I will not draft anything intended to be shipped as-is.

### Milestone 15 — Accessibility, performance, observability

- I can do directly: WCAG 2.2 AA pass (contrast, labels, dynamic type, touch targets, reduced motion, no color-only status), performance profiling against the P95 < 2.5s target, wiring real Sentry/analytics adapters **if** you've provided accounts by this point (otherwise stays no-op).
- Needs you at a dashboard (optional, only if you want real monitoring before launch): Sentry account + DSN; analytics SaaS account if you want one instead of the first-party table.

### Milestone 16 — Store readiness

- I can do directly: submission checklists, required asset lists, safe-content screenshot specs, age-rating questionnaire answers drafted for your review.
- Needs you: Apple Developer Program + App Store Connect account, Google Play Console account, EAS account for builds/signing, actual screenshots taken from a running build, submitting the app and responding to reviewers (I cannot act as account owner), final policy-compliance judgment call (recommend counsel review per PRD §10.3/§16).

---

## Full external-dependency summary

| Need                                          | First required at                                         | Type                                          |
| --------------------------------------------- | --------------------------------------------------------- | --------------------------------------------- |
| Supabase project                              | Milestone 1                                               | Account + dashboard config                    |
| Google Cloud OAuth clients                    | Milestone 2                                               | Account + dashboard config + credentials      |
| Apple Developer Program + Sign in with Apple  | Milestone 2                                               | Paid account + dashboard config + credentials |
| GitHub remote                                 | Milestone 0 (optional, for CI to run)                     | Account                                       |
| Domain for universal/app links                | Optional, improves Milestone 3 invite links               | Purchase + DNS config                         |
| Expo/EAS account                              | Milestone 16 (or earlier if you want cloud builds sooner) | Account                                       |
| Apple App Store Connect / Google Play Console | Milestone 16                                              | Paid accounts                                 |
| Sentry (or similar)                           | Optional, Milestone 15                                    | Account + DSN                                 |
| Analytics SaaS                                | Optional, Milestone 15                                    | Account + key                                 |
| SMS provider (phone auth)                     | Deferred post-MVP per PRD                                 | Account + key                                 |
| Legal counsel                                 | Milestone 14/16                                           | Not something I can provide                   |

---

## Next milestone: Milestone 1

Milestone 0 is complete (see above and `PROJECT_STATUS.md`). Milestone 1 (Supabase bootstrap + email/password auth) is next, and needs you to create a Supabase project before I can write real migrations against it — see the Milestone 1 section above for exact scope and what's needed from you.
