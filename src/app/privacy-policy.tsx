import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { LegalDisclaimer } from '@/components/ui/legal-disclaimer';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';

export default function PrivacyPolicyScreen() {
  return (
    <Screen>
      <Button variant="muted" onPress={() => router.back()}>
        Back
      </Button>
      <ThemedText type="headingXL">Privacy policy</ThemedText>
      <LegalDisclaimer />

      <SectionHeader title="What we collect" />
      <ThemedText type="bodySM" themeColor="textSecondary">
        Your username, display name, and birth year (used only to confirm you meet the minimum age
        requirement). The friends, groups, currencies, bets, manual obligations, and balance history
        you create or take part in. Any photo or text evidence you attach to a bet. Basic moderation
        and rate-limit logs (e.g. how many username searches you&apos;ve made recently) used to keep
        the app usable, not to profile you.
      </ThemedText>

      <SectionHeader title="What we don't collect" />
      <ThemedText type="bodySM" themeColor="textSecondary">
        NoShot never holds or transfers real money, so we don&apos;t collect payment card details or
        bank information. There are no public follower counts or vanity metrics, and no ad network
        or third-party tracker embedded in the app.
      </ThemedText>

      <SectionHeader title="How deletion works" />
      <ThemedText type="bodySM" themeColor="textSecondary">
        Deleting your account from the Account screen is immediate and permanent. Your username,
        display name, birth year, and age acknowledgement are cleared and replaced with an anonymous
        placeholder, and your username becomes available for someone else to use. Every session
        you&apos;re signed into is revoked at the same time.
      </ThemedText>
      <ThemedText type="bodySM" themeColor="textSecondary">
        We don&apos;t erase every record that mentions you: friends and groups you shared bets or
        obligations with keep a pseudonymized reference (shown as &quot;Deleted user&quot;) so their
        own balance history stays accurate and doesn&apos;t break. This is a deliberate retention
        decision, not an oversight -- deleting that history out from under someone else&apos;s
        ledger would make their records wrong.
      </ThemedText>
      <ThemedText type="bodySM" themeColor="textSecondary">
        A brief technical note in the interest of accuracy: revoking a session stops it from being
        renewed going forward, but an access token issued just before deletion can remain valid for
        a short time until it naturally expires. This window is short and does not allow the deleted
        account to be recovered or re-identified.
      </ThemedText>

      <SectionHeader title="Who we share data with" />
      <ThemedText type="bodySM" themeColor="textSecondary">
        Only the infrastructure provider that runs our database and authentication (Supabase). We do
        not sell data or share it with advertisers.
      </ThemedText>

      <SectionHeader title="Contact" />
      <ThemedText type="bodySM" themeColor="textSecondary">
        Placeholder contact channel for privacy questions or deletion issues -- to be filled in with
        a real support address before this document is published.
      </ThemedText>
    </Screen>
  );
}
