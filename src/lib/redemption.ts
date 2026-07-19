import type { LedgerEntryType, LedgerSourceType } from '@/lib/ledger';

export type RedemptionStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled';

export type RedemptionRequest = {
  id: string;
  debtor_id: string;
  creditor_id: string;
  currency_id: string;
  group_id: string | null;
  amount: number;
  status: RedemptionStatus;
  created_at: string;
  responded_at: string | null;
};

export type ForgivenessEvent = {
  id: string;
  creditor_id: string;
  debtor_id: string;
  currency_id: string;
  group_id: string | null;
  amount: number;
  note: string | null;
  created_at: string;
};

/** One original obligation-creating ledger entry with however much of it is
 * still unredeemed/unforgiven -- what the redeem/forgive UI selects from. */
export type OutstandingObligation = {
  source_entry_id: string;
  debtor_id: string;
  creditor_id: string;
  entry_type: LedgerEntryType;
  source_type: LedgerSourceType;
  source_id: string;
  original_amount: number;
  outstanding_amount: number;
  created_at: string;
};

export type Allocation = {
  source_entry_id: string;
  amount: number;
};
