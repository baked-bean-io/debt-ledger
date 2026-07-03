import {
  DETECTORS,
  mintId,
  validateItem,
  type Category,
  type DebtItem,
  type DetectedBy,
  type Points,
  type Status,
} from '@techdebt/core';
import type { Candidate } from './todo-scan.js';

export function parseCandidates(json: string): Candidate[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('candidates file is not valid JSON');
  }
  if (!Array.isArray(data)) {
    throw new Error('candidates file must be a JSON array (produced by `debt scan --json`)');
  }
  return data.map((c, i) => {
    const v = (c ?? {}) as Record<string, unknown>;
    if (
      typeof v.title !== 'string' ||
      v.title.length === 0 ||
      !Array.isArray(v.location) ||
      !v.location.every((l) => typeof l === 'string') ||
      !DETECTORS.includes(v.detectedBy as DetectedBy)
    ) {
      throw new Error(`candidate[${i}]: needs title (string), location (string[]), detectedBy (${DETECTORS.join('|')})`);
    }
    return {
      title: v.title,
      location: v.location as string[],
      detectedBy: v.detectedBy as DetectedBy,
    };
  });
}

export interface TriageAnswers {
  title: string;
  location: string[];
  detectedBy: DetectedBy;
  category: Category;
  effort: Points;
  impact: Points;
  interestRate: number;
  rationale: string;
  blocksWork: string[];
}

export function buildItem(
  answers: TriageAnswers,
  existingIds: Set<string>,
  today: string,
  generate?: () => string,
): DebtItem {
  return {
    id: mintId(existingIds, generate),
    title: answers.title,
    location: answers.location,
    category: answers.category,
    detectedBy: answers.detectedBy,
    effort: answers.effort,
    impact: answers.impact,
    interestRate: answers.interestRate,
    rationale: answers.rationale,
    ...(answers.blocksWork.length > 0 ? { blocksWork: answers.blocksWork } : {}),
    firstSeen: today,
    lastSeen: today,
    status: 'open',
  };
}

export function applyRevisit(
  item: DebtItem,
  answers: TriageAnswers,
  status: Status,
  today: string,
): DebtItem {
  return {
    id: item.id,
    title: answers.title,
    location: answers.location,
    category: answers.category,
    detectedBy: item.detectedBy,
    effort: answers.effort,
    impact: answers.impact,
    interestRate: answers.interestRate,
    rationale: answers.rationale,
    ...(answers.blocksWork.length > 0 ? { blocksWork: answers.blocksWork } : {}),
    firstSeen: item.firstSeen,
    lastSeen: today,
    status,
  };
}

// Parses the confirmed-items JSON the skill hands to `debt add`. The
// human gate already happened in conversation; this is the machine check
// that what was confirmed is schema-valid. Validation delegates to core
// validateItem via a probe item so the rules live in exactly one place.
export function parseConfirmedItems(json: string): TriageAnswers[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('confirmed-items input is not valid JSON');
  }
  if (!Array.isArray(data)) {
    throw new Error('confirmed-items input must be a JSON array');
  }
  return data.map((raw, i) => {
    const v = (raw ?? {}) as Record<string, unknown>;
    const answers: TriageAnswers = {
      title: typeof v.title === 'string' ? v.title : '',
      location:
        Array.isArray(v.location) && v.location.every((l) => typeof l === 'string')
          ? (v.location as string[])
          : [],
      detectedBy: v.detectedBy as DetectedBy,
      category: v.category as Category,
      effort: v.effort as Points,
      impact: v.impact as Points,
      interestRate: typeof v.interestRate === 'number' ? v.interestRate : NaN,
      rationale: typeof v.rationale === 'string' ? v.rationale : '',
      blocksWork: Array.isArray(v.blocksWork) ? v.blocksWork.map(String) : [],
    };
    const probe = buildItem(answers, new Set(), '2000-01-01');
    const errors = validateItem(probe);
    if (errors.length > 0) throw new Error(`item[${i}]: ${errors.join('; ')}`);
    return answers;
  });
}
