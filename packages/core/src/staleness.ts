import type { DebtItem } from './schema.js';

export interface StaleItem {
  item: DebtItem;
  missing: string[];
}

export function findStaleItems(
  items: DebtItem[],
  exists: (path: string) => boolean,
): StaleItem[] {
  const stale: StaleItem[] = [];
  for (const item of items) {
    if (item.status !== 'open' && item.status !== 'planned') continue;
    const missing = item.location.filter((l) => !exists(l));
    if (missing.length > 0) stale.push({ item, missing });
  }
  return stale;
}
