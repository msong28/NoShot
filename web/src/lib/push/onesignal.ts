import { Capacitor } from '@capacitor/core';
import OneSignal from 'onesignal-cordova-plugin';

import { supabase } from '@/lib/supabase';

/**
 * OneSignal's `login(externalId)` associates this device with our own
 * Supabase user id server-side -- no push-token table of our own needed,
 * unlike a raw APNs integration. The Edge Function that actually sends a
 * push targets `include_aliases.external_id`, not a device token we'd have
 * to store and keep in sync ourselves.
 */
let initialized = false;

/** Called once at app startup (see main.tsx). No-ops on web -- this SDK is
 * the native Cordova/Capacitor bridge, not OneSignal's separate web push
 * integration, which is out of scope here. Requires
 * VITE_ONESIGNAL_APP_ID -- see .env.example for where that comes from. */
export function initializeOneSignal() {
  if (!Capacitor.isNativePlatform() || initialized) return;

  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined;
  if (!appId) {
    console.warn('OneSignal is not configured -- set VITE_ONESIGNAL_APP_ID to enable push');
    return;
  }

  OneSignal.initialize(appId);
  initialized = true;
}

/** Keeps the OneSignal-side user identity in lockstep with Supabase's own
 * auth state -- logged in here, logged out there, so a push always reaches
 * (or stops reaching) the right person's devices, including after a
 * sign-out/sign-in as a different account on the same device. */
export function registerPushAuthListener() {
  if (!Capacitor.isNativePlatform()) return;

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!initialized) return;
    if (session?.user.id) {
      OneSignal.login(session.user.id);
    } else {
      OneSignal.logout();
    }
  });
}

/** Wired to the existing Settings screen "Notifications" toggle -- turning
 * it on also asks the OS for push permission on native, instead of a
 * separate, easy-to-miss onboarding prompt. `fallbackToSettings` opens the
 * Settings app if the user already declined once, since re-prompting
 * natively isn't possible past that point. */
export async function requestPushPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !initialized) return false;
  return OneSignal.Notifications.requestPermission(true);
}
