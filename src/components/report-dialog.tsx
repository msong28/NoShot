import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/inline-error';
import { Modal } from '@/components/ui/modal';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSubmitReport } from '@/hooks/use-reports';
import { getErrorMessage } from '@/lib/errors';
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/report';

type ReportDialogProps = {
  visible: boolean;
  targetType: ReportTargetType;
  targetId: string | null;
  onClose: () => void;
};

/** MOD-01's "Report" action -- one reusable dialog wired into every
 * reportable surface (bets, currencies, comments, chat messages, proof
 * images, user profiles), rather than six bespoke ones. */
export function ReportDialog({ visible, targetType, targetId, onClose }: ReportDialogProps) {
  const theme = useTheme();
  const toast = useToast();
  const submitReport = useSubmitReport();
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [details, setDetails] = useState('');

  function handleClose() {
    setReason('harassment');
    setDetails('');
    submitReport.reset();
    onClose();
  }

  function handleSubmit() {
    if (!targetId) return;
    submitReport.mutate(
      { targetType, targetId, reason, details },
      {
        onSuccess: () => {
          toast.show('Report submitted', 'success');
          handleClose();
        },
      },
    );
  }

  return (
    <Modal visible={visible} onClose={handleClose}>
      <ThemedText type="headingMD">Report this</ThemedText>
      <View style={styles.reasons}>
        {REPORT_REASONS.map((option) => {
          const selected = option === reason;
          return (
            <Pressable
              key={option}
              onPress={() => setReason(option)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={[
                styles.reasonRow,
                { borderColor: selected ? theme.accent : theme.border },
                selected && { backgroundColor: theme.surfaceMuted },
              ]}
            >
              <ThemedText type="bodySM" themeColor={selected ? 'textPrimary' : 'textSecondary'}>
                {REPORT_REASON_LABELS[option]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <TextField
        label="Details (optional)"
        placeholder="Anything else we should know?"
        value={details}
        onChangeText={setDetails}
        multiline
      />
      <InlineError
        message={
          submitReport.isError
            ? getErrorMessage(submitReport.error, 'Could not submit report')
            : null
        }
      />
      <View style={styles.actions}>
        <Button variant="ghost" onPress={handleClose}>
          Cancel
        </Button>
        <Button variant="destructive" onPress={handleSubmit} loading={submitReport.isPending}>
          Submit report
        </Button>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  reasons: {
    gap: Spacing.one,
  },
  reasonRow: {
    borderRadius: Radii.medium,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
});
