import type { DebtItem } from '@techdebt/core';

export function makeItem(overrides: Partial<DebtItem> = {}): DebtItem {
  return {
    id: 'td-0001',
    title: 'test item',
    location: ['src/a.ts'],
    category: 'design',
    detectedBy: 'human',
    effort: 3,
    impact: 3,
    interestRate: 0.2,
    rationale: 'because tests need a reason',
    firstSeen: '2026-07-01',
    lastSeen: '2026-07-01',
    status: 'open',
    ...overrides,
  };
}
