import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useCreateOrCounterBet } from '@/hooks/use-bets';
import { useCurrencies } from '@/hooks/use-currencies';
import { useFriends } from '@/hooks/use-friends';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { computeFundingChecks, computePayoutPreview } from '@/lib/bet';
import { getErrorMessage } from '@/lib/errors';

const CREATOR_OUTCOME = 'creator_wins';
const FRIEND_OUTCOME = 'friend_wins';

export default function CreateBetScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { friends } = useFriends(userId);
  const { data: myProfile } = useProfile(userId);
  const currencies = useCurrencies({ ownerUserId: userId as string });
  const createOrCounterBet = useCreateOrCounterBet(userId);

  const [friendId, setFriendId] = useState<string | null>(null);
  const [currencyId, setCurrencyId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [myStake, setMyStake] = useState('1');
  const [myOddsNum, setMyOddsNum] = useState('1');
  const [myOddsDenom, setMyOddsDenom] = useState('1');
  const [theirStake, setTheirStake] = useState('1');
  const [theirOddsNum, setTheirOddsNum] = useState('1');
  const [theirOddsDenom, setTheirOddsDenom] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const friendProfile = friends.find((f) => f.profile.id === friendId)?.profile;

  // Stored labels are always third-person ("Dave wins," not "You win") so
  // they read correctly for *any* future viewer of this bet, not just the
  // person composing it right now. The preview below still speaks to the
  // composer in first person, without persisting that phrasing.
  const sides = useMemo(
    () => [
      { outcomeKey: CREATOR_OUTCOME, label: `${myProfile?.display_name ?? 'You'} wins` },
      {
        outcomeKey: FRIEND_OUTCOME,
        label: friendProfile ? `${friendProfile.display_name} wins` : 'They win',
      },
    ],
    [myProfile, friendProfile],
  );

  const participants = useMemo(() => {
    if (!userId || !friendId || !currencyId) return [];
    return [
      {
        userId,
        outcomeKey: CREATOR_OUTCOME,
        currencyId,
        stakeQuantity: Number(myStake) || 0,
        oddsNumerator: Number(myOddsNum) || 1,
        oddsDenominator: Number(myOddsDenom) || 1,
      },
      {
        userId: friendId,
        outcomeKey: FRIEND_OUTCOME,
        currencyId,
        stakeQuantity: Number(theirStake) || 0,
        oddsNumerator: Number(theirOddsNum) || 1,
        oddsDenominator: Number(theirOddsDenom) || 1,
      },
    ];
  }, [
    userId,
    friendId,
    currencyId,
    myStake,
    myOddsNum,
    myOddsDenom,
    theirStake,
    theirOddsNum,
    theirOddsDenom,
  ]);

  const fundingChecks = useMemo(
    () => (participants.length === 2 ? computeFundingChecks(sides, participants) : []),
    [sides, participants],
  );
  const payoutPreview = useMemo(
    () => (participants.length === 2 ? computePayoutPreview(sides, participants) : []),
    [sides, participants],
  );
  const isFunded = fundingChecks.every((check) => check.isFunded);
  const currencyName = currencies.data?.find((c) => c.id === currencyId)?.name ?? '';

  const canSubmit =
    !!friendId && !!currencyId && title.trim().length > 0 && isFunded && participants.length === 2;

  function handleSubmit() {
    setError(null);
    createOrCounterBet.mutate(
      {
        title,
        description,
        resolutionMethod: 'participant_submission',
        randomFallbackEnabled: false,
        sides,
        participants,
      },
      {
        onSuccess: (bet) => router.replace(`/bet/${bet.id}`),
        onError: (err) => setError(getErrorMessage(err, 'Failed to propose that bet')),
      },
    );
  }

  return (
    <Screen>
      <Button variant="muted" onPress={() => router.back()}>
        Close
      </Button>
      <ThemedText type="headingXL">New bet</ThemedText>
      <ThemedText type="bodySM" themeColor="textSecondary">
        Propose a direct bet against a friend. They can accept, decline, or counter your terms.
      </ThemedText>

      <SectionHeader title="Who's the other side" />
      {friends.length === 0 ? (
        <EmptyState
          icon="friends"
          title="No friends yet"
          description="Add a friend before proposing a bet."
        />
      ) : (
        <View style={styles.pillRow}>
          {friends.map(({ profile }) => (
            <Button
              key={profile.id}
              variant={friendId === profile.id ? 'accent' : 'muted'}
              onPress={() => setFriendId(profile.id)}
            >
              {profile.display_name}
            </Button>
          ))}
        </View>
      )}

      <SectionHeader title="Currency" />
      <View style={styles.pillRow}>
        {(currencies.data ?? []).map((currency) => (
          <Button
            key={currency.id}
            variant={currencyId === currency.id ? 'accent' : 'muted'}
            onPress={() => setCurrencyId(currency.id)}
          >
            {currency.icon ? `${currency.icon} ` : ''}
            {currency.name}
          </Button>
        ))}
      </View>

      <SectionHeader title="The bet" />
      <TextField
        label="Title"
        placeholder="e.g. Who does dishes tonight"
        value={title}
        onChangeText={setTitle}
      />
      <TextField
        label="Description / rules"
        placeholder="Optional details"
        value={description}
        onChangeText={setDescription}
      />

      <SectionHeader title="Your stake and odds" />
      <View style={styles.row}>
        <TextField
          label="You risk"
          value={myStake}
          onChangeText={setMyStake}
          keyboardType="numeric"
          style={styles.flex}
        />
        <TextField
          label="Odds: risk"
          value={myOddsNum}
          onChangeText={setMyOddsNum}
          keyboardType="numeric"
          style={styles.oddsField}
        />
        <TextField
          label="to win"
          value={myOddsDenom}
          onChangeText={setMyOddsDenom}
          keyboardType="numeric"
          style={styles.oddsField}
        />
      </View>

      <SectionHeader title={`${friendProfile?.display_name ?? 'Their'} stake and odds`} />
      <View style={styles.row}>
        <TextField
          label="They risk"
          value={theirStake}
          onChangeText={setTheirStake}
          keyboardType="numeric"
          style={styles.flex}
        />
        <TextField
          label="Odds: risk"
          value={theirOddsNum}
          onChangeText={setTheirOddsNum}
          keyboardType="numeric"
          style={styles.oddsField}
        />
        <TextField
          label="to win"
          value={theirOddsDenom}
          onChangeText={setTheirOddsDenom}
          keyboardType="numeric"
          style={styles.oddsField}
        />
      </View>

      {participants.length === 2 && currencyId ? (
        <>
          <SectionHeader title="Payout preview" />
          <Card style={styles.previewCard}>
            {sides.map((side) => (
              <View key={side.outcomeKey} style={styles.previewRow}>
                <ThemedText type="label">
                  If{' '}
                  {side.outcomeKey === CREATOR_OUTCOME
                    ? 'you win'
                    : `${friendProfile?.display_name ?? 'they'} win${friendProfile ? 's' : ''}`}
                  :
                </ThemedText>
                {payoutPreview
                  .filter((row) => row.outcomeKey === side.outcomeKey)
                  .map((row) => (
                    <ThemedText key={row.userId} type="bodySM" themeColor="textSecondary">
                      {row.userId === userId ? 'You' : friendProfile?.display_name}{' '}
                      {row.amount >= 0
                        ? `receive ${row.amount} ${currencyName}`
                        : `owe ${Math.abs(row.amount)} ${currencyName}`}
                    </ThemedText>
                  ))}
              </View>
            ))}
            {!isFunded ? (
              <ThemedText type="bodySM" themeColor="danger">
                One side&apos;s payout exceeds what the other side has staked -- adjust the odds or
                stakes above.
              </ThemedText>
            ) : null}
          </Card>
        </>
      ) : null}

      <InlineError message={error} />

      <Button
        variant="primary"
        onPress={handleSubmit}
        disabled={!canSubmit || createOrCounterBet.isPending}
      >
        {createOrCounterBet.isPending
          ? 'Sending…'
          : 'Send to ' + (friendProfile?.display_name ?? 'friend')}
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  oddsField: {
    width: 72,
  },
  previewCard: {
    gap: Spacing.two,
  },
  previewRow: {
    gap: Spacing.half,
  },
});
