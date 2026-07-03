import { rank, type AdjacencyMatch, type DebtItem } from '@debt-ledger/core';

export const MARKER = '<!-- debt-ledger -->';

export interface ScoredMatch {
  item: DebtItem;
  score: number;
  files: string[];
}

// Ordering comes from the ledger's deterministic ranking — the comment is a
// view over the ledger, never a second opinion (DESIGN.md Q8).
export function scoreMatches(matches: AdjacencyMatch[]): ScoredMatch[] {
  const filesById = new Map(matches.map((m) => [m.item.id, m.files]));
  return rank(matches.map((m) => m.item)).map((r) => ({
    item: r.item,
    score: r.score,
    files: filesById.get(r.item.id) ?? [],
  }));
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function buildCommentBody(matches: ScoredMatch[]): string {
  if (matches.length === 0) {
    return `${MARKER}\nThis PR no longer touches any tracked tech debt.`;
  }
  const lines = [
    MARKER,
    '### Tech debt in files this PR touches',
    '',
    '| id | score | status | e/i | title | matched files |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const m of matches) {
    lines.push(
      `| ${m.item.id} | ${m.score.toFixed(2)} | ${m.item.status} | ${m.item.effort}/${m.item.impact} | ${escapeCell(m.item.title)} | ${m.files.map((f) => `\`${escapeCell(f)}\``).join(', ')} |`,
    );
  }
  lines.push('', '_Ordered by the ledger\'s deterministic score. Run `debt report` locally for the full list._');
  return lines.join('\n');
}
