export type ManualObligationStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

export type ManualObligationProposal = {
  id: string;
  proposer_id: string;
  debtor_id: string;
  creditor_id: string;
  currency_id: string;
  amount: number;
  description: string;
  status: ManualObligationStatus;
  created_at: string;
  responded_at: string | null;
};
