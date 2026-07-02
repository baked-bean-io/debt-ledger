import { readLedger, STATUSES, writeLedger, type Status } from '@techdebt/core';
import { todayIso } from '../today.js';

export interface StatusIo {
  out: (line: string) => void;
}

const consoleIo: StatusIo = { out: (line) => console.log(line) };

export function runStatus(
  root: string,
  id: string,
  status: string,
  io: StatusIo = consoleIo,
  today: string = todayIso(),
): void {
  if (!STATUSES.includes(status as Status)) {
    throw new Error(`status must be one of ${STATUSES.join(', ')}`);
  }
  const ledger = readLedger(root);
  const item = ledger.items.find((i) => i.id === id);
  if (!item) {
    throw new Error(`no item with id ${id} in the ledger`);
  }
  item.status = status as Status;
  item.lastSeen = today;
  writeLedger(root, ledger);
  io.out(`${id} -> ${status}`);
}
