import {
  DETECTORS,
  mintId,
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
    throw new Error('candidates file must be a JSON array (produced by `techdebt scan --json`)');
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
  random?: () => number,
): DebtItem {
  return {
    id: mintId(existingIds, random),
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
