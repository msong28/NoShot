import { useState } from 'react';
import { useNavigate } from 'react-router';

import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/inline-error';
import { useDeleteAccountRequest } from '@/hooks/use-account-deletion';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const CONFIRM_TEXT = 'DELETE';

export function DeleteAccountScreen() {
  const navigate = useNavigate();
  const deleteAccountRequest = useDeleteAccountRequest();

  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleDelete() {
    setError(null);
    deleteAccountRequest.mutate(undefined, {
      onSuccess: () => setDone(true),
      onError: (err) => setError(getErrorMessage(err, 'Could not process the deletion request')),
    });
  }

  async function handleDone() {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-app flex-col items-center justify-center gap-four p-four text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-medium bg-grape-soft text-2xl">
          ✅
        </span>
        <h1 className="font-display text-screen-title font-extrabold tracking-display-tight">
          Deletion requested
        </h1>
        <p className="text-text-secondary">
          Your account is scheduled for deletion. Your data will be anonymized rather than instantly
          erased, since your bet and ledger history is shared with other people who still need it —
          see the privacy policy for details.
        </p>
        <Button fullWidth onClick={handleDone}>
          Sign out
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <BackButton />

      <div className="mt-four flex flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-medium bg-danger-soft text-2xl">
          ⚠️
        </span>
        <h1 className="mt-three font-display text-screen-title font-extrabold tracking-display-tight">
          Delete your account
        </h1>
        <p className="mt-two text-text-secondary">
          This cannot be undone. Your profile will be anonymized; bets, ledger entries, and messages
          you're part of stay visible to the other people involved, since they're a real, still-owed
          record — but they'll no longer show your name.
        </p>
      </div>

      <div className="mt-four">
        <label className="text-sm font-bold text-text-secondary">
          Type <span className="font-display font-bold text-ink">{CONFIRM_TEXT}</span> to confirm
        </label>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="mt-two w-full rounded-medium border-[1.5px] border-danger bg-surface p-three"
        />
      </div>

      <InlineError message={error} />

      <div className="mt-four">
        <Button
          variant="dangerSolid"
          fullWidth
          disabled={confirmText !== CONFIRM_TEXT || deleteAccountRequest.isPending}
          onClick={handleDelete}
        >
          {deleteAccountRequest.isPending ? 'Processing…' : 'Delete my account'}
        </Button>
      </div>
    </main>
  );
}
