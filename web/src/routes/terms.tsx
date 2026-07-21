import { useNavigate } from 'react-router';

import { LegalDisclaimer } from '@/components/ui/legal-disclaimer';
import { SectionHeader } from '@/components/ui/section-header';

export function TermsScreen() {
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

      <h1 className="mt-three font-display text-2xl font-extrabold">Terms of service</h1>
      <div className="mt-three">
        <LegalDisclaimer />
      </div>

      <SectionHeader title="What NoShot is" />
      <p className="mt-two text-sm text-text-secondary">
        NoShot is a private challenge and IOU tracker for friends. It records agreed, non-cash
        stakes between people who already know each other — it is not a betting service. NoShot
        never holds or transfers real money, never charges entry fees or takes a cut, and never
        offers public pools, house odds, or strangers wagering against one another.
      </p>

      <SectionHeader title="Eligibility" />
      <p className="mt-two text-sm text-text-secondary">
        You must be at least 16 years old to create an account. Age is self-attested at sign-up; we
        don't currently verify it with an ID.
      </p>

      <SectionHeader title="Your content and conduct" />
      <p className="mt-two text-sm text-text-secondary">
        Content you create — bet terms, custom currencies, comments, chat messages — is checked
        against an automated safety filter before it's posted. Some content is blocked outright
        (credible threats, sexual content used as payment, encouragement of serious injury, illegal
        activity, and similar categories); other content may be flagged for review. All content is
        private to the people involved — there is no public feed.
      </p>

      <SectionHeader title="Disputes" />
      <p className="mt-two text-sm text-text-secondary">
        Dispute resolution is pre-agreed at the time a bet is created (a designated judge, a group
        vote, or an opt-in random tiebreaker among the outcomes that were actually submitted) and
        never decided unilaterally by one side.
      </p>

      <SectionHeader title="Account termination" />
      <p className="mt-two text-sm text-text-secondary">
        You can delete your account at any time from the Account screen — see the privacy policy
        for exactly what that does. We may suspend an account that violates these terms or the
        community guidelines.
      </p>

      <SectionHeader title="Disclaimers" />
      <p className="mt-two text-sm text-text-secondary">
        NoShot is provided during active development, without warranty of any kind. Placeholder
        liability and governing-law language belongs here once counsel has drafted it — nothing
        below this line should be treated as final.
      </p>
    </main>
  );
}
