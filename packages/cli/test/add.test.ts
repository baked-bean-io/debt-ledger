import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { LEDGER_PATH, readLedger, serializeLedger, writeLedger } from '@debt-ledger/core';
import { runAdd } from '../src/commands/add.js';
import { makeItem } from './helpers.js';

const confirmed = {
  title: 'retry logic duplicated in three call sites',
  location: ['src/retry.ts'],
  detectedBy: 'llm',
  category: 'design',
  effort: 3,
  impact: 5,
  interestRate: 0.5,
  rationale: 'each new integration copies the same retry block',
};

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (s: string) => out.push(s), err: (s: string) => err.push(s) }, out, err };
}

function fixture(items: object[]): { root: string; file: string } {
  const root = mkdtempSync(join(tmpdir(), 'techdebt-add-'));
  const file = join(root, 'confirmed.json');
  writeFileSync(file, JSON.stringify(items));
  return { root, file };
}

describe('runAdd', () => {
  test('adds items with minted ids and prints one id per line', () => {
    const { root, file } = fixture([confirmed, { ...confirmed, title: 'second item' }]);
    const { io, out } = capture();
    runAdd(root, { file }, io, '2026-07-02');
    expect(out).toHaveLength(2);
    for (const id of out) expect(id).toMatch(/^td-[0-9a-f-]{36}$/);
    const ledger = readLedger(root);
    expect(ledger.items).toHaveLength(2);
    expect(ledger.items.map((i) => i.status)).toEqual(['open', 'open']);
    expect(ledger.items[0]!.firstSeen).toBe('2026-07-02');
  });

  test('writes canonical bytes', () => {
    const { root, file } = fixture([confirmed]);
    runAdd(root, { file }, capture().io, '2026-07-02');
    const onDisk = readFileSync(join(root, LEDGER_PATH), 'utf8');
    expect(onDisk).toBe(serializeLedger(readLedger(root)));
  });

  test('warns on stderr about open items sharing a location, but still writes', () => {
    const { root, file } = fixture([confirmed]);
    writeLedger(root, {
      version: 1,
      items: [makeItem({ id: 'td-prev', location: ['src/retry.ts'] })],
    });
    const { io, err } = capture();
    runAdd(root, { file }, io, '2026-07-02');
    expect(err.join('\n')).toContain('td-prev');
    expect(readLedger(root).items).toHaveLength(2);
  });

  test('rejects invalid input without touching the ledger', () => {
    const { root, file } = fixture([{ ...confirmed, rationale: '' }]);
    expect(() => runAdd(root, { file }, capture().io, '2026-07-02')).toThrow(/item\[0\]/);
    expect(readLedger(root).items).toHaveLength(0);
  });
});
