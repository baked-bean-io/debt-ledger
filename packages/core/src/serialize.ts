import type { DebtItem, Ledger } from './schema.js';

// Declaration order of the DebtItem interface — the canonical key order.
const KEY_ORDER = [
  'id',
  'title',
  'location',
  'category',
  'detectedBy',
  'effort',
  'impact',
  'interestRate',
  'rationale',
  'blocksWork',
  'firstSeen',
  'lastSeen',
  'status',
] as const;

function canonicalItem(item: DebtItem): Record<string, unknown> {
  const source = item as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of KEY_ORDER) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

export function serializeLedger(ledger: Ledger): string {
  const items = [...ledger.items]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(canonicalItem);
  return `${JSON.stringify({ version: ledger.version, items }, null, 2)}\n`;
}
