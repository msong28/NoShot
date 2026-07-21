import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { ReportDialog } from '@/components/report-dialog';
import { useSendFriendRequest } from '@/hooks/use-friends';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';
import type { PublicProfile } from '@/lib/friend';
import { supabase } from '@/lib/supabase';

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
      return <p className="text-text-secondary">Loading…</p>;
    }

    if (!previewQuery.data) {
      return <p className="text-text-secondary">This invite link isn't valid.</p>;
    }

    const invitedProfile = previewQuery.data;

    return (
      <>
        <h2 className="font-display text-lg font-extrabold">
          @{invitedProfile.username} · {invitedProfile.display_name}
        </h2>
        <p className="mt-two text-text-secondary">wants to be your friend on NoShot.</p>

        {session ? (
          <button
            type="button"
            onClick={() => setShowReport(true)}
            className="mt-three font-display text-sm text-text-secondary"
          >
            Report this profile
          </button>
        ) : null}

        {session ? (
          requestSent ? (
            <p className="mt-four font-display font-bold text-success">Friend request sent.</p>
          ) : (
            <>
              <button
                type="button"
                disabled={sendRequest.isPending}
                onClick={() => {
                  setRequestError(null);
                  sendRequest.mutate(invitedProfile.id, {
                    onSuccess: () => setRequestSent(true),
                    onError: (error) =>
                      setRequestError(getErrorMessage(error, 'Failed to send request')),
                  });
                }}
                className="mt-four rounded-pill bg-primary px-four py-three font-display font-bold text-on-primary disabled:opacity-60"
              >
                Add as friend
              </button>
              {requestError ? (
                <p role="alert" className="mt-two text-sm text-danger">
                  {requestError}
                </p>
              ) : null}
            </>
          )
        ) : (
          <>
            <p className="mt-four text-text-secondary">
              Sign in to add {invitedProfile.display_name} as a friend.
            </p>
            <Link
              to="/"
              className="mt-three block rounded-pill bg-primary px-four py-three text-center font-display font-bold text-on-primary"
            >
              Sign in
            </Link>
          </>
        )}

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
    <main className="mx-auto flex min-h-screen max-w-app flex-col justify-center gap-three p-four">
      <h1 className="font-display text-3xl font-extrabold">NoShot</h1>
      {content}
    </main>
  );
}
