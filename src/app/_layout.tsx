import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as RouterThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ThemedView } from '@/components/themed-view';
import { ToastProvider } from '@/components/ui/toast';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { queryClient } from '@/lib/query-client';
import { ThemeProvider as AppThemeProvider, useThemeMode } from '@/providers/theme-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ThemedRouterProvider />
      </QueryClientProvider>
    </AppThemeProvider>
  );
}

function ThemedRouterProvider() {
  const { scheme } = useThemeMode();

  return (
    <RouterThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ToastProvider>
        <AnimatedSplashOverlay />
        <RootNavigator />
      </ToastProvider>
    </RouterThemeProvider>
  );
}

function RootNavigator() {
  const { session, isLoading: isSessionLoading } = useSession();
  const { data: profile, isLoading: isProfileLoading } = useProfile(session?.user.id);

  if (isSessionLoading || (session && isProfileLoading)) {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { flex: 1 } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !profile}>
        <Stack.Screen name="setup-profile" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !!profile}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="friends" />
        <Stack.Screen name="currencies" />
        <Stack.Screen name="obligations" />
        <Stack.Screen name="group/[groupId]" />
        <Stack.Screen name="design-system" />
      </Stack.Protected>
      {/* Not inside any guard above: reachable regardless of auth state, so a
          non-user can preview an invite before creating an account (FR-04). */}
      <Stack.Screen name="invite/[username]" />
      {/* Also ungated: the web OAuth redirect lands here before a session
          exists, and staying independent of the session guard avoids any
          race with Stack.Protected re-rendering mid-exchange. */}
      <Stack.Screen name="auth-callback" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
