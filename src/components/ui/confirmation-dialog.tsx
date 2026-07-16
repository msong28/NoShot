import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Spacing } from '@/constants/theme';

type ConfirmationDialogProps = {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * There was previously no confirmation step at all before leaving/archiving
 * a group or blocking someone -- this fixes that, not just a visual add.
 */
export function ConfirmationDialog({
  visible,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  return (
    <Modal visible={visible} onClose={onCancel}>
      <ThemedText type="headingMD">{title}</ThemedText>
      {description ? (
        <ThemedText type="bodySM" themeColor="textSecondary">
          {description}
        </ThemedText>
      ) : null}
      <View style={styles.actions}>
        <Button variant="ghost" onPress={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? 'destructive' : 'primary'} onPress={onConfirm}>
          {confirmLabel}
        </Button>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
});
