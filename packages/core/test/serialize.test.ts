import { describe, expect, test } from 'vitest';
import { parseLedger, SCHEMA_VERSION } from '../src/schema.js';
import { serializeLedger } from '../src/serialize.js';
import { makeItem } from './helpers.js';

describe('serializeLedger', () => {
  test('exact canonical output for a one-item ledger', () => {
    const out = serializeLedger({ version: SCHEMA_VERSION, items: [makeItem()] });
    expect(out).toBe(`{
  "version": 1,
  "items": [
    {
      "id": "td-0001",
      "title": "test item",
      "location": [
        "src/a.ts"
      ],
      "category": "design",
      "detectedBy": "human",
      "effort": 3,
      "impact": 3,
      "interestRate": 0.2,
      "rationale": "because tests need a reason",
      "firstSeen": "2026-07-01",
      "lastSeen": "2026-07-01",
      "status": "open"
    }
  ]
}
`);
  });

  test('sorts items by id regardless of input order', () => {
    const out = serializeLedger({
      version: 1,
      items: [makeItem({ id: 'td-zzzz' }), makeItem({ id: 'td-aaaa' })],
    });
    expect(out.indexOf('td-aaaa')).toBeLessThan(out.indexOf('td-zzzz'));
  });

  test('emits keys in schema order even when the object was built scrambled', () => {
    const scrambled = { status: 'open', id: 'td-0001', ...makeItem() };
    const out = serializeLedger({ version: 1, items: [scrambled] });
    expect(out.indexOf('"id"')).toBeLessThan(out.indexOf('"title"'));
    expect(out.indexOf('"rationale"')).toBeLessThan(out.indexOf('"firstSeen"'));
    expect(out.indexOf('"lastSeen"')).toBeLessThan(out.indexOf('"status"'));
  });

  test('includes blocksWork between rationale and firstSeen when present', () => {
    const out = serializeLedger({
      version: 1,
      items: [makeItem({ blocksWork: ['STRAT-14'] })],
    });
    expect(out).toContain('"blocksWork"');
    expect(out.indexOf('"rationale"')).toBeLessThan(out.indexOf('"blocksWork"'));
    expect(out.indexOf('"blocksWork"')).toBeLessThan(out.indexOf('"firstSeen"'));
  });

  test('ends with exactly one trailing newline', () => {
    const out = serializeLedger({ version: 1, items: [] });
    expect(out.endsWith('\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
  });

  test('round-trips through parseLedger to identical bytes', () => {
    const first = serializeLedger({
      version: 1,
      items: [makeItem({ id: 'td-b' }), makeItem({ id: 'td-a', blocksWork: ['X-1'] })],
    });
    expect(serializeLedger(parseLedger(first))).toBe(first);
  });
});
