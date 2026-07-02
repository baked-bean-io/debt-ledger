import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  harvestTodos,
  MAX_FILE_BYTES,
  scanContentForTodos,
  todosToCandidates,
} from '../src/todo-scan.js';

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
    expect(found[0]!.file).toBe('src/deep/a.ts');
    expect(found[0]!.text).toBe('found me');
  });
});

describe('harvestTodos in a git repo', () => {
  function gitFixture(): string {
    const root = mkdtempSync(join(tmpdir(), 'techdebt-git-'));
    execFileSync('git', ['-C', root, 'init', '-q']);
    return root;
  }

  test('respects .gitignore instead of the hardcoded skip-dir list', () => {
    // The first dogfood run OOM'd on 10 GB of gitignored cdk.out artifacts —
    // git's view of the repo, not a directory walk, is the file list.
    const root = gitFixture();
    mkdirSync(join(root, 'cdk.out'));
    writeFileSync(join(root, '.gitignore'), 'cdk.out/\n');
    writeFileSync(join(root, 'app.ts'), '// TODO: tracked\n');
    writeFileSync(join(root, 'cdk.out', 'bundle.js'), '// TODO: ignored artifact\n');

    const files = harvestTodos(root).map((t) => t.file);
    expect(files).toContain('app.ts');
    expect(files.some((f) => f.startsWith('cdk.out/'))).toBe(false);
  });

  test('skips files over MAX_FILE_BYTES and warns once', () => {
    const root = gitFixture();
    writeFileSync(join(root, 'big.txt'), `// TODO: needle\n${'x'.repeat(MAX_FILE_BYTES)}`);
    writeFileSync(join(root, 'small.ts'), '// TODO: found\n');

    const warnings: string[] = [];
    const found = harvestTodos(root, (line) => warnings.push(line));
    expect(found.map((t) => t.file)).toEqual(['small.ts']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('skipped 1 file');
  });

  test('tolerates files git lists but the worktree no longer has', () => {
    const root = gitFixture();
    writeFileSync(join(root, 'gone.ts'), '// TODO: soon deleted\n');
    execFileSync('git', ['-C', root, 'add', 'gone.ts']);
    rmSync(join(root, 'gone.ts'));
    expect(harvestTodos(root)).toEqual([]);
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
