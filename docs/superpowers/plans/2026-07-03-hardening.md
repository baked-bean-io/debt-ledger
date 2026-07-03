# Tech Debt Tracker — Team Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ledger safe for parallel team use: UUID item ids (cross-branch collision-proof), a `techdebt doctor` command (diagnose + repair: bad JSON, merge-conflict markers, duplicate ids, non-canonical formatting), and a plain-language merge-conflict recipe in the README.

**Architecture:** `mintId` in core switches from 4-char base36 suffixes to `td-<uuid>` via `node:crypto`'s `randomUUID` (a node builtin — core's zero-npm-dependency rule holds), with an injectable generator replacing the injectable RNG. Old short ids remain valid forever (the schema only requires a non-empty string), so existing ledgers are untouched. Doctor's pure logic (`diagnose`/`repair`) lives in `packages/cli/src/doctor-core.ts` (same placement precedent as `triage-core.ts`); the command is a thin wrapper. Both committed bundles (action, plugin) are rebuilt in whichever task changes code under them — the CI drift guard demands it.

**Tech Stack:** unchanged. No new dependencies.

## Global Constraints

- All prior global constraints bind (ESM `.js` imports, canonical writes through `serializeLedger` only, commit trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`, LF, plain-language README register).
- New id format: `td-` + lowercase UUID v4 (`/^td-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/`). Schema validation unchanged — old `td-xxxx` ids stay valid.
- `mintId(existing, generate?)` — second parameter is now `generate?: () => string` (was `random?: () => number`); the collision-retry loop stays. `buildItem`'s fourth parameter changes to match.
- Doctor is read-only without `--fix`; with `--fix` it repairs ONLY what needs no human judgment (re-mint duplicate ids, rewrite canonical form) and refuses (exit 1, clear message) on unparseable JSON, conflict markers, or invalid fields.
- Every task ends with `yarn vitest run` + `yarn build` and commits any regenerated bundle files (`action/dist/index.cjs`, `plugin/skills/techdebt/bin/techdebt.cjs`) alongside the source.

---

### Task 1: UUID ids in core + ripples

**Files:**
- Modify: `packages/core/src/id.ts`, `packages/core/test/id.test.ts`
- Modify: `packages/cli/src/triage-core.ts` (buildItem 4th param), `packages/cli/src/format.ts` (dynamic id column width)
- Modify: `packages/cli/test/add.test.ts`, `packages/cli/test/triage-core.test.ts` (id-shape regexes)
- Regenerated: both committed bundles

**Interfaces:**
- `mintId(existing: Set<string>, generate: () => string = () => \`td-${randomUUID()}\`): string`
- `buildItem(answers, existingIds, today, generate?: () => string)` — passes `generate` through to `mintId`.
- `formatReport` sizes the id column to the longest id present (min 2) instead of `padEnd(8)`.

- [ ] **Step 1: Rewrite the id tests (failing first)**

Replace the body of `packages/core/test/id.test.ts` with:

```ts
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
```

Run: `yarn vitest run packages/core/test/id.test.ts` — expect FAIL (old base36 implementation).

- [ ] **Step 2: Implement**

Replace `packages/core/src/id.ts` with:

```ts
import { randomUUID } from 'node:crypto';

// UUID ids: two branches minting items independently can never collide on
// merge (the old 4-char suffixes could, and a duplicated id makes the merged
// ledger unreadable). Old short ids remain valid — the schema only requires
// a non-empty string.
export function mintId(
  existing: Set<string>,
  generate: () => string = () => `td-${randomUUID()}`,
): string {
  for (;;) {
    const id = generate();
    if (!existing.has(id)) return id;
  }
}
```

In `packages/cli/src/triage-core.ts`, `buildItem`'s signature line

```ts
  random?: () => number,
```

becomes

```ts
  generate?: () => string,
```

and its `mintId(existingIds, random)` call becomes `mintId(existingIds, generate)`.

In `packages/cli/src/format.ts`, replace the header line and the id cell:

```ts
  const idWidth = Math.max(2, ...ranked.map((r) => r.item.id.length));
  const lines: string[] = [`rank  score   ${'id'.padEnd(idWidth)}  status   e/i  title`];
```

and in the row template, `item.id.padEnd(8)` → `item.id.padEnd(idWidth)`.

Test regex updates: in `packages/cli/test/add.test.ts` and `packages/cli/test/triage-core.test.ts`, every `toMatch(/^td-[0-9a-z]{4}$/)` becomes `toMatch(/^td-[0-9a-f-]{36}$/)`.

- [ ] **Step 3: Verify and commit (bundles ride along)**

```bash
yarn vitest run   # expect 138 passing (same count — tests rewritten, not added)
yarn build        # regenerates action/dist/index.cjs and plugin bundle
git status --short  # both bundles show modified
git add packages/core packages/cli action/dist plugin/skills/techdebt/bin
git commit -m "feat(core): UUID item ids — cross-branch collision-proof minting

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: techdebt doctor

**Files:**
- Create: `packages/cli/src/doctor-core.ts`, `packages/cli/src/commands/doctor.ts`
- Modify: `packages/cli/src/index.ts` (wire `doctor` below `suggest`)
- Test: `packages/cli/test/doctor.test.ts`
- Regenerated: both committed bundles

**Interfaces:**
- `diagnose(raw: string): Diagnosis` where `Diagnosis = { ok, conflictMarkers, parseError?, shapeError?, itemErrors: string[], duplicateIds: string[], canonical: boolean }`. `conflictMarkers` is only meaningful alongside `parseError` (markers make JSON unparseable; the check is `/^(<{7} |={7}$|>{7} )/m`).
- `repair(raw: string, generate?: () => string): { ledger: Ledger; remapped: Array<{ from: string; to: string }> }` — re-mints duplicate ids (first occurrence keeps its id); throws with a human-readable message on parse errors (with a conflict-marker hint), shape errors, or invalid fields.
- `runDoctor(root: string, opts: { fix: boolean }, io?: { out; err }): void` — missing ledger → friendly no-op; `ok` → `ledger OK (N item(s))`; problems → each reported on stderr, exit code 1; `--fix` → repair + canonical rewrite via `writeLedger`, printing each `re-minted duplicate: <from> -> <to>`.

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/test/doctor.test.ts`:

```ts
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { LEDGER_PATH, readLedger, serializeLedger, writeLedger } from '@techdebt/core';
import { runDoctor } from '../src/commands/doctor.js';
import { diagnose, repair } from '../src/doctor-core.js';
import { makeItem } from './helpers.js';

const canonical = serializeLedger({ version: 1, items: [makeItem()] });

afterEach(() => {
  process.exitCode = undefined;
});

describe('diagnose', () => {
  test('canonical valid ledger is ok', () => {
    expect(diagnose(canonical)).toMatchObject({ ok: true, canonical: true, duplicateIds: [] });
  });

  test('flags unresolved merge conflict markers', () => {
    const conflicted = `<<<<<<< HEAD\n${canonical}=======\n${canonical}>>>>>>> theirs\n`;
    const d = diagnose(conflicted);
    expect(d.ok).toBe(false);
    expect(d.parseError).toBeTruthy();
    expect(d.conflictMarkers).toBe(true);
  });

  test('flags duplicate ids', () => {
    const dup = serializeLedger({ version: 1, items: [makeItem(), makeItem()] });
    const d = diagnose(dup);
    expect(d.duplicateIds).toEqual(['td-0001']);
    expect(d.ok).toBe(false);
  });

  test('flags non-canonical formatting', () => {
    const sloppy = `${canonical}\n\n`;
    const d = diagnose(sloppy);
    expect(d.canonical).toBe(false);
    expect(d.ok).toBe(false);
  });

  test('flags invalid fields per item', () => {
    const bad = JSON.stringify({ version: 1, items: [{ ...makeItem(), rationale: '' }] });
    const d = diagnose(bad);
    expect(d.itemErrors[0]).toContain('items[0]');
  });
});

describe('repair', () => {
  test('re-mints later duplicates, keeps the first', () => {
    const dup = serializeLedger({
      version: 1,
      items: [makeItem({ title: 'first' }), makeItem({ title: 'second' })],
    });
    const { ledger, remapped } = repair(dup, () => 'td-fresh');
    expect(remapped).toEqual([{ from: 'td-0001', to: 'td-fresh' }]);
    expect(ledger.items.find((i) => i.title === 'first')!.id).toBe('td-0001');
    expect(ledger.items.find((i) => i.title === 'second')!.id).toBe('td-fresh');
  });

  test('refuses unparseable input with a conflict-marker hint', () => {
    expect(() => repair('<<<<<<< HEAD\n{')).toThrow(/conflict markers/);
  });

  test('refuses invalid fields', () => {
    const bad = JSON.stringify({ version: 1, items: [{ ...makeItem(), rationale: '' }] });
    expect(() => repair(bad)).toThrow(/cannot repair/);
  });
});

describe('runDoctor', () => {
  function capture() {
    const out: string[] = [];
    const err: string[] = [];
    return { io: { out: (s: string) => out.push(s), err: (s: string) => err.push(s) }, out, err };
  }

  test('healthy ledger reports OK, exit code untouched', () => {
    const root = mkdtempSync(join(tmpdir(), 'techdebt-doctor-'));
    writeLedger(root, { version: 1, items: [makeItem()] });
    const { io, out } = capture();
    runDoctor(root, { fix: false }, io);
    expect(out.join('\n')).toContain('ledger OK (1 item(s))');
    expect(process.exitCode).toBeUndefined();
  });

  test('duplicate ids: reported without --fix (exit 1), repaired with --fix', () => {
    const root = mkdtempSync(join(tmpdir(), 'techdebt-doctor-dup-'));
    writeFileSync(
      join(root, LEDGER_PATH).replace('items.json', ''),
      '',
      { flag: 'a' },
    ); // ensure parent exists via writeLedger instead:
    writeLedger(root, { version: 1, items: [makeItem()] });
    writeFileSync(
      join(root, LEDGER_PATH),
      serializeLedger({ version: 1, items: [makeItem({ title: 'a' }), makeItem({ title: 'b' })] }),
    );

    const first = capture();
    runDoctor(root, { fix: false }, first.io);
    expect(first.err.join('\n')).toContain('duplicate id: td-0001');
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;

    const second = capture();
    runDoctor(root, { fix: true }, second.io);
    expect(second.out.join('\n')).toContain('re-minted duplicate: td-0001 ->');
    const healed = readLedger(root); // parses ⇒ duplicates gone, canonical bytes
    expect(healed.items).toHaveLength(2);
    expect(new Set(healed.items.map((i) => i.id)).size).toBe(2);
  });

  test('missing ledger is a friendly no-op', () => {
    const root = mkdtempSync(join(tmpdir(), 'techdebt-doctor-none-'));
    const { io, out } = capture();
    runDoctor(root, { fix: false }, io);
    expect(out.join('\n')).toContain('nothing to check');
    expect(process.exitCode).toBeUndefined();
  });
});
```

Run: `yarn vitest run packages/cli/test/doctor.test.ts` — expect FAIL (modules missing).

- [ ] **Step 2: Implement doctor-core.ts**

Create `packages/cli/src/doctor-core.ts`:

```ts
import {
  mintId,
  SCHEMA_VERSION,
  serializeLedger,
  validateItem,
  type DebtItem,
  type Ledger,
} from '@techdebt/core';

export interface Diagnosis {
  ok: boolean;
  conflictMarkers: boolean;
  parseError?: string;
  shapeError?: string;
  itemErrors: string[];
  duplicateIds: string[];
  canonical: boolean;
}

const CONFLICT_MARKER = /^(<{7} |={7}$|>{7} )/m;

export function diagnose(raw: string): Diagnosis {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      conflictMarkers: CONFLICT_MARKER.test(raw),
      parseError: error instanceof Error ? error.message : String(error),
      itemErrors: [],
      duplicateIds: [],
      canonical: false,
    };
  }

  const d = data as { version?: unknown; items?: unknown };
  if (typeof data !== 'object' || data === null || d.version !== SCHEMA_VERSION || !Array.isArray(d.items)) {
    return {
      ok: false,
      conflictMarkers: false,
      shapeError: `expected { "version": ${SCHEMA_VERSION}, "items": [...] }`,
      itemErrors: [],
      duplicateIds: [],
      canonical: false,
    };
  }

  const items = d.items as DebtItem[];
  const itemErrors: string[] = [];
  items.forEach((item, i) => {
    for (const e of validateItem(item)) itemErrors.push(`items[${i}]: ${e}`);
  });

  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  for (const item of items) {
    const id = (item as { id?: unknown }).id;
    if (typeof id !== 'string') continue;
    if (seen.has(id) && !duplicateIds.includes(id)) duplicateIds.push(id);
    seen.add(id);
  }

  const canonical = raw === serializeLedger({ version: SCHEMA_VERSION, items });

  return {
    ok: itemErrors.length === 0 && duplicateIds.length === 0 && canonical,
    conflictMarkers: false,
    itemErrors,
    duplicateIds,
    canonical,
  };
}

export interface Repair {
  ledger: Ledger;
  remapped: Array<{ from: string; to: string }>;
}

// Fixes only what needs no human judgment: later duplicates get fresh ids
// (the first occurrence keeps its id), and the caller rewrites canonically.
export function repair(raw: string, generate?: () => string): Repair {
  const diagnosis = diagnose(raw);
  if (diagnosis.parseError) {
    throw new Error(
      diagnosis.conflictMarkers
        ? 'the ledger still contains merge conflict markers — edit the file, keep both versions of the items, then re-run doctor --fix'
        : `cannot repair: the ledger is not valid JSON (${diagnosis.parseError})`,
    );
  }
  if (diagnosis.shapeError) {
    throw new Error(`cannot repair: ${diagnosis.shapeError}`);
  }
  if (diagnosis.itemErrors.length > 0) {
    throw new Error(
      `cannot repair invalid fields automatically — fix these by hand:\n${diagnosis.itemErrors.join('\n')}`,
    );
  }

  const { items } = JSON.parse(raw) as Ledger;
  const all = new Set(items.map((i) => i.id));
  const seen = new Set<string>();
  const remapped: Array<{ from: string; to: string }> = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      const to = mintId(all, generate);
      remapped.push({ from: item.id, to });
      item.id = to;
      all.add(to);
    }
    seen.add(item.id);
  }
  return { ledger: { version: SCHEMA_VERSION, items }, remapped };
}
```

- [ ] **Step 3: Implement the command and wire it**

Create `packages/cli/src/commands/doctor.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEDGER_PATH, writeLedger } from '@techdebt/core';
import { diagnose, repair } from '../doctor-core.js';

export interface DoctorIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

const consoleIo: DoctorIo = {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
};

export function runDoctor(root: string, opts: { fix: boolean }, io: DoctorIo = consoleIo): void {
  const path = join(root, LEDGER_PATH);
  if (!existsSync(path)) {
    io.out(`no ledger at ${LEDGER_PATH} — nothing to check`);
    return;
  }
  const raw = readFileSync(path, 'utf8');
  const d = diagnose(raw);

  if (d.ok) {
    const count = (JSON.parse(raw) as { items: unknown[] }).items.length;
    io.out(`ledger OK (${count} item(s))`);
    return;
  }

  if (d.parseError) {
    io.err(
      d.conflictMarkers
        ? 'unresolved merge conflict markers in the ledger — edit the file, keep both versions of the items, then run doctor --fix'
        : `ledger is not valid JSON: ${d.parseError}`,
    );
    process.exitCode = 1;
    return;
  }
  if (d.shapeError) {
    io.err(`ledger has the wrong shape: ${d.shapeError}`);
    process.exitCode = 1;
    return;
  }

  for (const e of d.itemErrors) io.err(`invalid item: ${e}`);
  for (const id of d.duplicateIds) {
    io.err(`duplicate id: ${id}${opts.fix ? '' : ' (doctor --fix will re-mint one)'}`);
  }
  if (!d.canonical) {
    io.err(`file is not in canonical form${opts.fix ? '' : ' (doctor --fix will rewrite it)'}`);
  }

  if (!opts.fix) {
    process.exitCode = 1;
    return;
  }
  if (d.itemErrors.length > 0) {
    io.err('cannot fix invalid fields automatically — edit the reported items, then re-run');
    process.exitCode = 1;
    return;
  }

  const { ledger, remapped } = repair(raw);
  writeLedger(root, ledger);
  for (const r of remapped) io.out(`re-minted duplicate: ${r.from} -> ${r.to}`);
  io.out(`ledger repaired and rewritten canonically (${ledger.items.length} item(s))`);
}
```

In `packages/cli/src/index.ts`: add `import { runDoctor } from './commands/doctor.js';` with the other command imports, and register below `suggest` (before `program.parseAsync`):

```ts
program
  .command('doctor')
  .description('Check the ledger for problems (bad JSON, duplicate ids, formatting); --fix repairs what is safe')
  .option('--fix', 'repair duplicates and formatting, rewrite the file canonically')
  .action((opts: { fix?: boolean }) => {
    runDoctor(process.cwd(), { fix: Boolean(opts.fix) });
  });
```

- [ ] **Step 4: Verify and commit**

```bash
yarn vitest run   # expect 149 passing (138 + 11 new)
yarn build
git add packages/cli action/dist plugin/skills/techdebt/bin
git commit -m "feat(cli): doctor — diagnose and repair the ledger after merges

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(If the bundles show no diff after build — possible since doctor only adds CLI code, which both bundles include — commit whatever `git status` actually shows and say so.)

---

### Task 3: Docs — merge recipe, skill housekeeping, DESIGN record

**Files:**
- Modify: `README.md`, `plugin/skills/techdebt/SKILL.md`, `DESIGN.md`
- Regenerated: plugin bundle unchanged (SKILL.md is not bundled) — but run the build anyway to prove no drift.

- [ ] **Step 1: README — merge-conflict recipe**

Insert after the "## A nudge before you push (optional)" section (before "## How the ranking works, in plain words"):

```markdown
## If two branches change the debt list at once (merge conflicts)

This is rare — the list only changes when someone records or updates an item,
and the file is formatted so every item sits in its own tidy block. But when
two branches both touch `.techdebt/items.json`, git may ask you to resolve a
conflict. Here's the whole recipe:

1. Open `.techdebt/items.json`, delete git's conflict markers (`<<<<<<<`,
   `=======`, `>>>>>>>`), and **keep both versions of the items**. This is
   the one situation where editing the file by hand is exactly right.
2. Run `techdebt doctor --fix`. It checks the whole file, gives any
   accidentally duplicated id a fresh one, and restores the standard
   formatting.
3. Commit. Done.

`techdebt doctor` (without `--fix`) is also safe to run any time you just
want to check the ledger's health — it changes nothing.
```

- [ ] **Step 2: Skill housekeeping bullet**

In `plugin/skills/techdebt/SKILL.md`, append to the "## Housekeeping" list:

```markdown
- If any techdebt command reports the ledger is unreadable or has duplicate
  ids (typically right after a git merge), run `techdebt doctor` to see
  what's wrong and `techdebt doctor --fix` to repair it. Doctor without
  `--fix` never changes anything.
```

- [ ] **Step 3: DESIGN record**

Append a new section to `DESIGN.md` after "### Skill decisions (2026-07-02)":

```markdown
### Team-hardening decisions (2026-07-03)

- **UUID item ids.** Two branches minting items independently could collide
  on the old 4-char ids, and a duplicated id makes the merged ledger
  unreadable. Ids are now `td-<uuid4>`; old short ids stay valid (schema
  requires only a non-empty string). The report's id column sizes itself.
- **`techdebt doctor [--fix]`.** Post-merge repair path: detects unresolved
  conflict markers, duplicate ids, invalid fields, and non-canonical
  formatting; `--fix` re-mints later duplicates and rewrites canonically,
  and refuses anything requiring human judgment. Hand-editing the ledger is
  sanctioned in exactly one case: resolving a git merge conflict, followed
  by `doctor --fix`.
- Single-file ledger retained (Q4 stands) — with low write rates, canonical
  formatting, and doctor, file-per-item remains deferred until a team
  actually feels the pain.
```

- [ ] **Step 4: Verify and commit**

```bash
yarn vitest run   # 149 passing
yarn build && git status --short   # docs only — no bundle drift expected
git add README.md plugin/skills/techdebt/SKILL.md DESIGN.md
git commit -m "docs: merge-conflict recipe, doctor housekeeping, hardening decisions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Coverage vs the user's asks:** UUID ids (Task 1, exactly "use uuid instead"), conflict recipe in README (Task 3), doctor (Task 2, wired into the recipe and the skill).
**Placeholder scan:** none — full code and doc text throughout.
**Type consistency:** `mintId`'s new `generate` signature ripples only into `buildItem` (updated in Task 1); `diagnose`/`repair`/`runDoctor` names match between doctor-core, the command, and the tests; `LEDGER_PATH`, `serializeLedger`, `validateItem`, `writeLedger`, `readLedger`, `SCHEMA_VERSION`, `mintId` all exist in core's barrel.
**Compatibility:** old ids valid (no schema change, no migration); `td-a4f2`-style examples in docs remain illustrative and true.
**Known deferrals:** file-per-item ledger (explicitly re-affirmed as deferred); doctor does not check stale locations (scan already does).
