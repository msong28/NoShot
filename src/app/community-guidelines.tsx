import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { LegalDisclaimer } from '@/components/ui/legal-disclaimer';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';

export default function CommunityGuidelinesScreen() {
  return (
    <Screen>
      <Button variant="muted" onPress={() => router.back()}>
        Back
      </Button>
      <ThemedText type="headingXL">Community guidelines</ThemedText>
      <LegalDisclaimer />

      <ThemedText type="bodySM" themeColor="textSecondary">
        NoShot is for private, irreverent challenges between friends -- a little chaos is part of
        the fun. These guidelines exist to keep that fun from tipping into something unsafe.
      </ThemedText>

      <SectionHeader title="Never allowed" />
      <ThemedText type="bodySM" themeColor="textSecondary">
        Credible threats, encouragement of serious injury, non-consensual contact, sexual acts or
        services used as a stake, exploitation of minors, self-harm content, illegal weapons or
        drugs, dangerous consumption challenges, and hate or targeted harassment. This kind of
        content is blocked automatically at submission -- it never gets sent.
      </ThemedText>

      <SectionHeader title="Reviewed before it's allowed" />
      <ThemedText type="bodySM" themeColor="textSecondary">
        Ambiguous physical dares, excessive alcohol references, humiliation-based stakes, risky
        eating challenges, and slang with an unclear meaning get flagged for a safety warning or
        review rather than blocked outright.
      </ThemedText>

      <SectionHeader title="Always fine" />
      <ThemedText type="bodySM" themeColor="textSecondary">
        Benign custom jokes, chores, meals, coffees, harmless dares, points, favours, and ordinary
        IOUs -- the everyday stuff NoShot is actually built for.
      </ThemedText>

      <SectionHeader title="Reporting and blocking" />
      <ThemedText type="bodySM" themeColor="textSecondary">
        You can block anyone at any time -- it immediately ends any active friendship and prevents
        new friend requests, group invites, or bets between you. Reporting tools for specific
        content are part of a later milestone; blocking is available today.
      </ThemedText>

      <SectionHeader title="Consequences" />
      <ThemedText type="bodySM" themeColor="textSecondary">
        Repeated or severe violations can result in content removal or account suspension.
        Placeholder detail on the appeal process belongs here once the moderation/admin milestone is
        built.
      </ThemedText>
    </Screen>
  );
}
