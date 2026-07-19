import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shared banner for the placeholder legal documents (privacy policy, terms,
 * community guidelines) -- per DECISIONS.md, none of these ship as final
 * text without counsel review, so every one of them needs this same
 * up-front disclaimer rather than trusting each screen to repeat it
 * correctly on its own.
 */
export function LegalDisclaimer() {
  const theme = useTheme();

  return (
    <Card style={[styles.card, { borderColor: theme.danger }]}>
      <ThemedText type="label" themeColor="danger">
        NOT LEGAL ADVICE — FOR COUNSEL REVIEW
      </ThemedText>
      <ThemedText type="bodySM" themeColor="textSecondary">
        This is placeholder text drafted to describe how NoShot actually behaves today. It has not
        been reviewed by a lawyer and must not be published or relied on as a real legal document
        until qualified counsel has reviewed it for the launch jurisdiction(s).
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
