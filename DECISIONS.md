# NoShot — Decisions Log

Lightweight ADR log. Each entry: context, decision, status. Newest at bottom of its section. Update this file whenever a material technical or product decision is made or revisited.

## Open items requiring your sign-off

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

- **Replaced `NativeTabs` (`expo-router/unstable-native-tabs`) with a cross-platform headless tab bar** built on `expo-router/ui` (`Tabs`/`TabList`/`TabTrigger`/`TabSlot`) — applied in Milestone 0. Reason: the native version is explicitly unstable, renders OS-styled chrome that resists the Partiful-style custom treatment the PRD wants, and the `expo-router/ui` API was already proven working (it was the stock template's own web-only tab bar) — now unified into one component for all platforms, with "Add" opening `/create` as a `Stack.Screen` modal rather than being a persistent tab. Verified live on web; not yet verified on iOS/Android (no simulator available this session).
- **Keep the existing token-based styling system** instead of adding NativeWind — already functional, avoids extra dependency + rewrite. (`ARCHITECTURE.md` §4)
- **RPC-only vs. direct-insert table split** for the ledger/state-machine integrity requirement — see `ARCHITECTURE.md` §6.
- **Maestro over Detox** for native e2e — no native rebuild cycle, works against Expo dev/preview builds.
- **Phone auth**: deferred per PRD's own explicit decision (§16); provider abstraction should make it addable later without rework.
