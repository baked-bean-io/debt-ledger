import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { DetectedBy } from '@techdebt/core';

export interface TodoCandidate {
  file: string;
  line: number;
  tag: string;
  text: string;
}

export interface Candidate {
  title: string;
  location: string[];
  detectedBy: DetectedBy;
}

const TODO_RE = /\b(TODO|FIXME|HACK|XXX)\b:?\s*(.*)/;
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.techdebt', '.yarn',
]);

export function scanContentForTodos(content: string, file: string): TodoCandidate[] {
  const out: TodoCandidate[] = [];
  content.split('\n').forEach((lineText, i) => {
    const m = TODO_RE.exec(lineText);
    if (m) out.push({ file, line: i + 1, tag: m[1]!, text: m[2]!.trim() });
  });
  return out;
}

export function harvestTodos(root: string): TodoCandidate[] {
  const out: TodoCandidate[] = [];
  walk(root);
  return out;

  function repoRelative(rootDir: string, filePath: string): string {
    return relative(rootDir, filePath).split(sep).join('/');
  }

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path);
        continue;
      }
      if (!entry.isFile()) continue;
      const bytes = readFileSync(path);
      if (bytes.includes(0)) continue; // NUL byte: treat as binary, skip
      out.push(...scanContentForTodos(bytes.toString('utf8'), repoRelative(root, path)));
    }
  }
}

export function todosToCandidates(todos: TodoCandidate[]): Candidate[] {
  return todos.map((t) => ({
    title: t.text
      ? `${t.tag}: ${t.text} (${t.file}:${t.line})`
      : `${t.tag} (${t.file}:${t.line})`,
    location: [t.file],
    detectedBy: 'static-analysis' as const,
  }));
}
