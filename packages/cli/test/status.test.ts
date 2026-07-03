import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { readLedger, writeLedger } from '@debt-ledger/core';
import { runStatus } from '../src/commands/status.js';
import { makeItem } from './helpers.js';

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'techdebt-status-'));
  writeLedger(root, { version: 1, items: [makeItem({ id: 'td-abcd', lastSeen: '2026-01-01' })] });
  return root;
}

describe('runStatus', () => {
  test('flips status and stamps lastSeen', () => {
    const root = fixture();
    const out: string[] = [];
    runStatus(root, 'td-abcd', 'fixed', { out: (s) => out.push(s) }, '2026-07-02');
    const item = readLedger(root).items[0]!;
    expect(item.status).toBe('fixed');
    expect(item.lastSeen).toBe('2026-07-02');
    expect(out.join('\n')).toContain('td-abcd');
  });

  test('rejects an unknown id without writing', () => {
    const root = fixture();
    expect(() => runStatus(root, 'td-none', 'fixed', { out: () => {} }, '2026-07-02')).toThrow(
      /td-none/,
    );
    expect(readLedger(root).items[0]!.status).toBe('open');
  });

  test('rejects an invalid status', () => {
    const root = fixture();
    expect(() => runStatus(root, 'td-abcd', 'done', { out: () => {} }, '2026-07-02')).toThrow(
      /one of/,
    );
  });
});
