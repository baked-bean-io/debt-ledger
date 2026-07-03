import { describe, expect, test } from 'vitest';
import { validateItem } from '@debt-ledger/core';
import { applyRevisit, buildItem, parseCandidates, parseConfirmedItems, type TriageAnswers } from '../src/triage-core.js';
import { makeItem } from './helpers.js';

const answers: TriageAnswers = {
  title: 'untangle auth session handling',
  location: ['src/auth/session.ts'],
  detectedBy: 'static-analysis',
  category: 'design',
  effort: 3,
  impact: 5,
  interestRate: 0.5,
  rationale: 'every new endpoint copies the session hack',
  blocksWork: [],
};

describe('parseCandidates', () => {
  test('parses valid scan --json output', () => {
    const json = JSON.stringify([
      { title: 'TODO: x (a.ts:1)', location: ['a.ts'], detectedBy: 'static-analysis' },
    ]);
    expect(parseCandidates(json)).toHaveLength(1);
  });

  test.each([
    ['not json', '{oops'],
    ['not an array', '{}'],
    ['missing fields', '[{"title": "x"}]'],
    ['bad detectedBy', '[{"title": "x", "location": ["a.ts"], "detectedBy": "magic"}]'],
  ])('rejects %s', (_name, json) => {
    expect(() => parseCandidates(json)).toThrow();
  });
});

describe('buildItem', () => {
  test('produces a schema-valid open item stamped today', () => {
    const item = buildItem(answers, new Set(), '2026-07-02');
    expect(validateItem(item)).toEqual([]);
    expect(item.status).toBe('open');
    expect(item.firstSeen).toBe('2026-07-02');
    expect(item.lastSeen).toBe('2026-07-02');
    expect(item.id).toMatch(/^td-[0-9a-f-]{36}$/);
  });

  test('omits blocksWork entirely when empty', () => {
    const item = buildItem(answers, new Set(), '2026-07-02');
    expect('blocksWork' in item).toBe(false);
  });

  test('includes blocksWork when provided', () => {
    const item = buildItem({ ...answers, blocksWork: ['STRAT-14'] }, new Set(), '2026-07-02');
    expect(item.blocksWork).toEqual(['STRAT-14']);
  });

  test('avoids existing ids', () => {
    const existing = new Set(['td-0001']);
    const item = buildItem(answers, existing, '2026-07-02');
    expect(existing.has(item.id)).toBe(false);
  });
});

describe('applyRevisit', () => {
  test('preserves id, firstSeen, detectedBy; updates estimates and lastSeen', () => {
    const original = makeItem({ id: 'td-keep', firstSeen: '2026-01-01', detectedBy: 'llm' });
    const updated = applyRevisit(original, { ...answers, impact: 8 }, 'planned', '2026-07-02');
    expect(updated.id).toBe('td-keep');
    expect(updated.firstSeen).toBe('2026-01-01');
    expect(updated.detectedBy).toBe('llm');
    expect(updated.impact).toBe(8);
    expect(updated.status).toBe('planned');
    expect(updated.lastSeen).toBe('2026-07-02');
    expect(validateItem(updated)).toEqual([]);
  });

  test('drops blocksWork when the revisit clears it', () => {
    const original = makeItem({ blocksWork: ['STRAT-14'] });
    const updated = applyRevisit(original, answers, 'open', '2026-07-02');
    expect('blocksWork' in updated).toBe(false);
  });
});

describe('parseConfirmedItems', () => {
  const valid = {
    title: 'untangle auth session handling',
    location: ['src/auth/session.ts'],
    detectedBy: 'llm',
    category: 'design',
    effort: 3,
    impact: 5,
    interestRate: 0.5,
    rationale: 'every new endpoint copies the session hack',
  };

  test('parses a valid confirmed item (blocksWork optional)', () => {
    const [parsed] = parseConfirmedItems(JSON.stringify([valid]));
    expect(parsed!.title).toBe(valid.title);
    expect(parsed!.blocksWork).toEqual([]);
  });

  test('carries blocksWork through when present', () => {
    const [parsed] = parseConfirmedItems(
      JSON.stringify([{ ...valid, blocksWork: ['STRAT-14'] }]),
    );
    expect(parsed!.blocksWork).toEqual(['STRAT-14']);
  });

  test.each([
    ['not an array', JSON.stringify(valid)],
    ['invalid JSON', '{oops'],
    ['missing rationale', JSON.stringify([{ ...valid, rationale: '' }])],
    ['interestRate out of range', JSON.stringify([{ ...valid, interestRate: 1.5 }])],
    ['missing interestRate', JSON.stringify([(({ interestRate, ...rest }) => rest)(valid)])],
    ['non-fibonacci effort', JSON.stringify([{ ...valid, effort: 4 }])],
    ['bad category', JSON.stringify([{ ...valid, category: 'vibes' }])],
    ['empty location', JSON.stringify([{ ...valid, location: [] }])],
    ['non-string location entries', JSON.stringify([{ ...valid, location: [null] }])],
  ])('rejects %s', (_name, json) => {
    expect(() => parseConfirmedItems(json)).toThrow();
  });

  test('error names the offending index', () => {
    const bad = [{ ...valid }, { ...valid, rationale: '' }];
    expect(() => parseConfirmedItems(JSON.stringify(bad))).toThrow(/item\[1\]/);
  });
});
