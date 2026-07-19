import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CategoryPicker } from '@/components/category-picker';
import { ReportDialog } from '@/components/report-dialog';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useCreateCurrency, useCurrencies } from '@/hooks/use-currencies';
import { useSession } from '@/hooks/use-session';
import type { CurrencyCategory } from '@/lib/currency';
import { getErrorMessage } from '@/lib/errors';

export default function CurrenciesScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const currencies = useCurrencies({ ownerUserId: userId as string });
  const createCurrency = useCreateCurrency({ ownerUserId: userId as string });

  const [name, setName] = useState('');
  const [category, setCategory] = useState<CurrencyCategory>('custom');
  const [error, setError] = useState<string | null>(null);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    createCurrency.mutate(
      { name, category },
      {
        onSuccess: () => setName(''),
        onError: (err) => setError(getErrorMessage(err, 'Failed to create currency')),
      },
    );
  }

  return (
    <Screen>
      <Button variant="muted" onPress={() => router.back()}>
        Back
      </Button>
      <ThemedText type="headingXL">Currencies</ThemedText>
      <ThemedText type="bodySM" themeColor="textSecondary">
        Built-in currencies plus any custom ones you&apos;ve created. Bets will reference these once
        the bet engine lands.
      </ThemedText>

      <SectionHeader title="New currency" />
      <TextField label="Name" placeholder="e.g. Movie Night" value={name} onChangeText={setName} />
      <CategoryPicker value={category} onChange={setCategory} />
      <Button
        variant="primary"
        onPress={handleCreate}
        disabled={!name.trim() || createCurrency.isPending}
      >
        Create currency
      </Button>
      <InlineError message={error} />

      <SectionHeader title="All currencies" />
      {(currencies.data ?? []).map((currency) => (
        <ListRow
          key={currency.id}
          leading={currency.icon ? <ThemedText>{currency.icon}</ThemedText> : undefined}
          title={currency.name}
          trailing={
            <View style={styles.currencyTrailing}>
              {currency.is_builtin ? (
                <StatusBadge label="Built-in" variant="neutral" />
              ) : currency.moderation_status === 'pending_review' ? (
                <StatusBadge label="Pending review" variant="warning" />
              ) : null}
              <Button variant="ghost" onPress={() => setReportTargetId(currency.id)}>
                Report
              </Button>
            </View>
          }
        />
      ))}

      <ReportDialog
        visible={reportTargetId !== null}
        targetType="currency"
        targetId={reportTargetId}
        onClose={() => setReportTargetId(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  currencyTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
