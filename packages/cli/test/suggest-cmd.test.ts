import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { writeLedger } from '@debt-ledger/core';
import { runSuggest } from '../src/commands/suggest.js';
import { makeItem } from './helpers.js';

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'techdebt-suggest-'));
  writeLedger(root, {
    version: 1,
    items: [
      makeItem({ id: 'td-adjc', location: ['src/auth.ts'], impact: 5 }),
      makeItem({ id: 'td-glob', location: ['src/other.ts'], impact: 8, effort: 1 }),
    ],
  });
  return root;
}

function capture() {
  const out: string[] = [];
  return { io: { out: (s: string) => out.push(s) }, out };
}

describe('runSuggest', () => {
  test('--files filters to adjacent items and explains why', () => {
    const { io, out } = capture();
    runSuggest(fixture(), { files: 'src/auth.ts', json: false }, io);
    const text = out.join('\n');
    expect(text).toContain('td-adjc');
    expect(text).not.toContain('td-glob');
    expect(text).toContain('why: adjacent');
  });

  test('--json emits parseable suggestions with reasons', () => {
    const { io, out } = capture();
    runSuggest(fixture(), { json: true }, io);
    const suggestions = JSON.parse(out.join(''));
    expect(suggestions[0].item.id).toBe('td-glob'); // highest score globally
    expect(suggestions[0].reason).toContain('global ranking');
  });

  test('maxEffort caps what surfaces', () => {
    const { io, out } = capture();
    runSuggest(fixture(), { maxEffort: 1, json: true }, io);
    const suggestions = JSON.parse(out.join(''));
    expect(suggestions.map((s: { item: { id: string } }) => s.item.id)).toEqual(['td-glob']);
  });

  test('empty result says so in human mode', () => {
    const root = mkdtempSync(join(tmpdir(), 'techdebt-suggest-empty-'));
    const { io, out } = capture();
    runSuggest(root, { json: false }, io);
    expect(out.join('\n')).toContain('Nothing to suggest');
  });
});
