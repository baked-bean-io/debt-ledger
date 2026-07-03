import { describe, expect, test } from 'vitest';
import { mintId } from '../src/id.js';

describe('mintId', () => {
  test('mints td-prefixed UUIDs by default', () => {
    expect(mintId(new Set())).toMatch(
      /^td-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test('uses the injected generator verbatim', () => {
    expect(mintId(new Set(), () => 'td-fixed')).toBe('td-fixed');
  });

  test('retries until it avoids existing ids', () => {
    const draws = ['td-dup', 'td-dup', 'td-new'];
    let i = 0;
    expect(mintId(new Set(['td-dup']), () => draws[i++]!)).toBe('td-new');
  });

  test('consecutive default mints differ', () => {
    expect(mintId(new Set())).not.toBe(mintId(new Set()));
  });
});
