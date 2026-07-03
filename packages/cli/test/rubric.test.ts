import { describe, expect, test } from 'vitest';
import { POINTS } from '@debt-ledger/core';
import { runRubric } from '../src/commands/rubric.js';

function capture() {
  const out: string[] = [];
  return { io: { out: (s: string) => out.push(s) }, out };
}

describe('runRubric', () => {
  test('--json emits all three anchor sets, parseable', () => {
    const { io, out } = capture();
    runRubric({ json: true }, io);
    const rubric = JSON.parse(out.join('\n'));
    for (const p of POINTS) {
      expect(rubric.effort[String(p)]).toBeTruthy();
      expect(rubric.impact[String(p)]).toBeTruthy();
    }
    expect(rubric.interestRate.map(([v]: [number, string]) => v)).toEqual([0, 0.2, 0.5, 0.8]);
  });

  test('human mode lists every point value with its anchor', () => {
    const { io, out } = capture();
    runRubric({ json: false }, io);
    const text = out.join('\n');
    for (const p of POINTS) expect(text).toContain(`${p} — `);
    expect(text).toContain('interestRate');
    expect(text).toContain('0.8');
  });
});
