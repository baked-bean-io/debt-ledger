import { matchChangedFiles } from './adjacency.js';
import { rank } from './rank.js';
import type { DebtItem } from './schema.js';

export interface Suggestion {
  item: DebtItem;
  score: number;
  reason: string; // why it surfaced — part of the explainability contract
}

export interface SuggestOptions {
  changedFiles?: string[]; // adjacent-first when provided (DESIGN.md Q9)
  maxEffort?: number; // slack mode: "things I can finish today"
  limit?: number; // default 3
}

// Adjacent items ONLY when any adjacency hit exists; otherwise the global
// top-N. Mixing the two in one list would blur why each item surfaced.
export function suggest(items: DebtItem[], options: SuggestOptions = {}): Suggestion[] {
  const limit = options.limit ?? 3;
  const ranked = rank(items).filter(
    (r) => options.maxEffort === undefined || r.item.effort <= options.maxEffort,
  );

  if (options.changedFiles !== undefined && options.changedFiles.length > 0) {
    const matches = matchChangedFiles(options.changedFiles, ranked.map((r) => r.item));
    if (matches.length > 0) {
      const byId = new Map(matches.map((m) => [m.item.id, m]));
      return ranked
        .filter((r) => byId.has(r.item.id))
        .slice(0, limit)
        .map((r) => ({
          item: r.item,
          score: r.score,
          reason: `adjacent: you are touching ${byId.get(r.item.id)!.files.join(', ')}`,
        }));
    }
  }

  const globalReason =
    options.maxEffort === undefined
      ? 'top of the global ranking'
      : `top of the global ranking at effort <= ${options.maxEffort}`;
  return ranked.slice(0, limit).map((r) => ({ item: r.item, score: r.score, reason: globalReason }));
}
