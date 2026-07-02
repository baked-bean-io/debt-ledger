import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { writeLedger } from '@techdebt/core';
import { runScan } from '../src/commands/scan.js';
import { makeItem } from './helpers.js';

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (s: string) => out.push(s), err: (s: string) => err.push(s) }, out, err };
}

function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'techdebt-scan-cmd-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'a.ts'), '// TODO: tighten types\n');
  return root;
}

describe('runScan', () => {
  test('--json emits a parseable Candidate array on stdout', () => {
    const root = fixtureRepo();
    const { io, out } = capture();
    runScan(root, { json: true }, io);
    const candidates = JSON.parse(out.join('\n'));
    expect(candidates).toEqual([
      {
        title: `TODO: tighten types (${join('src', 'a.ts')}:1)`,
        location: [join('src', 'a.ts')],
        detectedBy: 'static-analysis',
      },
    ]);
  });

  test('human mode lists candidates and the triage hint', () => {
    const root = fixtureRepo();
    const { io, out } = capture();
    runScan(root, { json: false }, io);
    const text = out.join('\n');
    expect(text).toContain('1 candidate');
    expect(text).toContain('TODO: tighten types');
    expect(text).toContain('techdebt triage');
  });

  test('warns on stderr about stale ledger locations', () => {
    const root = fixtureRepo();
    writeLedger(root, {
      version: 1,
      items: [makeItem({ id: 'td-gone', location: ['deleted.ts'] })],
    });
    const { io, err } = capture();
    runScan(root, { json: true }, io);
    expect(err.join('\n')).toContain('td-gone');
    expect(err.join('\n')).toContain('deleted.ts');
  });

  test('reports zero candidates cleanly', () => {
    const root = mkdtempSync(join(tmpdir(), 'techdebt-empty-'));
    const { io, out } = capture();
    runScan(root, { json: false }, io);
    expect(out.join('\n')).toContain('No TODO/FIXME/HACK/XXX comments found');
  });
});
