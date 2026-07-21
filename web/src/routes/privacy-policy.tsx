import { BackButton } from '@/components/ui/back-button';

import { LegalDisclaimer } from '@/components/ui/legal-disclaimer';
import { SectionHeader } from '@/components/ui/section-header';

export function PrivacyPolicyScreen() {

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <BackButton />

      <h1 className="mt-three font-display text-2xl font-extrabold">Privacy policy</h1>
      <div className="mt-three">
        <LegalDisclaimer />
      </div>

      <SectionHeader title="What we collect" />
      <p className="mt-two text-sm text-text-secondary">
        Your username, display name, and birth year (used only to confirm you meet the minimum age
        requirement). The friends, groups, currencies, bets, manual obligations, and balance
        history you create or take part in. Any photo or text evidence you attach to a bet. Basic
        moderation and rate-limit logs (e.g. how many username searches you've made recently) used
        to keep the app usable, not to profile you.
      </p>

      <SectionHeader title="What we don't collect" />
      <p className="mt-two text-sm text-text-secondary">
        NoShot never holds or transfers real money, so we don't collect payment card details or
        bank information. There are no public follower counts or vanity metrics, and no ad network
        or third-party tracker embedded in the app.
      </p>

      <SectionHeader title="How deletion works" />
      <p className="mt-two text-sm text-text-secondary">
        Deleting your account from the Account screen is immediate and permanent. Your username,
        display name, birth year, and age acknowledgement are cleared and replaced with an
        anonymous placeholder, and your username becomes available for someone else to use. Every
        session you're signed into is revoked at the same time.
      </p>
      <p className="mt-two text-sm text-text-secondary">
        We don't erase every record that mentions you: friends and groups you shared bets or
        obligations with keep a pseudonymized reference (shown as "Deleted user") so their own
        balance history stays accurate and doesn't break. This is a deliberate retention decision,
        not an oversight — deleting that history out from under someone else's ledger would make
        their records wrong.
      </p>
      <p className="mt-two text-sm text-text-secondary">
        A brief technical note in the interest of accuracy: revoking a session stops it from being
        renewed going forward, but an access token issued just before deletion can remain valid for
        a short time until it naturally expires. This window is short and does not allow the
        deleted account to be recovered or re-identified.
      </p>

      <SectionHeader title="Who we share data with" />
      <p className="mt-two text-sm text-text-secondary">
        Only the infrastructure provider that runs our database and authentication (Supabase). We
        do not sell data or share it with advertisers.
      </p>

      <SectionHeader title="Contact" />
      <p className="mt-two text-sm text-text-secondary">
        Placeholder contact channel for privacy questions or deletion issues — to be filled in with
        a real support address before this document is published.
      </p>
    </main>
  );
}
