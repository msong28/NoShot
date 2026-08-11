# Copy-paste prompts for Claude Code

Work top to bottom. Each prompt assumes Claude Code can read this `design_handoff_noshot/` folder inside your repo. Wait for each step to finish and review before moving on.

---

## 0 · Orient (run once)

```
Read design_handoff_noshot/README.md in full and look at every image in
design_handoff_noshot/screens/. This is the target visual redesign for our
existing NoShot app. Don't change any code yet. Summarize back to me:
(1) the design tokens, (2) the core components, (3) the screen list, and
(4) how you'll map these onto our current codebase (framework, styling
approach, component library). Then propose an implementation order and stop.
```

## 1 · Tokens / theme layer

```
Set up the design tokens from the README as our app's theme: all light-mode
and dark-mode colors, the 4px spacing scale, the type scale (Bricolage
Grotesque headings, Plus Jakarta Sans body, Space Mono for numbers/labels),
radius scale, and shadows. Use our existing theming mechanism if we have one;
otherwise introduce a single tokens/theme module and wire dark mode as a
token swap (not duplicated styles). Install or note the fonts. Don't restyle
screens yet — just the token layer.
```

## 2 · Core components (in this order)

```
Using the tokens, build/restyle these shared components to match the README
specs and screenshots, in order: (a) the list row — see the "list row (the
atom)" spec and screens/13-bets-tab.png; (b) the status pill (all 5 states);
(c) the debt chip (up/down); (d) buttons (primary, secondary, irreversible
outline, irreversible solid); (e) the bottom nav with center FAB and
attention badge; (f) the "needs attention" card treatment. Match colors,
radii, padding, and type exactly. Show me each one before moving on.
```

---

## 3 · Screens

One prompt per screen. Template:

```
Rebuild the <SCREEN NAME> screen to match design_handoff_noshot/screens/<FILE>.
Use our tokens and the shared components from step 2 — do not hand-roll styles
that already exist as components. Match layout, spacing, colors, typography,
and copy. When done, compare your result to the screenshot and fix any gaps in
spacing/color/type. This is a re-skin: keep our existing logic and data wiring.
```

Fill in per screen:

| Screen name                  | File                             |
| ---------------------------- | -------------------------------- |
| Home / Dashboard (light)     | `screens/01-home-light.png`      |
| Bet detail                   | `screens/02-bet-detail.png`      |
| Home / Dashboard (dark)      | `screens/03-home-dark.png`       |
| Profile                      | `screens/04-profile.png`         |
| Invite preview (pre-auth)    | `screens/05-invite-preview.png`  |
| Sign-in                      | `screens/06-signin.png`          |
| Sign-up                      | `screens/07-signup.png`          |
| Confirm email                | `screens/08-confirm-email.png`   |
| Setup profile                | `screens/09-setup-profile.png`   |
| First-run Home (empty)       | `screens/10-first-run-home.png`  |
| Create bet                   | `screens/11-create-bet.png`      |
| Friends                      | `screens/12-friends.png`         |
| Bets tab                     | `screens/13-bets-tab.png`        |
| Win reveal                   | `screens/14-win-reveal.png`      |
| Cancel confirm               | `screens/15-cancel-confirm.png`  |
| Cash in / settle             | `screens/16-cash-in.png`         |
| Group standings              | `screens/17-group-standings.png` |
| Bet thread (chat/proof/poll) | `screens/18-bet-thread.png`      |
| You / activity               | `screens/19-you-activity.png`    |
| Settings                     | `screens/20-settings.png`        |

**Suggested order:** Home (01) → the four nav tabs (13, 12, 19) → bet detail (02) → create bet (11) → auth flow (05→06→07→08→09→10) → the emotional/serious screens (14, 15, 16) → group + social (17, 18) → settings (20) → dark mode pass (03).

---

## 4 · Mascot

```
Brick (the basketball mascot) is currently drawn with CSS shapes as a
placeholder — see the mascot section of the README and screens/14-win-reveal.png
and screens/21-mascot-placement.png. Do NOT reproduce the CSS version. Instead,
add a <Brick> component that renders an illustrated asset (leave a clearly
marked slot / TODO for the real artwork) with variants: default, cheeky/wink,
and neutral/waiting. Then place it ONLY at the emotional beats listed in the
README's placement rule (splash, empty states, win reveal, confirm-email,
avatar fallback) — never in bet rows, balances, standings, or the cancel sheet.
```

## 5 · QA pass

```
Go screen by screen and compare the running app to each image in
design_handoff_noshot/screens/. List every mismatch in spacing, color, radius,
font, weight, or copy, then fix them. Verify: (1) debt direction is never
ambiguous (green up / amber down), (2) every bet status has its distinct
color, (3) irreversible actions use the danger register and a confirm step,
(4) dark mode is a clean token swap, (5) the app never looks like a
banking/finance product.
```

---

### Guardrails to repeat if it drifts

- "This is a re-skin against tokens — reuse existing components, don't rebuild logic."
- "Match the screenshot; use the README's hex/px when unsure."
- "Emoji only where they carry meaning (bet type, status), never decoration."
- "Red is reserved for irreversible actions only."
