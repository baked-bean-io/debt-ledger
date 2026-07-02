import { describe, expect, test } from 'vitest';
import { suggest } from '../src/suggest.js';
import { makeItem } from './helpers.js';

describe('suggest', () => {
  test('returns empty for an empty ledger', () => {
    expect(suggest([])).toEqual([]);
  });

  test('with changed files, returns ONLY adjacent items, in rank order, with an adjacency reason', () => {
    const items = [
      makeItem({ id: 'td-adja', location: ['src/x.ts'], impact: 1, effort: 8, interestRate: 0 }),
      makeItem({ id: 'td-adjb', location: ['src/x.ts'], impact: 8, effort: 1, interestRate: 0 }),
      makeItem({ id: 'td-glob', location: ['src/z.ts'], impact: 8, effort: 1, interestRate: 1 }),
    ];
    const out = suggest(items, { changedFiles: ['src/x.ts'] });
    expect(out.map((s) => s.item.id)).toEqual(['td-adjb', 'td-adja']);
    expect(out[0]!.reason).toContain('src/x.ts');
  });

  test('with changed files but no adjacency, falls back to the global ranking', () => {
    const items = [
      makeItem({ id: 'td-glob', location: ['src/z.ts'] }),
    ];
    const out = suggest(items, { changedFiles: ['src/other.ts'] });
    expect(out.map((s) => s.item.id)).toEqual(['td-glob']);
    expect(out[0]!.reason).toContain('global ranking');
  });

  test('without changed files, returns the global top N (default limit 3)', () => {
    const items = ['td-aaaa', 'td-bbbb', 'td-cccc', 'td-dddd'].map((id) => makeItem({ id }));
    const out = suggest(items);
    expect(out).toHaveLength(3);
    expect(out.map((s) => s.item.id)).toEqual(['td-aaaa', 'td-bbbb', 'td-cccc']);
  });

  test('limit overrides the default', () => {
    const items = ['td-aaaa', 'td-bbbb'].map((id) => makeItem({ id }));
    expect(suggest(items, { limit: 1 })).toHaveLength(1);
  });

  test('maxEffort filters before ranking, and the reason mentions the cap', () => {
    const items = [
      makeItem({ id: 'td-big', effort: 8, impact: 8 }),
      makeItem({ id: 'td-small', effort: 2, impact: 1 }),
    ];
    const out = suggest(items, { maxEffort: 3 });
    expect(out.map((s) => s.item.id)).toEqual(['td-small']);
    expect(out[0]!.reason).toContain('effort');
  });

  test('fixed and wontfix items are never suggested', () => {
    const items = [
      makeItem({ id: 'td-done', status: 'fixed', location: ['src/x.ts'] }),
    ];
    expect(suggest(items, { changedFiles: ['src/x.ts'] })).toEqual([]);
  });

  test('score is carried through from rank', () => {
    const out = suggest([makeItem()]); // 3 * 1.2 / 3 = 1.2
    expect(out[0]!.score).toBe(1.2);
  });
});
