import { readLedger, suggest } from '@debt-ledger/core';

export interface SuggestIo {
  out: (line: string) => void;
}

const consoleIo: SuggestIo = { out: (line) => console.log(line) };

export function runSuggest(
  root: string,
  opts: { files?: string; maxEffort?: number; limit?: number; json: boolean },
  io: SuggestIo = consoleIo,
): void {
  const ledger = readLedger(root);
  const changedFiles = opts.files
    ? opts.files.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
    : undefined;
  const suggestions = suggest(ledger.items, {
    changedFiles,
    maxEffort: opts.maxEffort,
    limit: opts.limit,
  });

  if (opts.json) {
    io.out(JSON.stringify(suggestions, null, 2));
    return;
  }
  if (suggestions.length === 0) {
    io.out('Nothing to suggest — no open items match the filters.');
    return;
  }
  for (const s of suggestions) {
    io.out(`${s.item.id}  ${s.score.toFixed(2)}  [e${s.item.effort}/i${s.item.impact}]  ${s.item.title}`);
    io.out(`      why: ${s.reason}`);
    io.out(`      rationale: ${s.item.rationale}`);
  }
}
