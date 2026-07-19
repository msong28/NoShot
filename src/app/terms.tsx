import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { LegalDisclaimer } from '@/components/ui/legal-disclaimer';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';

export default function TermsScreen() {
  return (
    <Screen>
      <Button variant="muted" onPress={() => router.back()}>
        Back
      </Button>
      <ThemedText type="headingXL">Terms of service</ThemedText>
      <LegalDisclaimer />

      <SectionHeader title="What NoShot is" />
      <ThemedText type="bodySM" themeColor="textSecondary">
        NoShot is a private challenge and IOU tracker for friends. It records agreed, non-cash
        stakes between people who already know each other -- it is not a betting service. NoShot
        never holds or transfers real money, never charges entry fees or takes a cut, and never
        offers public pools, house odds, or strangers wagering against one another.
      </ThemedText>

      <SectionHeader title="Eligibility" />
      <ThemedText type="bodySM" themeColor="textSecondary">
        You must be at least 16 years old to create an account. Age is self-attested at sign-up; we
        don&apos;t currently verify it with an ID.
      </ThemedText>

      <SectionHeader title="Your content and conduct" />
      <ThemedText type="bodySM" themeColor="textSecondary">
        Content you create -- bet terms, custom currencies, comments, chat messages -- is checked
        against an automated safety filter before it&apos;s posted. Some content is blocked outright
        (credible threats, sexual content used as payment, encouragement of serious injury, illegal
        activity, and similar categories); other content may be flagged for review. All content is
        private to the people involved -- there is no public feed.
      </ThemedText>

      <SectionHeader title="Disputes" />
      <ThemedText type="bodySM" themeColor="textSecondary">
        Dispute resolution is pre-agreed at the time a bet is created (a designated judge, a group
        vote, or an opt-in random tiebreaker among the outcomes that were actually submitted) and
        never decided unilaterally by one side.
      </ThemedText>

      <SectionHeader title="Account termination" />
      <ThemedText type="bodySM" themeColor="textSecondary">
        You can delete your account at any time from the Account screen -- see the privacy policy
        for exactly what that does. We may suspend an account that violates these terms or the
        community guidelines.
      </ThemedText>

      <SectionHeader title="Disclaimers" />
      <ThemedText type="bodySM" themeColor="textSecondary">
        NoShot is provided during active development, without warranty of any kind. Placeholder
        liability and governing-law language belongs here once counsel has drafted it -- nothing
        below this line should be treated as final.
      </ThemedText>
    </Screen>
  );
}
