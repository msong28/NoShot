import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryPicker } from '@/components/category-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCreateCurrency, useCurrencies } from '@/hooks/use-currencies';
import { useSession } from '@/hooks/use-session';
import { getErrorMessage } from '@/lib/errors';
import type { CurrencyCategory } from '@/lib/currency';

export default function CurrenciesScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const userId = session?.user.id;

  const currencies = useCurrencies({ ownerUserId: userId as string });
  const createCurrency = useCreateCurrency({ ownerUserId: userId as string });

  const [name, setName] = useState('');
  const [category, setCategory] = useState<CurrencyCategory>('custom');
  const [error, setError] = useState<string | null>(null);

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
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
        ]}
      >
        <Button variant="muted" onPress={() => router.back()} style={styles.backButton}>
          Back
        </Button>
        <ThemedText type="title">Currencies</ThemedText>
        <ThemedText themeColor="textSecondary">
          Built-in currencies plus any custom ones you&apos;ve created. Bets will reference these
          once the bet engine lands.
        </ThemedText>

        <ThemedText type="smallBold">New currency</ThemedText>
        <TextField
          label="Name"
          placeholder="e.g. Movie Night"
          value={name}
          onChangeText={setName}
        />
        <CategoryPicker value={category} onChange={setCategory} />
        <Button onPress={handleCreate} disabled={!name.trim() || createCurrency.isPending}>
          Create currency
        </Button>
        {error ? (
          <ThemedText type="small" themeColor="negative">
            {error}
          </ThemedText>
        ) : null}

        <ThemedText type="smallBold">All currencies</ThemedText>
        {(currencies.data ?? []).map((currency) => (
          <Card key={currency.id} style={styles.row}>
            <ThemedText>
              {currency.icon ? `${currency.icon} ` : ''}
              {currency.name}
              {currency.is_builtin ? ' · Built-in' : ''}
              {currency.moderation_status === 'pending_review' ? ' · Pending review' : ''}
            </ThemedText>
          </Card>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
