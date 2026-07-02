import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { harvestTodos, scanContentForTodos, todosToCandidates } from '../src/todo-scan.js';

describe('scanContentForTodos', () => {
  test('finds all four tags with and without colons', () => {
    const content = [
      '// TODO: refactor this',
      '# FIXME broken on windows',
      '/* HACK: temporary */',
      '-- XXX revisit',
      'const x = 1; // nothing here',
    ].join('\n');
    const found = scanContentForTodos(content, 'src/a.ts');
    expect(found.map((t) => t.tag)).toEqual(['TODO', 'FIXME', 'HACK', 'XXX']);
    expect(found[0]).toEqual({ file: 'src/a.ts', line: 1, tag: 'TODO', text: 'refactor this' });
    expect(found[1]!.line).toBe(2);
  });

  test('does not match tags embedded in words', () => {
    expect(scanContentForTodos('const mastodont = 1;', 'a.ts')).toEqual([]);
  });

  test('returns empty for content with no tags', () => {
    expect(scanContentForTodos('clean code\nonly\n', 'a.ts')).toEqual([]);
  });
});

describe('harvestTodos', () => {
  test('walks nested dirs, skips node_modules and binary files, reports repo-relative paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'techdebt-scan-'));
    mkdirSync(join(root, 'src', 'deep'), { recursive: true });
    mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true });
    writeFileSync(join(root, 'src', 'deep', 'a.ts'), '// TODO: found me\n');
    writeFileSync(join(root, 'node_modules', 'pkg', 'b.ts'), '// TODO: skip me\n');
    writeFileSync(join(root, 'image.bin'), Buffer.from([0x54, 0x4f, 0x44, 0x4f, 0x00, 0xff]));

    const found = harvestTodos(root);
    expect(found).toHaveLength(1);
    expect(found[0]!.file).toBe(join('src', 'deep', 'a.ts'));
    expect(found[0]!.text).toBe('found me');
  });
});

describe('todosToCandidates', () => {
  test('builds a titled candidate pointing at the file', () => {
    const [candidate] = todosToCandidates([
      { file: 'src/a.ts', line: 12, tag: 'TODO', text: 'refactor this' },
    ]);
    expect(candidate).toEqual({
      title: 'TODO: refactor this (src/a.ts:12)',
      location: ['src/a.ts'],
      detectedBy: 'static-analysis',
    });
  });

  test('handles a bare tag with no trailing text', () => {
    const [candidate] = todosToCandidates([
      { file: 'src/a.ts', line: 3, tag: 'HACK', text: '' },
    ]);
    expect(candidate!.title).toBe('HACK (src/a.ts:3)');
  });
});
