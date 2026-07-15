# NoShot — Project Status

Last updated: 2026-07-14 (Milestone 0 complete).

## Where things stand

- Milestone 0 (repo & tooling foundation) is complete and verified. See below.
- No Supabase project, no backend code, no state-management wiring yet (client libs are installed, not yet used — that's Milestone 1).
- No CI run has happened yet: the workflow exists but nothing has been pushed to a GitHub remote.
- Planning docs: `ARCHITECTURE.md`, `DECISIONS.md`, `IMPLEMENTATION_PLAN.md`, this file.

## Milestone 0 — done

What shipped:

- Initial git commit of the baseline scaffold + planning docs, then Milestone 0 work on top.
- Installed `@supabase/supabase-js`, `@tanstack/react-query`, `expo-secure-store` (client wiring comes in Milestone 1); added `.env.example` and gitignored `.env`.
- Jest (`jest-expo`) + React Native Testing Library configured (`jest.config.js`, `babel.config.js`); 4 passing tests across 2 suites.
- ESLint (`eslint-config-expo`) + Prettier configured and reconciled (`eslint-config-prettier`); one pre-existing lint violation in the stock `use-color-scheme.web.ts` hydration hook suppressed with a documented inline reason (it's the correct, intentional pattern; the lint rule is new).
- GitHub Actions CI workflow (`.github/workflows/ci.yml`): format check, lint, typecheck, test. Triggers on push to `main`/`master` and on PRs — will only actually run once you push to a GitHub remote.
- Replaced the experimental `expo-router/unstable-native-tabs` with a cross-platform headless tab bar built on `expo-router/ui` (`Tabs`/`TabList`/`TabTrigger`/`TabSlot`) — the same stable API the stock template already used for its web variant, now unified across all platforms into one `src/components/app-tabs.tsx`. Five destinations: Home, Groups, Add (opens `/create` as a modal via `Stack.Screen` `presentation: 'modal'`, not a persistent tab), Activity, Account — matching PRD §7.1.
- Removed template demo-only screens/components tied to the old two-tab welcome flow (`explore.tsx`, old `index.tsx`, `hint-row.tsx`, `web-badge.tsx`, `collapsible.tsx`, the decorative half of `animated-icon.*`) — kept the real splash-transition logic (`AnimatedSplashOverlay`).
- Expanded design tokens (`src/constants/theme.ts`): `accent`/`accentText`/`border`/`positive`/`negative` colors per theme, a `CurrencyCategoryColors` map, and `Radii` tokens — first step toward the black-base/vibrant-accent Partiful direction.
- First `src/components/ui` primitives: `Button`, `Card`, `Badge` (Badge always pairs a color with a text label, per the PRD's "never colour alone" rule), each with a passing render test.

Verification performed:

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check` all pass.
- `npx expo-doctor`: 20/20.
- Booted the app with `expo start --web` and drove it in a real browser: all 5 destinations (Home, Groups, Add/Create modal, Activity, Account) navigate correctly, the modal opens and closes correctly, no console errors.
- **Not verified**: iOS/Android native builds. No simulator/emulator was available in this environment this session (no booted iOS simulator, no `emulator`/`adb` on PATH). The tab bar uses the same cross-platform `expo-router/ui` primitives the stock template already shipped (proven on native previously), so risk is low, but this has not been directly observed running on iOS or Android. Recommend a native smoke test (`npx expo run:ios` / `run:android` or Expo Go) before or during Milestone 1.

Not pushed to GitHub — no remote configured. CI will not run until you create one and push.

## Milestone status

| #    | Milestone                                | Status                                                              |
| ---- | ---------------------------------------- | ------------------------------------------------------------------- |
| 0    | Repo & tooling foundation                | Done — see above                                                    |
| 1    | Supabase bootstrap + email/password auth | Not started — blocked on you creating a Supabase project            |
| 2    | Google + Apple sign-in                   | Not started (blocked on M1, and on Google/Apple developer accounts) |
| 3–16 | See `IMPLEMENTATION_PLAN.md`             | Not started                                                         |

## Open items waiting on you

- Nothing blocking to start Milestone 1 except creating a Supabase project (see `IMPLEMENTATION_PLAN.md` Milestone 1).
- `DECISIONS.md` #2 — resolve the PRD's judge/group-vote vs. "random fallback" contradiction (needed before Milestone 8, not before M1).
- Optional: recommend a native (iOS/Android) smoke test of the new tab bar before it's built on further, since only web was verified live this session.
- Optional: create a GitHub remote if/when you want CI to actually execute.

## How to keep this file useful

Update this file and the milestone table in `IMPLEMENTATION_PLAN.md` at the end of every milestone: what shipped, what tests were run and passed, what's still open, and what the next milestone is.
