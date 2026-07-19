import { router } from 'expo-router';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { InlineError } from '@/components/ui/inline-error';
import { Screen } from '@/components/ui/screen';
import { useDeleteAccountRequest } from '@/hooks/use-account-deletion';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export default function DeleteAccountScreen() {
  const deleteAccount = useDeleteAccountRequest();
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setShowConfirm(false);
    setError(null);
    deleteAccount.mutate(undefined, {
      onSuccess: async () => {
        // The RPC already revoked server-side sessions; this clears the
        // local session too so the auth-state listener in _layout.tsx
        // routes straight back to the sign-in screen.
        await supabase.auth.signOut();
      },
      onError: (err) => setError(getErrorMessage(err, 'Failed to delete your account')),
    });
  }

  return (
    <Screen>
      <Button variant="muted" onPress={() => router.back()}>
        Back
      </Button>
      <ThemedText type="headingXL">Delete account</ThemedText>
      <ThemedText type="bodySM" themeColor="textSecondary">
        This anonymizes your profile and can&apos;t be undone.
      </ThemedText>

      <Card>
        <ThemedText type="label">What stays behind</ThemedText>
        <ThemedText type="bodySM" themeColor="textSecondary">
          Friends and groups you were part of keep enough of a record that their bet and balance
          history stays coherent, but it&apos;ll show as &quot;Deleted user&quot; instead of your
          real name or username. Accepted friendships and active group memberships aren&apos;t
          removed; pending friend requests and group invites involving you are cancelled.
        </ThemedText>
      </Card>

      <Card>
        <ThemedText type="label">What&apos;s removed</ThemedText>
        <ThemedText type="bodySM" themeColor="textSecondary">
          Your username, display name, birth year, and age acknowledgement are cleared -- your
          username becomes available for someone else to use. Every session you&apos;re signed into,
          on every device, is revoked.
        </ThemedText>
      </Card>

      <InlineError message={error} />

      <Button
        variant="destructive"
        onPress={() => setShowConfirm(true)}
        loading={deleteAccount.isPending}
      >
        Delete my account
      </Button>

      <ConfirmationDialog
        visible={showConfirm}
        title="Delete your account?"
        description="This can't be undone -- your identity is anonymized immediately and you'll be signed out everywhere."
        confirmLabel="Delete account"
        destructive
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />
    </Screen>
  );
}
