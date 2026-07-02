import { describe, expect, test } from 'vitest';
import { findStaleItems } from '../src/staleness.js';
import { makeItem } from './helpers.js';

describe('findStaleItems', () => {
  const existsIn = (present: string[]) => (path: string) => present.includes(path);

  test('flags an open item whose location is missing', () => {
    const item = makeItem({ location: ['gone.ts'] });
    expect(findStaleItems([item], existsIn([]))).toEqual([{ item, missing: ['gone.ts'] }]);
  });

  test('lists only the missing subset of a multi-file location', () => {
    const item = makeItem({ location: ['here.ts', 'gone.ts'] });
    expect(findStaleItems([item], existsIn(['here.ts']))[0]!.missing).toEqual(['gone.ts']);
  });

  test('does not flag items whose locations all exist', () => {
    const item = makeItem({ location: ['here.ts'] });
    expect(findStaleItems([item], existsIn(['here.ts']))).toEqual([]);
  });

  test('ignores fixed and wontfix items', () => {
    const items = [
      makeItem({ status: 'fixed', location: ['gone.ts'] }),
      makeItem({ status: 'wontfix', location: ['gone.ts'] }),
    ];
    expect(findStaleItems(items, existsIn([]))).toEqual([]);
  });
});
