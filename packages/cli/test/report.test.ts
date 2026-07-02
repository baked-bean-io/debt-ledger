import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { writeLedger } from '@techdebt/core';
import { runReport } from '../src/commands/report.js';
import { makeItem } from './helpers.js';

describe('runReport', () => {
  test('prints the ranked ledger', () => {
    const root = mkdtempSync(join(tmpdir(), 'techdebt-report-'));
    writeLedger(root, {
      version: 1,
      items: [
        makeItem({ id: 'td-high', impact: 8, effort: 1, interestRate: 0.5 }),
        makeItem({ id: 'td-low', impact: 1, effort: 8, interestRate: 0 }),
        makeItem({ id: 'td-done', status: 'fixed' }),
      ],
    });
    const out: string[] = [];
    runReport(root, { out: (s) => out.push(s) });
    const text = out.join('\n');
    expect(text.indexOf('td-high')).toBeLessThan(text.indexOf('td-low'));
    expect(text).not.toContain('td-done');
  });

  test('handles a repo with no ledger', () => {
    const root = mkdtempSync(join(tmpdir(), 'techdebt-noledger-'));
    const out: string[] = [];
    runReport(root, { out: (s) => out.push(s) });
    expect(out.join('\n')).toContain('No open debt items');
  });
});
