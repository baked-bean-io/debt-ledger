import { describe, expect, test } from 'vitest';
import { mintId } from '../src/id.js';

function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe('mintId', () => {
  test('matches the td-xxxx shape', () => {
    expect(mintId(new Set())).toMatch(/^td-[0-9a-z]{4}$/);
  });

  test('is deterministic given a seeded random source', () => {
    // floor(0 * 36) = 0 -> '0', so four zeros -> td-0000
    expect(mintId(new Set(), sequence([0, 0, 0, 0]))).toBe('td-0000');
  });

  test('retries until it avoids existing ids', () => {
    // first attempt td-0000 collides; second attempt uses 0,0,0,0.5 -> td-000i
    const random = sequence([0, 0, 0, 0, 0, 0, 0, 0.5]);
    expect(mintId(new Set(['td-0000']), random)).toBe('td-000i');
  });
});
