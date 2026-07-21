import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';

import { queryClient } from '@/lib/query-client';
import { AccountScreen } from '@/routes/account';
import { ActivityScreen } from '@/routes/activity';
import { AuthCallbackScreen } from '@/routes/auth-callback';
import { BalancesScreen } from '@/routes/balances';
import { BetDetailScreen } from '@/routes/bet-detail';
import { CommunityGuidelinesScreen } from '@/routes/community-guidelines';
import { CreateScreen } from '@/routes/create';
import { CurrenciesScreen } from '@/routes/currencies';
import { DeleteAccountScreen } from '@/routes/delete-account';
import { FriendsScreen } from '@/routes/friends';
import { GroupDetailScreen } from '@/routes/group-detail';
import { GroupsScreen } from '@/routes/groups';
import { HomeScreen } from '@/routes/home';
import { PrivacyPolicyScreen } from '@/routes/privacy-policy';
import { ProfileScreen } from '@/routes/profile';
import { ProtectedRoute } from '@/routes/protected-route';
import { RequireProfile } from '@/routes/require-profile';
import { RequireSessionNoProfile } from '@/routes/require-session-no-profile';
import { SetupProfileScreen } from '@/routes/setup-profile';
import { SignInScreen } from '@/routes/sign-in';
import { TermsScreen } from '@/routes/terms';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SignInScreen />} />
          <Route path="/auth/callback" element={<AuthCallbackScreen />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyScreen />} />
          <Route path="/terms" element={<TermsScreen />} />
          <Route path="/community-guidelines" element={<CommunityGuidelinesScreen />} />

          <Route element={<RequireSessionNoProfile />}>
            <Route path="/setup-profile" element={<SetupProfileScreen />} />
          </Route>

          <Route element={<RequireProfile />}>
            <Route path="/home" element={<HomeScreen />} />
            <Route path="/activity" element={<ActivityScreen />} />
            <Route path="/groups" element={<GroupsScreen />} />
            <Route path="/account" element={<AccountScreen />} />
            <Route path="/bet/:betId" element={<BetDetailScreen />} />
            <Route path="/group/:groupId" element={<GroupDetailScreen />} />
            <Route path="/create" element={<CreateScreen />} />
            <Route path="/balances" element={<BalancesScreen />} />
            <Route path="/currencies" element={<CurrenciesScreen />} />
            <Route path="/friends" element={<FriendsScreen />} />
            <Route path="/delete-account" element={<DeleteAccountScreen />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<ProfileScreen />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
