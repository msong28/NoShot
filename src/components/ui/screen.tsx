import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type ScreenProps = {
  children: ReactNode;
  /** Default true. Set false for screens that manage their own scrolling (e.g. a FlatList). */
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Spacing.four by default; tab-root screens (no back button) typically want Spacing.six. */
  topInset?: number;
  /** Spacing.four by default; pass BottomTabInset + Spacing.four for screens under the tab bar. */
  bottomInset?: number;
};

/**
 * The insets + maxWidth-centering + gap layout every screen in this app was
 * hand-rolling identically -- see DESIGN_SYSTEM.md §8. Not yet applied to
 * existing screens (Phase 3); available for new ones.
 */
export function Screen({
  children,
  scroll = true,
  contentStyle,
  topInset = Spacing.four,
  bottomInset = Spacing.four,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const paddedStyle = [
    styles.content,
    { paddingTop: insets.top + topInset, paddingBottom: insets.bottom + bottomInset },
    contentStyle,
  ];

  return (
    <ThemedView style={styles.screen}>
      {scroll ? (
        <ScrollView contentContainerStyle={paddedStyle}>{children}</ScrollView>
      ) : (
        <ThemedView style={paddedStyle}>{children}</ThemedView>
      )}
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
});
