import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { DetectedBy } from '@debt-ledger/core';

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

// Files larger than this are never hand-written source. Reading them wholesale
// is how the first dogfood run OOM'd: 10 GB of gitignored cdk.out bundles.
export const MAX_FILE_BYTES = 1024 * 1024;

export function scanContentForTodos(content: string, file: string): TodoCandidate[] {
  const out: TodoCandidate[] = [];
  content.split('\n').forEach((lineText, i) => {
    const m = TODO_RE.exec(lineText);
    if (m) out.push({ file, line: i + 1, tag: m[1]!, text: m[2]!.trim() });
  });
  return out;
}

// Git's view of the repo — tracked plus untracked-but-not-ignored files — is
// the authoritative file list: it respects .gitignore (build output, caches,
// vendored blobs) and returns repo-relative forward-slash paths, exactly the
// ledger's location format. Returns null outside a git work tree.
function gitListFiles(root: string): string[] | null {
  try {
    const out = execFileSync(
      'git',
      ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      { maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return out.toString('utf8').split('\0').filter((f) => f.length > 0);
  } catch {
    return null;
  }
}

// Fallback for non-git directories: recursive walk with a fixed skip list.
function walkFiles(root: string): string[] {
  const out: string[] = [];
  walk(root);
  return out;

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path);
        continue;
      }
      if (!entry.isFile()) continue;
      out.push(relative(root, path).split(sep).join('/'));
    }
  }
}

export function harvestTodos(
  root: string,
  warn: (line: string) => void = () => {},
): TodoCandidate[] {
  const files = gitListFiles(root) ?? walkFiles(root);
  const out: TodoCandidate[] = [];
  let skippedLarge = 0;

  for (const file of files) {
    const path = join(root, file);
    let size: number;
    try {
      const stat = statSync(path);
      if (!stat.isFile()) continue; // symlink to dir etc.
      size = stat.size;
    } catch {
      continue; // git lists it, the worktree no longer has it
    }
    if (size > MAX_FILE_BYTES) {
      skippedLarge += 1;
      continue;
    }
    let bytes: Buffer;
    try {
      bytes = readFileSync(path);
    } catch {
      continue; // unreadable (permissions, race) — skip, don't abort the scan
    }
    if (bytes.includes(0)) continue; // NUL byte: treat as binary, skip
    out.push(...scanContentForTodos(bytes.toString('utf8'), file));
  }

  if (skippedLarge > 0) {
    warn(
      `skipped ${skippedLarge} file(s) over ${MAX_FILE_BYTES / (1024 * 1024)} MiB — not hand-written source`,
    );
  }
  return out;
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
