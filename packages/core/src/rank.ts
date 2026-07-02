import type { DebtItem } from './schema.js';

// Tunables — expect these to change during dogfooding. Change them here only.
export const BLOCK_WEIGHT = 0.5;
export const BLOCK_CAP = 4;

export function blockMultiplier(item: DebtItem): number {
  const count = item.blocksWork?.length ?? 0;
  return 1 + BLOCK_WEIGHT * Math.min(count, BLOCK_CAP);
}

// priority = (impact * (1 + interestRate) * blockMultiplier) / effort
// (1 + interestRate): a rate of 0 must not zero out stable debt that blocks work.
// Rounded once to 2 decimals; ranking compares the rounded value so that
// morally-equal items actually tie and fall through to the documented tie-break.
export function score(item: DebtItem): number {
  const raw = (item.impact * (1 + item.interestRate) * blockMultiplier(item)) / item.effort;
  return Math.round(raw * 100) / 100;
}

export interface RankedItem {
  item: DebtItem;
  score: number;
}

// Total order: rounded score desc → impact desc → id asc.
// The tie-break is part of the explainability contract — document any change.
export function rank(items: DebtItem[]): RankedItem[] {
  return items
    .filter((i) => i.status === 'open' || i.status === 'planned')
    .map((item) => ({ item, score: score(item) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.item.impact - a.item.impact ||
        (a.item.id < b.item.id ? -1 : 1),
    );
}
