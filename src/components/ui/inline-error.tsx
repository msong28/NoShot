import { ThemedText } from '@/components/themed-text';

/**
 * Replaces the `{error ? <ThemedText themeColor="negative" .../> : null}`
 * pattern duplicated across friends/groups/currencies/invite screens.
 */
export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <ThemedText type="bodySM" themeColor="danger">
      {message}
    </ThemedText>
  );
}
