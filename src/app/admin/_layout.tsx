import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useIsAdmin } from '@/hooks/use-admin';
import { useSession } from '@/hooks/use-session';

/** MOD-05: gates the whole (admin) route group behind is_admin(), checked
 * server-side on every render -- this redirect is UX only, not the real
 * enforcement (every admin RPC and reports_select re-check is_admin()
 * independently, so a non-admin who somehow lands here still gets nothing
 * but permission errors). */
export default function AdminLayout() {
  const { session, isLoading: isSessionLoading } = useSession();
  const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin(session?.user.id);

  if (isSessionLoading || isAdminLoading) {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!session || !isAdmin) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
