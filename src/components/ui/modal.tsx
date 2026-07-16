import type { ReactNode } from 'react';
import { Modal as RNModal, Pressable, StyleSheet } from 'react-native';

import { Shadows } from '@/constants/shadows';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemeMode } from '@/providers/theme-provider';

type ModalProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};

/**
 * A centered dialog, not a gesture-driven bottom sheet -- a true bottom
 * sheet would need a new dependency for what this already covers (see
 * DESIGN_SYSTEM.md §7). Add one later if a real interaction need shows up.
 */
export function Modal({ visible, onClose, children }: ModalProps) {
  const theme = useTheme();
  const { scheme } = useThemeMode();

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.overlay }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Pressable
          style={[styles.card, { backgroundColor: theme.surfaceRaised }, Shadows[scheme].raised]}
          onPress={(event) => event.stopPropagation()}
        >
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    width: '100%',
    maxWidth: 400,
    gap: Spacing.three,
  },
});
