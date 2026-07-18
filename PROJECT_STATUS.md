# NoShot — Project Status

Last updated: 2026-07-19 (Milestone 9 — ledger & balances, done and live-verified).

## Where things stand

- Milestones 0–9 are complete (Apple sign-in within Milestone 2 is built but still not live-verified — no iOS simulator/device available in this environment). Milestone 10 (manual obligations) is also done, built in parallel by a background agent. See below for detail; earlier milestones are further down this file.
- Real Supabase project is live and linked: `noshot-dev` (ref `tckpbwvzxxovnsvdtwee`). `profiles`, `friendships`, `blocks`, `username_search_log`, `groups`, `group_members`, `currencies`, `bets`/`bet_versions`/`bet_sides`/`bet_participants`/`bet_commitments`/`bet_approvals`/`bet_cancellation_approvals`/`bet_result_submissions`/`bet_result_confirmations`/`bet_dispute_votes`/`dispute_resolutions`, `manual_obligation_proposals`, and `ledger_entries` tables + RLS are all deployed to it.
- CI is green (fixed in an earlier session — see git history if you need the detail; this file no longer tracks it as an open item).
- Master, `milestone-6-bet-engine`, `milestone-7-bet-cancellation`, `milestone-8-resolution-disputes`, and `milestone-10-manual-obligations` are all merged together on `master` and pushed. `milestone-9-ledger-balances` is done locally, not yet merged.
- Planning docs: `ARCHITECTURE.md`, `DECISIONS.md`, `IMPLEMENTATION_PLAN.md`, this file.

## Milestone 9 — Ledger & balances — done (2026-07-19)

What shipped:

- `supabase/migrations/20260719120000_ledger.sql`: `ledger_entries` (append-only — an update/delete-blocking trigger enforces this at the DB level, not just via RLS; `debtor_id`/`creditor_id`/`group_id`/`currency_id`/`amount`/`entry_type`/`source_type`/`source_id`/`reversal_of`), RLS scoped to the two parties on each entry, no write grants (RPC/internal-function-only, same pattern as every other ledger-adjacent table). `get_my_balances()` (`SECURITY DEFINER` — needed because it calls `auth.uid()` directly in its own body, unlike RLS policies which get implicit access) aggregates net balance per counterparty/currency/group. `_finalize_bet_resolution()` (Milestone 8's internal resolution seam) and `approve_manual_obligation()` (Milestone 10) both extended via `CREATE OR REPLACE FUNCTION` — never editing the already-pushed migrations that first defined them — to post ledger entries at the moment of resolution/approval. A tied bet posts zero entries.
- Pro-rata payout/ledger allocation formula, worked out and verified against the PRD's own §5.3 example: for a resolved bet, `amount(loser L owes winner W) = stake_L * (payout_if_win_W / total_losing_pool)`. Reduces to the simple 1-vs-1 case, generalizes to N-vs-N, and respects BET-05's funding guarantee.
- `supabase/migrations/20260719120500_ledger_counterparty_profiles.sql` and `..._ledger_currency_names.sql`: two follow-up read helpers, both gated on "I have a `ledger_entries` row involving this person/currency" rather than friendship or ownership. Needed because a balance's counterparty isn't necessarily a friend (bets don't require it) and a bet's currency is only required to be visible to its *creator* at commitment time — so the *other* participant can end up with a ledger entry referencing a person or currency their own RLS can't otherwise resolve a name for.
- `src/lib/ledger.ts` (types), `src/hooks/use-ledger.ts` (`useMyBalances` — wraps `get_my_balances` plus the two name-resolution RPCs; `useLedgerEntriesBetween` — the BAL-02 drill-down query for one counterparty/currency/group). New `src/app/balances.tsx` screen: BAL-01's consolidated per-counterparty list, tap a row to expand BAL-02's underlying source-event history inline. Home screen's Balances card replaced its placeholder text with the top 3 real balances, linking through to `/balances`.

Verification performed:

- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db` all pass — all nine pgTAP suites run together against one fresh database with no conflicts. (Typed routes for the new `/balances` screen needed a brief `expo start` run to regenerate `.expo/types/router.d.ts` before `tsc` would recognize the route — same one-time step every new route has needed all session.)
- `supabase/tests/ledger.test.sql`: 14 pgTAP assertions — the PRD's own worked example produces the exact expected entry; direct insert/update/delete all denied; `get_my_balances` correct for both parties; RLS (an uninvolved user sees nothing); a tied bet posts zero entries; an approved manual obligation posts the right entry; multiple entries between the same pair net correctly; a non-friend counterparty's name resolves via the ledger relationship (not friendship); a currency invisible via direct RLS resolves via the ledger relationship; anon has zero table access.
- Live in a real browser against `noshot-dev`, signed in as `davetest4`: Home's Balances card correctly read "All settled up" (the one already-resolved "Coin flip" bet between Dave and Alice predates this migration, so it never posted a ledger entry — expected, not a bug). Proposed a manual obligation (Alice owes Dave 3 Chore) to generate a fresh entry, switched to `alicetest2`, approved it — Alice's Home card immediately showed "You owe: Dave Test — 3 Chore"; `/balances` showed the same consolidated row, and tapping it correctly expanded the drill-down to the underlying "Manual obligation / You owed / 3 Chore" entry, confirming BAL-01 and BAL-02 both work end-to-end.
- **Not live-verified**: the bet-settlement ledger path itself (as opposed to the manual-obligation path) — RPC/pgTAP-verified only in this pass, since exercising it live would mean re-resolving a bet the way Milestone 8 already did live. Native iOS/Android (same standing gap as every milestone to date).

## Milestone 8 — Resolution & disputes — done (2026-07-19)

What shipped:

- `supabase/migrations/20260719090000_bet_resolution_status.sql`: adds `pending_result`/`disputed`/`resolved`/`tied` to the `bet_status` enum (own migration, same same-transaction restriction as every other enum addition this project). Deliberately does _not_ add a `settled` status, even though Appendix A.1 shows "resolved -> settled" — nothing in RES-01..07 or §9.3 operates on a bet-level settled state; settlement is a ledger/obligation-level concept (§5.5), Milestone 11's territory, not this bet's own status.
- `supabase/migrations/20260719090500_bet_resolution.sql`: `bet_result_submissions`/`bet_result_confirmations`/`dispute_resolutions` (all three already named RPC-only in `ARCHITECTURE.md` §6 from the start) plus `bet_dispute_votes` (an addition beyond the PRD's own table list, same treatment as `bet_cancellation_approvals`, needed to implement group-vote fairly). `submit_bet_result()`, `confirm_bet_result()` (unanimous confirmation on any single submission finalizes it — including a disputed bet, which is exactly how a dispute with no configured fallback organically resolves per §5.4: "remains disputed until affected participants agree"), `resolve_dispute()` (judge only), `vote_on_dispute()` (group vote, finalizes once every active group member has voted, plurality wins), `trigger_random_fallback()` (picks uniformly among _submitted_ outcomes only, per Appendix B — never an outcome nobody actually claimed). "Tie" is a reserved outcome key always valid regardless of whether the bet has an explicit tie side, since Milestone 6's creation UI doesn't expose adding one yet but PRD §5.2 treats tie as a default outcome.
- Scope note, same pattern as Milestone 10's ledger deferral: at the time this milestone shipped, resolution determined and recorded the final outcome (`bets.resolved_outcome_key`, status -> `resolved`/`tied`) but did not write ledger entries, since `ledger_entries` didn't exist yet. Milestone 9 has since closed this gap by extending `_finalize_bet_resolution()` in place — see that section above.
- `src/hooks/use-bets.ts`: `useSubmitBetResult`, `useConfirmBetResult`, `useResolveDispute`, `useVoteOnDispute`, `useTriggerRandomFallback`; `useBetDetail` returns `resultSubmissions`/`resultConfirmations`/`disputeVotes`/`disputeResolution`/`participantProfiles`; `useMyBets` gained `resolutionPendingBets` (same "needs _your_ attention" logic as pending/cancellation) and `resolvedBets`.
- `src/app/bet/[betId].tsx`: a "Result" section covering every status from `active` through `resolved`/`tied` — submission form (outcome picker built from the bet's sides plus a "Tie" option, optional rationale), a list of all submissions with per-submission confirm state, a vote tally when a group-vote dispute is in progress, and resolution-method-specific action panels (submit for whoever's authorized per the configured method; judge-resolve panel only for the actual judge; vote panel for group members; a random-fallback trigger behind a `ConfirmationDialog` since it's irreversible).
- `src/app/(tabs)/index.tsx`: bets awaiting the user's result confirmation now show under "Needs your attention"; a new "Recently resolved" section lists resolved/tied bets (previously they'd have had nowhere to go once they left "Active bets").

One real bug found and fixed during live verification: the "Result" card read "Dave Test wins wins" — Milestone 6 already stores side labels as "{name} wins" (fixed grammar there for the same reason), so appending " wins" again in this new resolved-state display duplicated it. Fixed by using the stored label as-is.

Verification performed:

- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db` all pass — all eight pgTAP suites run together against one fresh database with no conflicts.
- `supabase/tests/bet_resolution.test.sql`: 15 pgTAP assertions covering every resolution path — unanimous confirmation resolves; conflicting submissions dispute the bet; a disputed bet resolves once participants converge on one submission (no fallback needed); only the judge can submit/resolve on a judge-method bet, and a judge's own second conflicting submission is what disputes a judge-method bet (since only the judge may submit at all); group vote requires full participation and the majority outcome wins; random fallback always selects one of the outcomes actually submitted; a unanimously confirmed "tie" moves the bet to `tied` rather than `resolved`; RLS boundaries and anon zero-access.
- Live in a real browser against `noshot-dev`, driving `davetest4` and `alicetest2` through every UI-reachable path on real bets: submit a result → the other party sees "Needs your attention" → submitting a _conflicting_ result correctly disputes the bet, showing both submissions with independent confirm state → confirming the other side's submission (rather than insisting on your own) correctly converges the dispute to `resolved` with the right outcome, matching pgTAP's coverage of that exact path → a separate bet resolved via a unanimously confirmed "Tie" correctly lands on `tied` (not `resolved`) with the right messaging. Home screen checked throughout: resolved/tied bets move into the new "Recently resolved" section and out of "Active bets"; "Needs your attention" correctly scopes to whichever party hasn't yet responded.
- **Not UI-reachable in this pass, but RPC/pgTAP-verified**: judge resolution, group-vote resolution, and random fallback. Milestone 6's creation form only builds direct 1:1 `participant_submission` bets — there's no UI yet to configure a judge, a group-vote bet, or `random_fallback_enabled`, so those panels in `bet/[betId].tsx` exist and are correct but can't be exercised end-to-end without extending the creation form. Same category of gap as Milestone 6's own "group-scoped/multi-way bet creation has no UI yet."
- **Not live-verified**: native iOS/Android (same standing gap as every milestone to date).

## Milestone 7 — Bet cancellation — done (2026-07-18)

What shipped:

- `supabase/migrations/20260718120000_bet_cancellation_status.sql`: adds `cancellation_pending` to the `bet_status` enum, split into its own migration since Postgres rejects using a freshly added enum value inside the same transaction it was added in, and Supabase applies each migration file as one transaction.
- `supabase/migrations/20260718120500_bet_cancellation.sql`: `bet_cancellation_approvals` table (RPC-only, same rationale as the rest of the bet engine) + `propose_cancel_bet()` / `approve_cancel_bet()`. Only applies to an _active_ bet — killing a not-yet-activated proposal already goes through `approve_bet_version()`'s decline path from Milestone 6, since nothing was agreed to yet. Mutual approval required to actually void (BET-09, §5.2); a decline reverts the bet to `active` and clears the failed attempt so a fresh proposal starts clean rather than inheriting stale decisions.
- `src/hooks/use-bets.ts`: `useProposeCancelBet`, `useApproveCancelBet`; `useMyBets` now also surfaces cancellation-pending bets the current user hasn't responded to yet (mirroring the same "needs _your_ attention, not just anyone's" logic from Milestone 6); `useBetDetail` returns `cancellationApprovals`.
- `src/app/bet/[betId].tsx`: a "Cancel bet" action on active bets (behind a `ConfirmationDialog`, since proposing ties up the bet), a "Cancellation" roster section mirroring the main participant list while one is in progress, and "Confirm cancellation" / "Keep this bet" actions for whoever hasn't responded yet.
- `src/app/(tabs)/index.tsx`: cancellation-pending bets needing the current user's response now show under "Needs your attention" too.

Verification performed:

- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db` all pass — all seven pgTAP suites (including the two new ones) run together against one fresh database with no conflicts.
- `supabase/tests/bet_cancellation.test.sql`: 10 pgTAP assertions — only a participant can propose, direct-insert-denied, only an active bet can have cancellation proposed, RLS (uninvolved user sees nothing), a decline reverts to active and clears the attempt, responding to a cancellation that isn't in progress is rejected, unanimous approval voids the bet, anon has zero access.
- Live in a real browser against `noshot-dev`, driving `davetest4` and `alicetest2` through the full loop on the real active bet from Milestone 6's own verification: Alice proposes cancellation → her own bet detail correctly shows no response buttons for her (she already responded by proposing) → Dave's Home screen shows "Someone wants to cancel this bet" under "Needs your attention" (and the bet has dropped out of "Active bets") → Dave declines ("Keep this bet") → bet correctly reverts to `active`, cancellation section clears, "Cancel bet" reappears → Dave proposes again → Alice confirms this time → bet correctly goes `voided`, with the cancellation UI and action buttons both correctly gone.
- **Not live-verified**: native iOS/Android (same standing gap as every milestone to date).

## Milestone 6 — Bet engine core — done (2026-07-18)

What shipped:

- `supabase/migrations/20260718090000_bets_core.sql`: `bets`/`bet_versions`/`bet_sides`/`bet_participants`/`bet_commitments`/`bet_approvals` tables + enums, all RPC-only (no direct client insert/update — extends the RPC-only list in `ARCHITECTURE.md` §6, which previously only named `bet_versions`/`bet_approvals`); `create_or_counter_bet()` (handles both a brand-new proposal and a counteroffer/amendment on an existing one, in one function — validates funding per BET-05, currency consistency, moderates title/description); `approve_bet_version()` (accept/decline, activates on unanimous approval, an outright decline before activation voids the bet outright rather than routing through the bilateral-cancellation flow that's reserved for undoing an already-agreed bet in Milestone 7); `propose_bet_amendment()` (thin wrapper restricted to already-active bets); `submit_draft_bet()` (BET-10's minimal draft-save support); `get_bet_payout_preview()` and `get_bet_participant_profiles()` read helpers.
- `supabase/migrations/20260718091500_bets_participant_profiles.sql`: small follow-up migration adding `get_bet_participant_profiles()` (missed in the first pass — profiles' own RLS is self-select-only, same gap groups/friends already solved with their own helpers). Added as a separate migration rather than editing the already-pushed one.
- Payout model: each commitment declares its own stake and a personal odds ratio (risk:reward, in lowest terms, per PRD §5.3's "ratios only, A:B" rule); `payout_if_win = stake * odds_denominator / odds_numerator`. Funding validation checks, for every possible winning side, that side's total payout doesn't exceed every other side's staked total. Full person-to-person ledger allocation across multiple winners/losers is deliberately left to Milestone 9's `confirm_bet_result()`, which is where the PRD actually scopes that calculation — this milestone only needed creation-time validation and a preview.
- `src/lib/bet.ts`: types + a client-side mirror of the payout/funding math (`computePayoutPreview`, `computeFundingChecks`) for instant UI feedback, advisory only — same pattern as the moderation filter (client checks are fast feedback, the server RPC is authoritative).
- `src/hooks/use-bets.ts`: `useMyBets` (active bets + bets awaiting _this specific user's_ approval — not just "the bet as a whole is unresolved," which would wrongly nag the proposer about their own bet), `useBetDetail`, `useCreateOrCounterBet`, `useApproveBetVersion`, `useProposeBetAmendment`, `useSubmitDraftBet`.
- `src/app/create.tsx`: rebuilt as a real single-screen creation form for a direct 1v1 bet (friend picker, currency picker, title/description, stake+odds for both sides, live payout preview, submit). Scoped to the direct 1v1 case for this first pass — the schema/RPC layer is fully general (group-scoped bets, N participants, N sides all work server-side and are pgTAP-tested), but the wizard UI for those cases isn't built yet. Group-scoped and multi-way bet creation UI, plus counteroffer/amendment UI, are the natural next slice of Milestone 6 if you want more UI surface before moving to Milestone 7.
- `src/app/bet/[betId].tsx` (new route, registered in `_layout.tsx`): bet detail — status, roster with per-participant approval state, payout preview, Approve/Decline (Decline behind a `ConfirmationDialog`, since it's irreversible).
- `src/app/(tabs)/index.tsx`: added an "Active bets" section and folded bet proposals into "Needs your attention", per the design-system decision already on record that bet visibility on Home doesn't require a dedicated nav tab.
- `src/constants/icons.ts`: added `bet: 'flag-outline'` (avoiding gambling-adjacent iconography per PRD §7 constraints).

Two real bugs found and fixed during live verification, not just cosmetic:

1. The outcome label was written from the creator's own perspective ("You win"), so when the _other_ participant viewed the same bet, their screen would show "You win" under the creator's name — confusing and just wrong. Fixed by storing labels in fixed third person ("Dave wins") always, with the creation form's live preview speaking to the composer in first person separately, without persisting that phrasing.
2. `useMyBets`'s "needs your attention" list only checked whether the _bet as a whole_ was still pending, not whether _this specific user_ had already responded — so a proposer kept seeing their own freshly-sent bet nagging them to review it, even though they'd already implicitly approved it by proposing it. Fixed by cross-referencing the caller's own `bet_approvals` rows against the bet's current version.
3. `useInvalidateBetDetail` only invalidated the top-level bet query, not the sides/participants/commitments/approvals sub-queries `useBetDetail` also depends on — so after approving, the top status badge updated but the roster below stayed stale (showing "Pending" and an Approve button for a decision the user had just made). Fixed by restructuring all of `useBetDetail`'s query keys under a shared `['bet-detail', betId, ...]` prefix so one invalidation call catches everything via React Query's default prefix matching.

Verification performed:

- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db` all pass.
- `supabase/tests/bets_core.test.sql`: 17 pgTAP assertions — creator-must-be-participant, direct-insert-denied, payout preview matches the PRD's own worked example exactly, RLS boundaries (uninvolved user sees nothing; group member sees a group bet exists but not its commitments; anon has zero access), unanimous approval activates, duplicate approval rejected, amending an active bet bumps the version and resets approval, approving a stale version rejected, mismatched currencies rejected, an underfunded payout rejected, an outright decline before activation voids the bet, roster-profile helper scoped correctly to participants.
- Live in a real browser against the real `noshot-dev` project, driving two real test accounts (`davetest4`, `alicetest2`) through the full loop: propose a direct bet reproducing the PRD §5.3 worked example exactly (1 meal at 1:2 vs. 2 meals at 2:1) → payout preview matched → the other party saw it under "Needs your attention" (and the proposer did not, confirming bug #2's fix) → approved → bet went active on both accounts' Home screens and detail screens with correct roster/approval state (confirming bug #3's fix) → separately, proposed and declined a second bet, confirming it voids correctly with an instant, correct UI update.
- **Not live-verified**: native iOS/Android (same standing gap as every milestone to date — web only, no simulator/device in this environment).

Known, deliberate scope gaps for this milestone (not bugs, just not built yet):

- Creation UI only covers direct 1:1 bets, not group-scoped or multi-participant/multi-side bets — the backend fully supports both (pgTAP-tested), just no wizard UI yet.
- No counteroffer/amendment UI yet (the RPC and pgTAP coverage exist; a participant can't currently _submit_ a counteroffer from the app, only accept or decline the original terms).
- `random_fallback_enabled` is stored (defaulting `false`) but not exposed as a UI toggle yet — real dispute-resolution logic using it doesn't exist until Milestone 8, so there's nothing yet for a toggle to meaningfully control.
- BET-10 draft-save (`submit_draft_bet()`) is built and RLS-correct but has no UI entry point yet (P1 priority in the PRD).

## Milestone 2 — Google half done, Apple built but unverified

Dashboard setup (done earlier by you): Google Cloud OAuth consent screen + Web/iOS clients, Apple Developer App ID `com.noshot.app.ram` with Sign in with Apple (native-flow only), both providers enabled in Supabase Auth settings for `noshot-dev`.

What shipped:

- `src/lib/supabase.ts`: added `flowType: 'pkce'` — needed so the OAuth redirect carries a single-use `code` rather than tokens directly in the URL.
- `src/lib/oauth.ts`: `signInWithGoogle()` — a browser-redirect flow (`expo-web-browser` + `supabase.auth.signInWithOAuth`), chosen over the native `@react-native-google-signin` module specifically because it works from one code path on web/iOS/Android and doesn't need a custom dev client to test (see the question I asked before starting — you picked this option). `signInWithApple()` — the native `expo-apple-authentication` modal, which hands Supabase an identity token directly via `signInWithIdToken`, no browser redirect involved. `createSessionFromUrl()` is the shared PKCE code-exchange helper both the callback screen and the native Google path use.
- `src/app/auth-callback.tsx`: where the web OAuth redirect lands (native usually resolves in-flow via `expo-web-browser`'s own promise and never needs this screen, but it's a safe fallback for that path too). Reads `code`/`error_description` from the URL, exchanges the code for a session, then routes to `/`.
- `src/app/(auth)/index.tsx`: added "Continue with Google" (always shown) and Apple's official native button component (iOS only, gated by `isAppleSignInAvailable()`).
- `app.json`: added the `expo-apple-authentication` config plugin (adds the `com.apple.developer.applesignin` entitlement on an EAS build — confirmed by reading the plugin source directly, not just assuming).
- `_layout.tsx`: registered `auth-callback` as an ungated route (reachable before a session exists, same reasoning as `invite/[username]`).

Verification performed:

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db` all pass.
- **Google sign-in verified live end-to-end** against the real project, using your real Google account (you drove the actual Google account-chooser/consent steps yourself, not me — that's your real identity, not a disposable test fixture): Continue with Google → Google's real account chooser → consent → redirect through Supabase → our `/auth-callback` → code exchange → landed on the existing `/setup-profile` screen (no code changes needed there — it already handles a session without a profile row regardless of how the session was created) → filled in profile → landed on Home with the full tab bar → Account tab showed the real new profile (`@fluffypancake28`).
  - First attempt failed with "unable to exchange external code" — a Supabase-server-side failure exchanging Google's authorization code for Google tokens, entirely before our app code ever ran. Diagnosed (not something I could see the cause of directly) as almost certainly a Google Cloud/Supabase dashboard mismatch (redirect URI, client secret, or wrong client ID) rather than an app bug, since that exchange happens between Supabase and Google directly. You fixed something on your end and the retry succeeded.
- **Not verified**: Apple sign-in (no iOS simulator/device in this environment — same standing gap as every other iOS-specific piece of this app); Android for either provider (Google's Android OAuth client is deliberately deferred until a real keystore SHA-1 exists from an EAS build).

Known gap: no provider-linking UI (letting an existing email/password user also attach a Google/Apple identity to the same account) — not required by AUTH-01's P0 wording ("support email/password, Google, and Apple sign-in"), so it wasn't built this pass; each sign-in method currently creates/uses its own independent identity.

## Milestones 4 and 5 — done

Built together in one pass (both unblocked, independent of each other) and verified together with one live browser pass, per your call to move faster on lower-risk milestones while keeping the DB test suite as the safety net.

What shipped — Milestone 4 (Groups & membership):

- `supabase/migrations/20260715100000_groups_membership.sql`: `groups` and `group_members` tables (role: owner/member; status: invited/active/left/removed/declined), RLS-locked with all writes through `SECURITY DEFINER` RPCs — `create_group`, `invite_to_group` (blocked-pair check reuses Milestone 3's `is_blocked_pair`), `respond_to_group_invite`, `leave_group`, `remove_member` (owner-only), `archive_group` (owner-only). `get_my_group_ids()` and `get_group_member_profiles()` are the same "security-definer escape hatch" pattern Milestone 3 used for `get_profiles_for_relations`, needed because `profiles`' own RLS only lets a user see their own row.
- `src/app/(tabs)/groups.tsx`: replaces the placeholder — create-group form, pending invites (accept/decline), your active groups list.
- `src/app/group/[groupId].tsx`: group detail — invite-by-username (reuses Milestone 3's `useSearchUsername`), member roster with role/status, remove-member (owner-only), leave/archive actions, plus the group's currencies (see Milestone 5).
- `src/hooks/use-groups.ts`, `src/lib/group.ts`.
- `supabase/tests/groups_membership.test.sql`: covers ownership on create, RLS denial of direct writes, self-invite/duplicate-invite rejection, invite across an active block rejected, non-member visibility denial (both for the group and for `get_group_member_profiles`), accept/decline, owner-only remove/archive enforcement, leave-group, and anon zero-access.
- **Known, deliberate gap (GR-03):** "can't leave with active bets or outstanding obligations" isn't enforced yet because bets/ledger tables don't exist until Milestones 6/9 — there's nothing to check. Flagged in a code comment on `leave_group()` to revisit then.
- **Known, deliberate gap (GR-02):** group invites only work for existing users found via username search; a non-user invite link (the FR-04 pattern from Friends) wasn't built this pass, to keep scope to the two milestones at hand. Noted, not hidden.
- **Known, deliberate gap:** no ownership-transfer path — if the sole owner leaves, the group has no owner (can't be archived or have members removed) until a future milestone adds transfer. Not specified in the PRD; not built speculatively.

What shipped — Milestone 5 (Currencies):

- `supabase/migrations/20260715110000_currencies.sql`: `currencies` table (category enum matches `CurrencyCategoryColors` in `src/constants/theme.ts` — `food`/`drinks`/`items`/`favours`/`chores`/`actions`/`points`/`custom` — rather than the PRD's prose wording verbatim, to line up with the color system already built in Milestone 0). Personal (`owner_user_id`) xor group-owned (`group_id`) xor built-in, enforced by a check constraint. A 7-row built-in catalog seeded (Meal, Coffee, Gift, Favour, Chore, Harmless Dare, Point) — deliberately low-risk only, per PRD §10.2.
- `moderate_text()`: the deterministic keyword/tier moderation filter decided in `DECISIONS.md` #3 (hard-block / warn+queue / permit), written generically so later milestones (bet titles, comments, chat) can call it too. A `BEFORE INSERT` trigger applies it server-side (only for real `anon`/`authenticated` requests, not the migration's own seed insert), overriding whatever the client sent for `is_builtin`/`moderation_status` so neither can be spoofed. Deliberately no slur list — see the code comment and `DECISIONS.md` #3 for why.
- `src/lib/moderation.ts`: an advisory-only client-side mirror of the same tiers, for fast pre-submit feedback; the DB trigger is the actual authority.
- `src/app/currencies.tsx` (personal) and the currencies section of `src/app/group/[groupId].tsx` (group-scoped): create form with a category picker (`src/components/category-picker.tsx`, shared between both screens), list showing built-in/pending-review status.
- `src/hooks/use-currencies.ts`, `src/lib/currency.ts`.
- `supabase/tests/currencies.test.sql`: covers all three moderation tiers, the anti-spoofing trigger override, case-insensitive duplicate-name rejection, personal/group visibility scoping (including a non-member's insert being denied), and anon zero-access.

Also, while building this: moved the error-message helper built for Milestone 3 (`friendErrorMessage`) to a shared `src/lib/errors.ts` (`getErrorMessage`) rather than duplicating the same "Supabase errors aren't `instanceof Error`" logic a third time for groups/currencies. `friends.tsx` and `invite/[username].tsx` now import it from there.

Verification performed:

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db` all pass.
- Both migrations pushed to the real `noshot-dev` project (`supabase db push`).
- Live in a real browser: created a group as `alicetest2`, invited an existing user by username, confirmed a duplicate-invite-while-still-pending shows the real Postgres error (not a generic fallback), created a group currency and hit all three moderation tiers live (benign → approved, "Cocaine Run" → hard-blocked with the real message, "Tequila Shots" → created but flagged "Pending review"), created a fresh account (`davetest4@example.com`) specifically to verify the invite-accept flow end-to-end (saw the invite, accepted, saw the full roster and both group currencies including the pending-review one, then left the group and confirmed it disappeared from his list), and created a personal currency on the standalone Currencies screen. Also confirmed username search correctly excludes a user with an active block (incidental: `caroltest3` had blocked `alicetest2` during Milestone 3's verification, so Alice's search for "carol" correctly returned nothing — not a bug).
- **Not verified**: iOS/Android native (web-only again, same gap as every prior milestone); decline-invite and remove-member weren't clicked through live this pass (both are covered by the DB test suite).

## Milestone 3 — done

What shipped:

- `supabase/migrations/20260715090000_friendships_blocks.sql`: `friendships` (requester/addressee, status enum pending/accepted/declined/cancelled, one-active-relationship-per-pair partial unique index) and `blocks` tables, both RLS-locked with all writes routed through `SECURITY DEFINER` RPCs (`send_friend_request`, `respond_friend_request`, `cancel_friend_request`, `block_user`, `unblock_user`); blocking cancels any active friendship as a side effect (FR-05). `search_profiles_by_username` (prefix search, min 3 chars, excludes self/blocked, rate-limited via `username_search_log` to 20/minute). `get_invite_preview` (anon-callable, exact-username-only, for FR-04 invite links) and `get_profiles_for_relations` (only returns profiles the caller actually has a friendships row with).
- `src/app/friends.tsx`: Friends screen — invite link + QR (`src/components/invite-qr-card.tsx`, via `react-native-qrcode-svg`), debounced username search, incoming/outgoing request lists, friends list with block action.
- `src/app/invite/[username].tsx`: deep-link invite preview, reachable outside the auth guard in `_layout.tsx` so a signed-out visitor can preview before creating an account, then add-as-friend once signed in.
- `src/hooks/use-friends.ts`, `src/lib/friend.ts`: React Query hooks for all the above; `friendErrorMessage()` helper (see bug note below).
- `supabase/tests/friendships_blocks.test.sql`: behavior tests for every RPC and RLS boundary (self-request rejected, direct table writes denied, duplicate-request rejected, only-addressee-can-respond, block cancels friendship, block prevents re-request, search excludes self/blocked/too-short, anon has zero table access but can still hit `get_invite_preview`). `scripts/test-db.sh` updated to wrap each test file in its own `begin/rollback` so fixture data (e.g. same usernames) can't collide across files sharing one throwaway database.

Bug found and fixed during live verification:

- Supabase RPC/query errors come back as **plain objects**, not `Error` instances (`postgrest-js` only upgrades to a real `PostgrestError` under `.throwOnError()`, which these hooks don't use — confirmed by reproducing against the real project with a raw `supabase-js` script). The friends UI's `error instanceof Error ? error.message : fallback` checks were therefore always false, silently swallowing every real error message (e.g. "a pending or accepted friendship with this user already exists") behind a generic "Something went wrong" / "Search failed". Fixed by adding `friendErrorMessage()` in `src/lib/friend.ts` (checks for a `.message` string property instead of `instanceof Error`) and using it in `friends.tsx` and `invite/[username].tsx`. Confirmed fixed live: the duplicate-request case now shows the real Postgres message. Auth screens were unaffected — `supabase-js`'s `AuthError` really does extend `Error`, so their existing `error.message` usage was always fine; it's specifically the postgrest/RPC path that returns plain objects.

Verification performed:

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db` all pass.
- Migration pushed to the real `noshot-dev` project (`supabase db push`).
- Live in a real browser, using three real accounts against the real project (`bobtest`, plus two fresh signups `alicetest2`/`caroltest3`): anon invite-preview (shows create-account/sign-in prompt, no add-friend button), signed-in invite-preview add-as-friend, username search (debounced, finds prefix matches), duplicate-request error surfaced correctly (post-fix), sent-requests list + cancel-affordance, incoming-request accept flow, resulting friends-list entry on both sides, block action, and confirmed a blocked user no longer appears in the blocker's search results. Not tested: decline, cancel, unblock (code paths match the DB-test-verified RPCs but weren't clicked through in the browser).
- **Not verified**: iOS/Android native (web-only again this milestone, same gap as Milestones 0/1).

Known gaps / cleanup notes:

- Three throwaway test accounts now exist in the real `noshot-dev` project's auth: `bobtest` (pre-existing), `alicetest2@example.com`, `caroltest3@example.com` (both password `TestPass123!`, created this session for the two/three-account verification above). No account-deletion UI exists yet to remove them; harmless dev-project clutter for now.
- `app.json` picked up an iOS `bundleIdentifier` / Android `package` of `com.noshot.app.ram` and `package.json`/`package-lock.json` picked up `react-native-qrcode-svg` + `react-native-svg` — all uncommitted as of this writeup, along with everything else listed above.

## Milestone 1 — done

What shipped:

- `supabase/migrations/20260714120000_profiles.sql`: `profiles` table (id references `auth.users`, username, display_name, birth_year, age_acknowledged_at, status, timestamps), a case-insensitive-while-live unique username index, a server-side min-age-16 trigger (`enforce_min_age`), default-deny RLS with self-select/insert/update-only policies, `anon` fully revoked.
- `supabase/seed.sql`: local-dev-only demo profiles (for future `supabase start` use — not run against the real project).
- `src/lib/supabase.ts`: Supabase client with a `LargeSecureStore` adapter (SecureStore-held AES key + AsyncStorage-held ciphertext, since SecureStore's ~2KB limit is too small for session tokens) on native, plain AsyncStorage on web, and a no-op storage on web SSR (fixed a real crash: Expo Router's web output does a Node.js SSR pass with no `window`, which the naive storage adapter didn't account for).
- Auth screens: `src/app/(auth)/index.tsx` (sign in), `src/app/(auth)/sign-up.tsx` (handles both instant-session and confirmation-required project configs), `src/app/setup-profile.tsx` (display name, username, birth year, required age-acknowledgement checkbox — all validated client-side to match the DB constraints, with the DB as the authoritative check).
- Routing: `src/app/_layout.tsx` uses Expo Router's current `Stack.Protected guard={...}` API (confirmed via package inspection, not just docs) to route no-session → auth screens, session-without-profile → setup screen, both → main tabs.
- Account tab now shows the real `@username · Display Name` and a working sign-out button.
- New `src/components/ui/text-field.tsx` primitive; `Button` gained a real disabled-state style.
- `scripts/test-db.sh` + `supabase/tests/profiles_rls.test.sql`: a committed, repeatable RLS/behavior test suite that spins up a throwaway local Postgres cluster (no Docker needed — just `postgres`/`initdb`/`psql`), stubs the parts of Supabase's schema the migration depends on, applies every migration, and asserts: underage signup rejected, duplicate username rejected, a user sees/can-modify only their own profile row, and `anon` has zero table access. Wired into CI (`npm run test:db`).

Verification performed:

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check`, `npm run test:db` all pass.
- Deliberately broke an assertion in the DB test and confirmed the harness fails loudly (nonzero exit) — not just a script that always prints "passed."
- Live end-to-end in a real browser against the real Supabase project: sign-up (with a fresh test account) → setup-profile → landed on Home with full tab bar → Account tab showed the real profile → sign-out → routed back to sign-in → sign-in with the same account → routed straight to Home (correctly skipping setup-profile since the row already exists). Zero console errors throughout.
- Confirmed (before disabling it) that the confirmation-required path also works: sign-up with confirmation ON correctly showed "check your email," and a real confirmation email arrived from Supabase Auth.
- **Not verified**: iOS/Android native builds (still no simulator available this session — same gap as Milestone 0).

Known, tracked gaps (see `DECISIONS.md` #6 and #7):

- **"Confirm email" is currently OFF** in the Supabase project's Auth settings — a deliberate dev-convenience change made during this milestone's verification. **Must be turned back on before any real-user testing or launch.**
- Sign-up doesn't yet pass `emailRedirectTo`, so once email confirmation is back on, clicking the confirmation link lands on a generic Supabase page rather than back in the app. Also not yet handling Supabase's account-enumeration protection (fake-success on an already-registered email). Both are small, well-understood follow-ups, not done yet.

Pushed to GitHub (`origin/master`). **CI has run and is currently failing** on both pushes so far — `tsc --noEmit` errors on `import '@/global.css'` in `src/constants/theme.ts` because CI never regenerates the gitignored `expo-env.d.ts`/`.expo/types/**` that `tsconfig.json` depends on for that ambient module type (works locally only because those files already exist on disk from a prior `expo start`). Needs a CI-workflow fix (e.g. a step to regenerate those types before typecheck, or committing a small dedicated `.d.ts` for the CSS module declaration) — not yet fixed as of this writeup.

## Milestone 10 — Manual obligations & adjustments — done (2026-07-18)

Built independently on branch `milestone-10-manual-obligations`, in parallel with live work on Milestone 6 elsewhere — see that branch's own history for the actual commit(s). Summary:

Shipped: `manual_obligation_proposals` table + `propose_manual_obligation()` / `approve_manual_obligation()` / `decline_manual_obligation()` / `cancel_manual_obligation()` RPCs (RPC-only, per `ARCHITECTURE.md` §6); a pgTAP behavior test covering the full propose/approve/decline/cancel lifecycle, RLS boundaries, and validation errors; an Obligations screen reachable from Friends.

Verified: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db`, `npm run format:check` all pass. **Not live-verified in a browser** — no browser available in this environment.

Deliberately deferred / scoped down (see `IMPLEMENTATION_PLAN.md`'s Milestone 10 entry for the full reasoning):

- No ledger write yet at the time this milestone shipped — `ledger_entries` didn't exist until Milestone 9, which has since extended `approve_manual_obligation()` in place to post the entry on approval. See Milestone 9's section above.
- Scoped to friends only (an accepted friendship is required between the two parties), not general group members.
- Currency choice is restricted to built-ins or shared-group currencies — a party's personal currency was deliberately excluded, since the other party's own `currencies` RLS wouldn't let them see it to render it.

Did **not** run `supabase db push` from this branch, to avoid colliding with the concurrent Milestone 6 work's real pushes — the real push against `noshot-dev` is left for whenever this branch gets merged and reviewed.

## Milestone status

| #     | Milestone                                | Status                                                                  |
| ----- | ---------------------------------------- | ----------------------------------------------------------------------- |
| 0     | Repo & tooling foundation                | Done                                                                    |
| 1     | Supabase bootstrap + email/password auth | Done — see below                                                        |
| 2     | Google + Apple sign-in                   | Google done & verified live; Apple built, unverified (no iOS simulator) |
| 3     | Friends & blocks                         | Done — committed and pushed                                             |
| 4     | Groups & membership                      | Done — committed and pushed                                             |
| 5     | Currencies                               | Done — committed and pushed                                             |
| 6     | Bet engine core                          | Done and live-verified — see above. Direct 1:1 creation UI only so far. |
| 7     | Bet cancellation                         | Done — merged to master                                                 |
| 8     | Resolution & disputes                    | Done — merged to master                                                 |
| 9     | Ledger & balances                        | Done and live-verified — see above, not yet merged to master            |
| 10    | Manual obligations & adjustments         | Done — merged to master                                                 |
| 11–16 | See `IMPLEMENTATION_PLAN.md`             | Not started                                                             |

## Open items waiting on you

- Merge branch `milestone-9-ledger-balances` to master whenever convenient — quality-bar-passing, live-verified on the manual-obligation ledger path (BAL-01/02 UI); bet-settlement ledger path verified via pgTAP only.
- Apple sign-in needs testing on a real device or simulator whenever you have one available — the code path has never actually run.
- Native iOS/Android still has zero live verification across every milestone to date — web is the only platform actually driven in a real browser so far. Worth a native smoke test before the app gets much bigger.
- Bet creation UI currently only covers direct 1:1 `participant_submission` bets — no UI yet for group-scoped/multi-way bets, counteroffers, or configuring a judge/group-vote/random-fallback resolution method. All of that is fully built and tested on the backend, just not reachable through the creation form yet.
- Test accounts in `noshot-dev`: `bobtest`, `alicetest2@example.com`, `caroltest3@example.com`, `davetest4@example.com` (password `TestPass123!` except `bobtest`), plus a real Google identity (`fluffypancake28`) from earlier OAuth verification — harmless, flagging in case you want to clean the dashboard later. Dave and Alice have two resolved test bets between them from Milestone 8's live verification (one "resolved," one "tied") that predate the ledger and so post no balance, plus a fresh 3-Chore manual obligation from Milestone 9's live verification that does.
- `DECISIONS.md` #6 — turn "Confirm email" back on in Supabase Auth settings before any real-user testing. Not urgent while still in solo dev/testing.
- `DECISIONS.md` #7 — decide whether to add the `emailRedirectTo` deep-link callback flow now or later; should land before #6 is flipped back on.

## How to keep this file useful

Update this file and the milestone table in `IMPLEMENTATION_PLAN.md` at the end of every milestone: what shipped, what tests were run and passed, what's still open, and what the next milestone is.
