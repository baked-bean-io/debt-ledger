import { InvalidArgumentError } from 'commander';

export function parseIntStrict(value: string): number {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) throw new InvalidArgumentError('expected a number');
  return n;
}
