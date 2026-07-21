import { useNavigate } from 'react-router';

import { LegalDisclaimer } from '@/components/ui/legal-disclaimer';
import { SectionHeader } from '@/components/ui/section-header';

export function CommunityGuidelinesScreen() {
  const navigate = useNavigate();

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="font-display text-sm text-text-secondary"
      >
        ← Back
      </button>

      <h1 className="mt-three font-display text-2xl font-extrabold">Community guidelines</h1>
      <div className="mt-three">
        <LegalDisclaimer />
      </div>

      <p className="mt-three text-sm text-text-secondary">
        NoShot is for private, irreverent challenges between friends — a little chaos is part of
        the fun. These guidelines exist to keep that fun from tipping into something unsafe.
      </p>

      <SectionHeader title="Never allowed" />
      <p className="mt-two text-sm text-text-secondary">
        Credible threats, encouragement of serious injury, non-consensual contact, sexual acts or
        services used as a stake, exploitation of minors, self-harm content, illegal weapons or
        drugs, dangerous consumption challenges, and hate or targeted harassment. This kind of
        content is blocked automatically at submission — it never gets sent.
      </p>

      <SectionHeader title="Reviewed before it's allowed" />
      <p className="mt-two text-sm text-text-secondary">
        Ambiguous physical dares, excessive alcohol references, humiliation-based stakes, risky
        eating challenges, and slang with an unclear meaning get flagged for a safety warning or
        review rather than blocked outright.
      </p>

      <SectionHeader title="Always fine" />
      <p className="mt-two text-sm text-text-secondary">
        Benign custom jokes, chores, meals, coffees, harmless dares, points, favours, and ordinary
        IOUs — the everyday stuff NoShot is actually built for.
      </p>

      <SectionHeader title="Reporting and blocking" />
      <p className="mt-two text-sm text-text-secondary">
        You can block anyone at any time — it immediately ends any active friendship and prevents
        new friend requests, group invites, or bets between you. Reporting tools for specific
        content are part of a later milestone; blocking is available today.
      </p>

      <SectionHeader title="Consequences" />
      <p className="mt-two text-sm text-text-secondary">
        Repeated or severe violations can result in content removal or account suspension.
        Placeholder detail on the appeal process belongs here once the moderation/admin milestone
        is built.
      </p>
    </main>
  );
}
