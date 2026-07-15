import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryPicker } from '@/components/category-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import type { CurrencyCategory } from '@/lib/currency';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSearchUsername } from '@/hooks/use-friends';
import {
  useArchiveGroup,
  useGroupDetail,
  useInviteToGroup,
  useLeaveGroup,
  useRemoveMember,
} from '@/hooks/use-groups';
import { useSession } from '@/hooks/use-session';
import { useCreateCurrency, useCurrencies } from '@/hooks/use-currencies';
import { getErrorMessage } from '@/lib/errors';

export default function GroupDetailScreen() {
  const insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { group, members } = useGroupDetail(groupId);
  const inviteToGroup = useInviteToGroup(groupId);
  const removeMember = useRemoveMember(groupId);
  const archiveGroup = useArchiveGroup(groupId);
  const leaveGroup = useLeaveGroup(userId);
  const search = useSearchUsername();
  const currencies = useCurrencies({ groupId: groupId as string });
  const createCurrency = useCreateCurrency({ groupId: groupId as string });

  const [query, setQuery] = useState('');
  const [currencyName, setCurrencyName] = useState('');
  const [currencyCategory, setCurrencyCategory] = useState<CurrencyCategory>('custom');
  const [actionError, setActionError] = useState<string | null>(null);

  const me = members.find((row) => row.profile.id === userId);
  const isOwner = me?.member.role === 'owner' && me.member.status === 'active';

  function runAction(action: Promise<unknown>) {
    setActionError(null);
    action.catch((err: unknown) => setActionError(getErrorMessage(err, 'Something went wrong')));
  }

  function handleCreateCurrency() {
    setActionError(null);
    createCurrency.mutate(
      { name: currencyName, category: currencyCategory },
      {
        onSuccess: () => setCurrencyName(''),
        onError: (err) => setActionError(getErrorMessage(err, 'Failed to create currency')),
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
        <ThemedText type="title">{group?.name ?? 'Group'}</ThemedText>
        {group?.status === 'archived' ? (
          <ThemedText type="small" themeColor="textSecondary">
            This group is archived.
          </ThemedText>
        ) : null}

        <ThemedText type="smallBold">Invite by username</ThemedText>
        <TextField
          label="Username"
          placeholder="Search by username"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (text.trim().length >= 3) search.mutate(text.trim());
          }}
          autoCapitalize="none"
        />
        {(search.data ?? []).map((result) => (
          <Card key={result.id} style={styles.row}>
            <ThemedText>
              @{result.username} · {result.display_name}
            </ThemedText>
            <Button onPress={() => runAction(inviteToGroup.mutateAsync(result.id))}>Invite</Button>
          </Card>
        ))}

        {actionError ? (
          <ThemedText type="small" themeColor="negative">
            {actionError}
          </ThemedText>
        ) : null}

        <ThemedText type="smallBold">Members</ThemedText>
        {members.map(({ member, profile }) => (
          <Card key={profile.id} style={styles.row}>
            <ThemedText>
              @{profile.username} · {profile.display_name}
              {member.role === 'owner' ? ' · Owner' : ''}
              {member.status === 'invited' ? ' · Invited' : ''}
            </ThemedText>
            {isOwner && member.status === 'active' && profile.id !== userId ? (
              <Button
                variant="muted"
                onPress={() => runAction(removeMember.mutateAsync(profile.id))}
              >
                Remove
              </Button>
            ) : null}
          </Card>
        ))}

        <ThemedText type="smallBold">Group currencies</ThemedText>
        <TextField
          label="New currency name"
          placeholder="e.g. House Points"
          value={currencyName}
          onChangeText={setCurrencyName}
        />
        <CategoryPicker value={currencyCategory} onChange={setCurrencyCategory} />
        <Button onPress={handleCreateCurrency} disabled={!currencyName.trim()}>
          Add currency
        </Button>
        {(currencies.data ?? []).map((currency) => (
          <Card key={currency.id} style={styles.row}>
            <ThemedText>
              {currency.icon ? `${currency.icon} ` : ''}
              {currency.name}
              {currency.moderation_status === 'pending_review' ? ' · Pending review' : ''}
            </ThemedText>
          </Card>
        ))}

        {me?.member.status === 'active' ? (
          <Button
            variant="muted"
            onPress={() => runAction(leaveGroup.mutateAsync(groupId as string))}
          >
            Leave group
          </Button>
        ) : null}
        {isOwner ? (
          <Button variant="muted" onPress={() => runAction(archiveGroup.mutateAsync())}>
            Archive group
          </Button>
        ) : null}
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
