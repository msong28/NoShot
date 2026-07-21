import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

import { exchangeCodeForSession } from './oauth';

/** Registered once at startup (see main.tsx), before the first render. */
export function registerDeepLinkListener() {
  if (!Capacitor.isNativePlatform()) return;

  CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith('noshotweb://auth-callback')) return;
    try {
      await exchangeCodeForSession(url);
    } finally {
      await Browser.close();
    }
  });
}
