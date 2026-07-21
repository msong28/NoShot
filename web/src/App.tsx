import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';

import { queryClient } from '@/lib/query-client';
import { AccountScreen } from '@/routes/account';
import { ActivityScreen } from '@/routes/activity';
import { AuthCallbackScreen } from '@/routes/auth-callback';
import { GroupsScreen } from '@/routes/groups';
import { HomeScreen } from '@/routes/home';
import { ProfileScreen } from '@/routes/profile';
import { ProtectedRoute } from '@/routes/protected-route';
import { RequireProfile } from '@/routes/require-profile';
import { RequireSessionNoProfile } from '@/routes/require-session-no-profile';
import { SetupProfileScreen } from '@/routes/setup-profile';
import { SignInScreen } from '@/routes/sign-in';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SignInScreen />} />
          <Route path="/auth/callback" element={<AuthCallbackScreen />} />

          <Route element={<RequireSessionNoProfile />}>
            <Route path="/setup-profile" element={<SetupProfileScreen />} />
          </Route>

          <Route element={<RequireProfile />}>
            <Route path="/home" element={<HomeScreen />} />
            <Route path="/activity" element={<ActivityScreen />} />
            <Route path="/groups" element={<GroupsScreen />} />
            <Route path="/account" element={<AccountScreen />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<ProfileScreen />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
