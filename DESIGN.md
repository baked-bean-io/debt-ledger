# Tech Debt Tracker — Design

Open-source personal project. Dogfood target: Stratum.

Track tech debt per-project in a versioned ledger, rank it deterministically, and
surface items only when relevant — when current work is adjacent to the debt's
location, or when there's declared slack to fix it. The system ranks and suggests;
a human decides.

## Architecture

```
packages/core/        ← rank.ts, schema, ledger read/write, adjacency (pure TS, zero runtime deps)
packages/cli/         ← npx entrypoint (`techdebt scan|report|triage`) — the OSS front door
plugin/               ← Claude Code plugin: the skill + a bundled CLI (installable via /plugin)
action/               ← GitHub Action: adjacency comment on PRs (no LLM per-PR)
examples/
```

- The ledger (`.techdebt/items.json`) lives in each consuming repo — per-project
  data versioned alongside the code it describes.
- Monorepo (**yarn workspaces**), not three repos — solo maintainer, avoid
  version-coordination overhead.
- The CLI matters for adoption; the skill is the differentiator, not the front door.

## Core principle: detection ≠ ranking

- Detection is non-deterministic. LLM or static analysis proposes candidate items
  and first-pass estimates with rationale.
- A human confirms and freezes the numbers into the ledger. This gate is what makes
  the determinism mean anything.
- Ranking is pure arithmetic over frozen fields. No LLM at rank time. Ordering is
  stable, explainable, and auditable via `git diff items.json`.

## Schema

```ts
interface DebtItem {
  id: string;                // opaque slug (e.g. "td-a4f2"), generated at triage time
  title: string;
  location: string[];        // repo-relative file paths (concrete files only in v1)
  category: 'design' | 'test' | 'dependency' | 'doc' | 'perf' | 'security';
  detectedBy: 'human' | 'static-analysis' | 'llm';
  effort: 1 | 2 | 3 | 5 | 8;
  impact: 1 | 2 | 3 | 5 | 8; // blast radius if unfixed
  interestRate: number;      // 0–1, how fast it compounds
  rationale: string;         // REQUIRED — why these estimates; frozen at triage
  blocksWork?: string[];     // free-form ticket/feature IDs; human-maintained claims
  firstSeen: string;         // ISO date
  lastSeen: string;          // updated on human confirmation, not machine inference
  status: 'open' | 'planned' | 'fixed' | 'wontfix';
}
```

Ledger file shape: `{ "version": 1, "items": [...] }`.

### Decisions

- **Identity (Q1):** `id` is an opaque human-meaningless slug generated when the
  human freezes the item at triage — not at detection. Reconciliation of re-detected
  candidates is NOT automatic: triage shows existing open items at/near the same
  location and the human decides duplicate-or-new. No fuzzy LLM dedupe (it would
  reintroduce non-determinism into the ledger write path).
- **Location (Q2):** `string[]` of concrete repo-relative file paths; exact match
  only in v1. Directory-prefix matching deferred until dogfooding demands it. No
  globs. A staleness check (open item whose location no longer exists on disk) runs
  in the CLI — cheap, deterministic; no automatic rename-following.
- **Rationale (Q6):** required single prose field covering the estimates as a
  whole. Written/edited at triage; the LLM's draft rationale is the starting point.
  No per-field rationale, no embedded history array — git is the history.
- **blocksWork (Q7):** free-form strings, no ticket-system integration in v1.
  Treated as a human-maintained claim, like the estimates. `report` displays
  claimed blockers inline on items whose rank depends on the multiplier, so stale
  claims are seen and pruned. Auto-verification via integrations is an explicit
  non-goal until v2.

## Ranking (`rank.ts`)

```
priority = (impact * (1 + interestRate) * blockMultiplier) / effort
blockMultiplier = 1 + BLOCK_WEIGHT * min(blocksWork.length, BLOCK_CAP)
                  // BLOCK_WEIGHT = 0.5, BLOCK_CAP = 4 — named constants, tune in dogfooding
```

Note `(1 + interestRate)`, not `interestRate` — a rate of 0 must not zero out
stable debt that blocks active work.

- **Total order (Q5):** sort by rounded priority desc → impact desc → id asc.
  Tie-break documented next to the formula; it's part of the explainability contract.
- Scores rounded to 2 decimals once, then compared — morally-tied items actually tie.
- `open` and `planned` rank together (status shown in output). `fixed`/`wontfix`
  excluded from ranking but kept in the ledger forever.

## Ledger I/O (Q4)

- Single `items.json` in v1; file-per-item deferred until merge conflicts actually
  hurt.
- **Deterministic serialization** through one canonical serializer in core:
  2-space pretty-print, fixed key order matching schema declaration, items sorted
  by id, trailing newline. Estimate changes diff as one line.
- `version` envelope field from day one; migrations go through core on read.
- Scan candidates are **ephemeral** (stdout/temp consumed by triage) — never
  stored in `.techdebt/`. The versioned directory contains only human-confirmed truth.

## CLI (Q3)

`npx techdebt scan|report|triage` — deterministic end-to-end, zero network, no
API key. The LLM only ever enters through the skill.

- `scan`: pure static analysis — harvest TODO/FIXME/HACK/XXX comments into
  candidates (`detectedBy: 'static-analysis'`), plus the location-staleness check.
  Output is candidates, not ledger writes; feeds the same triage gate as LLM
  detection.
- `triage`: interactive prompt where estimates + rationale get frozen and ids
  minted. Also `--revisit <id>` to re-triage (prune stale blockers, adjust
  estimates); the diff is the audit trail.
- `report`: ranked list with scores, statuses, claimed blockers.
- Shallow detection is accepted: the CLI's job on first touch is demonstrating
  the ledger/ranking loop in 60 seconds, not being a great detector.

## GitHub Action (Q8)

Runs on PR open/synchronize. Surface-only in v1: match changed files against
ledger locations. No LLM (v2 option only, after the ledger has earned trust).

- **One sticky comment**, upserted via hidden marker (`<!-- debt-ledger -->`),
  rewritten each run to current state; edited (not deleted) if matches drop to zero.
- **Reads the ledger from the PR head** — a PR that fixes an item and flips it to
  `fixed` isn't nagged about it.
- **Silent when nothing matches** — no comment is ever created for a clean PR.
- Body shows the same fields as `report` (id, title, score, status, matched files)
  — recognizably a view over the ledger, not a second opinion.

### Action decisions (2026-07-02)

- Node20 JS action bundling core via esbuild into a committed `action/dist`
  (no per-PR npm install, no registry dependency at run time).
- Requires `actions/checkout` first (on pull_request that checkout is the PR
  merge ref, which contains the PR's ledger changes) and `pull-requests: write`
  permission; token defaults to `github.token`.
- Missing ledger file behaves as an empty ledger — the zero-match path, so
  existing sticky comments still get corrected rather than orphaned.
- Comment ordering delegates to core `rank` over the matched items — the
  comment is a view over the ledger, never a second opinion.

## Claude Code skill

Three narrowly-scoped, human-invoked jobs:

1. **Detect** — scan a diff/module, propose candidate DebtItems (`detectedBy: 'llm'`).
2. **Triage** — fill soft estimates with rationale against the calibration rubric;
   human confirms before commit.
3. **Suggest (Q9)** — always human-invoked, never proactive. Work context comes
   from git deterministically: `git diff --name-only $(git merge-base HEAD
   origin/main)` + uncommitted changes, intersected with ledger locations using
   the same adjacency matcher the Action uses (one implementation in core, two
   consumers). Slack is *declared, not detected*: with no adjacent work, Suggest
   falls through to the global ranking, optionally effort-capped ("things I can
   finish today"). Output: top N (~3) with score, rationale, and why-it-surfaced.

### Skill decisions (2026-07-02)

- **CLI-mediated writes.** The skill never edits `items.json`; Claude cannot
  drive the interactive triage TUI, so the CLI grew a non-interactive
  surface: `add` (validated confirmed-items JSON in, canonical write + minted
  ids out), `status <id> <status>`, `suggest`, `rubric`, `report --json`.
  The human gate moves into the conversation: propose → confirm → `add`.
- **interestRate is anchor-quantized by convention.** The schema accepts any
  value in [0,1]; every writer emits only 0 / 0.2 / 0.5 / 0.8. Consistency
  is the rubric's job; continuous precision would be false precision.
- **Suggest stays deterministic.** `suggest()` lives in core (adjacent-only
  when adjacency hits, else global top-N, effort-cappable, every result
  carries a `reason`). The skill computes the changed-file list from git and
  narrates; it never reorders.
- **`add` warns, never blocks, on location overlap** — the duplicate check
  is advisory because the human gate already passed in conversation.
- **Distributed as a Claude Code plugin (2026-07-02).** `plugin/` wraps the
  skill plus an esbuild-bundled CLI (`skills/techdebt/bin/techdebt.cjs`,
  committed; the CI drift guard covers it). The repo doubles as the
  marketplace via `.claude-plugin/marketplace.json`. The skill invokes the
  bundled CLI through `${CLAUDE_SKILL_DIR}`, so installing the plugin is the
  entire setup. `plugin.json` omits `version` deliberately: git-SHA
  versioning means every commit is an update while the tool is young. The
  standalone CLI (npx) remains the front door for non-Claude users.

### Team-hardening decisions (2026-07-03)

- **UUID item ids.** Two branches minting items independently could collide
  on the old 4-char ids, and a duplicated id makes the merged ledger
  unreadable. Ids are now `td-<uuid4>`; old short ids stay valid (schema
  requires only a non-empty string). The report's id column sizes itself.
- **`techdebt doctor [--fix]`.** Post-merge repair path: detects unresolved
  conflict markers, duplicate ids, invalid fields, and non-canonical
  formatting; `--fix` re-mints later duplicates and rewrites canonically,
  and refuses anything requiring human judgment. Hand-editing the ledger is
  sanctioned in exactly one case: resolving a git merge conflict, followed
  by `doctor --fix`.
- Single-file ledger retained (Q4 stands) — with low write rates, canonical
  formatting, and doctor, file-per-item remains deferred until a team
  actually feels the pain.
- Doctor detects mis-resolved merges (an item carrying two `"id"` fields)
  and refuses `--fix` rather than certifying a ledger that silently lost an
  item. A future enhancement could auto-resolve conflict markers by parsing
  both sides and unioning the items — noted, not built.

### Naming for publication (2026-07-03)

- Repo `baked-bean-io/debt-ledger`; plugin `debt-ledger`; marketplace `baked-bean-io`
  (org-named so future plugins share it); CLI command and skill are `debt`.
- The on-disk path stays `.techdebt/items.json` — renaming it would orphan
  existing ledgers for zero benefit.

### Front-door inversion (2026-07-03)

- The original adoption bet ("the CLI matters for adoption; the skill is the
  differentiator, not the front door") is REVERSED for publication: the
  Claude Code plugin is the first-class citizen and the primary way people
  are expected to use the tool. The README leads with the two-command plugin
  install and the conversational workflow; the terminal CLI is documented as
  the secondary path (non-Claude teammates, scripts). The CLI remains fully
  supported — it's the substrate the plugin drives — but it is no longer the
  pitch.

## Calibration rubric (Q11)

One screen, single source in `packages/core` docs; embedded in the skill's triage
prompt and echoed per-field in the CLI triage screen. Its job is estimate
*consistency*, not correctness — anchors get tuned during dogfooding.

- **effort:** 1 ≈ <1h · 2 ≈ half-day · 3 ≈ 1–2 days · 5 ≈ a week ·
  8 ≈ break it down before touching.
- **impact:** 1 = annoys one person, one file · 3 = slows most work in the module ·
  5 = distorts designs beyond its module / recurring bug source · 8 = company-scale
  (data loss, security, "can't ship X until this dies").
- **interestRate:** 0 = static, ugly but inert · ~0.2 = grows as surrounding code
  grows · ~0.5 = new features copy the bad pattern · ~0.8+ = actively spreading —
  other modules now depend on the wrong shape.

## Tooling (Q10)

- **Yarn workspaces**; no Nx/Turbo — four small packages, linear dependency chain.
- TypeScript strict, ESM-only, Node ≥ 20. `tsup` (or plain `tsc`) to build.
- **Vitest**; rank tie-breaks and serializer canonicalization are table-driven
  tests from day one.
- Zero-runtime-deps rule applies to `core` only. CLI may take minimal deps
  (`citty`/`commander`, `@clack/prompts`).
- Action is a small JS action bundling core via esbuild + `@actions/github` — not
  a composite action shelling to `npx` (avoids per-PR install latency and a
  registry dependency).
- No changesets/publishing setup until after dogfooding. **Verify the npm package
  name is available before the README bakes it in** (`techdebt` is likely taken).

## Explicitly rejected

- Autonomous background agent that decides when debt gets fixed or auto-fixes it.
- LLM "vibe-ranking" the list live off diffs.
- Automatic/fuzzy dedupe of re-detected items (non-determinism in the write path).
- Slack *detection* (calendar-reading etc.) — slack is declared by the human.
- Ticket-system integration for `blocksWork` verification (v2 at the earliest).
- Splitting into multiple repos before there's a proven core.

## Build order

1. `packages/core` — schema, `rank.ts`, canonical serializer + ledger I/O,
   adjacency matching, staleness check, tests.
2. CLI wrapper (scan/triage/report).
3. Skill (detect/triage/suggest).
4. Action.
5. Dogfood against Stratum; expect formula weights, rubric anchors, and schema to
   take a couple of revisions before extraction/publishing.
