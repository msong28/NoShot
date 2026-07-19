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
| 9   | Ledger & balances — **done**                                     | 8          | BAL-01, 02, 08; §5.5 |
| 10  | Manual obligations & adjustments — **done**                      | 4, 5       | BAL-03, 04           |
| 11  | Redemption & forgiveness — **done**                              | 9          | BAL-05..07           |
| 12  | Social layer (comments, chat, polls, proof) — **done**           | 6, 4       | SOC-01..06           |
| 13  | Trust & safety (reports, moderation, admin) — **done**           | 12         | MOD-01..06           |
| 14  | Account deletion & privacy — **done**                            | 1          | AUTH-05, §9.5        |
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

### Milestone 8 — Resolution & disputes — **done** (2026-07-19)

Shipped: `pending_result`/`disputed`/`resolved`/`tied` bet statuses; `bet_result_submissions`/`bet_result_confirmations`/`dispute_resolutions`/`bet_dispute_votes` + RLS (all RPC-only); `submit_bet_result()`, `confirm_bet_result()` (converging confirmations resolve a dispute with no fallback needed), `resolve_dispute()` (judge), `vote_on_dispute()` (group vote, majority after full participation), `trigger_random_fallback()` (submitted outcomes only). Full "Result" UI on the bet detail screen covering every resolution path. 15 pgTAP assertions; live-verified end-to-end for the participant-submission path (submit, dispute via conflicting submissions, confirm-to-converge, tie) with two real accounts. Full detail in `PROJECT_STATUS.md`. Branch `milestone-8-resolution-disputes`, not yet merged.

Not UI-reachable yet (RPC/pgTAP-verified, no creation-form support): judge resolution, group-vote resolution, random fallback — Milestone 6's creation form only builds `participant_submission` bets. Ledger entries are deliberately not written here — `resolved_outcome_key` is what Milestone 9 needs to post real obligations once its ledger table exists.

### Milestone 9 — Ledger & balances — **done** (2026-07-19)

Shipped: `ledger_entries` (append-only, trigger-enforced against update/delete) + RLS (visible only to the two parties on an entry); `get_my_balances()` (per-counterparty/currency/group net aggregation); `get_ledger_counterparty_profiles()` and `get_ledger_currency_names()` (two new relationship-gated read helpers — a balance's counterparty or currency isn't always visible via friendship/ownership RLS alone, since bets don't require friendship and a currency only has to be visible to its creator). `_finalize_bet_resolution()` (Milestone 8) and `approve_manual_obligation()` (Milestone 10) both extended via `CREATE OR REPLACE FUNCTION` to post ledger entries on resolution/approval, closing the two seams both milestones deliberately left open — a tie posts no entries. Pro-rata payout formula generalizes BET-05's funding-guarantee math to N-way settlement, verified against the PRD's own §5.3 worked example. `src/lib/ledger.ts`, `src/hooks/use-ledger.ts` (`useMyBalances`, `useLedgerEntriesBetween`), a new `/balances` screen (BAL-01 consolidated list + BAL-02 tap-to-drill-down into source ledger entries), and the Home screen's Balances card now shows real data instead of a placeholder.

14 pgTAP assertions; live-verified end-to-end with two real accounts (proposed and approved a manual obligation, watched the ledger entry appear on both the Home card and the `/balances` drill-down with the correct direction and source label). Full detail in `PROJECT_STATUS.md`. Branch `milestone-9-ledger-balances`.

Not done at the time this milestone shipped: no dedicated redemption/forgiveness UI yet (that's Milestone 11's `entry_type`s — the enum values exist, nothing writes them yet); the bet-settlement ledger path itself is RPC/pgTAP-verified only, not live-clicked through, since it requires resolving a bet the way Milestone 8 already exercised live and re-doing that wasn't the point of this pass. Both now done -- see Milestone 11's own section.

### Milestone 10 — Manual obligations & adjustments — **done** (2026-07-18)

Built in parallel with Milestone 6 on branch `milestone-10-manual-obligations` by a background agent, then reviewed and merged. Shipped: `supabase/migrations/20260718100000_manual_obligations.sql` (`manual_obligation_proposals` table, RPC-only per `ARCHITECTURE.md` §6, friends-only scope, builtin-or-shared-group currency scope); `propose_manual_obligation()`, `approve_manual_obligation()`, `decline_manual_obligation()`, `cancel_manual_obligation()`; `supabase/tests/manual_obligations.test.sql`; `src/lib/manual-obligation.ts`, `src/hooks/use-manual-obligations.ts`, `src/app/obligations.tsx` (reachable via a "Manual obligations" button on the Friends screen); a new `obligations` semantic icon.

Verified: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db`, `npm run format:check` all pass. Behavior test covers propose/approve/decline/cancel, the proposer being unable to approve their own proposal, RLS (uninvolved user sees nothing, anon has zero table access), direct-insert denial, non-friend rejection, currency-not-shared rejection, non-positive-amount rejection, and blocking canceling the friendship (and thus blocking new proposals). **Not live-verified in a browser** — this branch was built without an attached browser session; unlike Milestone 6, it hasn't had a live click-through pass yet.

Deliberately deferred: this does **not** write to a ledger — `ledger_entries` doesn't exist yet (Milestone 9). An approved row sits in `approved` state; wiring the actual balance-affecting write is left for whenever Milestone 9 lands. Also scoped narrower than the milestone's original one-line description: obligations are friends-only (not group-scoped) and can only use built-in or shared-group currencies, not a party's personal currency — see the migration's comments for why (a personal currency would be invisible to the other party under currencies' own RLS). Flagging both as judgment calls worth a second look, not settled facts.

### Milestone 11 — Redemption & forgiveness — **done** (2026-07-20)

Shipped: `redemption_requests` + `redemption_status` enum ('pending'/'confirmed'/'declined'/'cancelled'), `forgiveness_events`, and `obligation_allocations` (the PRD's own named table mapping a redemption/forgiveness event back to the specific original ledger entries it draws down, with a per-source amount -- this is what makes BAL-05's "select which underlying obligations" and per-source outstanding tracking possible). `get_outstanding_obligations()` (what's left to redeem/forgive per source, after subtracting reserved-or-settled allocations). `request_redemption()` (debtor-only, locks each selected source row `FOR UPDATE` so concurrent requests against the same obligation can't double-reserve it), `confirm_redemption()`/`decline_redemption()` (creditor-only), `cancel_redemption()` (debtor-only, releases the reservation) -- mirroring the propose/approve/decline/cancel shape from Milestone 10. `forgive_obligation()` (creditor-only, single atomic step -- unlike redemption, forgiveness needs no counterparty approval per BAL-07, so there's no separate request/confirm pair). Both settlement paths reuse Milestone 9's signed-netting trick: a redemption or forgiveness ledger entry is inserted with debtor/creditor _swapped_ relative to the original, so `get_my_balances()` needs zero entry-type-specific logic to net it down correctly. `src/lib/redemption.ts`, `src/hooks/use-redemption.ts`, and a "Settle up" section added to the `/balances` screen's drill-down (per-obligation Redeem/Forgive with an editable amount, defaulting to the full outstanding amount) plus pending-redemption confirm/decline/cancel UI; Home's "Needs your attention" now also surfaces redemptions awaiting the caller's confirmation.

Scope note: only `bet_settlement` and `manual_obligation` entries are redeemable/forgivable sources. `correction` is left out entirely -- nothing writes that entry_type yet (defined in Milestone 9, still unused), and §8.1's phrasing suggests it behaves more like a further deduction than a fresh obligation, which isn't a question this milestone needed to answer. UI scope note, same shape as Milestone 6's direct-1:1-only creation form over a fully general N-way schema: the backend's `p_allocations` accepts a batch of obligations in one call, but the UI acts on one obligation at a time (each "Settle up" row has its own amount field and button) rather than a multi-select batch flow.

18 pgTAP assertions; live-verified end-to-end with two real accounts on the real 3-Chore manual obligation created during Milestone 9's own verification (Alice owed Dave): Alice partially redeemed 1 -- outstanding correctly dropped from 3 to 2 immediately (the reservation counts before confirmation) -- Dave's Home screen surfaced it under "Needs your attention," confirmed it, and the balance correctly dropped to 2 with a "Redemption" entry appearing in history; Dave then forgave the remaining 2, and the balance zeroed out and disappeared from the list entirely, landing on the "All settled up" empty state. Full detail in `PROJECT_STATUS.md`. Branch `milestone-11-redemption-forgiveness`.

### Milestone 12 — Social layer — **done** (2026-07-22)

Shipped in three passes on one branch: comments + real-time group chat, then polls, then image proof.

**Comments & chat (SOC-01, SOC-02):** `comments` (bet-scoped -- see scope note below) and `chat_messages` (group-scoped), both gated by a shared `content_moderation_status` enum (approved/pending_review/blocked) driven by Milestone 5's `moderate_text()`, reused rather than duplicated. Visibility for comments extends past participants to the bet's group too (matching GR-05's precedent for proof), which required widening the existing `get_bet_participant_profiles()` (via a follow-up migration, not an edit) so group viewers can resolve comment authors' names. `chat_messages` is added to the `supabase_realtime` publication -- Realtime evaluates each subscriber's own RLS, so no separate authorization layer was needed for the live feed. `post_comment()`/`post_chat_message()` RPCs.

**Polls (SOC-03):** `polls`/`poll_options`/`poll_votes`, genuinely bet-**or**-group scoped per the PRD's explicit text (unlike comments). `create_poll()`, `vote_on_poll()` (re-voting on a single-choice poll replaces the previous vote rather than rejecting it; multi-choice polls allow more than one selection), `close_poll()` (creator-only). Votes aren't anonymous, matching `bet_dispute_votes`' precedent from Milestone 8.

**Image proof (SOC-04, SOC-05):** private `proof-assets` Storage bucket, `proof_assets` table, `upload_proof()` metadata-registration RPC. Client uploads directly to Storage (authorized by `storage.objects` RLS policies keyed off the bet_id encoded in the object path via `storage.foldername()`), then registers the row -- standard two-step Supabase Storage flow. Client-side compression via `expo-image-picker` + `expo-image-manipulator` (resize to 1600px wide, JPEG at 0.7 quality) before upload; viewing goes through short-lived signed URLs (`createSignedUrls`, batched), since the bucket is private. Both new Expo packages' current SDK 57 APIs were checked against the versioned docs before use (the old `ImagePicker.MediaTypeOptions` enum and `manipulateAsync()` are both deprecated in favor of `mediaTypes: ['images']` and the new `ImageManipulator.manipulate()` context API), and the upload technique (`fetch(uri).arrayBuffer()`, not `.blob()`) matches Supabase's own official Expo reference implementation.

Scope notes: `comments` stayed bet-only, not group-scoped, since no functional requirement actually calls for a general group comment thread separate from chat (only SOC-01's per-bet thread is required) -- the column shape still matches the PRD's schema if that's wanted later. `correction`-type ledger entries aside, moderation follows the exact three-tier pattern (block outright / warn+queue as `pending_review` / permit as `approved`) already established for currencies in Milestone 5, extended to comments/chat/proof rather than reinvented.

38 pgTAP assertions across three test files (comments_chat, polls, proof_assets), including a from-scratch `storage` schema stub added to the local test harness (`storage.buckets`/`storage.objects`/`storage.foldername()`) so Storage RLS policies get real local coverage, not just a live-only check. Live-verified end-to-end with real accounts against `noshot-dev`: posted and saw a bet comment; created a bet-scoped poll and voted; created a real group, invited a second account, sent a group chat message from one browser tab and watched it appear in a second tab with zero interaction (proving the Realtime subscription itself, independent of RLS correctness which pgTAP already covers); created a multi-choice group poll and voted for two options at once. **Not live-verified:** the proof-upload flow specifically -- it requires a native OS file-picker dialog that browser automation can't drive (the tooling explicitly warns against attempting it), so this one path relies on the passing pgTAP coverage of the RPC/RLS/Storage-policy layer plus doc-verified API usage instead of a live click-through. Native iOS/Android unverified, same standing gap as every milestone to date.

### Milestone 13 — Trust & safety — **done** (2026-07-23)

Landed in two independently-built pieces that merged together cleanly, split from the start specifically so they wouldn't touch the same files.

- Reports (MOD-01), the poll-option/group-name moderation gap-fix (MOD-03/04), the admin dashboard (MOD-05), and the audit log (MOD-06) — built on branch `milestone-13-trust-safety` off master.
- Blocking enforcement (MOD-02) — built on branch `milestone-13-blocking-enforcement`. Blocking has existed since Milestone 3 (`blocks`, `is_blocked_pair()`, `block_user()`) and already overrode friendships and group invites, but nothing built since (the whole bet engine, comments, chat, polls, proof) ever checked it. Shipped: `create_or_counter_bet()`, `post_comment()`, `create_poll()`, `vote_on_poll()`, and `upload_proof()` all now reject a blocked pair — for bet creation, no two participants can be a blocked pair; for the bet-scoped social actions, the check applies retroactively too (a block that happens _after_ a bet already exists still stops new comments/polls/proof on it). `chat_messages_select`'s RLS now also hides messages from a blocked author (MOD-02's "hides content where feasible" half) — the one surface explicitly called out for this in Milestone 4's own code comments. `is_blocked_pair()` needed a direct grant to `authenticated` for the first time, since RLS policies run as the querying role, not with a SECURITY DEFINER function's elevated privileges the way every other caller of it (all inside RPC bodies) does. 12 pgTAP assertions; live-verified against `noshot-dev` (blocked a real friend, confirmed a new bet between the blocked pair is unreachable through the friend-scoped creation UI, and confirmed commenting on an existing shared bet now fails with the new error message, surfaced cleanly through the existing error-handling UI with zero new UI code). Deliberately did **not** retroactively hide whole bets/comments/polls/proof-by-block, since a bet's ledger entries are exactly the kind of real, still-owed obligation history that needs to stay visible regardless of a later block (same reasoning Milestone 14's anonymize-not-delete design already established). Currencies needed no changes — their visibility is owner/group-scoped, not counterparty-scoped, so there was nothing block-shaped to enforce there.

Full detail, including a migration-timestamp collision caught and fixed during merge (both branches independently used `20260723090000`), is in `PROJECT_STATUS.md`.

### Milestone 14 — Account deletion & privacy — **done** (2026-07-22)

Built on branch `delete-accounts`, in parallel with the ledger/redemption work on a separate branch (no dependency between them beyond both touching `profiles`). Shipped: `delete_account_request()` (anonymizes rather than hard-deletes, per §9.5's pseudonymized-history requirement); session revocation via a direct `auth.sessions` delete, live-verified against the real project; the in-app deletion flow reachable from Account; privacy-policy/ToS/community-guidelines placeholders, each clearly marked "NOT LEGAL ADVICE — FOR COUNSEL REVIEW." Full detail in `PROJECT_STATUS.md`.

Needs you: final legal text requires your counsel; nothing drafted here is intended to be shipped as-is.

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
