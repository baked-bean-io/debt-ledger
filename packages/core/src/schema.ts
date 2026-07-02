export const SCHEMA_VERSION = 1;

export const CATEGORIES = ['design', 'test', 'dependency', 'doc', 'perf', 'security'] as const;
export type Category = (typeof CATEGORIES)[number];

export const POINTS = [1, 2, 3, 5, 8] as const;
export type Points = (typeof POINTS)[number];

export const STATUSES = ['open', 'planned', 'fixed', 'wontfix'] as const;
export type Status = (typeof STATUSES)[number];

export const DETECTORS = ['human', 'static-analysis', 'llm'] as const;
export type DetectedBy = (typeof DETECTORS)[number];

export interface DebtItem {
  id: string;
  title: string;
  location: string[]; // repo-relative file paths, concrete files only in v1
  category: Category;
  detectedBy: DetectedBy;
  effort: Points;
  impact: Points; // blast radius if unfixed
  interestRate: number; // 0–1, how fast it compounds
  rationale: string; // why these estimates — frozen at triage, required
  blocksWork?: string[]; // human-maintained claims, free-form ticket ids
  firstSeen: string; // ISO date YYYY-MM-DD
  lastSeen: string; // updated on human confirmation, not machine inference
  status: Status;
}

export interface Ledger {
  version: number;
  items: DebtItem[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateItem(value: unknown): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['item must be an object'];
  }
  const v = value as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof v.id !== 'string' || v.id.length === 0) {
    errors.push('id: non-empty string required');
  }
  if (typeof v.title !== 'string' || v.title.length === 0) {
    errors.push('title: non-empty string required');
  }
  if (
    !Array.isArray(v.location) ||
    v.location.length === 0 ||
    !v.location.every((l) => typeof l === 'string' && l.length > 0)
  ) {
    errors.push('location: non-empty array of non-empty path strings required');
  }
  if (!CATEGORIES.includes(v.category as Category)) {
    errors.push(`category: must be one of ${CATEGORIES.join(', ')}`);
  }
  if (!DETECTORS.includes(v.detectedBy as DetectedBy)) {
    errors.push(`detectedBy: must be one of ${DETECTORS.join(', ')}`);
  }
  if (!POINTS.includes(v.effort as Points)) {
    errors.push(`effort: must be one of ${POINTS.join(', ')}`);
  }
  if (!POINTS.includes(v.impact as Points)) {
    errors.push(`impact: must be one of ${POINTS.join(', ')}`);
  }
  if (typeof v.interestRate !== 'number' || !(v.interestRate >= 0 && v.interestRate <= 1)) {
    errors.push('interestRate: number between 0 and 1 required');
  }
  if (typeof v.rationale !== 'string' || v.rationale.trim().length === 0) {
    errors.push('rationale: required — why these estimates');
  }
  if (
    v.blocksWork !== undefined &&
    (!Array.isArray(v.blocksWork) || !v.blocksWork.every((b) => typeof b === 'string' && b.length > 0))
  ) {
    errors.push('blocksWork: array of non-empty strings when present');
  }
  if (typeof v.firstSeen !== 'string' || !ISO_DATE.test(v.firstSeen)) {
    errors.push('firstSeen: ISO date (YYYY-MM-DD) required');
  }
  if (typeof v.lastSeen !== 'string' || !ISO_DATE.test(v.lastSeen)) {
    errors.push('lastSeen: ISO date (YYYY-MM-DD) required');
  }
  if (!STATUSES.includes(v.status as Status)) {
    errors.push(`status: must be one of ${STATUSES.join(', ')}`);
  }

  return errors;
}

export class LedgerError extends Error {}

export function parseLedger(json: string): Ledger {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new LedgerError('ledger is not valid JSON');
  }
  if (typeof data === 'object' && data !== null && !('version' in data)) {
    throw new LedgerError('ledger is missing a version field');
  }
  if (typeof data !== 'object' || data === null) {
    throw new LedgerError('ledger must be a JSON object');
  }
  const d = data as Record<string, unknown>;
  if (d.version !== SCHEMA_VERSION) {
    throw new LedgerError(
      `unsupported ledger version ${JSON.stringify(d.version)}; this tool supports version ${SCHEMA_VERSION}`,
    );
  }
  if (!Array.isArray(d.items)) {
    throw new LedgerError('ledger.items must be an array');
  }

  const errors: string[] = [];
  d.items.forEach((item, i) => {
    for (const e of validateItem(item)) errors.push(`items[${i}]: ${e}`);
  });

  const seen = new Set<string>();
  for (const item of d.items as Array<{ id?: unknown }>) {
    if (typeof item?.id === 'string') {
      if (seen.has(item.id)) errors.push(`duplicate id: ${item.id}`);
      seen.add(item.id);
    }
  }

  if (errors.length > 0) throw new LedgerError(errors.join('\n'));
  return { version: SCHEMA_VERSION, items: d.items as DebtItem[] };
}
