import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { ListRow } from '@/components/ui/list-row';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import { useReports } from '@/hooks/use-admin';
import { Icons } from '@/lib/icons';
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

function statusVariant(status: ReportStatus): StatusPillVariant {
  if (status === 'open') return 'pending';
  if (status === 'resolved') return 'won';
  return 'tied';
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
        className="-ml-two flex items-center gap-half rounded-large px-two py-one font-display text-sm text-text-secondary"
      >
        <Icons.back size={18} strokeWidth={2} />
        Exit admin
      </button>

      <h1 className="mt-three font-display text-screen-title font-extrabold tracking-display-tight">
        Reports
      </h1>

      <div className="mt-three flex gap-two">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={`rounded-pill px-three py-two text-sm font-bold whitespace-nowrap ${
              status === tab.value
                ? 'bg-ink text-bg'
                : 'border border-line bg-surface text-text-secondary'
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
                  <StatusPill variant={statusVariant(report.status)} label={report.status} />
                }
              />
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
