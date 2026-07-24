import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { motion } from 'motion/react';

import { ReportDialog } from '@/components/report-dialog';
import { Avatar } from '@/components/ui/avatar';
import { useSendFriendRequest } from '@/hooks/use-friends';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';
import type { PublicProfile } from '@/lib/friend';
import { supabase } from '@/lib/supabase';

/**
 * README §"Invite preview": "the loudest screen — first impression" --
 * full grape background (not a themed surface swap; this is the one
 * deliberately fixed-color screen in the system), lime primary CTA. The
 * mock also shows a specific bet preview card ("Dishes for a week ·
 * Pending"), but `get_invite_preview` only returns the inviter's public
 * profile -- this invite flow is a generic friend invite, not tied to any
 * bet, so that card is omitted rather than faked.
 */
export function InvitePreviewScreen() {
  const { username } = useParams<{ username: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const sendRequest = useSendFriendRequest(userId);
  const [requestSent, setRequestSent] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const previewQuery = useQuery({
    queryKey: ['invite-preview', username],
    queryFn: async (): Promise<PublicProfile | null> => {
      const { data, error } = await supabase.rpc('get_invite_preview', { p_username: username });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!username,
  });

  const content = (() => {
    if (previewQuery.isLoading) {
      return <p className="text-white/80">Loading…</p>;
    }

    if (!previewQuery.data) {
      return <p className="text-white/80">This invite link isn&rsquo;t valid.</p>;
    }

    const invitedProfile = previewQuery.data;

    return (
      <>
        <motion.div
          className="rounded-pill ring-4 ring-white/40"
          initial={{ scale: 0.4, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14 }}
        >
          <Avatar id={invitedProfile.id} name={invitedProfile.display_name} size="xl" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-four font-display text-screen-title font-extrabold tracking-display-tight"
        >
          {invitedProfile.display_name} challenged you on NoShot
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="mt-two text-white/80"
        >
          Keep score on bets &amp; dares with friends. No cash — just stakes.
        </motion.p>

        {session ? (
          <button
            type="button"
            onClick={() => setShowReport(true)}
            className="mt-three text-sm text-white/60 underline"
          >
            Report this profile
          </button>
        ) : null}

        <div className="mt-auto flex w-full flex-col items-center gap-three pt-four">
          {session ? (
            requestSent ? (
              <motion.p
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className="font-display font-bold text-lime"
              >
                Friend request sent 🎉
              </motion.p>
            ) : (
              <>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  disabled={sendRequest.isPending}
                  onClick={() => {
                    setRequestError(null);
                    sendRequest.mutate(invitedProfile.id, {
                      onSuccess: () => setRequestSent(true),
                      onError: (error) =>
                        setRequestError(getErrorMessage(error, 'Failed to send request')),
                    });
                  }}
                  className="w-full rounded-[16px] bg-lime px-four py-three font-extrabold text-on-lime disabled:opacity-60"
                >
                  Accept challenge
                </motion.button>
                {requestError ? (
                  <p role="alert" className="text-sm text-white">
                    {requestError}
                  </p>
                ) : null}
              </>
            )
          ) : (
            <>
              <p className="text-white/80">
                Sign in to add {invitedProfile.display_name} as a friend.
              </p>
              <Link
                to="/"
                className="w-full rounded-[16px] bg-lime px-four py-three text-center font-extrabold text-on-lime"
              >
                Sign in
              </Link>
            </>
          )}
          <Link to="/" className="text-sm text-white/70 underline">
            What&rsquo;s NoShot?
          </Link>
        </div>

        <ReportDialog
          visible={showReport}
          targetType="user"
          targetId={invitedProfile.id}
          onClose={() => setShowReport(false)}
        />
      </>
    );
  })();

  return (
    <main className="flex min-h-screen flex-col items-center bg-grape px-four py-six text-center text-white">
      <p className="font-display text-lg font-extrabold">
        NoShot<span className="text-lime">.</span>
      </p>
      <div className="mt-six flex flex-1 flex-col items-center">{content}</div>
    </main>
  );
}
