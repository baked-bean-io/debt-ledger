import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEDGER_PATH, writeLedger } from '@debt-ledger/core';
import { diagnose, repair } from '../doctor-core.js';

export interface DoctorIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

const consoleIo: DoctorIo = {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
};

export function runDoctor(root: string, opts: { fix: boolean }, io: DoctorIo = consoleIo): void {
  const path = join(root, LEDGER_PATH);
  if (!existsSync(path)) {
    io.out(`no ledger at ${LEDGER_PATH} — nothing to check`);
    return;
  }
  const raw = readFileSync(path, 'utf8');
  const d = diagnose(raw);

  if (d.ok) {
    const count = (JSON.parse(raw) as { items: unknown[] }).items.length;
    io.out(`ledger OK (${count} item(s))`);
    return;
  }

  if (d.parseError) {
    io.err(
      d.conflictMarkers
        ? 'unresolved merge conflict markers in the ledger — edit the file, keep both versions of the items, then run doctor --fix'
        : `ledger is not valid JSON: ${d.parseError}`,
    );
    process.exitCode = 1;
    return;
  }
  if (d.shapeError) {
    io.err(`ledger has the wrong shape: ${d.shapeError}`);
    process.exitCode = 1;
    return;
  }

  const canFix = d.itemErrors.length === 0 && !d.mangledMerge;

  for (const e of d.itemErrors) io.err(`invalid item: ${e}`);
  for (const id of d.duplicateIds) {
    io.err(`duplicate id: ${id}${opts.fix || !canFix ? '' : ' (doctor --fix will re-mint the later one(s))'}`);
  }
  if (d.mangledMerge) {
    io.err(
      'an item appears to contain fields from two merged versions — a merge was probably mis-resolved; compare with git history (git log -p .techdebt/items.json) and rebuild the affected items by hand',
    );
  }
  if (!d.canonical) {
    io.err(`file is not in canonical form${opts.fix || !canFix ? '' : ' (doctor --fix will rewrite it)'}`);
  }

  if (!opts.fix) {
    process.exitCode = 1;
    return;
  }
  if (d.itemErrors.length > 0 || d.mangledMerge) {
    io.err('cannot fix this automatically — repair the reported problems by hand, then re-run');
    process.exitCode = 1;
    return;
  }

  const { ledger, remapped } = repair(raw);
  writeLedger(root, ledger);
  for (const r of remapped) io.out(`re-minted duplicate: ${r.from} -> ${r.to}`);
  io.out(`ledger repaired and rewritten canonically (${ledger.items.length} item(s))`);
}
