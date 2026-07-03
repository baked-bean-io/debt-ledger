import { describe, expect, test } from 'vitest';
import { rank } from '@debt-ledger/core';
import { formatReport } from '../src/format.js';
import { makeItem } from './helpers.js';

describe('formatReport', () => {
  test('says so when there is nothing to rank', () => {
    expect(formatReport([])).toContain('No open debt items');
  });

  test('shows rank, score, id, status, effort/impact, and title per line', () => {
    const out = formatReport(rank([makeItem({ id: 'td-abcd', title: 'untangle auth' })]));
    const line = out.split('\n').find((l) => l.includes('td-abcd'))!;
    expect(line).toContain('1');
    expect(line).toContain('1.20'); // 3 * 1.2 / 3
    expect(line).toContain('open');
    expect(line).toContain('3/3');
    expect(line).toContain('untangle auth');
  });

  test('orders lines by rank', () => {
    const out = formatReport(
      rank([
        makeItem({ id: 'td-low', impact: 1, effort: 8, interestRate: 0 }),
        makeItem({ id: 'td-high', impact: 8, effort: 1, interestRate: 0.5 }),
      ]),
    );
    expect(out.indexOf('td-high')).toBeLessThan(out.indexOf('td-low'));
  });

  test('prints a blocker-claims warning line for items with blocksWork', () => {
    const out = formatReport(
      rank([makeItem({ blocksWork: ['STRAT-14', 'STRAT-22'] })]),
    );
    expect(out).toContain('claims to block: STRAT-14, STRAT-22');
    expect(out).toContain('prune if shipped');
  });

  test('planned items appear with their status visible', () => {
    const out = formatReport(rank([makeItem({ status: 'planned' })]));
    expect(out).toContain('planned');
  });
});
