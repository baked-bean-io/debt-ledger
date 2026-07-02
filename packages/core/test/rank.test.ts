import { describe, expect, test } from 'vitest';
import { blockMultiplier, rank, score } from '../src/rank.js';
import { makeItem } from './helpers.js';

describe('score', () => {
  // priority = (impact * (1 + interestRate) * blockMultiplier) / effort
  const cases: Array<[string, Parameters<typeof makeItem>[0], number]> = [
    ['baseline', { impact: 3, interestRate: 0.2, effort: 3 }, 1.2],
    ['zero interest does not zero the score', { impact: 5, interestRate: 0, effort: 5 }, 1],
    ['two blockers double the base', { impact: 5, interestRate: 0, effort: 5, blocksWork: ['A', 'B'] }, 2],
    ['blocker cap at 4', { impact: 5, interestRate: 0, effort: 5, blocksWork: ['A', 'B', 'C', 'D', 'E', 'F'] }, 3],
    ['rounds to 2 decimals', { impact: 1, interestRate: 0.1, effort: 3 }, 0.37],
    ['max everything', { impact: 8, interestRate: 1, effort: 1, blocksWork: ['A', 'B', 'C', 'D'] }, 48],
  ];

  test.each(cases)('%s', (_name, overrides, expected) => {
    expect(score(makeItem(overrides))).toBe(expected);
  });
});

describe('blockMultiplier', () => {
  test('is 1 with no blocksWork', () => {
    expect(blockMultiplier(makeItem())).toBe(1);
  });
});

describe('rank', () => {
  test('excludes fixed and wontfix, keeps open and planned', () => {
    const items = [
      makeItem({ id: 'td-open', status: 'open' }),
      makeItem({ id: 'td-plan', status: 'planned' }),
      makeItem({ id: 'td-done', status: 'fixed' }),
      makeItem({ id: 'td-wont', status: 'wontfix' }),
    ];
    expect(rank(items).map((r) => r.item.id).sort()).toEqual(['td-open', 'td-plan']);
  });

  test('orders by score descending', () => {
    const items = [
      makeItem({ id: 'td-low', impact: 1, effort: 8, interestRate: 0 }),
      makeItem({ id: 'td-high', impact: 8, effort: 1, interestRate: 0.5 }),
    ];
    expect(rank(items).map((r) => r.item.id)).toEqual(['td-high', 'td-low']);
  });

  test('breaks score ties by impact descending', () => {
    // both score 1.00: 8*1/8 and 1*1/1
    const items = [
      makeItem({ id: 'td-aaaa', impact: 1, effort: 1, interestRate: 0 }),
      makeItem({ id: 'td-bbbb', impact: 8, effort: 8, interestRate: 0 }),
    ];
    expect(rank(items).map((r) => r.item.id)).toEqual(['td-bbbb', 'td-aaaa']);
  });

  test('breaks remaining ties by id ascending', () => {
    const items = [makeItem({ id: 'td-bbbb' }), makeItem({ id: 'td-aaaa' })];
    expect(rank(items).map((r) => r.item.id)).toEqual(['td-aaaa', 'td-bbbb']);
  });

  test('compares on the rounded score', () => {
    // raw scores differ in the 15th decimal place; rounded they tie, id decides
    const a = makeItem({ id: 'td-aaaa', impact: 3, effort: 3, interestRate: 0.1 });
    const b = makeItem({ id: 'td-bbbb', impact: 1, effort: 1, interestRate: 0.1 });
    expect(rank([b, a]).map((r) => r.item.id)).toEqual(['td-aaaa', 'td-bbbb']);
  });
});
