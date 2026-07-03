import type { RankedItem } from '@debt-ledger/core';

export function formatReport(ranked: RankedItem[]): string {
  if (ranked.length === 0) {
    return 'No open debt items in .techdebt/items.json\n';
  }
  const idWidth = Math.max(2, ...ranked.map((r) => r.item.id.length));
  const lines: string[] = [`rank  score   ${'id'.padEnd(idWidth)}  status   e/i  title`];
  ranked.forEach((r, i) => {
    const { item } = r;
    lines.push(
      [
        String(i + 1).padStart(4),
        r.score.toFixed(2).padStart(6),
        item.id.padEnd(idWidth),
        item.status.padEnd(8),
        `${item.effort}/${item.impact}`.padEnd(4),
        item.title,
      ].join('  '),
    );
    if (item.blocksWork && item.blocksWork.length > 0) {
      lines.push(`      ! claims to block: ${item.blocksWork.join(', ')} — prune if shipped`);
    }
  });
  return `${lines.join('\n')}\n`;
}
