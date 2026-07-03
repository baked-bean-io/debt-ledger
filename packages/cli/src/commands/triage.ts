import { readFileSync } from 'node:fs';
import * as p from '@clack/prompts';
import {
  CATEGORIES,
  EFFORT_ANCHORS,
  IMPACT_ANCHORS,
  INTEREST_ANCHORS,
  matchChangedFiles,
  POINTS,
  readLedger,
  STATUSES,
  writeLedger,
  type Category,
  type DebtItem,
  type DetectedBy,
  type Points,
  type Status,
} from '@techdebt/core';
import type { Candidate } from '../todo-scan.js';
import { applyRevisit, buildItem, parseCandidates, type TriageAnswers } from '../triage-core.js';
import { todayIso } from '../today.js';

function checked<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Triage aborted; no further changes will be written.');
    process.exit(0);
  }
  return value as T;
}

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function promptAnswers(
  init: { title: string; location: string[]; detectedBy: DetectedBy },
  current?: DebtItem,
): Promise<TriageAnswers> {
  const title = checked(
    await p.text({
      message: 'Title',
      initialValue: init.title,
      validate: (v) => (v.trim() ? undefined : 'title is required'),
    }),
  );
  const locationRaw = checked(
    await p.text({
      message: 'Locations (comma-separated repo-relative file paths)',
      initialValue: init.location.join(', '),
      validate: (v) => (splitList(v).length > 0 ? undefined : 'at least one path is required'),
    }),
  );
  const category = checked(
    await p.select<Category>({
      message: 'Category',
      options: CATEGORIES.map((c) => ({ value: c, label: c })),
      initialValue: current?.category,
    }),
  );
  const effort = checked(
    await p.select<Points>({
      message: 'Effort',
      options: POINTS.map((n) => ({ value: n, label: `${n} — ${EFFORT_ANCHORS[n]}` })),
      initialValue: current?.effort,
    }),
  );
  const impact = checked(
    await p.select<Points>({
      message: 'Impact (blast radius if unfixed)',
      options: POINTS.map((n) => ({ value: n, label: `${n} — ${IMPACT_ANCHORS[n]}` })),
      initialValue: current?.impact,
    }),
  );
  const interestRate = checked(
    await p.select<number>({
      message: 'Interest rate (how fast it compounds)',
      options: INTEREST_ANCHORS.map(([value, label]) => ({ value, label: `${value} — ${label}` })),
      initialValue: current?.interestRate,
    }),
  );
  const rationale = checked(
    await p.text({
      message: 'Rationale — why these estimates (required, frozen into the ledger)',
      initialValue: current?.rationale ?? '',
      validate: (v) => (v.trim() ? undefined : 'rationale is required'),
    }),
  );
  const blocksRaw = checked(
    await p.text({
      message: 'Blocks work (comma-separated ticket ids, empty for none)',
      initialValue: current?.blocksWork?.join(', ') ?? '',
      defaultValue: '',
    }),
  );
  return {
    title: title.trim(),
    location: splitList(locationRaw),
    detectedBy: init.detectedBy,
    category,
    effort,
    impact,
    interestRate,
    rationale: rationale.trim(),
    blocksWork: splitList(blocksRaw),
  };
}

export async function runTriage(
  root: string,
  opts: { candidatesFile?: string; revisitId?: string },
): Promise<void> {
  const ledger = readLedger(root);
  p.intro('debt triage');

  if (opts.revisitId) {
    const item = ledger.items.find((i) => i.id === opts.revisitId);
    if (!item) {
      p.cancel(`no item with id ${opts.revisitId} in the ledger`);
      process.exitCode = 1;
      return;
    }
    const answers = await promptAnswers(
      { title: item.title, location: item.location, detectedBy: item.detectedBy },
      item,
    );
    const status = checked(
      await p.select<Status>({
        message: 'Status',
        options: STATUSES.map((s) => ({ value: s, label: s })),
        initialValue: item.status,
      }),
    );
    const updated = applyRevisit(item, answers, status, todayIso());
    ledger.items = ledger.items.map((i) => (i.id === item.id ? updated : i));
    writeLedger(root, ledger);
    p.outro(`updated ${item.id}`);
    return;
  }

  const candidates: Candidate[] = opts.candidatesFile
    ? parseCandidates(readFileSync(opts.candidatesFile, 'utf8'))
    : [{ title: '', location: [], detectedBy: 'human' }];

  const existingIds = new Set(ledger.items.map((i) => i.id));
  let added = 0;

  for (const candidate of candidates) {
    p.log.step(candidate.title || 'manual entry');

    const duplicates = matchChangedFiles(candidate.location, ledger.items);
    for (const d of duplicates) {
      p.log.warn(`possible duplicate: ${d.item.id} "${d.item.title}" already covers ${d.files.join(', ')}`);
    }

    const proceed = checked(
      await p.confirm({ message: 'Triage this into the ledger?', initialValue: true }),
    );
    if (!proceed) continue;

    const answers = await promptAnswers(candidate);
    const item = buildItem(answers, existingIds, todayIso());
    existingIds.add(item.id);
    ledger.items.push(item);
    writeLedger(root, ledger); // save incrementally: Ctrl-C never loses confirmed items
    added += 1;
    p.log.success(`added ${item.id}`);
  }

  p.outro(`${added} item(s) added to .techdebt/items.json`);
}
