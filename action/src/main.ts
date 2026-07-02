import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { LEDGER_PATH, matchChangedFiles, parseLedger, SCHEMA_VERSION, type Ledger } from '@techdebt/core';
import { buildCommentBody, MARKER, scoreMatches } from './comment.js';

async function run(): Promise<void> {
  const pr = github.context.payload.pull_request;
  if (!pr) {
    core.info('Not a pull_request event; nothing to do.');
    return;
  }

  const token = core.getInput('github-token', { required: true });
  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;

  // The ledger is read from the checkout, i.e. the PR head — a PR that fixes
  // an item and flips it to `fixed` isn't nagged about it (DESIGN.md Q8).
  const ledgerPath = join(process.env.GITHUB_WORKSPACE ?? '.', LEDGER_PATH);
  const ledger: Ledger = existsSync(ledgerPath)
    ? parseLedger(readFileSync(ledgerPath, 'utf8'))
    : { version: SCHEMA_VERSION, items: [] };

  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pr.number,
    per_page: 100,
  });
  const changed = files.map((f) => f.filename);
  const scored = scoreMatches(matchChangedFiles(changed, ledger.items));

  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: pr.number,
    per_page: 100,
  });
  const existing = comments.find((c) => c.body?.includes(MARKER));

  if (scored.length === 0 && !existing) {
    core.info('No tracked debt touched; staying silent.');
    return;
  }

  const body = buildCommentBody(scored);
  if (existing) {
    await octokit.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
    core.info(`Updated sticky comment (${scored.length} match(es)).`);
  } else {
    await octokit.rest.issues.createComment({ owner, repo, issue_number: pr.number, body });
    core.info(`Created sticky comment (${scored.length} match(es)).`);
  }
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
