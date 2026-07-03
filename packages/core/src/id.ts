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
