# techdebt-tracker

Track tech debt per-project in a versioned ledger (`.techdebt/items.json`), rank it
deterministically, and surface items when your current work is adjacent to them.
Detection proposes; a human confirms and freezes the numbers; ranking is pure
arithmetic over the frozen fields. See [DESIGN.md](DESIGN.md) for the full design.

## Packages

- `packages/core` — schema, ranking, canonical ledger I/O, adjacency, staleness.
  Pure TypeScript, zero runtime dependencies.
- `packages/cli` — the `techdebt` command (`scan`, `triage`, `report`). No LLM,
  no network, no API key.

## Quick start

```sh
yarn install && yarn build

# in the repo you want to track:
techdebt scan                       # find TODO/FIXME/HACK/XXX candidates
techdebt scan --json > c.json
techdebt triage --candidates c.json # human gate: confirm + freeze estimates
techdebt triage                     # or add an item manually
techdebt report                     # deterministic ranked ledger
techdebt triage --revisit td-a4f2   # re-estimate, prune blockers, change status
```

## Claude Code skill

`skill/SKILL.md` teaches Claude Code the detect → confirm → record loop:
propose candidates with rubric-anchored estimates, get your confirmation in
chat, then write through `techdebt add` (never by editing the ledger
directly). Install by copying into your project:

```sh
mkdir -p .claude/skills/techdebt && cp skill/SKILL.md .claude/skills/techdebt/
```

Then ask Claude things like "scan src/auth for tech debt", "what debt should
I fix while I'm in this file?", or "td-a4f2 is fixed".

## GitHub Action

`action/` comments on pull requests that touch files with open tracked debt —
one sticky comment, rewritten on every push, silent when the PR is clean, and
reading the ledger from the PR head (so a PR that fixes an item and flips it
to `fixed` isn't nagged about it). No LLM, no network beyond the GitHub API.
See `examples/techdebt-workflow.yml`; the workflow needs `pull-requests: write`
permission and a checkout step before the action.

## Ranking

`priority = (impact × (1 + interestRate) × blockMultiplier) / effort`,
`blockMultiplier = 1 + 0.5 × min(blockers, 4)`. Ties: impact desc, then id.
Scores round to 2 decimals before comparison. Fixed/wontfix items never rank
but stay in the ledger as the historical record.

## Development

```sh
yarn test    # vitest across all packages
yarn build   # tsc, topological
```
