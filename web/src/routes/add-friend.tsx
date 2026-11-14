import { useState } from 'react';
import { useNavigate } from 'react-router';

import { BackButton } from '@/components/ui/back-button';
import { IconTile } from '@/components/ui/icon-tile';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { Icons } from '@/lib/icons';
import { getInviteLink, shareInviteLink } from '@/lib/invite-link';

/** The "get someone into your friends list" hub: look them up by username,
 * copy your invite link, or send it through the phone's share sheet (which is
 * also how you reach contacts / Messages -- there's no contacts import yet). */
export function AddFriendScreen() {
  const { session } = useSession();
  const navigate = useNavigate();
  const { data: myProfile } = useProfile(session?.user.id);

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCopy() {
    if (!myProfile) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(getInviteLink(myProfile.username));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy your invite link");
    }
  }

  async function handleShare() {
    if (!myProfile) return;
    setError(null);
    try {
      const result = await shareInviteLink(myProfile.username, myProfile.display_name);
      if (result === 'copied') {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      setError("Couldn't share your invite link");
    }
  }

  return (
    <main className="mx-auto max-w-app p-four">
      <BackButton label="Friends" />
      <h1 className="mt-three font-display text-screen-title font-extrabold tracking-display-tight">
        Add friends
      </h1>
      <p className="mt-one text-text-secondary">Pick how you want to find them.</p>

      <InlineError message={error} />

      <div className="mt-four flex flex-col gap-two">
        <ListRow
          onClick={() => navigate('/friends/search')}
          leading={
            <IconTile tone="neutral">
              <Icons.search size={20} strokeWidth={2} />
            </IconTile>
          }
          title="Search by username"
          subtitle="Find someone already on NoShot"
        />
        <ListRow
          onClick={handleCopy}
          leading={
            <IconTile tone="neutral">
              <Icons.link size={20} strokeWidth={2} />
            </IconTile>
          }
          title={copied ? 'Link copied!' : 'Copy invite link'}
          subtitle="Paste it in any chat"
        />
        <ListRow
          onClick={handleShare}
          leading={
            <IconTile tone="neutral">
              <Icons.share size={20} strokeWidth={2} />
            </IconTile>
          }
          title="Share invite link"
          subtitle="Send to your contacts via Messages, WhatsApp…"
        />
      </div>
    </main>
  );
}
