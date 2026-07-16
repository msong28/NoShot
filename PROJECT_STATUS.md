# NoShot — Project Status

Last updated: 2026-07-15 (Milestone 2 — Google sign-in built and verified live; Apple sign-in built, unverified).

## Where things stand

- Milestones 0, 1, 2 (Google half), 3, 4, and 5 are complete. See below. (Milestone 2's Apple half is built but not live-verified — no iOS simulator/device available in this environment, same gap as the rest of the app's iOS-specific code.)
- Real Supabase project is live and linked: `noshot-dev` (ref `tckpbwvzxxovnsvdtwee`). `profiles`, `friendships`, `blocks`, `username_search_log`, `groups`, `group_members`, and `currencies` tables + RLS are deployed to it.
- Email/password **and now Google** sign-in both work end-to-end against the real project, verified live in a browser. Apple sign-in is coded but untested (native-only, no simulator here).
- Milestones 3, 4, and 5 are committed (`8b14dc5` and earlier) and pushed. Milestone 2 is not yet committed as of this writeup.
- **CI is currently red** on both pushes so far (`tsc --noEmit` failure, unrelated to product code — see the Milestone 1 section below and "Open items"). Not fixed as part of this milestone; flagging so it doesn't get lost.
- Planning docs: `ARCHITECTURE.md`, `DECISIONS.md`, `IMPLEMENTATION_PLAN.md`, this file.

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

## Milestone status

| #    | Milestone                                | Status                                                                  |
| ---- | ---------------------------------------- | ----------------------------------------------------------------------- |
| 0    | Repo & tooling foundation                | Done                                                                    |
| 1    | Supabase bootstrap + email/password auth | Done — see above                                                        |
| 2    | Google + Apple sign-in                   | Google done & verified live; Apple built, unverified (no iOS simulator) |
| 3    | Friends & blocks                         | Done — committed and pushed                                             |
| 4    | Groups & membership                      | Done — committed and pushed                                             |
| 5    | Currencies                               | Done — committed and pushed                                             |
| 6–16 | See `IMPLEMENTATION_PLAN.md`             | Not started                                                             |

## Open items waiting on you

- **CI is red** — both GitHub Actions runs so far have failed on `npm run typecheck` (`Cannot find module or type declarations for side-effect import of '@/global.css'`), because CI never regenerates the gitignored `expo-env.d.ts`/`.expo/types` that `tsconfig.json` relies on. Needs a workflow fix; flagging here so it doesn't get missed since local `npm run typecheck` still passes and hides the problem. Not touched this session — say the word if you want it fixed.
- Milestone 2 isn't committed yet — let me know when you want it committed/pushed.
- Apple sign-in needs testing on a real device or simulator whenever you have one available — the code path has never actually run.
- A fifth Google-created account now exists in `noshot-dev` from live verification (`fluffypancake28`, a real Google identity, not one of the disposable test-password accounts) — nothing to clean up on my end, just flagging it exists.
- Four test accounts also exist from Milestones 3-5 verification (`bobtest`, `alicetest2@example.com`, `caroltest3@example.com`, `davetest4@example.com`, test password `TestPass123!` except `bobtest`) — harmless, flagging in case you want to clean them out of the dashboard later.
- `DECISIONS.md` #6 — turn "Confirm email" back on in Supabase Auth settings before any real-user testing (exact dashboard path is in that entry). Not urgent while still in solo dev/testing.
- `DECISIONS.md` #7 — decide whether to add the `emailRedirectTo` deep-link callback flow now or later; should land before #6 is flipped back on.
- `DECISIONS.md` #2 — resolve the PRD's judge/group-vote vs. "random fallback" contradiction (needed before Milestone 8, not before Milestone 6).
- Optional: recommend a native (iOS/Android) smoke test before building further, since only web has been verified live so far (every milestone to date) — this is now more pressing given Apple sign-in specifically needs it.

## How to keep this file useful

Update this file and the milestone table in `IMPLEMENTATION_PLAN.md` at the end of every milestone: what shipped, what tests were run and passed, what's still open, and what the next milestone is.
