export type ReportTargetType =
  'bet' | 'currency' | 'comment' | 'chat_message' | 'proof_asset' | 'user';

export type ReportReason = 'harassment' | 'spam' | 'inappropriate_content' | 'scam_fraud' | 'other';

export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export type Report = {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment: 'Harassment',
  spam: 'Spam',
  inappropriate_content: 'Inappropriate content',
  scam_fraud: 'Scam or fraud',
  other: 'Other',
};

export const REPORT_REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];
