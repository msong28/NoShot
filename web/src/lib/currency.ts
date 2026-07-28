export type CurrencyCategory =
  'food' | 'drinks' | 'items' | 'favours' | 'chores' | 'actions' | 'points' | 'custom';

/** Fixed id of the built-in "Money" currency seeded by the
 * money_stake_currency migration -- referenced directly so a "money" stake
 * can be routed through the shared bet engine, which stakes every bet in a
 * currencies row. Kept in sync with that migration's literal id. */
export const MONEY_CURRENCY_ID = '00000000-0000-4000-8000-000000000001';

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
  sort_order: number;
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
