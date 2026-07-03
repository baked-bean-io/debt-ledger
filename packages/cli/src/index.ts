#!/usr/bin/env node
import { Command } from 'commander';
import { LedgerError } from '@techdebt/core';
import { runScan } from './commands/scan.js';
import { runReport } from './commands/report.js';
import { runTriage } from './commands/triage.js';
import { runRubric } from './commands/rubric.js';
import { runAdd } from './commands/add.js';
import { runStatus } from './commands/status.js';
import { runSuggest } from './commands/suggest.js';
import { runDoctor } from './commands/doctor.js';
import { parseIntStrict } from './parse-int.js';

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

program
  .command('suggest')
  .description('Suggest debt worth fixing now — adjacent to --files first, else the global top')
  .option('--files <list>', 'comma-separated changed files (adjacent-first mode)')
  .option('--max-effort <n>', 'only items with effort <= n', parseIntStrict)
  .option('--limit <n>', 'max suggestions (default 3)', parseIntStrict)
  .option('--json', 'machine-readable output')
  .action((opts: { files?: string; maxEffort?: number; limit?: number; json?: boolean }) => {
    runSuggest(process.cwd(), {
      files: opts.files,
      maxEffort: opts.maxEffort,
      limit: opts.limit,
      json: Boolean(opts.json),
    });
  });

program
  .command('doctor')
  .description('Check the ledger for problems (bad JSON, duplicate ids, formatting); --fix repairs what is safe')
  .option('--fix', 'repair duplicates and formatting, rewrite the file canonically')
  .action((opts: { fix?: boolean }) => {
    runDoctor(process.cwd(), { fix: Boolean(opts.fix) });
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  if (error instanceof LedgerError) {
    console.error('run `techdebt doctor` to inspect the ledger, or `techdebt doctor --fix` to repair it');
  }
  process.exitCode = 1;
});
