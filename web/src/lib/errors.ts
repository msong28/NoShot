/**
 * Supabase RPC/query errors (unlike auth errors) come back as plain objects,
 * not Error instances -- postgrest-js only upgrades to a real PostgrestError
 * when .throwOnError() is used, which our hooks don't do. `instanceof Error`
 * is always false for them, so callers must check for `.message` directly
 * instead.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
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
