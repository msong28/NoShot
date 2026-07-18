# NoShot — Implementation Plan

Source of truth: `NoShot_PRD.docx`. Architecture: `ARCHITECTURE.md`. Open/resolved technical decisions: `DECISIONS.md`. Current state: `PROJECT_STATUS.md` (update both this file and that one after every milestone).

Rule for all milestones: complete and test one before starting the next. Each milestone below lists what I can do directly, what needs you at an external dashboard, and what credentials/info I'll need from you.

## Milestone map

| #   | Milestone                                                        | Depends on | PRD refs             |
| --- | ---------------------------------------------------------------- | ---------- | -------------------- |
| 0   | Repo & tooling foundation — **done**                             | —          | §9.1, §14.1, §14.3   |
| 1   | Supabase bootstrap + email/password auth — **done**              | 0          | AUTH-01..05, §9      |
| 2   | Google + Apple sign-in — **Google done**, Apple built/unverified | 1          | AUTH-01              |
| 3   | Friends & blocks — **done**                                      | 1          | FR-01..05            |
| 4   | Groups & membership — **done**                                   | 3          | GR-01..06            |
| 5   | Currencies — **done**                                            | 1          | §5.1                 |
| 6   | Bet engine core (draft → versions → approvals) — **done**        | 4, 5       | BET-01..10           |
| 7   | Bet cancellation                                                 | 6          | §5.2                 |
| 8   | Resolution & disputes                                            | 6          | RES-01..07           |
| 9   | Ledger & balances                                                | 8          | BAL-01, 02, 08; §5.5 |
| 10  | Manual obligations & adjustments — **done**                      | 4, 5       | BAL-03, 04           |
| 11  | Redemption & forgiveness                                         | 9          | BAL-05..07           |
| 12  | Social layer (comments, chat, polls, proof)                      | 6, 4       | SOC-01..06           |
| 13  | Trust & safety (reports, moderation, admin)                      | 12         | MOD-01..06           |
| 14  | Account deletion & privacy                                       | 1          | AUTH-05, §9.5        |
| 15  | Accessibility, performance, observability                        | all        | §11, §12             |
| 16  | Store readiness                                                  | all        | §10.5                |

This is deliberately finer-grained than the PRD's own 8 phases, so each milestone is small enough to fully test before moving on.

---

### Milestone 0 — Repo & tooling foundation — **done** (2026-07-14)

**Goal:** a clean, lintable, typed, tested-empty baseline with CI, before any product code.

Shipped: initial git commit of the scaffold; `.env.example` + gitignored `.env`; `@supabase/supabase-js`, `@tanstack/react-query`, `expo-secure-store` installed; Jest + `jest-expo` + RNTL configured with 4 passing tests; ESLint (`eslint-config-expo`) + Prettier reconciled; GitHub Actions CI workflow (format/lint/typecheck/test); `NativeTabs` replaced with a cross-platform `expo-router/ui`-based tab bar (Home, Groups, Add-as-modal, Activity, Account); design tokens expanded (accent/border/positive/negative colors, currency-category colors, radii); first `src/components/ui` primitives (`Button`, `Card`, `Badge`) with tests.

Verified: lint/typecheck/test/format all pass locally; `expo-doctor` 20/20; live-browser-tested on web (all 5 destinations + modal open/close, no console errors). **Not verified on iOS/Android** — no simulator/emulator was available in this environment this session. Full detail in `PROJECT_STATUS.md`.

Not done: CI hasn't actually run yet (no GitHub remote pushed).

### Milestone 1 — Supabase bootstrap + email/password auth — **done** (2026-07-14)

**Goal:** real backend, minimal account creation, first RLS test suite.

Shipped: `supabase/migrations/20260714120000_profiles.sql` (profiles table, min-age trigger, unique username index, default-deny RLS); `supabase/seed.sql`; `src/lib/supabase.ts` client (LargeSecureStore on native, AsyncStorage on web, SSR-safe); sign-up/sign-in/sign-out screens; `setup-profile` screen (display name, username, birth year, age acknowledgement); `Stack.Protected`-based auth routing; `scripts/test-db.sh` + `supabase/tests/profiles_rls.test.sql`, a committed Docker-free RLS test suite wired into CI.

Verified: lint/typecheck/test/format/test:db all pass; the DB test harness was confirmed to actually fail on a broken assertion (not a rubber-stamp); full sign-up → setup-profile → tabs → sign-out → sign-in loop driven live in a browser against the real linked Supabase project (`noshot-dev`), zero console errors. **Not verified on iOS/Android** (same gap as Milestone 0). Full detail in `PROJECT_STATUS.md`.

Not done / tracked follow-ups: `DECISIONS.md` #6 (email confirmation currently OFF for dev convenience, must re-enable before real users) and #7 (no `emailRedirectTo` deep-link callback yet, no account-enumeration handling on sign-up — should land before #6 is reversed).

### Milestone 2 — Google + Apple sign-in

- **Dashboard setup done** (2026-07-15): Google Cloud OAuth consent screen configured, Web + iOS OAuth clients created (Android client deferred — needs a real keystore SHA-1, which doesn't exist until an EAS/dev build is made). Apple Developer App ID `com.noshot.app.ram` has Sign in with Apple enabled, native-flow only (no Services ID/key needed — no separate website using Apple sign-in yet). Both providers enabled and configured in Supabase Auth settings for `noshot-dev`.
- I can do directly, now unblocked: client-side OAuth flow wiring (`expo-apple-authentication`, native Google sign-in via ID token, `supabase.auth.signInWithIdToken()`), provider-linking UI.
- Needs you at a dashboard: nothing left for the native flow. Only if Android sign-in is wanted before an EAS build exists, or Apple sign-in is later needed on a real website (would require adding the web Services ID + `.p8` key flow on top of the existing native one).
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

### Milestone 6 — Bet engine core — **done** (2026-07-18)

Shipped: `bets`/`bet_versions`/`bet_participants`/`bet_sides`/`bet_commitments`/`bet_approvals` + RLS, `create_or_counter_bet()`, `approve_bet_version()`, `propose_bet_amendment()`, `submit_draft_bet()`, `get_bet_payout_preview()`, funding validation (BET-05), a live payout-preview UI, and a direct 1:1 creation form. 17 pgTAP assertions; live-verified end-to-end with two real accounts (propose → approve → activate, and a separate decline → void). Full detail in `PROJECT_STATUS.md`.

Not done in this pass, left for a follow-up UI slice before Milestone 7 if wanted: group-scoped/multi-participant bet creation UI and counteroffer/amendment UI (the backend supports both today, pgTAP-tested — just no wizard UI yet). `random_fallback_enabled` is stored but has no UI toggle (nothing to control until Milestone 8).

### Milestone 7 — Bet cancellation — **done** (2026-07-18)

Shipped: `cancellation_pending` bet status (own migration, since Postgres won't let a freshly added enum value be used inside the same transaction it was added in — Supabase applies each migration as one transaction); `bet_cancellation_approvals` + `propose_cancel_bet()`/`approve_cancel_bet()` (mutual-approval, mirrors the negotiation-approval pattern from Milestone 6); bet-detail UI (Cancel bet, cancellation roster, Confirm/Keep actions); Home surfaces cancellation-pending bets under "Needs your attention". 10 pgTAP assertions; live-verified end-to-end (propose → decline → reverts to active → propose again → confirm → voids) with two real accounts. Full detail in `PROJECT_STATUS.md`. Branch `milestone-7-bet-cancellation`, not yet merged.

### Milestone 8 — Resolution & disputes

Unblocked (2026-07-18) — see `DECISIONS.md` "Decided" section for the resolved random-fallback approach.

- I can do directly: result submission/confirmation tables, `submit_bet_result()`, `confirm_bet_result()`, `dispute_resolutions`, `resolve_dispute()`, disputed-state UI, judge/group-vote/random-fallback UI (including the toggle + disclosure copy at bet creation).

### Milestone 9 — Ledger & balances

- I can do directly: `ledger_entries` (append-only, trigger-enforced), `obligation_allocations`, atomic ledger writes inside `confirm_bet_result()`/`resolve_dispute()`, balance-aggregation queries/views, Balances UI with drill-down to source events, per-currency separation (never cross-currency netting), CAD/USD kept separate.

### Milestone 10 — Manual obligations & adjustments — **done** (2026-07-18)

Built in parallel with Milestone 6 on branch `milestone-10-manual-obligations` by a background agent, then reviewed and merged. Shipped: `supabase/migrations/20260718100000_manual_obligations.sql` (`manual_obligation_proposals` table, RPC-only per `ARCHITECTURE.md` §6, friends-only scope, builtin-or-shared-group currency scope); `propose_manual_obligation()`, `approve_manual_obligation()`, `decline_manual_obligation()`, `cancel_manual_obligation()`; `supabase/tests/manual_obligations.test.sql`; `src/lib/manual-obligation.ts`, `src/hooks/use-manual-obligations.ts`, `src/app/obligations.tsx` (reachable via a "Manual obligations" button on the Friends screen); a new `obligations` semantic icon.

Verified: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db`, `npm run format:check` all pass. Behavior test covers propose/approve/decline/cancel, the proposer being unable to approve their own proposal, RLS (uninvolved user sees nothing, anon has zero table access), direct-insert denial, non-friend rejection, currency-not-shared rejection, non-positive-amount rejection, and blocking canceling the friendship (and thus blocking new proposals). **Not live-verified in a browser** — this branch was built without an attached browser session; unlike Milestone 6, it hasn't had a live click-through pass yet.

Deliberately deferred: this does **not** write to a ledger — `ledger_entries` doesn't exist yet (Milestone 9). An approved row sits in `approved` state; wiring the actual balance-affecting write is left for whenever Milestone 9 lands. Also scoped narrower than the milestone's original one-line description: obligations are friends-only (not group-scoped) and can only use built-in or shared-group currencies, not a party's personal currency — see the migration's comments for why (a personal currency would be invisible to the other party under currencies' own RLS). Flagging both as judgment calls worth a second look, not settled facts.

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

| Need                                          | First required at                                         | Type                                  |
| --------------------------------------------- | --------------------------------------------------------- | ------------------------------------- |
| Supabase project                              | Milestone 1                                               | Account + dashboard config            |
| Google Cloud OAuth clients                    | Milestone 2                                               | Done (2026-07-15) — Web + iOS clients |
| Apple Developer Program + Sign in with Apple  | Milestone 2                                               | Done (2026-07-15) — native flow only  |
| GitHub remote                                 | Milestone 0 (optional, for CI to run)                     | Account                               |
| Domain for universal/app links                | Optional, improves Milestone 3 invite links               | Purchase + DNS config                 |
| Expo/EAS account                              | Milestone 16 (or earlier if you want cloud builds sooner) | Account                               |
| Apple App Store Connect / Google Play Console | Milestone 16                                              | Paid accounts                         |
| Sentry (or similar)                           | Optional, Milestone 15                                    | Account + DSN                         |
| Analytics SaaS                                | Optional, Milestone 15                                    | Account + key                         |
| SMS provider (phone auth)                     | Deferred post-MVP per PRD                                 | Account + key                         |
| Legal counsel                                 | Milestone 14/16                                           | Not something I can provide           |

---

## Next milestone: Milestone 1

Milestone 0 is complete (see above and `PROJECT_STATUS.md`). Milestone 1 (Supabase bootstrap + email/password auth) is next, and needs you to create a Supabase project before I can write real migrations against it — see the Milestone 1 section above for exact scope and what's needed from you.
