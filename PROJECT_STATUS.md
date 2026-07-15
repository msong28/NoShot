# NoShot — Project Status

Last updated: 2026-07-14 (initial audit, no milestones started yet).

## Where things stand

- Repo is an unmodified `create-expo-app` scaffold: Expo SDK 57.0.4, Expo Router 57.0.4, React Native 0.86.0 (New Architecture only), React 19.2.3, TypeScript 6.0.3. `expo-doctor` passes 20/20.
- No git commits yet, no remote configured.
- No Supabase project, no backend code, no `.env` handling, no state-management library.
- No test tooling (Jest, Playwright, Maestro) installed.
- No CI configured.
- Navigation currently uses the experimental `expo-router/unstable-native-tabs` with 2 placeholder tabs (Home, Explore) from the template — slated for replacement (see `DECISIONS.md` #1).
- Styling: hand-rolled token system (`ThemedText`/`ThemedView`/`constants/theme.ts`), no NativeWind.
- Planning docs created this session: `ARCHITECTURE.md`, `DECISIONS.md`, `IMPLEMENTATION_PLAN.md`, this file.

## Milestone status

| # | Milestone | Status |
|---|---|---|
| 0 | Repo & tooling foundation | Not started — recommended next |
| 1 | Supabase bootstrap + email/password auth | Not started (blocked on M0, and on you creating a Supabase project) |
| 2 | Google + Apple sign-in | Not started (blocked on M1, and on Google/Apple developer accounts) |
| 3–16 | See `IMPLEMENTATION_PLAN.md` | Not started |

## Open items waiting on you

- `DECISIONS.md` #1 — confirm dropping `NativeTabs` for a custom JS tab bar.
- `DECISIONS.md` #2 — resolve the PRD's judge/group-vote vs. "random fallback" contradiction (needed before Milestone 8, not before M0).
- Nothing needed to start Milestone 0 itself.

## How to keep this file useful

Update this file and the milestone table in `IMPLEMENTATION_PLAN.md` at the end of every milestone: what shipped, what tests were run and passed, what's still open, and what the next milestone is.
