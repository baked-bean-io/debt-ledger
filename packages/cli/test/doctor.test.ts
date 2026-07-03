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
