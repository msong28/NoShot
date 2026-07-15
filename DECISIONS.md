# NoShot — Decisions Log

Lightweight ADR log. Each entry: context, decision, status. Newest at bottom of its section. Update this file whenever a material technical or product decision is made or revisited.

## Open items requiring your sign-off

### 1. Navigation: replace `NativeTabs` with JS `Tabs`
**Context:** the scaffold uses `expo-router/unstable-native-tabs`, an experimental API that renders native OS tab-bar chrome (SwiftUI `TabView` / Jetpack Compose equivalent). The PRD wants a 5-tab Splitwise-style IA with Partiful-style bold, colourful, custom visual treatment, working the same across iOS/Android/web, plus an "Add" tab that's actually an action button, not a screen.
**Problem:** native tab chrome is largely OS-styled (limited color/shape control), the API is explicitly labeled unstable, and its web behavior is not a good fit for a fully custom, brand-heavy design.
**Proposed decision:** build a custom JS tab bar (still using `expo-router`'s stable `Tabs` navigator with a custom `tabBar`, or an equivalent hand-rolled bottom bar) so we have full styling control on all three platforms.
**Status:** proposed, not yet applied — first task of Milestone 0. Confirm you're OK dropping `NativeTabs`, or tell me if you specifically wanted to keep native tab chrome.

### 2. Dispute "random fallback" — contradiction in the PRD
**Context:** PRD §5.4 and RES-04 define exactly two dispute-resolution fallbacks: a pre-agreed judge, or a group vote. If neither was configured, the bet stays disputed indefinitely — "no automatic timeout resolution in V1." But the data model (`bets.random_fallback_enabled`) and the Appendix B test scenario ("approved random fallback selects only among submitted outcomes") describe a third mechanism: a random selection among the conflicting submitted outcomes.
**Why it matters:** this changes the `resolve_dispute()` contract, the bet-creation UI (would need a toggle + explanation), and the disclosure/consent language shown before activation (PRD requires any fallback be disclosed and approved pre-activation).
**Options:**
- (a) Add "random fallback among submitted outcomes" as a third pre-agreed, disclosed, opt-in resolution method, alongside judge and group vote.
- (b) Drop `random_fallback_enabled` and the random-fallback test scenario; disputes with no judge/vote configured simply stay disputed, full stop.
**Status:** needs your decision before Milestone 8 (Resolution & disputes). Not blocking Milestone 0/1.

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

## Store/legal risks to track (not decisions I can make for you)

- **App-store classification risk.** NoShot's ratio/odds mechanic is adjacent to gambling even without cash stakes. PRD §16 already mandates safe positioning language and hard content blocks; final risk sign-off needs review against Apple/Google's then-current policies and, per the PRD itself, qualified counsel — I cannot make this determination or guarantee approval.
- **Age gating is self-attestation only** (16+ checkbox + birth year), no ID verification, per MVP scope. This is a product/legal risk to revisit for regional launches.
- **Final ToS / Privacy Policy / Community Guidelines** will ship as clearly-marked placeholders only; do not submit to app stores without counsel review, per PRD §14.2.
- **Store submission, developer agreements, and paid accounts** (Apple Developer Program, Google Play Console, Expo/EAS) must be created and owned by you; I cannot create or pay for these.

## Decided (and why)

- **Keep the existing token-based styling system** instead of adding NativeWind — already functional, avoids extra dependency + rewrite. (`ARCHITECTURE.md` §4)
- **RPC-only vs. direct-insert table split** for the ledger/state-machine integrity requirement — see `ARCHITECTURE.md` §6.
- **Maestro over Detox** for native e2e — no native rebuild cycle, works against Expo dev/preview builds.
- **Phone auth**: deferred per PRD's own explicit decision (§16); provider abstraction should make it addable later without rework.
