import type { DebtItem } from './schema.js';

export interface AdjacencyMatch {
  item: DebtItem;
  files: string[];
}

function normalize(path: string): string {
  return path.startsWith('./') ? path.slice(2) : path;
}

// Exact file-path equality only (v1). Directory-prefix matching is a deliberate
// non-feature until dogfooding demands it — see DESIGN.md "Location (Q2)".
export function matchChangedFiles(changedFiles: string[], items: DebtItem[]): AdjacencyMatch[] {
  const changed = new Set(changedFiles.map(normalize));
  const matches: AdjacencyMatch[] = [];
  for (const item of items) {
    if (item.status !== 'open' && item.status !== 'planned') continue;
    const files = item.location.map(normalize).filter((l) => changed.has(l));
    if (files.length > 0) matches.push({ item, files });
  }
  return matches;
}
