import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar, AvatarStack } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { CurrencyLabel } from '@/components/ui/currency-label';
import { Divider } from '@/components/ui/divider';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { Modal } from '@/components/ui/modal';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { TextField } from '@/components/ui/text-field';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useToast } from '@/components/ui/toast';
import { Colors, Spacing } from '@/constants/theme';
import type { TypeScaleToken } from '@/constants/typography';

const TYPE_SAMPLES: TypeScaleToken[] = [
  'display',
  'headingXL',
  'headingLG',
  'headingMD',
  'bodyLG',
  'body',
  'bodySM',
  'label',
  'caption',
];

const SWATCH_NAMES = [
  'background',
  'surface',
  'surfaceRaised',
  'surfaceMuted',
  'textPrimary',
  'textSecondary',
  'textMuted',
  'border',
  'primary',
  'secondary',
  'competitive',
  'success',
  'warning',
  'danger',
  'info',
] as const;

const DEMO_MEMBERS = [
  { id: 'a', name: 'Alice Test' },
  { id: 'b', name: 'Bob Test' },
  { id: 'c', name: 'Carol Test' },
  { id: 'd', name: 'Dave Test' },
];

export default function DesignSystemScreen() {
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <Screen>
      <Button variant="muted" onPress={() => router.back()} style={styles.backButton}>
        Back
      </Button>
      <ThemedText type="headingXL">Design system</ThemedText>
      <ThemedText type="bodySM" themeColor="textSecondary">
        Every token and component in one place, per DESIGN_SYSTEM.md. Check this before inventing a
        new visual pattern.
      </ThemedText>

      <SectionHeader title="Theme" />
      <ThemeToggle />

      <SectionHeader title="Typography" />
      <Card style={styles.stack}>
        {TYPE_SAMPLES.map((token) => (
          <ThemedText key={token} type={token}>
            {token}
          </ThemedText>
        ))}
      </Card>

      <SectionHeader title="Colors" />
      <View style={styles.swatchGrid}>
        {SWATCH_NAMES.map((name) => (
          <ColorSwatch key={name} name={name} />
        ))}
      </View>

      <SectionHeader title="Buttons" />
      <Card style={styles.stack}>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="primary" loading={loading} onPress={() => setLoading((v) => !v)}>
          Toggle loading
        </Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
        <IconButton name="add" accessibilityLabel="Add" />
      </Card>

      <SectionHeader title="Inputs" />
      <Card style={styles.stack}>
        <TextField label="Display name" placeholder="Alex Rivera" />
        <TextField label="Search" variant="search" placeholder="Search by username" />
        <InlineError message="This is what an inline error looks like." />
      </Card>

      <SectionHeader title="Rows" />
      <ListRow
        leading={<Avatar id="demo-1" name="Alex Rivera" />}
        title="Alex Rivera"
        subtitle="@alexr · Owner"
        trailing={<StatusBadge label="Owner" variant="info" />}
      />
      <ListRow
        leading={<AvatarStack members={DEMO_MEMBERS} />}
        title="Roommates"
        subtitle="4 members"
      />

      <SectionHeader title="Status badges" />
      <Card style={styles.row}>
        <StatusBadge label="Approved" variant="success" />
        <StatusBadge label="Pending review" variant="warning" />
        <StatusBadge label="Disputed" variant="danger" />
        <StatusBadge label="Invited" variant="info" />
        <StatusBadge label="Archived" variant="neutral" />
      </Card>

      <SectionHeader title="Currency" />
      <Card style={styles.row}>
        <CurrencyLabel quantity={2} currency={{ name: 'Meal', icon: '🍽️' }} />
        <CurrencyLabel quantity={12} currency={{ name: 'Point', icon: '⭐' }} />
      </Card>

      <SectionHeader title="Empty state" />
      <Card>
        <EmptyState
          icon="groups"
          title="No groups yet"
          description="Create one to start tracking bets with friends."
        />
      </Card>

      <SectionHeader title="Loading" />
      <Card style={styles.stack}>
        <Skeleton height={20} width="60%" />
        <Skeleton height={16} width="90%" />
        <Skeleton height={16} width="40%" />
      </Card>

      <Divider />

      <SectionHeader title="Overlays" />
      <Card style={styles.stack}>
        <Button variant="outline" onPress={() => setShowModal(true)}>
          Show modal
        </Button>
        <Button variant="outline" onPress={() => setShowConfirm(true)}>
          Show confirmation dialog
        </Button>
        <Button variant="outline" onPress={() => toast.show('Currency created')}>
          Show toast
        </Button>
      </Card>

      <Modal visible={showModal} onClose={() => setShowModal(false)}>
        <ThemedText type="headingMD">A modal</ThemedText>
        <ThemedText type="bodySM" themeColor="textSecondary">
          Centered, not a bottom sheet -- see DESIGN_SYSTEM.md §7 for why.
        </ThemedText>
        <Button variant="primary" onPress={() => setShowModal(false)}>
          Close
        </Button>
      </Modal>

      <ConfirmationDialog
        visible={showConfirm}
        title="Leave this group?"
        description="You'll lose access to its bets and balances."
        confirmLabel="Leave"
        destructive
        onConfirm={() => setShowConfirm(false)}
        onCancel={() => setShowConfirm(false)}
      />
    </Screen>
  );
}

function ColorSwatch({ name }: { name: (typeof SWATCH_NAMES)[number] }) {
  return (
    <View style={styles.swatch}>
      <View style={[styles.swatchColor, { backgroundColor: Colors.light[name] }]} />
      <View style={[styles.swatchColor, { backgroundColor: Colors.dark[name] }]} />
      <ThemedText type="caption" themeColor="textSecondary">
        {name}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
  },
  stack: {
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  swatch: {
    width: 84,
    gap: Spacing.half,
  },
  swatchColor: {
    height: 20,
    borderRadius: 4,
  },
});
