import { useState } from 'react';
import { useNavigate } from 'react-router';

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
      <main className="mx-auto flex min-h-screen max-w-app flex-col justify-center gap-four p-four text-center">
        <h1 className="font-display text-2xl font-extrabold">Deletion requested</h1>
        <p className="text-text-secondary">
          Your account is scheduled for deletion. Your data will be anonymized rather than
          instantly erased, since your bet and ledger history is shared with other people who
          still need it — see the privacy policy for details.
        </p>
        <button
          type="button"
          onClick={handleDone}
          className="rounded-pill bg-primary px-four py-three font-display font-bold text-on-primary"
        >
          Sign out
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-app flex-col justify-center gap-four p-four">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Delete your account</h1>
        <p className="mt-two text-text-secondary">
          This cannot be undone. Your profile will be anonymized; bets, ledger entries, and
          messages you're part of stay visible to the other people involved, since they're a
          real, still-owed record — but they'll no longer show your name.
        </p>
      </div>

      <div>
        <label className="text-sm text-text-secondary">
          Type <span className="font-display font-bold">{CONFIRM_TEXT}</span> to confirm
        </label>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="mt-two w-full rounded-medium bg-surface p-three shadow-card"
        />
      </div>

      <InlineError message={error} />

      <button
        type="button"
        disabled={confirmText !== CONFIRM_TEXT || deleteAccountRequest.isPending}
        onClick={handleDelete}
        className="rounded-pill bg-danger-bg px-four py-three font-display font-bold text-danger disabled:opacity-60"
      >
        {deleteAccountRequest.isPending ? 'Processing…' : 'Delete my account'}
      </button>
    </main>
  );
}
