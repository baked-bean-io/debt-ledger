import {
  mintId,
  SCHEMA_VERSION,
  serializeLedger,
  validateItem,
  type DebtItem,
  type Ledger,
} from '@debt-ledger/core';

export interface Diagnosis {
  ok: boolean;
  conflictMarkers: boolean;
  parseError?: string;
  shapeError?: string;
  itemErrors: string[];
  duplicateIds: string[];
  canonical: boolean;
  mangledMerge: boolean;
}

const CONFLICT_MARKER = /^(<{7} |={7}$|>{7} )/m;

export function diagnose(raw: string): Diagnosis {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      conflictMarkers: CONFLICT_MARKER.test(raw),
      parseError: error instanceof Error ? error.message : String(error),
      itemErrors: [],
      duplicateIds: [],
      canonical: false,
      mangledMerge: false,
    };
  }

  const d = data as { version?: unknown; items?: unknown };
  if (typeof data !== 'object' || data === null || d.version !== SCHEMA_VERSION || !Array.isArray(d.items)) {
    return {
      ok: false,
      conflictMarkers: false,
      shapeError: `expected { "version": ${SCHEMA_VERSION}, "items": [...] }`,
      itemErrors: [],
      duplicateIds: [],
      canonical: false,
      mangledMerge: false,
    };
  }

  const items = d.items as DebtItem[];
  const itemErrors: string[] = [];
  items.forEach((item, i) => {
    for (const e of validateItem(item)) itemErrors.push(`items[${i}]: ${e}`);
  });

  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const id = (item as { id?: unknown }).id;
    if (typeof id !== 'string') continue;
    if (seen.has(id) && !duplicateIds.includes(id)) duplicateIds.push(id);
    seen.add(id);
  }

  // A mis-resolved merge squashes two items into one object with duplicate
  // JSON keys; JSON.parse keeps the last, silently losing an item. Every
  // item has exactly one "id" key in canonical form, so more raw "id" keys
  // than parsed items means fields from two versions got merged into one.
  const idKeyCount = (raw.match(/"id"\s*:/g) ?? []).length;
  const mangledMerge = idKeyCount > items.length;

  const canonical = itemErrors.length === 0 && raw === serializeLedger({ version: SCHEMA_VERSION, items });

  return {
    ok: itemErrors.length === 0 && duplicateIds.length === 0 && canonical && !mangledMerge,
    conflictMarkers: false,
    itemErrors,
    duplicateIds,
    canonical,
    mangledMerge,
  };
}

export interface Repair {
  ledger: Ledger;
  remapped: Array<{ from: string; to: string }>;
}

// Fixes only what needs no human judgment: later duplicates get fresh ids
// (the first occurrence keeps its id), and the caller rewrites canonically.
export function repair(raw: string, generate?: () => string): Repair {
  const diagnosis = diagnose(raw);
  if (diagnosis.parseError) {
    throw new Error(
      diagnosis.conflictMarkers
        ? 'the ledger still contains merge conflict markers — edit the file, keep both versions of the items, then re-run doctor --fix'
        : `cannot repair: the ledger is not valid JSON (${diagnosis.parseError})`,
    );
  }
  if (diagnosis.shapeError) {
    throw new Error(`cannot repair: ${diagnosis.shapeError}`);
  }
  if (diagnosis.itemErrors.length > 0) {
    throw new Error(
      `cannot repair invalid fields automatically — fix these by hand:\n${diagnosis.itemErrors.join('\n')}`,
    );
  }
  if (diagnosis.mangledMerge) {
    throw new Error(
      'cannot repair: an item seems to contain fields from two merged versions (more "id" fields than items) — rebuild the affected items by hand from git history, then re-run',
    );
  }

  const { items } = JSON.parse(raw) as Ledger;
  const all = new Set(items.map((i) => i.id));
  const seen = new Set<string>();
  const remapped: Array<{ from: string; to: string }> = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      const to = mintId(all, generate);
      remapped.push({ from: item.id, to });
      item.id = to;
      all.add(to);
    }
    seen.add(item.id);
  }
  return { ledger: { version: SCHEMA_VERSION, items }, remapped };
}
