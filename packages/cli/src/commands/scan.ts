import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findStaleItems, readLedger } from '@debt-ledger/core';
import { harvestTodos, todosToCandidates } from '../todo-scan.js';

export interface ScanIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

const consoleIo: ScanIo = {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
};

export function runScan(root: string, opts: { json: boolean }, io: ScanIo = consoleIo): void {
  const candidates = todosToCandidates(harvestTodos(root, (line) => io.err(line)));

  const ledger = readLedger(root);
  const stale = findStaleItems(ledger.items, (p) => existsSync(join(root, p)));
  for (const s of stale) {
    for (const missing of s.missing) {
      io.err(`stale location: ${s.item.id} "${s.item.title}" points at missing file ${missing}`);
    }
  }

  if (opts.json) {
    io.out(JSON.stringify(candidates, null, 2));
    return;
  }

  if (candidates.length === 0) {
    io.out('No TODO/FIXME/HACK/XXX comments found.');
    return;
  }
  io.out(`${candidates.length} candidate(s) found:\n`);
  for (const c of candidates) io.out(`  ${c.title}`);
  io.out('');
  io.out('To triage: debt scan --json > candidates.json && debt triage --candidates candidates.json');
}
