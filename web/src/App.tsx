import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';

import { useThemeMode } from '@/hooks/use-theme-mode';
import { queryClient } from '@/lib/query-client';
import { AccountScreen } from '@/routes/account';
import { ActivityScreen } from '@/routes/activity';
import { AdminReportDetailScreen } from '@/routes/admin-report-detail';
import { AdminReportQueueScreen } from '@/routes/admin-reports';
import { AuthCallbackScreen } from '@/routes/auth-callback';
import { BalancesScreen } from '@/routes/balances';
import { BetDetailScreen } from '@/routes/bet-detail';
import { BetsScreen } from '@/routes/bets';
import { CommunityGuidelinesScreen } from '@/routes/community-guidelines';
import { CreateScreen } from '@/routes/create';
import { CurrenciesScreen } from '@/routes/currencies';
import { DeleteAccountScreen } from '@/routes/delete-account';
import { EditProfileScreen } from '@/routes/edit-profile';
import { ForgotPasswordScreen } from '@/routes/forgot-password';
import { FriendsScreen } from '@/routes/friends';
import { GroupDetailScreen } from '@/routes/group-detail';
import { GroupsScreen } from '@/routes/groups';
import { HomeScreen } from '@/routes/home';
import { InvitePreviewScreen } from '@/routes/invite-preview';
import { ObligationsScreen } from '@/routes/obligations';
import { PrivacyPolicyScreen } from '@/routes/privacy-policy';
import { ProfileScreen } from '@/routes/profile';
import { ProtectedRoute } from '@/routes/protected-route';
import { RequireAdmin } from '@/routes/require-admin';
import { RequireProfile } from '@/routes/require-profile';
import { RequireSessionNoProfile } from '@/routes/require-session-no-profile';
import { ResetPasswordScreen } from '@/routes/reset-password';
import { SetupProfileScreen } from '@/routes/setup-profile';
import { SignInScreen } from '@/routes/sign-in';
import { SignUpScreen } from '@/routes/sign-up';
import { TermsScreen } from '@/routes/terms';

export function App() {
  const { mode, setMode } = useThemeMode();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SignInScreen />} />
          <Route path="/sign-up" element={<SignUpScreen />} />
          <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
          <Route path="/reset-password" element={<ResetPasswordScreen />} />
          <Route path="/auth/callback" element={<AuthCallbackScreen />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyScreen />} />
          <Route path="/terms" element={<TermsScreen />} />
          <Route path="/community-guidelines" element={<CommunityGuidelinesScreen />} />
          <Route path="/invite/:username" element={<InvitePreviewScreen />} />

          <Route element={<RequireSessionNoProfile />}>
            <Route path="/setup-profile" element={<SetupProfileScreen />} />
          </Route>

          <Route element={<RequireProfile />}>
            <Route path="/home" element={<HomeScreen />} />
            <Route path="/bets" element={<BetsScreen />} />
            <Route path="/activity" element={<ActivityScreen />} />
            <Route path="/groups" element={<GroupsScreen />} />
            <Route path="/account" element={<AccountScreen mode={mode} setMode={setMode} />} />
            <Route path="/edit-profile" element={<EditProfileScreen />} />
            <Route path="/bet/:betId" element={<BetDetailScreen />} />
            <Route path="/group/:groupId" element={<GroupDetailScreen />} />
            <Route path="/create" element={<CreateScreen />} />
            <Route path="/balances" element={<BalancesScreen />} />
            <Route path="/currencies" element={<CurrenciesScreen />} />
            <Route path="/friends" element={<FriendsScreen />} />
            <Route path="/obligations" element={<ObligationsScreen />} />
            <Route path="/delete-account" element={<DeleteAccountScreen />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<ProfileScreen />} />
          </Route>

          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminReportQueueScreen />} />
            <Route path="/admin/report/:reportId" element={<AdminReportDetailScreen />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
