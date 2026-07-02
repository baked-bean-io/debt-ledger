#!/usr/bin/env node
import { Command } from 'commander';
import { runScan } from './commands/scan.js';
import { runReport } from './commands/report.js';
import { runTriage } from './commands/triage.js';

export const program = new Command();

program
  .name('techdebt')
  .description('Track and rank tech debt in a versioned per-repo ledger (.techdebt/items.json)');

program
  .command('scan')
  .description('Harvest TODO/FIXME/HACK/XXX comments as candidates; warn about stale ledger locations')
  .option('--json', 'print candidates as JSON on stdout (warnings go to stderr)')
  .action((opts: { json?: boolean }) => {
    runScan(process.cwd(), { json: Boolean(opts.json) });
  });

program
  .command('report')
  .description('Print the debt ledger ranked by priority (score desc, impact desc, id asc)')
  .action(() => {
    runReport(process.cwd());
  });

program
  .command('triage')
  .description('Interactively confirm candidates into the ledger (the human freeze step)')
  .option('--candidates <file>', 'candidates JSON produced by `techdebt scan --json`')
  .option('--revisit <id>', 're-triage an existing item: adjust estimates, prune blockers, change status')
  .action(async (opts: { candidates?: string; revisit?: string }) => {
    await runTriage(process.cwd(), { candidatesFile: opts.candidates, revisitId: opts.revisit });
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
