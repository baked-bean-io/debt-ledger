import { rank, readLedger } from '@techdebt/core';
import { formatReport } from '../format.js';

export interface ReportIo {
  out: (text: string) => void;
}

const consoleIo: ReportIo = { out: (text) => process.stdout.write(text) };

export function runReport(root: string, io: ReportIo = consoleIo): void {
  const ledger = readLedger(root);
  io.out(formatReport(rank(ledger.items)));
}
