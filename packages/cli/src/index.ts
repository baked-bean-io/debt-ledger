#!/usr/bin/env node
import { Command } from 'commander';
import { runScan } from './commands/scan.js';
import { runReport } from './commands/report.js';
import { runTriage } from './commands/triage.js';
import { runRubric } from './commands/rubric.js';
import { runAdd } from './commands/add.js';
import { runStatus } from './commands/status.js';

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
  .option('--json', 'emit the ranked items as JSON')
  .action((opts: { json?: boolean }) => {
    runReport(process.cwd(), { json: Boolean(opts.json) });
  });

program
  .command('triage')
  .description('Interactively confirm candidates into the ledger (the human freeze step)')
  .option('--candidates <file>', 'candidates JSON produced by `techdebt scan --json`')
  .option('--revisit <id>', 're-triage an existing item: adjust estimates, prune blockers, change status')
  .action(async (opts: { candidates?: string; revisit?: string }) => {
    await runTriage(process.cwd(), { candidatesFile: opts.candidates, revisitId: opts.revisit });
  });

program
  .command('rubric')
  .description('Print the calibration rubric (effort/impact/interestRate anchors)')
  .option('--json', 'machine-readable anchors')
  .action((opts: { json?: boolean }) => {
    runRubric({ json: Boolean(opts.json) });
  });

program
  .command('add')
  .description('Add confirmed items non-interactively (JSON from --file or stdin); prints minted ids')
  .option('--file <file>', 'confirmed-items JSON array (defaults to stdin)')
  .action((opts: { file?: string }) => {
    runAdd(process.cwd(), { file: opts.file });
  });

program
  .command('status')
  .description('Set an item status (open|planned|fixed|wontfix) and stamp lastSeen')
  .argument('<id>', 'item id, e.g. td-a4f2')
  .argument('<status>', 'new status')
  .action((id: string, status: string) => {
    runStatus(process.cwd(), id, status);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
