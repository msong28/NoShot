import { Link, router } from 'expo-router';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatusBadge } from '@/components/ui/status-badge';
import { useReports } from '@/hooks/use-admin';
import { REPORT_REASON_LABELS, type ReportStatus } from '@/lib/report';

const STATUS_TABS: { value: ReportStatus | 'all'; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
];

const TARGET_TYPE_LABELS: Record<string, string> = {
  bet: 'Bet',
  currency: 'Currency',
  comment: 'Comment',
  chat_message: 'Chat message',
  proof_asset: 'Proof image',
  user: 'User',
};

function statusVariant(status: ReportStatus) {
  if (status === 'open') return 'warning' as const;
  if (status === 'resolved') return 'success' as const;
  return 'neutral' as const;
}

export default function AdminReportQueueScreen() {
  const [status, setStatus] = useState<ReportStatus | 'all'>('open');
  const reports = useReports(status);

  return (
    <Screen>
      <Button variant="muted" onPress={() => router.replace('/')}>
        Exit admin
      </Button>
      <ThemedText type="headingXL">Reports</ThemedText>

      <SegmentedControl options={STATUS_TABS} value={status} onChange={setStatus} />

      {reports.isLoading ? (
        <ThemedText type="bodySM" themeColor="textMuted">
          Loading…
        </ThemedText>
      ) : (reports.data ?? []).length === 0 ? (
        <EmptyState
          icon="info"
          title="No reports here"
          description="Nothing matches this filter right now."
        />
      ) : (
        (reports.data ?? []).map((report) => (
          <Link key={report.id} href={`/report/${report.id}`} asChild>
            <ListRow
              title={`${TARGET_TYPE_LABELS[report.target_type] ?? report.target_type} report`}
              subtitle={REPORT_REASON_LABELS[report.reason]}
              trailing={
                <StatusBadge label={report.status} variant={statusVariant(report.status)} />
              }
            />
          </Link>
        ))
      )}
    </Screen>
  );
}
