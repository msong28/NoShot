export type CurrencyCategory =
  | 'food'
  | 'drinks'
  | 'items'
  | 'favours'
  | 'chores'
  | 'actions'
  | 'points'
  | 'custom';

export type CurrencyModerationStatus = 'approved' | 'pending_review' | 'blocked';

export type Currency = {
  id: string;
  name: string;
  category: CurrencyCategory;
  icon: string | null;
  owner_user_id: string | null;
  group_id: string | null;
  is_builtin: boolean;
  moderation_status: CurrencyModerationStatus;
  created_at: string;
};

export const CurrencyCategories: { value: CurrencyCategory; label: string }[] = [
  { value: 'food', label: 'Food' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'items', label: 'Items' },
  { value: 'favours', label: 'Favours' },
  { value: 'chores', label: 'Chores' },
  { value: 'actions', label: 'Harmless actions' },
  { value: 'points', label: 'Points' },
  { value: 'custom', label: 'Custom' },
];
