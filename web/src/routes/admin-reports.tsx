import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { StatusBadge, type BadgeVariant } from '@/components/ui/badge';
import { ListRow } from '@/components/ui/list-row';
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

function statusVariant(status: ReportStatus): BadgeVariant {
  if (status === 'open') return 'warning';
  if (status === 'resolved') return 'success';
  return 'neutral';
}

export function AdminReportQueueScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ReportStatus | 'all'>('open');
  const reports = useReports(status);

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <button
        type="button"
        onClick={() => navigate('/', { replace: true })}
        className="font-display text-sm text-text-secondary"
      >
        Exit admin
      </button>

      <h1 className="mt-three font-display text-2xl font-extrabold">Reports</h1>

      <div className="mt-three flex gap-two">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={`rounded-pill px-three py-two font-display text-sm font-bold ${
              status === tab.value ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-four flex flex-col gap-two">
        {reports.isLoading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : (reports.data ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">Nothing matches this filter right now.</p>
        ) : (
          (reports.data ?? []).map((report) => (
            <Link key={report.id} to={`/admin/report/${report.id}`}>
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
      </div>
    </main>
  );
}
