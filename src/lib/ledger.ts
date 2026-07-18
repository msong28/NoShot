export type LedgerEntryType =
  'bet_settlement' | 'manual_obligation' | 'redemption' | 'forgiveness' | 'correction';

export type LedgerSourceType = 'bet' | 'manual_obligation' | 'redemption' | 'forgiveness';

export type LedgerEntry = {
  id: string;
  debtor_id: string;
  creditor_id: string;
  group_id: string | null;
  currency_id: string;
  amount: number;
  entry_type: LedgerEntryType;
  source_type: LedgerSourceType;
  source_id: string;
  reversal_of: string | null;
  created_at: string;
};

/** One consolidated, already-netted balance with a single counterparty in a
 * single currency (and group scope). Positive net_amount means the
 * counterparty owes the caller; negative means the caller owes them. */
export type Balance = {
  counterparty_id: string;
  group_id: string | null;
  currency_id: string;
  net_amount: number;
};
