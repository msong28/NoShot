import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';

import { queryClient } from '@/lib/query-client';
import { AuthCallbackScreen } from '@/routes/auth-callback';
import { ProfileScreen } from '@/routes/profile';
import { ProtectedRoute } from '@/routes/protected-route';
import { SignInScreen } from '@/routes/sign-in';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SignInScreen />} />
          <Route path="/auth/callback" element={<AuthCallbackScreen />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<ProfileScreen />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
