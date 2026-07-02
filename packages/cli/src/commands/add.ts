import { readFileSync } from 'node:fs';
import { matchChangedFiles, readLedger, writeLedger } from '@techdebt/core';
import { buildItem, parseConfirmedItems } from '../triage-core.js';
import { todayIso } from '../today.js';

export interface AddIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

const consoleIo: AddIo = {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
};

// Non-interactive write path for the skill: the human confirmed these items
// in conversation; this validates them, mints ids, and writes canonically.
export function runAdd(
  root: string,
  opts: { file?: string },
  io: AddIo = consoleIo,
  today: string = todayIso(),
): void {
  const json = readFileSync(opts.file ?? 0, 'utf8'); // fd 0 = stdin when no --file
  const confirmed = parseConfirmedItems(json);

  const ledger = readLedger(root);
  const existingIds = new Set(ledger.items.map((i) => i.id));
  const minted: string[] = [];

  for (const answers of confirmed) {
    for (const dupe of matchChangedFiles(answers.location, ledger.items)) {
      io.err(
        `warning: ${dupe.item.id} "${dupe.item.title}" already covers ${dupe.files.join(', ')}`,
      );
    }
    const item = buildItem(answers, existingIds, today);
    existingIds.add(item.id);
    ledger.items.push(item);
    minted.push(item.id);
  }

  writeLedger(root, ledger);
  for (const id of minted) io.out(id);
}
