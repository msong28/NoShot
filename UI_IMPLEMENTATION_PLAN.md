# NoShot — UI Implementation Plan

Rollout plan for the design system in `DESIGN_SYSTEM.md`. Update the status column as work lands.

## Phase 1 — Audit (done, 2026-07-16)

Findings folded into `DESIGN_SYSTEM.md` and `DECISIONS.md`: theming was OS-only with no persistence or toggle; tokens existed (`src/constants/theme.ts`) but were thin (flat color list, no semantic roles, one raw hex leaked outside the system); no icon library was in use; motion was used exactly once (splash icon); no custom fonts were loaded. Two conflicts with the PRD/prior decisions found and resolved — see `DECISIONS.md`.

## Phase 2 — Design system foundation

| Item                                                                             | Status |
| -------------------------------------------------------------------------------- | ------ |
| Semantic color tokens (`src/constants/theme.ts`, extended)                       | Done   |
| Typography scale (`src/constants/typography.ts`)                                 | Done   |
| Shadows/elevation (`src/constants/shadows.ts`)                                   | Done   |
| Motion tokens (`src/constants/motion.ts`)                                        | Done   |
| Breakpoints (`src/constants/breakpoints.ts`)                                     | Done   |
| Icon registry (`src/constants/icons.ts`, `@expo/vector-icons`)                   | Done   |
| Component-variant maps (`src/constants/component-variants.ts`)                   | Done   |
| Theme provider + persistence + dark-default (`src/providers/theme-provider.tsx`) | Done   |
| `Button` variants + loading state                                                | Done   |
| `Icon`, `IconButton`                                                             | Done   |
| `Screen` layout primitive                                                        | Done   |
| `Card` (+ elevated variant)                                                      | Done   |
| `ListRow`                                                                        | Done   |
| `Avatar`, `AvatarStack`                                                          | Done   |
| `StatusBadge`                                                                    | Done   |
| `CurrencyLabel`                                                                  | Done   |
| `EmptyState`, `SectionHeader`, `Divider`                                         | Done   |
| `InlineError`, `Skeleton`                                                        | Done   |
| `SegmentedControl`, `ThemeToggle`                                                | Done   |
| `Modal`, `ConfirmationDialog`                                                    | Done   |
| `Toast` + `ToastProvider`/`useToast()`                                           | Done   |
| `TextField` `variant="search"`                                                   | Done   |
| Visual reference screen (`src/app/design-system.tsx`)                            | Done   |

## Phase 3 — Representative screens (done, 2026-07-16)

Swapped from the original brief's list (Bet detail/creation, Balances) to screens with real data today — see `DECISIONS.md` for why.

| Screen                               | Existing state                                                          | Components it uses                                                                       | Status |
| ------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------ |
| Sign-in (`(auth)/index.tsx`)         | Functional, unstyled default look                                       | `Screen`, `Button`, `TextField`, `InlineError`, headings                                 | Done   |
| Home (`(tabs)/index.tsx`)            | Functional; Friends/Currencies cards; owed/owing still placeholder text | `Screen`, `Card`, `ListRow`, `Avatar`, `StatusBadge`, `SectionHeader`, `EmptyState`      | Done   |
| Group detail (`group/[groupId].tsx`) | Functional; roster, invite, currencies                                  | `ListRow`, `Avatar`, `StatusBadge`, `ConfirmationDialog`, `InlineError`, `SectionHeader` | Done   |
| Friends (`friends.tsx`)              | Functional; search, requests, friend list                               | `ListRow`, `Avatar`, `ConfirmationDialog`, `InlineError`, `EmptyState`, `SectionHeader`  | Done   |
| Currencies (`currencies.tsx`)        | Functional; built-ins + custom creation                                 | `ListRow`, `StatusBadge`, `InlineError`, `SectionHeader`, category picker (kept)         | Done   |

Two screens picked up confirmation dialogs they didn't have before: leaving/archiving a group, and blocking a friend, now confirm before acting instead of firing immediately.

## Phase 4 — Review consistency (done, 2026-07-16)

Checklist result: no one-off inline styles left in the five screens above; component APIs (`Screen`, `ListRow`, `Avatar`, `StatusBadge`, `ConfirmationDialog`, `InlineError`, `SectionHeader`, `EmptyState`) held up across all five without special-casing; both themes checked live on each; existing functionality re-verified identical to before the visual pass — friend request send/cancel/accept/decline, block-with-confirmation, group create/invite/leave-with-confirmation/archive-with-confirmation, currency creation (built-in list + custom + pending-review badge), sign-out/sign-in. No regressions found.

## Phase 5 — Full rollout

Not started. Remaining screens: Groups list, Activity (placeholder), Account, Sign-up, Setup-profile, Create (placeholder), Invite preview, Auth callback. Bet/Balance/Chat/Comment/Poll screens get the system applied as their milestones are actually built (6, 9, 12), not ahead of them.

## Verification log

- 2026-07-16: Phase 2 — `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db` all pass. Design system screen checked live in a real browser: both themes (typography scale, all 15 color tokens, all 5 button variants including loading/disabled, inputs with the search variant, rows with Avatar/AvatarStack/StatusBadge, currency labels, empty state, skeleton, modal, confirmation dialog, toast); theme choice persists across a full reload; spot-checked an existing real screen (Friends) in both themes to confirm no regression from the Button/Card/ThemedText internals changing.
- Two real bugs found and fixed during that verification, not just cosmetic: (1) Jest didn't have an AsyncStorage mock, so any component importing `ThemedText` (i.e. almost everything) failed to even import under test once `useTheme()` started depending on the new AsyncStorage-backed provider — fixed via `moduleNameMapper` in `jest.config.js` pointing at AsyncStorage's own shipped Jest mock, plus a `src/test/render.tsx` helper so tests render inside `ThemeProvider`. (2) The `Toast` component's Reanimated-driven fade never actually applied on web — opacity measured via the DOM stayed at 0 for the toast's entire visible window — so it was simplified to a plain show/hide (no animation) rather than spending more time chasing a non-critical flourish; documented in a code comment.
- 2026-07-16: Phase 3 + 4 — all five representative screens (Sign-in, Home, Group detail, Friends, Currencies) checked live in a real browser in both Dark and Light themes, signed in as a real test account. Confirmed identical behavior to before the restyle: friend request search/send/cancel/accept/decline, the new block-friend confirmation dialog (cancel and confirm paths), group creation/invite-by-username/member removal, the new leave-group and archive-group confirmation dialogs (cancel and confirm paths), built-in and custom currency listing with category picker and pending-review badge, and full sign-out/sign-in. No functional regressions found. Full check suite (`format:check`, `lint`, `typecheck`, `test`, `test:db`) passing.
