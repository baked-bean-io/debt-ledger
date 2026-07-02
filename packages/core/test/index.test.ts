import { describe, expect, test } from 'vitest';
import {
  EFFORT_ANCHORS,
  findStaleItems,
  IMPACT_ANCHORS,
  INTEREST_ANCHORS,
  matchChangedFiles,
  mintId,
  parseLedger,
  POINTS,
  rank,
  readLedger,
  serializeLedger,
  validateItem,
  writeLedger,
} from '../src/index.js';

describe('public barrel', () => {
  test('re-exports every module', () => {
    for (const fn of [
      findStaleItems, matchChangedFiles, mintId, parseLedger,
      rank, readLedger, serializeLedger, validateItem, writeLedger,
    ]) {
      expect(typeof fn).toBe('function');
    }
  });
});

describe('rubric', () => {
  test('effort and impact anchors cover every point value', () => {
    for (const p of POINTS) {
      expect(EFFORT_ANCHORS[p]).toBeTruthy();
      expect(IMPACT_ANCHORS[p]).toBeTruthy();
    }
  });

  test('interest anchors are ascending in [0, 1]', () => {
    const values = INTEREST_ANCHORS.map(([v]) => v);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(values[0]).toBeGreaterThanOrEqual(0);
    expect(values[values.length - 1]!).toBeLessThanOrEqual(1);
  });
});
