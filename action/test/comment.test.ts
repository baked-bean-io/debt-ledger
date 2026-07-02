import { describe, expect, test } from 'vitest';
import { matchChangedFiles } from '@techdebt/core';
import { buildCommentBody, MARKER, scoreMatches } from '../src/comment.js';
import { makeItem } from './helpers.js';

describe('scoreMatches', () => {
  test('orders by the ledger ranking and keeps matched files', () => {
    const items = [
      makeItem({ id: 'td-low', location: ['a.ts'], impact: 1, effort: 8, interestRate: 0 }),
      makeItem({ id: 'td-high', location: ['b.ts'], impact: 8, effort: 1, interestRate: 0.5 }),
    ];
    const scored = scoreMatches(matchChangedFiles(['a.ts', 'b.ts'], items));
    expect(scored.map((s) => s.item.id)).toEqual(['td-high', 'td-low']);
    expect(scored[0]!.files).toEqual(['b.ts']);
    expect(scored[0]!.score).toBe(12);
  });
});

describe('buildCommentBody', () => {
  test('starts with the sticky marker in both modes', () => {
    expect(buildCommentBody([])).toMatch(new RegExp(`^${MARKER}`));
    const scored = scoreMatches(matchChangedFiles(['src/a.ts'], [makeItem()]));
    expect(buildCommentBody(scored)).toMatch(new RegExp(`^${MARKER}`));
  });

  test('zero matches produces the no-longer-touches body', () => {
    expect(buildCommentBody([])).toContain('no longer touches');
  });

  test('renders one table row per match with report fields', () => {
    const scored = scoreMatches(
      matchChangedFiles(['src/a.ts'], [makeItem({ id: 'td-abcd', title: 'untangle auth' })]),
    );
    const body = buildCommentBody(scored);
    expect(body).toContain('| td-abcd | 1.20 | open | 3/3 | untangle auth | `src/a.ts` |');
    expect(body).toContain('techdebt report');
  });

  test('escapes pipes in titles so the table cannot break', () => {
    const scored = scoreMatches(
      matchChangedFiles(['src/a.ts'], [makeItem({ title: 'a | b' })]),
    );
    expect(buildCommentBody(scored)).toContain('a \\| b');
  });
});
