/**
 * Postgres's default SQLSTATE for a bare `raise exception '...'` with no
 * explicit errcode -- every hand-written validation message in our RPCs
 * (e.g. "only a participant can upload proof for this bet") uses this code,
 * and none of our ~260 RAISE EXCEPTIONs set a custom one. Any *other* code
 * (23505 unique_violation, 42501 insufficient_privilege, etc.) is a raw
 * Postgres/PostgREST error we didn't author -- its message can contain
 * internal table/column/constraint names, so it isn't safe to show as-is.
 */
const OUR_OWN_EXCEPTION_CODE = 'P0001';

/**
 * Supabase RPC/query errors (unlike auth errors) come back as plain objects,
 * not Error instances -- postgrest-js only upgrades to a real PostgrestError
 * when .throwOnError() is used, which our hooks don't do. `instanceof Error`
 * is always false for them, so callers must check for `.message` directly
 * instead. Real Error instances (Supabase Auth's AuthError, or anything we
 * throw ourselves) are already designed to be user-facing and pass through
 * unfiltered; plain RPC error objects are only trusted when they carry our
 * own exception code.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string' &&
    (error as { code?: unknown }).code === OUR_OWN_EXCEPTION_CODE
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}
