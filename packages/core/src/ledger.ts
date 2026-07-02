import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseLedger, SCHEMA_VERSION, type Ledger } from './schema.js';
import { serializeLedger } from './serialize.js';

export const LEDGER_PATH = '.techdebt/items.json';

export function readLedger(root: string): Ledger {
  const path = join(root, LEDGER_PATH);
  if (!existsSync(path)) return { version: SCHEMA_VERSION, items: [] };
  return parseLedger(readFileSync(path, 'utf8'));
}

export function writeLedger(root: string, ledger: Ledger): void {
  const path = join(root, LEDGER_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeLedger(ledger));
}
