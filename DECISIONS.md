# NoShot — Decisions Log

Lightweight ADR log. Each entry: context, decision, status. Newest at bottom of its section. Update this file whenever a material technical or product decision is made or revisited.

## Open items requiring your sign-off

### 3. Moderation approach for MVP

**Context:** PRD MOD-03 requires "automated text checks at creation time" for severe-harm categories. Real ML moderation (OpenAI moderation endpoint, Perspective API, etc.) needs an external account/API key.
**Decision:** ship a self-hosted deterministic keyword/pattern tiered filter (hard-block / warn+queue / permit) for MVP, applied both client-side (fast feedback) and server-side (authoritative), designed so a real moderation API can be swapped in behind the same interface later.
**Status:** decided for MVP purposes, flagged as a known limitation — regex/keyword filtering will under- and over-trigger relative to an ML classifier. Revisit before any wider release. No action needed from you now.

### 4. Analytics & monitoring: first-party over SaaS, for now

**Context:** PRD wants privacy-conscious analytics and error monitoring, but the delivery requirements ask for "no-op local implementations," implying account-requiring services shouldn't block MVP progress.
**Decision:** first-party `analytics_events` table for analytics, no-op adapter for error monitoring, both behind swappable interfaces.
**Status:** decided. If you already have a preferred analytics/Sentry account you want wired in from day one, tell me and I'll adjust the relevant milestone.

### 5. Admin surface: same app, not a separate package

**Context:** PRD §9.1 allows "a separate lightweight admin route or app... in the same TypeScript monorepo." Your instructions say one Expo codebase unless there's a strong reason otherwise.
**Decision:** admin lives at a gated route group inside the same app (web-oriented, but not web-only at the routing level), not a separate package/monorepo.
**Status:** decided. Revisit only if admin needs diverge substantially (e.g., a different release cadence).

### 6. Email confirmation is OFF in Supabase Auth — dev convenience, must flip back before launch

**Context:** the project shipped with "Confirm email" ON (Supabase's default). During Milestone 1 verification, sign-up + email-confirm-click flow was built and works, but confirming via a disposable-inbox link proved slow to test live. You turned "Confirm email" OFF in the dashboard so sign-up returns a session immediately, no email step.
**Consequence:** right now, anyone can sign up with any email address (real or fake) and get in immediately — fine for development, **not** acceptable for a real launch (spam accounts, unverifiable emails).
**Status:** must be turned back ON before any real-user testing or launch. Tracked here so it doesn't get forgotten. Re-enabling is a dashboard toggle (Authentication → Sign In / Providers → Email → "Confirm email"), no code change needed — the sign-up screen already handles both the confirmation-required and instant-session cases.

### 7. Confirmation/reset emails don't yet redirect back into the app

**Context:** compared against a working pattern from a prior project (FoundrV1): that project passes `emailRedirectTo` (signup) / `redirectTo` (password reset) pointing at a deep link, so clicking the emailed link lands back in the app already authenticated, rather than on Supabase's generic hosted confirmation page. Our current `signUp()` call doesn't set this.
**Why it matters:** cosmetic/UX now (Confirm email is off, so this path isn't exercised), but becomes a real gap once Confirm email is turned back on (Decision #6) — users would confirm via a generic Supabase page with no path back to the app.
**Decision:** not built in Milestone 1 — deliberately deferred, since it needs a dedicated auth-callback route handling both web (URL-based) and native (deep link + PKCE code exchange), which is more than a one-line change. Also worth adding then: Supabase's account-enumeration protection (a signup for an already-registered, already-confirmed email returns a fake-success with an empty `identities` array rather than an error) isn't handled in the sign-up screen yet either — small, cheap addition to pair with this work.
**Status:** open, not blocking. Should land before Decision #6 is flipped back on (turning email confirmation back on without this means confirmed users land on a dead-end generic page).

## Store/legal risks to track (not decisions I can make for you)

- **App-store classification risk.** NoShot's ratio/odds mechanic is adjacent to gambling even without cash stakes. PRD §16 already mandates safe positioning language and hard content blocks; final risk sign-off needs review against Apple/Google's then-current policies and, per the PRD itself, qualified counsel — I cannot make this determination or guarantee approval.
- **Age gating is self-attestation only** (16+ checkbox + birth year), no ID verification, per MVP scope. This is a product/legal risk to revisit for regional launches.
- **Final ToS / Privacy Policy / Community Guidelines** will ship as clearly-marked placeholders only; do not submit to app stores without counsel review, per PRD §14.2.
- **Store submission, developer agreements, and paid accounts** (Apple Developer Program, Google Play Console, Expo/EAS) must be created and owned by you; I cannot create or pay for these.

## Decided (and why)

- **Dispute "random fallback" is a third opt-in resolution method (2026-07-18).** PRD §5.4/RES-04 describe only judge or group-vote fallbacks, but the data model (`bets.random_fallback_enabled`) and the Appendix B test scenario describe a third mechanism. Resolved: random selection among the conflicting submitted outcomes ships as a third pre-agreed, disclosed, opt-in resolution method alongside judge and group vote. `resolve_dispute()`, the bet-creation UI (toggle + explanation), and pre-activation disclosure/consent language all need to account for it — scope for Milestone 8.
- **UI design system initiative (2026-07-16)**, and two conflicts resolved against your brief for it:
  - **Phase 3 "representative screens" swapped.** Your brief listed Bet detail, Bet creation, and Balances/friend-detail as representative screens to restyle first. None have real functionality behind them yet — `bets`/`bet_versions`/`ledger_entries` etc. don't exist until Milestones 6/9. Designing polished screens against fake data now is exactly the anti-pattern the PRD itself warns against ("Do not scaffold every screen first while leaving core state transitions insecure or incomplete"). Swapped in Home, Group detail, Friends, Currencies, and the sign-in screen instead — all have real data today. Bet/Balance screens get the system applied when Milestones 6/9 actually ship, not before.
  - **Nav kept as Home/Groups/Add/Activity/Account.** Your brief suggested a persistent "Bets" tab in place of "Add." PRD §7.1 explicitly recommends the current 5 tabs, and the Milestone-0 entry below already documents _why_ "Add" is a modal action rather than a tab. Kept the nav as-is; bet visibility instead comes from a prominent "Active bets" section on Home once Milestone 6 exists.
  - Everything else in the brief (tokens, theming, typography scale, component list, avatars, motion) had no conflict with anything on record — see `DESIGN_SYSTEM.md` and `UI_IMPLEMENTATION_PLAN.md` for the resulting system and rollout plan.
- **Icon library: `@expo/vector-icons`, not `expo-symbols`.** `expo-symbols` was already an installed-but-unused dependency; it's iOS-only (SF Symbols), which fails a "works everywhere" requirement for an app that also targets Android and web. `@expo/vector-icons` ships with `expo` itself (no new dependency) and renders consistently cross-platform.
- **No custom font loaded yet.** The brief allows deferring custom font loading if it adds unnecessary technical risk. No font assets exist in the repo, and loading them now (async load state, FOIT/FOUT handling, extra EAS config) buys nothing functional yet. System fonts stay, styled boldly via weight/size/letter-spacing for the Partiful-influenced headings. Recommended eventual brand pairing, to revisit once visual polish is a priority: a bold grotesk/geometric display face (e.g. Clash Display, General Sans, or Inter Tight) for headings, paired with Inter or the existing system font for body text.
- **Replaced `NativeTabs` (`expo-router/unstable-native-tabs`) with a cross-platform headless tab bar** built on `expo-router/ui` (`Tabs`/`TabList`/`TabTrigger`/`TabSlot`) — applied in Milestone 0. Reason: the native version is explicitly unstable, renders OS-styled chrome that resists the Partiful-style custom treatment the PRD wants, and the `expo-router/ui` API was already proven working (it was the stock template's own web-only tab bar) — now unified into one component for all platforms, with "Add" opening `/create` as a `Stack.Screen` modal rather than being a persistent tab. Verified live on web; not yet verified on iOS/Android (no simulator available this session).
- **Keep the existing token-based styling system** instead of adding NativeWind — already functional, avoids extra dependency + rewrite. (`ARCHITECTURE.md` §4)
- **RPC-only vs. direct-insert table split** for the ledger/state-machine integrity requirement — see `ARCHITECTURE.md` §6.
- **Maestro over Detox** for native e2e — no native rebuild cycle, works against Expo dev/preview builds.
- **Phone auth**: deferred per PRD's own explicit decision (§16); provider abstraction should make it addable later without rework.
