import * as Linking from 'expo-linking';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

type InviteQrCardProps = {
  username: string;
};

export function InviteQrCard({ username }: InviteQrCardProps) {
  const theme = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const inviteUrl = Linking.createURL(`/invite/${username}`);

  return (
    <Card style={styles.card}>
      <ThemedText type="smallBold">Your invite link</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" selectable>
        {inviteUrl}
      </ThemedText>
      <Button variant="muted" onPress={() => setIsVisible((prev) => !prev)}>
        {isVisible ? 'Hide QR code' : 'Show QR code'}
      </Button>
      {isVisible ? (
        <View style={styles.qrWrapper}>
          <QRCode
            value={inviteUrl}
            size={160}
            color={theme.text}
            backgroundColor={theme.background}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  qrWrapper: {
    alignSelf: 'center',
    marginTop: Spacing.two,
  },
});
