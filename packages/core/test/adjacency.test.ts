import { describe, expect, test } from 'vitest';
import { matchChangedFiles } from '../src/adjacency.js';
import { makeItem } from './helpers.js';

describe('matchChangedFiles', () => {
  test('matches on exact path equality', () => {
    const item = makeItem({ location: ['src/a.ts'] });
    const matches = matchChangedFiles(['src/a.ts', 'src/b.ts'], [item]);
    expect(matches).toEqual([{ item, files: ['src/a.ts'] }]);
  });

  test('normalizes a leading ./ on either side', () => {
    const item = makeItem({ location: ['./src/a.ts'] });
    expect(matchChangedFiles(['src/a.ts'], [item])).toHaveLength(1);
    const item2 = makeItem({ location: ['src/a.ts'] });
    expect(matchChangedFiles(['./src/a.ts'], [item2])).toHaveLength(1);
  });

  test('does NOT match directory prefixes (v1 is exact-file only)', () => {
    const item = makeItem({ location: ['src'] });
    expect(matchChangedFiles(['src/a.ts'], [item])).toEqual([]);
  });

  test('reports only the overlapping subset of a multi-file location', () => {
    const item = makeItem({ location: ['src/a.ts', 'src/z.ts'] });
    const matches = matchChangedFiles(['src/a.ts'], [item]);
    expect(matches[0]!.files).toEqual(['src/a.ts']);
  });

  test('ignores fixed and wontfix items', () => {
    const items = [
      makeItem({ id: 'td-done', status: 'fixed' }),
      makeItem({ id: 'td-wont', status: 'wontfix' }),
    ];
    expect(matchChangedFiles(['src/a.ts'], items)).toEqual([]);
  });

  test('returns empty on no overlap', () => {
    expect(matchChangedFiles(['other.ts'], [makeItem()])).toEqual([]);
  });
});
