import { describe, expect, test } from 'vitest';
import { parseIntStrict } from '../src/parse-int.js';

describe('parseIntStrict', () => {
  test('parses integers', () => {
    expect(parseIntStrict('3')).toBe(3);
  });
  test('throws a clean error on non-numeric input', () => {
    expect(() => parseIntStrict('abc')).toThrow(/number/);
  });
});
