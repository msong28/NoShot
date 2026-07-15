export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  responded_at: string | null;
};

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
};

/**
 * Supabase RPC/query errors (unlike auth errors) come back as plain objects,
 * not Error instances -- postgrest-js only upgrades to a real PostgrestError
 * when .throwOnError() is used, which these hooks don't do. `instanceof
 * Error` is always false for them, so callers must check for `.message`
 * directly instead.
 */
export function friendErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}
