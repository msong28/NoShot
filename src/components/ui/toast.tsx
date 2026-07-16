import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ToastVariant = 'default' | 'success' | 'danger';
type ToastContextValue = { show: (message: string, variant?: ToastVariant) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_VISIBLE_MS = 2500;

/**
 * Feedback for something that just happened ("Currency created") -- routine,
 * not celebratory, so per DESIGN_SYSTEM.md §5 this is deliberately a plain
 * show/hide, no fade. (An earlier Reanimated-driven fade never actually
 * applied on web -- opacity stayed at 0 for the whole visible window, a
 * timing quirk not worth chasing for a non-critical flourish.)
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show(message: string, variant: ToastVariant = 'default') {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setToast({ message, variant });
    hideTimeoutRef.current = setTimeout(() => setToast(null), TOAST_VISIBLE_MS);
  }

  const variantColor =
    toast?.variant === 'success'
      ? theme.success
      : toast?.variant === 'danger'
        ? theme.danger
        : undefined;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={styles.toastWrapper}>
          <View style={[styles.toast, { backgroundColor: theme.surfaceRaised }]}>
            <ThemedText type="bodySM" style={variantColor ? { color: variantColor } : undefined}>
              {toast.message}
            </ThemedText>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  toastWrapper: {
    // RN Web's plain 'absolute' resolves against whatever ancestor happens
    // to establish a positioning context, which for a root-level provider
    // can end up being content-height (not viewport-height) -- 'fixed' on
    // web pins it to the actual viewport instead.
    position: Platform.select({ web: 'fixed' as const, default: 'absolute' as const }),
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toast: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radii.pill,
  },
});
