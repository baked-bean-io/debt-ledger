import { EFFORT_ANCHORS, IMPACT_ANCHORS, INTEREST_ANCHORS, POINTS } from '@debt-ledger/core';

export interface RubricIo {
  out: (line: string) => void;
}

const consoleIo: RubricIo = { out: (line) => console.log(line) };

export function runRubric(opts: { json: boolean }, io: RubricIo = consoleIo): void {
  if (opts.json) {
    io.out(
      JSON.stringify(
        { effort: EFFORT_ANCHORS, impact: IMPACT_ANCHORS, interestRate: INTEREST_ANCHORS },
        null,
        2,
      ),
    );
    return;
  }
  io.out('Calibration rubric — anchors keep estimates consistent with each other.');
  io.out('');
  io.out('effort:');
  for (const p of POINTS) io.out(`  ${p} — ${EFFORT_ANCHORS[p]}`);
  io.out('impact (blast radius if unfixed):');
  for (const p of POINTS) io.out(`  ${p} — ${IMPACT_ANCHORS[p]}`);
  io.out('interestRate (use exactly these values):');
  for (const [value, label] of INTEREST_ANCHORS) io.out(`  ${value} — ${label}`);
}
