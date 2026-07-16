# NoShot — Design System

Source of truth for how NoShot looks and feels. New screens should be built from the tokens and components documented here, not by inventing new visual values. If a screen needs something this system doesn't cover, add it here first, then use it.

Companion doc: `UI_IMPLEMENTATION_PLAN.md` (screen-by-screen rollout status). Product requirements: `NoShot_PRD.docx`. Prior architecture calls: `ARCHITECTURE.md`, `DECISIONS.md`.

## 1. Design principles

**Splitwise's clarity, Partiful's energy — never both at once on the same element.** A balance row should look like Splitwise: compact, plain-language, scannable in under a second. A screen title or a celebration moment should look like Partiful: bold, editorial, a little loud. The system keeps these separated by _role_ (routine vs. expressive), not blended into one in-between style.

**One accent per screen, on purpose.** Every screen has a dominant accent chosen for what it's doing (lime for a primary action, coral for something competitive/urgent, violet for a secondary action), not a different color per section. If everything is colorful, nothing is.

**Numbers are trustworthy first, fun second.** This app tracks obligations between friends — a wrong or ambiguous balance is a real problem, not just an aesthetic one. Currencies are never combined ("you owe 2 meals and CAD 12," never "you owe $14 equivalent"). Color is never the only signal of owed/owing — always paired with a label, sign, or icon.

**Dark mode is the primary design, not a light-mode inversion.** Both themes are designed with the same warm, high-contrast, editorial personality — light mode is not just dark mode with the colors flipped.

**Don't scaffold ahead of the data.** A component for a feature that doesn't exist yet (bets, chat, polls) doesn't get built until that feature does. See `UI_IMPLEMENTATION_PLAN.md` for what's deferred and why.

### What NoShot should never look like

Sportsbook, crypto product, generic fintech dashboard, banking app, generic SaaS template, children's game, Web3 product, glassmorphism concept, a Splitwise or Partiful clone. Concretely, avoid: excessive gradients, purple-to-blue gradient backgrounds, glowing borders, floating translucent cards, oversized pills everywhere, decorative dashboard stats nobody asked for, generic sparkle icons, a different accent color per section, symmetrical landing-page layouts inside the app.

## 2. Theming

Three modes: `system` (follows the OS), `light`, `dark`. A brand-new install with no stored preference defaults to **`dark`** — not `system` — per product direction; the user can switch to `light` or back to `system` at any time via the theme toggle, and the choice persists (`src/providers/theme-provider.tsx`, backed by `AsyncStorage`).

Both palettes share the same warm undertone and the same semantic roles — only the values differ.

### Semantic color tokens

Defined in `src/constants/theme.ts` (`Colors.light` / `Colors.dark`). Legacy keys (`text`, `background`, `backgroundElement`, `backgroundSelected`, `accent`, `accentText`, `positive`, `negative`) are kept as aliases so existing screens don't break — new code should prefer the semantic names below.

| Token              | Role                                                                  |
| ------------------ | --------------------------------------------------------------------- |
| `background`       | Screen background                                                     |
| `surface`          | Cards, rows, standard elevated content                                |
| `surfaceRaised`    | Modals, sheets, anything above `surface`                              |
| `surfaceMuted`     | Recessed areas — input backgrounds, disabled states                   |
| `textPrimary`      | Default text                                                          |
| `textSecondary`    | De-emphasized text (metadata, captions, secondary lines)              |
| `textMuted`        | Placeholder / disabled text                                           |
| `border`           | Hairline borders and dividers                                         |
| `primary`          | The main energetic accent (electric lime) — primary actions           |
| `primaryPressed`   | `primary` while pressed                                               |
| `onPrimary`        | Text/icon color on top of `primary`                                   |
| `secondary`        | Bright controlled violet — secondary actions, links                   |
| `secondaryPressed` | `secondary` while pressed                                             |
| `onSecondary`      | Text/icon color on top of `secondary`                                 |
| `competitive`      | Saturated coral — competitive/urgent emphasis (bet stakes, deadlines) |
| `onCompetitive`    | Text/icon color on top of `competitive`                               |
| `success`          | Confirmed / completed states                                          |
| `warning`          | Pending / needs-attention states                                      |
| `danger`           | Destructive actions, disputes, errors                                 |
| `info`             | Neutral informational emphasis                                        |
| `overlay`          | Modal/sheet backdrop                                                  |
| `focus`            | Focus ring color (keyboard focus on web)                              |

`CurrencyCategoryColors` (unchanged, from Milestone 5) stays a separate map — currency-category color is a data property, not a theme role.

### Values

Dark (default):

```
background      #100F0D    surface        #1C1A17    surfaceRaised  #242119    surfaceMuted   #16140F
textPrimary     #F7F4EE    textSecondary  #B6B0A2    textMuted      #7C776A    border         #302B22
primary         #C6F135    primaryPressed #A9D428    onPrimary      #14130F
secondary       #9B7BFF    secondaryPressed #8362E8  onSecondary    #FFFFFF
competitive     #FF6B4A    onCompetitive  #14130F
success         #3ED686    warning        #FFB020    danger         #FF5D7A    info   #5AA9E6
overlay         rgba(10,9,7,0.64)
```

Light:

```
background      #FBF7F0    surface        #FFFFFF    surfaceRaised  #F5F0E6    surfaceMuted   #F1ECE1
textPrimary     #1A1713    textSecondary  #5A5548    textMuted      #8B8576    border         #E6E0D2
primary         #77A600    primaryPressed #5E8700    onPrimary      #FFFFFF
secondary       #6C4FE0    secondaryPressed #5A3FC2  onSecondary    #FFFFFF
competitive     #E1512E    onCompetitive  #FFFFFF
success         #1E9E5A    warning        #B8860B    danger         #E23F5D    info   #1D6FC4
overlay         rgba(26,23,19,0.4)
```

`primary`/`competitive` are deliberately darker/more saturated in light mode than dark mode — the same neon-lime value that pops on a near-black background reads as washed-out on off-white, so the hue is preserved but the value is adjusted per theme. This is the concrete example of "light mode is not dark mode inverted."

## 3. Typography

`src/constants/typography.ts`. Named scale, consumed via `ThemedText`'s `type` prop (`ThemedText` _is_ the system's text component — there's no separate `AppText`/`Heading`, to avoid two components doing the same job).

| Token       | Size / line-height | Weight | Use                                 |
| ----------- | ------------------ | ------ | ----------------------------------- |
| `display`   | 40 / 44            | 800    | Rare, top-of-screen brand moments   |
| `headingXL` | 32 / 38            | 800    | Screen titles (Partiful-influenced) |
| `headingLG` | 24 / 30            | 700    | Section/group headers               |
| `headingMD` | 19 / 24            | 700    | Card titles, bet statements later   |
| `bodyLG`    | 17 / 24            | 500    | Emphasized body text                |
| `body`      | 16 / 22            | 400    | Default body text                   |
| `bodySM`    | 14 / 20            | 400    | Secondary lines, metadata           |
| `label`     | 14 / 18            | 700    | Form labels, small buttons          |
| `caption`   | 12 / 16            | 500    | Timestamps, fine print              |

Font family: system fonts only for now (see `DECISIONS.md`). Headings lean on **weight and size**, not a separate display typeface, to get Partiful's boldness without the technical risk of custom font loading. Revisit once a brand font is chosen.

## 4. Spacing, radius, elevation

**Spacing** (`Spacing` in `src/constants/theme.ts`, unchanged from Milestone 0): `half`(2) `one`(4) `two`(8) `three`(16) `four`(24) `five`(32) `six`(64). Already a token scale — no rename needed.

**Radius** (`Radii`, unchanged): `small`(8) for inputs/compact controls, `medium`(16) for standard cards, `large`(24) for prominent Home cards/celebration surfaces, `pill`(999) for chips/avatars/status pills only — not for every element.

**Elevation** (`src/constants/shadows.ts`, new): three levels — `none`, `low` (rows/standard cards), `raised` (modals/sheets). Dark mode leans on `surface`/`border` tone changes rather than shadow depth (shadows barely read on near-black); light mode uses a small, soft shadow. No heavy drop shadows anywhere.

## 5. Motion

`src/constants/motion.ts`. Two categories:

- **Routine** (navigation, list updates, form feedback): fast (150-200ms), no bounce, easing only — motion should be felt, not watched.
- **Celebration** (bet accepted/activated, winner confirmed, obligation redeemed, group created): more expressive, spring-based, brief (under ~800ms total), and always skippable — never blocks the next action.

`useReducedMotion()` (from `react-native-reanimated`, already installed) gates celebration effects — reduced-motion users get the state change instantly, no animation, same end result.

## 6. Icons

`@expo/vector-icons` (ships with `expo`, no new dependency) — chosen over `expo-symbols` because the latter is iOS-only. `src/constants/icons.ts` maps semantic names (e.g. `friend`, `group`, `currency`, `settings`) to a specific glyph, so feature code asks for `Icons.friend`, not a raw icon-family name — keeps the mapping swappable in one place and keeps icon style consistent app-wide.

## 7. Components

Built or extended this pass, in `src/components/ui/` unless noted: `Button` (variants: `primary` `secondary` `outline` `ghost` `destructive`; loading state), `IconButton`, `Icon`, `Screen` (the repeated insets+scroll+max-width wrapper every screen was hand-rolling), `Card` (adds an `elevated` variant), `ListRow` (generic leading/title/subtitle/trailing row — replaces the `styles.row` pattern copy-pasted across friends/groups/currencies), `Avatar` + `AvatarStack` (deterministic initials-based color from a fixed palette, keyed by user id — never random per render), `StatusBadge` (generalizes the Milestone-0 `Badge` for status pills like "Pending review," "Invited," "Owner"), `CurrencyLabel` (renders "2 meals" / "CAD 12" consistently), `EmptyState`, `SectionHeader`, `InlineError` (replaces the `{error ? <ThemedText.../> : null}` pattern duplicated in every screen with a mutation), `Skeleton`, `Divider`, `SegmentedControl`, `ThemeToggle`, `Modal`, `ConfirmationDialog` (built on `Modal` — there was previously no confirmation step at all before leaving/archiving a group or blocking someone), `Toast` + `ToastProvider`/`useToast()`.

`TextField` gained a `variant="search"` rather than a separate `SearchInput` component (same behavior, different chrome — a variant, not a duplicate).

### Deliberately not built yet

`BetRow`, `BetCard`, `OddsChip` (Milestone 6 — bet engine doesn't exist), `ChatBubble`, `CommentRow`, `PollOption` (Milestone 12 — social layer doesn't exist), `Tabs` (no screen currently has in-screen tabbed content), a gesture-driven `BottomSheet` (would need a new dependency — `@gorhom/bottom-sheet` or equivalent — for what `Modal` already covers today; add it if a real interaction need shows up, not preemptively), `GroupRow`/`BalanceRow` (folded into the generic `ListRow` + `CurrencyLabel` rather than near-duplicate components).

## 8. Responsive behavior

Mobile is the primary target. On wider web viewports, content stays constrained to `MaxContentWidth` (`src/constants/breakpoints.ts`, unchanged value, now documented alongside named breakpoints) and centered — no full-viewport-width rows, no turning the app into a desktop dashboard. Side-by-side panels are opt-in per screen where they demonstrably help (not a default), never a rule.

## 9. Accessibility baseline

Every semantic color pair (`background`/`textPrimary`, `primary`/`onPrimary`, etc.) is chosen to meet at least WCAG AA contrast in both themes. Status is always paired with text/icon, never color alone (already a Milestone-0 rule, carried forward). Touch targets stay at or above 44×44pt. Focus rings (`focus` token) are visible on web. Reduced-motion is respected everywhere celebratory motion appears. Full WCAG 2.2 AA pass is Milestone 15's job — this system establishes the baseline that pass will audit against, not the audit itself.

## 10. Visual reference

`src/app/design-system.tsx` (reachable from Account → "Design system") — renders every token and component in both themes side by side. This is the screen to check before adding a new visual pattern: if it's not there, it's not established yet.
