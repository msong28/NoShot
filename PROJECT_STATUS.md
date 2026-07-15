# NoShot — Project Status

Last updated: 2026-07-15 (Milestone 3 complete).

## Where things stand

- Milestones 0, 1, and 3 are complete and verified. See below. (Milestone 2 — Google/Apple sign-in — is skipped for now, blocked on external dashboard accounts; Milestone 3 only depends on Milestone 1, so it was done out of order.)
- Real Supabase project is live and linked: `noshot-dev` (ref `tckpbwvzxxovnsvdtwee`). `profiles`, `friendships`, `blocks`, and `username_search_log` tables + RLS are deployed to it.
- Email/password auth works end-to-end against the real project: sign-up, setup-profile, sign-out, sign-in all verified live in a browser.
- No CI run has happened yet: the workflow exists but nothing has been pushed to a GitHub remote.
- Planning docs: `ARCHITECTURE.md`, `DECISIONS.md`, `IMPLEMENTATION_PLAN.md`, this file.

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

Not pushed to GitHub — no remote configured. CI will not run until you create one and push.

## Milestone status

| #    | Milestone                                | Status                                                                                                  |
| ---- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 0    | Repo & tooling foundation                | Done                                                                                                    |
| 1    | Supabase bootstrap + email/password auth | Done — see above                                                                                        |
| 2    | Google + Apple sign-in                   | Not started — blocked on Google Cloud / Apple Developer Program accounts (see `IMPLEMENTATION_PLAN.md`) |
| 3    | Friends & blocks                         | Done — see above                                                                                        |
| 4–16 | See `IMPLEMENTATION_PLAN.md`             | Not started                                                                                             |

## Open items waiting on you

- Nothing is committed yet from Milestone 3 — `git status` shows it all as modified/untracked. Let me know when you want it committed (and whether as one commit or split).
- Three test accounts now exist in the real `noshot-dev` project from this milestone's live verification (`bobtest`, `alicetest2@example.com`, `caroltest3@example.com`) — harmless, but flagging in case you want to clean them out of the dashboard later.
- `DECISIONS.md` #6 — turn "Confirm email" back on in Supabase Auth settings before any real-user testing (exact dashboard path is in that entry). Not urgent while still in solo dev/testing.
- `DECISIONS.md` #7 — decide whether to add the `emailRedirectTo` deep-link callback flow now or later; should land before #6 is flipped back on.
- `DECISIONS.md` #2 — resolve the PRD's judge/group-vote vs. "random fallback" contradiction (needed before Milestone 8, not before Milestone 4).
- For Milestone 2 (Google + Apple sign-in): Google Cloud Console OAuth client setup, Apple Developer Program enrollment — see `IMPLEMENTATION_PLAN.md` Milestone 2 for exact steps, only needed when you're ready to start that milestone.
- Optional: recommend a native (iOS/Android) smoke test before building further, since only web has been verified live so far (Milestones 0, 1, and 3 all).
- Optional: create a GitHub remote if/when you want CI to actually execute.

## How to keep this file useful

Update this file and the milestone table in `IMPLEMENTATION_PLAN.md` at the end of every milestone: what shipped, what tests were run and passed, what's still open, and what the next milestone is.
