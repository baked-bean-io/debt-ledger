import { describe, expect, test } from 'vitest';
import {
  LedgerError,
  parseLedger,
  SCHEMA_VERSION,
  validateItem,
} from '../src/schema.js';
import { makeItem } from './helpers.js';

describe('validateItem', () => {
  test('a fully valid item has no errors', () => {
    expect(validateItem(makeItem())).toEqual([]);
  });

  test('valid item with blocksWork has no errors', () => {
    expect(validateItem(makeItem({ blocksWork: ['STRAT-14'] }))).toEqual([]);
  });

  const bad: Array<[string, unknown]> = [
    ['non-object', 42],
    ['empty id', makeItem({ id: '' })],
    ['empty title', makeItem({ title: '' })],
    ['empty location array', makeItem({ location: [] })],
    ['location with empty string', makeItem({ location: [''] })],
    ['unknown category', makeItem({ category: 'vibes' as never })],
    ['unknown detectedBy', makeItem({ detectedBy: 'oracle' as never })],
    ['non-fibonacci effort', makeItem({ effort: 4 as never })],
    ['non-fibonacci impact', makeItem({ impact: 6 as never })],
    ['interestRate above 1', makeItem({ interestRate: 1.5 })],
    ['interestRate below 0', makeItem({ interestRate: -0.1 })],
    ['NaN interestRate', makeItem({ interestRate: NaN })],
    ['blank rationale', makeItem({ rationale: '   ' })],
    ['non-array blocksWork', makeItem({ blocksWork: 'STRAT-14' as never })],
    ['bad firstSeen', makeItem({ firstSeen: 'July 1' })],
    ['bad lastSeen', makeItem({ lastSeen: '2026-7-1' })],
    ['unknown status', makeItem({ status: 'done' as never })],
  ];

  test.each(bad)('%s produces at least one error', (_name, value) => {
    expect(validateItem(value).length).toBeGreaterThan(0);
  });
});

describe('parseLedger', () => {
  test('parses a valid ledger', () => {
    const json = JSON.stringify({ version: SCHEMA_VERSION, items: [makeItem()] });
    const ledger = parseLedger(json);
    expect(ledger.version).toBe(SCHEMA_VERSION);
    expect(ledger.items).toHaveLength(1);
    expect(ledger.items[0]!.id).toBe('td-0001');
  });

  test('rejects invalid JSON', () => {
    expect(() => parseLedger('{nope')).toThrow(LedgerError);
  });

  test('rejects an unsupported version', () => {
    const json = JSON.stringify({ version: 999, items: [] });
    expect(() => parseLedger(json)).toThrow(/version/);
  });

  test('rejects a missing items array', () => {
    expect(() => parseLedger(JSON.stringify({ version: 1 }))).toThrow(LedgerError);
  });

  test('reports every invalid item with its index', () => {
    const json = JSON.stringify({
      version: 1,
      items: [makeItem(), makeItem({ id: 'td-0002', rationale: '' })],
    });
    expect(() => parseLedger(json)).toThrow(/items\[1\]/);
  });

  test('rejects duplicate ids', () => {
    const json = JSON.stringify({
      version: 1,
      items: [makeItem(), makeItem()],
    });
    expect(() => parseLedger(json)).toThrow(/duplicate/);
  });
});
