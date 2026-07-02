#!/usr/bin/env node
import { Command } from 'commander';
import { runScan } from './commands/scan.js';

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

program.parseAsync(process.argv);
