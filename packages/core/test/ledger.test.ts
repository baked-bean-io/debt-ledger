import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { LEDGER_PATH, readLedger, writeLedger } from '../src/ledger.js';
import { LedgerError, SCHEMA_VERSION } from '../src/schema.js';
import { serializeLedger } from '../src/serialize.js';
import { makeItem } from './helpers.js';

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'techdebt-'));
}

describe('readLedger', () => {
  test('returns an empty versioned ledger when no file exists', () => {
    expect(readLedger(tempRoot())).toEqual({ version: SCHEMA_VERSION, items: [] });
  });

  test('throws LedgerError on an unsupported version', () => {
    const root = tempRoot();
    mkdirSync(join(root, '.techdebt'));
    writeFileSync(join(root, LEDGER_PATH), JSON.stringify({ version: 999, items: [] }));
    expect(() => readLedger(root)).toThrow(LedgerError);
  });
});

describe('writeLedger', () => {
  test('creates .techdebt/ and round-trips through readLedger', () => {
    const root = tempRoot();
    const ledger = { version: SCHEMA_VERSION, items: [makeItem()] };
    writeLedger(root, ledger);
    expect(readLedger(root)).toEqual(ledger);
  });

  test('writes canonical bytes', () => {
    const root = tempRoot();
    const ledger = { version: SCHEMA_VERSION, items: [makeItem()] };
    writeLedger(root, ledger);
    expect(readFileSync(join(root, LEDGER_PATH), 'utf8')).toBe(serializeLedger(ledger));
  });
});
