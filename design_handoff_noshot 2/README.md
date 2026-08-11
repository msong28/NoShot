# Handoff: NoShot — full visual redesign

## Overview

NoShot is a private app where friends track non-cash bets, dares, and IOUs ("loser does the dishes for a week", "loser buys coffee"). No real money is ever involved — it is a playful way to keep score with friends. Personality target: **Splitwise clarity + Partiful energy** — trustworthy enough to track who-owes-who, but fun and lighthearted, aimed at a ~20-year-old audience (roommates, friend groups).

This package documents a **complete visual system + the full screen set** so the existing (functional but unpolished) app can be re-skinned to a cohesive, considered design.

## About the design files

The single file in this bundle — `NoShot Screens.dc.html` — is a **design reference created in HTML**. It is a prototype showing the intended look, layout, and behavior; it is **not production code to copy directly**. It is authored in a streaming component format ("Design Component") and uses inline styles throughout, so do **not** import it into the codebase.

Your task is to **recreate these designs in the app's existing environment** (React Native / React / SwiftUI / whatever the NoShot app already uses), following its established component patterns, navigation, and libraries. If no design-system layer exists yet, introduce the tokens below as the foundation. The app already exists and is functional — this is a **re-skin against tokens**, screen by screen, not a rebuild.

The HTML is organized into "Rounds" (design iterations). **Round 1** holds the core screens + the foundations/component board (palette swatches, type specimen, spacing, the list-row anatomy, status pills, debt chips, buttons, nav). Rounds 2–5 add profile, onboarding, the full app loop, and the social/settings layer. Each screen has a mono id badge (e.g. `01`, `3a`, `4d`) matching the names below.

## Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, and radii are all specified with exact values below and in the HTML. Recreate pixel-accurately using the codebase's existing UI primitives. Screens are designed at a 390×830 logical mobile viewport (iOS-style), inside a device frame that is **not** part of the UI — ignore the bezel/notch.

## Design tokens

### Color — Light mode

| Token            | Hex       | Use                                        |
| ---------------- | --------- | ------------------------------------------ |
| `bg`             | `#FBF6EF` | app background (warm cream)                |
| `surface`        | `#FFFFFF` | cards, rows, inputs                        |
| `surface-sunken` | `#F5EFE5` | icon tiles, chips, inset areas             |
| `ink`            | `#1C1917` | primary text; also the dark "hero" card bg |
| `ink-muted`      | `#6E675F` | secondary text / labels                    |
| `ink-faint`      | `#8A8178` | tertiary text, placeholders                |
| `line`           | `#ECE4D7` | borders / dividers                         |
| `grape` (brand)  | `#6C4BF5` | primary actions, active state, brand       |
| `grape-ink`      | `#4A2FD0` | grape text on light bg                     |
| `grape-soft`     | `#EEE9FF` | grape tint backgrounds                     |
| `lime` (pop)     | `#D8FF4B` | high-energy accent (on dark/grape only)    |
| `up` (positive)  | `#0FB77E` | they-owe-you / winning / won               |
| `up-soft`        | `#DDF6EC` | up tint bg                                 |
| `up-ink`         | `#0A7C56` | up text on light                           |
| `down` (owed)    | `#F5892B` | you-owe / losing                           |
| `down-soft`      | `#FDECD9` | down tint bg                               |
| `down-ink`       | `#B4550E` | down text on light                         |
| `gold` (pending) | `#E0A008` | pending/awaiting-accept status             |
| `gold-soft`      | `#FBEFCB` | pending tint bg                            |
| `gold-ink`       | `#8A6A00` | pending text                               |
| `danger`         | `#E5484D` | **irreversible actions only**              |
| `danger-soft`    | `#FBE3E3` | danger tint bg / disputed                  |
| `danger-ink`     | `#C0362F` | danger/disputed text                       |
| `neutral-soft`   | `#EFEAE1` | tied/settled tint                          |

### Color — Dark mode

| Token            | Hex                         |
| ---------------- | --------------------------- |
| `bg`             | `#17130E` (warm near-black) |
| `surface`        | `#221C15`                   |
| `surface-sunken` | `#2C251C`                   |
| `ink`            | `#F7F1E7`                   |
| `ink-muted`      | `#A8A093`                   |
| `ink-faint`      | `#8F867A`                   |
| `line`           | `#2C251C`                   |
| `grape`          | `#9B80FF`                   |
| `lime`           | `#D8FF4B`                   |
| `up`             | `#2DD39C`                   |
| `down`           | `#FFA24D`                   |
| `gold`           | `#F5C147`                   |
| `danger`         | `#FF6B6B`                   |

Dark mode is a **token swap**, not duplicated layout. On dark, tinted status backgrounds use the accent at ~16% alpha (e.g. `rgba(155,128,255,.16)` for grape) rather than the soft hexes.

### Typography

Three families (Google Fonts):

- **Bricolage Grotesque** — headings, screen titles, big numbers. Weights 700–800. Letter-spacing `-0.02em` to `-0.03em` on large sizes.
- **Plus Jakarta Sans** — all body, labels, buttons, row text. Weights 400–800.
- **Space Mono** — tallies, counts, scores, timestamps, and small uppercase eyebrow labels (letter-spacing `.12em`, `text-transform:uppercase`). Weights 400/700.

Type scale (px): screen title 26–27/800 · section heading 15–16/700 · row title 14.5/700 · body 13–14/400–600 · subline 12/400 (muted) · eyebrow 10.5–11/700 mono uppercase · big number/hero 38–44/800.

### Spacing

4px base scale: **4, 8, 12, 16, 20, 24, 32, 40**. Screen horizontal padding 20–22px. Card padding 14–22px. Row internal padding 13–14px. Gap between stacked rows 9px.

### Radius

- pill / chip / avatar: `999px` / `50%`
- button: `14–16px`
- icon tile: `12–14px`
- list row: `18px`
- card: `20–24px`
- bottom sheet top corners: `28px`

### Shadow

- card lift: `0 6px 16px -8px rgba(108,75,245,.35)` (grape-tinted for attention cards)
- primary button: `0 10px 22px -8px rgba(108,75,245,.6)`
- FAB: `0 10px 22px -6px rgba(108,75,245,.75)` + `0 0 0 5px <bg>` ring

## Core components (build these first — they repeat everywhere)

### List row (the atom)

Structure: `[icon tile 44×44 r14] · [title 14.5/700 + subline 12/muted] · [right column: status pill + debt chip]`, laid out with `display:flex; gap:12px; align-items:center`. Row: `surface` bg, `1px solid line`, radius 18, padding 13–14px. The bet-type emoji lives in the icon tile (🧽 dishes, ☕ coffee, 🎮 game, 👟 steps, 🧺 laundry, 🎲 dare, 🧋 boba, 💬 texts). Lists use a flex column with `gap:9px`.

### Status pill

`inline-flex; gap:5px; padding:4px 9px; radius:999; 10.5–11px/700` + a 6px dot. States:

- **Pending** — bg `gold-soft`, text `gold-ink`, dot `gold`
- **Active** — bg `grape-soft`, text `grape-ink`, dot `grape`
- **Disputed** — bg `danger-soft`, text `danger-ink`, dot `danger`
- **Won** — bg `up-soft`, text `up-ink`, dot `up`
- **Tied / Settled** — bg `neutral-soft`, text `ink-muted`, dot `#a8a093`

### Debt chip (direction must never be ambiguous)

`padding:3px 8px; radius:999; 10.5px/700`. **They owe you / leading** → bg `up-soft`, text `up-ink`, prefix `↑`. **You owe** → bg `down-soft`, text `down-ink`, prefix `↓`.

### Buttons

- **Primary**: grape bg, white text, radius 16, padding 15px, weight 800, primary shadow.
- **Secondary**: surface bg, `1px solid line`, ink text.
- **Irreversible (outline)**: surface bg, `1.5px solid danger`, `danger-ink` text — for "Cancel bet".
- **Irreversible (solid)**: `danger` bg, white text — for "Delete account", "Yes, cancel bet".

### Bottom nav

5 slots, `surface` bg at 92% + `backdrop-filter: blur(8px)`, 1px top border, safe-area bottom padding (~26px). Order: Home 🏠 · Bets 📋 · **center FAB** ＋ (54px grape circle, `margin-top:-24px`, 5px bg ring) · Friends 👥 · You 🔔. Active label = grape/800; inactive = muted at 55% opacity. Attention badge = 16px `danger` circle with count, `-3px` top offset, 2px bg border.

### "Needs attention" / "Your move" treatment

The most important pattern. An item that needs the user's action gets: `1.5px solid grape` border (or `danger` for disputes) + a grape-tinted shadow + a pulsing 8px grape dot on the section header. This is the app's notification surface (there is no separate notification center).

## Screens / views

Each entry: **id** — Purpose · key layout & content notes. Colors/type per tokens above.

- **01 Home / Dashboard (light)** — landing screen. Top: mono date eyebrow + "Yo, Maya 👋" (Bricolage 27/800) + avatar. Sections top→bottom: **Your move** (horizontal row of 2 attention cards — a bet approval with Accept/Pass, a disputed result with Review); **Balance hero** (ink `#1C1917` card, "+3 favors up" in lime Bricolage 44, two inset stats "They owe you 5" up-green / "You owe 2" down-amber); **Quick actions** (grape "New bet" 2fr + "🤝 Settle" 1fr); **Active bets** list of rows. Bottom nav (Home active, You badge = 2).
- **03 Home / Dashboard (dark)** — identical layout, dark token swap. Balance hero goes pure black `#000` with a lime radial glow.
- **02 Bet detail** — status pill ("Active · ends in 3 days") → title (Bricolage 29) → description → **VS card** (two 54px avatars + italic "VS"). Centerpiece = **On the line**: two side-by-side cards, "If you win 🏆" (up-soft) / "If you lose" (down-soft), each with a Bricolage 16 outcome. Then tabs (💬 Chat 4 / 📸 Proof / 📊 Poll) + a chat preview row. Footer: grape "Mark result" primary + a `danger-ink` "Cancel bet" text link.
- **2e Profile** — centered 88px avatar (grape gradient, white ring) + name + `@handle · since …` mono + Edit/Share buttons. **Scoreboard** (ink card): Won 14 (up) / Lost 9 (down) / Tied 3, Space Mono 26, divided; footer "🔥 3 win streak · +3 favors up". **Trophies**: 3 shaped tiles (grape/up/down tinted, Bricolage initials like "10k", "W5", "0" — deliberately NOT scattered emoji). **Recent** = list rows with Won/Lost pills.
- **3a Invite preview (pre-auth)** — full grape `#6C4BF5` background (loudest screen — first impression). Wordmark, inviter avatar (78px, white ring), "Theo challenged you on NoShot" (Bricolage 26, white), value-prop line, a white preview bet card, then **lime `#D8FF4B` "Accept challenge"** primary + "What's NoShot?" link. Leads into sign-up.
- **3b Sign-in** — Brick mascot (60px) + "Welcome back". Buttons: **Continue with Apple** (ink solid), **Continue with Google** (white, bordered, blue "G"), an "or" divider, Email + Password fields, right-aligned "Forgot password?" (grape), grape "Sign in", footer "New here? Create account".
- **3c Sign-up** — back chevron, "Make it official" (Bricolage 27). Email + Password fields, a 4-segment password strength meter (3/4 filled green + "strong" mono), grape "Create account", terms/"not real-money betting" microcopy, footer "Got an account? Sign in".
- **3d Confirm email** — centered. Brick with a **neutral flat mouth** ("waiting" face) in a grape-soft disc + ✉️ badge. "Check your email" (Bricolage 26), "We sent a link to you@email.com…", a mono chip "no shot you're in yet — confirm first", grape "Open mail app", "Resend email" link, bottom "Wrong address? Go back".
- **3e Setup profile** — 3-step progress bar (step 2 filled). "Set up your player". Avatar picker (dashed grape circle + 📷 badge). Display name field; Username field with green border + "✓ available"; Birth year select; an **age-confirmation** row (checked grape box + "I'm 18 or older … not real-money betting"). Grape "Continue".
- **3f First-run Home (empty state)** — onboarding finale. Header "Welcome, Maya 🎉". **Empty hero** (ink card, Brick 78px, "No bets yet", nudge copy). "Get started": two nudge cards — **Add friends** (grape-soft tile 👥, "Invite" button) / **Set stakes** (up-soft tile 🎯, "Customize"). A dashed, faded ghost row "Your first bet lands here". Bottom nav (no badges yet).
- **4a Create bet** — "Cancel / New bet / Draft" bar. Fields: "What's the bet?" (filled, grape border); "Pick your rival" (row of selectable 52px avatars, selected one has grape ring + "More" dashed); "Loser's stake" (wrapping selectable chips: grape-filled "🧽 Dishes ×7" selected, others outlined, "＋ Custom"); symmetric-bet note; "Decided by" (3 segments: ink "🤝 Both confirm" selected, "📸 Proof", "📊 Poll"). Footer grape "Send bet to Theo".
- **4b Friends** — "Friends" title + grape ＋. Search field. **Requests** section (grape-bordered card, Add/✕). **Your friends** list rows: 44px avatar, name, `@handle`, right-aligned head-to-head record ("3–1" Space Mono + "you lead" up / "down" / "even"). Bottom nav (Friends active).
- **4c Bets tab** — "All bets" + filter chips (ink "All 12" selected, "Active 4", "Pending 2", "Done"). List showing every status incl. a `danger`-bordered **Disputed** row with "your move", plus dimmed (72% opacity) settled Won/Tied rows. Bottom nav (Bets active).
- **4d Win reveal** — celebration; **Brick's biggest moment**. Grape gradient bg + scattered confetti squares (lime/up/down/white, rotated). "RESULT IS IN" (lime mono). **Cheeky Brick (winking)** 120px, white ring. "You won! 🏆" (Bricolage 38, white). Bet name. A translucent payout card "Theo owes you · 🧽 Dishes ×7 days" (lime). Footer: lime "Rub it in 😏" + white "Cash in later".
- **4e Cancel confirm** — the one **serious** screen; **no mascot** (rule). Blurred/dimmed backdrop + `rgba(20,15,10,.55)` scrim. Bottom sheet: grab handle, ⚠️ tile (danger-soft), "Cancel this bet?" (Bricolage 23), body stressing "can't be undone" + "Theo will be notified", the affected bet row, **`danger` solid "Yes, cancel bet"** + secondary "Keep it".
- **4f Cash in** — "Cash in", "You're owed 5 favors…". List of redeemable favor cards (up-soft icon tile + "from … · won date" + grape "Redeem" button). Footer note tile (🔒) explaining the confirm-loop with the friend.
- **5a Group bet — standings** — "GROUP · 4" mono. Active pill, title, "Last place buys boba". **Standings** = ranked rows: rank number (Space Mono), avatar, name (leader marked up-green + up-border; last place marked down + down-soft bg), step count. Ink card "Your lead +330 steps" (lime) + "Sync steps". Footer grape "💬 Open group chat".
- **5b Bet thread (chat + proof + poll)** — chat header (back, bet icon tile, name + "Active · vs Theo"). Message list: centered mono system chip, their bubble (white, `1px line`, tail bottom-left), my bubble (grape, white text, tail bottom-right), a **photo-proof** attachment (striped placeholder — real app shows the uploaded photo), and an inline **poll** card (grape border; two options as horizontal bars filled to vote %, Maya 66%/2 vs Theo 33%/1). Composer bar: ＋, pill input "Message…", grape send ➤.
- **5c You / activity** — "You" + ⚙. **Needs you** section (2 attention cards: grape-bordered "Theo sent a bet", danger-bordered "Result disputed"). **Recent activity** feed: 34px colored circle icon + a rich sentence (bold key phrases) + mono relative timestamp. Bottom nav (You active, badge 2).
- **5d Settings** — grouped lists. **Account** (Edit profile, Manage stakes, Notifications with a grape toggle). **Appearance** (Dark mode "Auto"). **Danger zone** (uppercase danger-ink label): a danger-bordered group with "Log out" and "Delete account · Permanent · erases your record", both `danger-ink`. Footer "NoShot v1.0 · made for fun, not cash".

## Mascot system — "Brick"

Brick is a goofy basketball (a "brick" = a badly missed shot; "no shot" is basketball trash-talk). Constructed from an orange radial-gradient circle `radial-gradient(circle at 34% 28%, #FF9D52, #F26E17)` with two seam lines (vertical + horizontal, `rgba(90,30,0,.4)`), two white eyes with ink pupils, and a mouth that changes with emotion. **In the real app, replace the CSS-built Brick with a proper illustrated asset** — the HTML version is a stand-in for the shape/personality.

Variants (see Rounds 2–3): **2a** glossy (default), **2b** flat 2-tone with ink outline (systematized), **2c** "Bean" grape blob, **2d** "Chatter" speech bubble, **3g** headband, **3h** **Cheeky/winking** (one eye a flat line — for wins & taunts), **3i** duo "The Rivals", **3j** sticker (white keyline).

### Placement rule (important for not looking "vibe-coded")

Brick appears at **emotional beats only**, never in dense/functional UI:

- ✅ App icon & splash · empty states & first-run · **win/result reveals** (Cheeky Brick) · loading/waiting & confirm-email (neutral face) · default avatar fallback.
- ✕ **Never** in bet rows, balances, standings, or serious/irreversible moments (e.g. the Cancel confirm is deliberately Brick-free).

Likewise, **emoji are used only where they carry meaning** (bet-type icons, status), never as decoration. This discipline — consistent tokens + a rule for mascot/emoji — is the actual fix for the "vibe-coded" feel.

## Interactions & behavior

- **Bet lifecycle**: Proposed/Pending → Active → (Disputed / Cancellation-pending) → Resolved (Won/Lost/Tied) or Settled. Status pill + debt chip update at each transition.
- **Needs-attention routing**: friend requests, bet approvals, disputed results, redemption confirmations, and cancellation responses all surface as attention cards on Home ("Your move") and You ("Needs you"), and drive the nav badge count.
- **Create bet**: rival + stake + decision-method are required before "Send" enables; symmetric stakes by default.
- **Result**: decided by mutual confirm, photo proof, or poll (per bet). Disputes flip the bet to the danger register until resolved.
- **Redeem / cash in**: tapping Redeem pings the friend to confirm they paid up; both keep a record.
- **Irreversible actions** (cancel bet, remove from group, delete account) always require the serious-register confirm sheet described in 4e.
- **Transitions**: keep them lightweight/springy (Partiful energy) on celebratory moments (win reveal), calm/instant on functional navigation. Pulsing dot on attention headers (~1.8s ease-in-out).

## State management

- `user` (name, @handle, avatar, birthYear, ageConfirmed, record {won, lost, tied}, streak, favorsNet).
- `friends[]` (id, name, handle, avatar, headToHead {won, lost}).
- `friendRequests[]`.
- `bets[]` (id, title, description, type/icon, participants[], stake, decisionMethod, status, debtDirection per viewer, deadline, createdAt).
- `bet.thread[]` (messages, proof attachments, poll {options, votes}).
- `owedToYou[]` / `youOwe[]` (redeemable favors).
- `attentionItems[]` (derived) → nav badge count.
- Theme: `light | dark | auto`.

## Assets

- **Fonts**: Bricolage Grotesque, Plus Jakarta Sans, Space Mono (Google Fonts) — or the codebase's licensed equivalents.
- **Mascot (Brick)**: currently CSS/HTML shapes — commission/replace with a real illustrated asset set (the variants above).
- **Emoji**: system emoji used for bet-type/status glyphs; swap for a consistent icon set if the app has one.
- **Photo proof**: user-uploaded images (striped placeholder in the mock).
- No third-party brand assets are used.

## Screenshots

High-res (2×) renders of every screen live in `screens/`. Each is a labeled capture matching the ids/names above:

| File                      | Screen                            |
| ------------------------- | --------------------------------- |
| `01-home-light.png`       | Home / Dashboard (light)          |
| `02-bet-detail.png`       | Bet detail                        |
| `03-home-dark.png`        | Home / Dashboard (dark)           |
| `04-profile.png`          | Profile                           |
| `05-invite-preview.png`   | Invite preview (pre-auth)         |
| `06-signin.png`           | Sign-in                           |
| `07-signup.png`           | Sign-up                           |
| `08-confirm-email.png`    | Confirm email                     |
| `09-setup-profile.png`    | Setup profile                     |
| `10-first-run-home.png`   | First-run Home (empty state)      |
| `11-create-bet.png`       | Create bet                        |
| `12-friends.png`          | Friends                           |
| `13-bets-tab.png`         | Bets tab                          |
| `14-win-reveal.png`       | Win reveal                        |
| `15-cancel-confirm.png`   | Cancel confirm (serious register) |
| `16-cash-in.png`          | Cash in / settle                  |
| `17-group-standings.png`  | Group bet standings               |
| `18-bet-thread.png`       | Bet thread (chat + proof + poll)  |
| `19-you-activity.png`     | You / activity feed               |
| `20-settings.png`         | Settings                          |
| `21-mascot-placement.png` | Mascot placement guide            |

Each capture is 392px-wide phone at 2× inside a device frame (the bezel/notch is not part of the UI). For any pixel value not spelled out in this README, open `NoShot Screens.dc.html` in a browser and use devtools on the matching id.

## Files

- `NoShot Screens.dc.html` — the complete design reference (all screens + foundations/components board). Open in a browser to inspect; use browser devtools to read exact computed values. Rounds are stacked newest-first; scroll to the bottom (Round 1) for the foundations/component specimens.
