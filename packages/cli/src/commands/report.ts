import { rank, readLedger } from '@debt-ledger/core';
import { formatReport } from '../format.js';

export interface ReportIo {
  out: (text: string) => void;
}

const consoleIo: ReportIo = { out: (text) => process.stdout.write(text) };

export function runReport(
  root: string,
  opts: { json?: boolean } = {},
  io: ReportIo = consoleIo,
): void {
  const ranked = rank(readLedger(root).items);
  if (opts.json) {
    io.out(`${JSON.stringify(ranked, null, 2)}\n`);
    return;
  }
  io.out(formatReport(ranked));
}
