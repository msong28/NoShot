import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { registerDeepLinkListener } from '@/lib/auth/deep-link';
import './styles/index.css';

registerDeepLinkListener();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
