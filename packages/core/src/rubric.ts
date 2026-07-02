import type { Points } from './schema.js';

export const EFFORT_ANCHORS: Record<Points, string> = {
  1: 'under an hour',
  2: 'about half a day',
  3: 'a day or two',
  5: 'about a week',
  8: 'needs to be broken down before anyone touches it',
};

export const IMPACT_ANCHORS: Record<Points, string> = {
  1: 'annoys one person in one file',
  2: 'regular friction for anyone working nearby',
  3: 'slows most work in this module',
  5: 'distorts designs beyond its module / recurring source of bugs',
  8: 'company-scale: data loss, security, or "we cannot ship X until this dies"',
};

export const INTEREST_ANCHORS: ReadonlyArray<readonly [number, string]> = [
  [0, 'static — ugly but inert'],
  [0.2, 'grows as the code around it grows'],
  [0.5, 'each new feature in the area copies the bad pattern'],
  [0.8, 'actively spreading — other modules now depend on the wrong shape'],
];
