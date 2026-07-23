// Sends a push notification via OneSignal's REST API, targeted at a
// Supabase user id (not a raw device token -- see lib/push/onesignal.ts
// on the client, which calls OneSignal.login(userId) so OneSignal itself
// maintains the user<->device mapping via `external_id`).
//
// Only ever called server-side, from notify_push() (see
// 20260723130000_push_notifications.sql) via pg_net -- never invoked
// directly by a client, which is why this is deployed with
// --no-verify-jwt and instead checks its own shared secret header. That
// secret is generated once and stored in both Postgres Vault (read by
// notify_push()) and this function's own secrets, never in git.

/** Plain `!==` on secrets leaks timing information about how many leading
 * bytes matched -- WebCrypto's digest comparison here runs in time
 * proportional to input length, not to where the strings first differ. */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const bytesA = new Uint8Array(hashA);
  const bytesB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  const dispatchSecret = Deno.env.get('PUSH_DISPATCH_SECRET');
  const oneSignalAppId = Deno.env.get('ONESIGNAL_APP_ID');
  const oneSignalApiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');

  const providedSecret = req.headers.get('x-internal-secret') ?? '';
  if (!dispatchSecret || !(await timingSafeEqual(providedSecret, dispatchSecret))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  if (!oneSignalAppId || !oneSignalApiKey) {
    return new Response(JSON.stringify({ error: 'push not configured' }), { status: 501 });
  }

  let userId: unknown, title: unknown, body: unknown, data: unknown;
  try {
    ({ userId, title, body, data } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON body' }), { status: 400 });
  }
  if (typeof userId !== 'string' || typeof title !== 'string' || typeof body !== 'string') {
    return new Response(JSON.stringify({ error: 'userId, title, and body are required' }), {
      status: 400,
    });
  }

  const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${oneSignalApiKey}`,
    },
    body: JSON.stringify({
      app_id: oneSignalAppId,
      target_channel: 'push',
      include_aliases: { external_id: [userId] },
      headings: { en: title },
      contents: { en: body },
      data: data ?? {},
    }),
  });

  const result = await oneSignalResponse.json();
  if (!oneSignalResponse.ok) {
    console.error('OneSignal send failed', result);
    return new Response(JSON.stringify({ error: result }), { status: 502 });
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
});
