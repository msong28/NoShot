import { describe, expect, it } from 'vitest';

import type { BetStatus } from '@/lib/bet';

import { betCategory } from './bets';

describe('betCategory', () => {
  it('files a not-yet-accepted bet under Pending regardless of who created it', () => {
    // Regression: a bet the current user just sent is `pending_acceptance` and
    // already self-approved, so the hook's "your move" pendingBets drops it.
    // The lifecycle browser must still show it under Pending.
    expect(betCategory('pending_acceptance')).toBe('pending');
    expect(betCategory('draft')).toBe('pending');
  });

  it('files live and mid-resolution bets under Active', () => {
    expect(betCategory('active')).toBe('active');
    expect(betCategory('cancellation_pending')).toBe('active');
    expect(betCategory('pending_result')).toBe('active');
    expect(betCategory('disputed')).toBe('active');
  });

  it('files finished bets under Done', () => {
    expect(betCategory('resolved')).toBe('done');
    expect(betCategory('tied')).toBe('done');
  });

  it('leaves off-tab statuses uncategorized (they show only under All)', () => {
    expect(betCategory('voided')).toBeNull();
  });

  it('assigns every BetStatus to at most one tab, never crossing buckets', () => {
    const statuses: BetStatus[] = [
      'draft',
      'pending_acceptance',
      'active',
      'cancellation_pending',
      'voided',
      'pending_result',
      'disputed',
      'resolved',
      'tied',
    ];
    for (const status of statuses) {
      const category = betCategory(status);
      expect(category === null || ['active', 'pending', 'done'].includes(category)).toBe(true);
    }
  });
});
