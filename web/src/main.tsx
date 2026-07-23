import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { registerDeepLinkListener } from '@/lib/auth/deep-link';
import { initializeOneSignal, registerPushAuthListener } from '@/lib/push/onesignal';
import './styles/index.css';

registerDeepLinkListener();
initializeOneSignal();
registerPushAuthListener();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
