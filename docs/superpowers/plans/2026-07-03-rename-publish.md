# Debt Ledger — Rename + Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand for publication — repo `bakebean/debt-ledger`, plugin `debt-ledger`, marketplace `bakebean`, CLI command + skill `debt` — add the MIT license, create the public GitHub repo, and push.

**Architecture:** Naming scheme by layer: users type `debt <cmd>`; the plugin installs as `debt-ledger@bakebean`; the marketplace is named after the org so future bakebean plugins ship through it. The on-disk ledger path **stays `.techdebt/items.json`** — descriptive, and renaming it would orphan existing dogfood data for zero benefit (recorded as a decision). Internal workspace packages rename `@techdebt/*` → `@debt-ledger/*` so the published source reads coherently.

## Global Constraints

- All prior global constraints bind (trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`, LF, canonical writes, plain-language README).
- Exact names: repo `bakebean/debt-ledger`; plugin name `debt-ledger`; marketplace name `bakebean`; CLI bin + skill name + program name `debt`; bundle filenames `debt.cjs` (plugin) — action bundle stays `action/dist/index.cjs` (path is referenced by action.yml only).
- `LEDGER_PATH = '.techdebt/items.json'` is NOT renamed. The literal string `techdebt` may remain ONLY in: that path constant and messages quoting it, `DESIGN.md`/`docs/superpowers/plans/*` (history), `.superpowers/` (ledger), and test tmpdir prefixes (cosmetic). Everywhere else the sweep must be complete — each task ends with a grep gate proving it.
- After every code-touching task: `yarn vitest run` green (154), `yarn build` clean, regenerated bundles committed.
- GitHub: `gh` is authed as mcewball13 with org access to bakebean confirmed. Repo is public, MIT.

---

### Task 1: User-facing rename

**Files:** `packages/cli/package.json` (bin), `packages/cli/src/index.ts` (program name + help strings), `packages/cli/src/commands/scan.ts` (triage hint string), `action/src/comment.ts` (report footer), `action/action.yml` (display name), plugin manifests, `plugin/skills/techdebt/` → `plugin/skills/debt/` (git mv; SKILL.md frontmatter + body; bundle path), `plugin/package.json` (esbuild outfile), root `.claude-plugin/marketplace.json`, `examples/*` (settings, workflow — rename `techdebt-workflow.yml` → `debt-workflow.yml`, pre-push hook text), `README.md` (full sweep incl. real org paths), `DESIGN.md` (naming-decision addendum only), tests asserting command strings.

- [ ] **Step 1: CLI surface**

- `packages/cli/package.json`: `"bin": { "debt": "./dist/index.js" }`.
- `packages/cli/src/index.ts`: `program.name('debt')`; any description/hint text containing `techdebt ` → `debt `.
- `packages/cli/src/commands/scan.ts`: the human-mode hint becomes `To triage: debt scan --json > candidates.json && debt triage --candidates candidates.json`.
- Grep `packages/*/src` for remaining `techdebt` — only the `LEDGER_PATH` constant in `packages/core/src/ledger.ts` and messages quoting `.techdebt/items.json` may remain.
- Update any test assertions that named the old command (e.g. scan.test.ts's `toContain('techdebt triage')` if present → `debt triage`; `format.ts`'s empty-ledger message quotes the PATH, which stays).

- [ ] **Step 2: Plugin + marketplace + skill**

- `git mv plugin/skills/techdebt plugin/skills/debt`.
- `plugin/skills/debt/SKILL.md`: frontmatter `name: debt`; every `techdebt ` command mention in the body → `debt `; the Running-the-CLI path becomes `node "${CLAUDE_SKILL_DIR}/bin/debt.cjs" ...`. (The `.techdebt/items.json` path mentions stay.)
- `plugin/package.json`: esbuild `--outfile=skills/debt/bin/debt.cjs`; delete the old committed `skills/debt/bin/techdebt.cjs` after the move (`git rm`), rebuild produces `debt.cjs`.
- `plugin/.claude-plugin/plugin.json`: `"name": "debt-ledger"`, description updated to say the `debt` CLI is bundled, add `"homepage": "https://github.com/bakebean/debt-ledger"`. Still NO version field.
- Root `.claude-plugin/marketplace.json`: `"name": "bakebean"`, plugin entry `"name": "debt-ledger"`, same `./plugin` source, description updated.
- `action/src/comment.ts`: footer `techdebt report` → `debt report`. `action/action.yml`: `name: 'Debt Ledger'`, description mentions `.techdebt/items.json` (path unchanged).

- [ ] **Step 3: Examples + README + DESIGN**

- `git mv examples/techdebt-workflow.yml examples/debt-workflow.yml`; inside: job/workflow name `debt-ledger`, `- uses: bakebean/debt-ledger/action@main` (the real path now — local `./action` note removed), header comment updated.
- `examples/claude-settings-plugin.json`: marketplace key `bakebean` with `"repo": "bakebean/debt-ledger"`, `"enabledPlugins": { "debt-ledger@bakebean": true }`.
- `examples/pre-push`: message text `techdebt scan/triage` → `debt scan/triage`.
- `README.md` full sweep: title `# debt-ledger`; every `techdebt` command → `debt`; clone target `~/debt-ledger`; alias/PowerShell lines updated; plugin install becomes the real `/plugin marketplace add bakebean/debt-ledger` + `/plugin install debt-ledger@bakebean` (drop the "until this repo is on GitHub" local-path paragraph — replace with one line noting a local checkout also works as a marketplace path); workflow example filename updated; contributors section updated. The `.techdebt/items.json` mentions stay (it's the real path).
- `DESIGN.md`: append to the team-hardening section:

```markdown
### Naming for publication (2026-07-03)

- Repo `bakebean/debt-ledger`; plugin `debt-ledger`; marketplace `bakebean`
  (org-named so future plugins share it); CLI command and skill are `debt`.
- The on-disk path stays `.techdebt/items.json` — renaming it would orphan
  existing ledgers for zero benefit.
```

- [ ] **Step 4: Verify and commit**

```bash
yarn vitest run && yarn build
node plugin/skills/debt/bin/debt.cjs --help   # program name reads "debt", all 8 commands
claude plugin validate ./plugin               # passes (version warning expected)
grep -rn "techdebt" packages/*/src action/src plugin examples README.md .claude-plugin | grep -v ".techdebt"   # expect NO output
git add -A && git commit -m "feat!: rename — command 'debt', plugin 'debt-ledger', marketplace 'bakebean'

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Internal package rename

**Files:** all four workspace `package.json`s (`@techdebt/core|cli|action|plugin` → `@debt-ledger/*`, and the `workspace:*` dep references), every `from '@techdebt/core'` import in src+tests (→ `@debt-ledger/core`), `vitest.config.ts` alias key, root `package.json` name (`techdebt-tracker` → `debt-ledger`).

- [ ] **Step 1: Mechanical sweep**

```bash
grep -rl "@techdebt/" packages action plugin vitest.config.ts | while read f; do sed -i '' 's|@techdebt/|@debt-ledger/|g' "$f"; done
```

Then root `package.json` `"name": "debt-ledger"`, and `yarn install` (lockfile updates for the renamed workspaces).

- [ ] **Step 2: Verify and commit**

```bash
yarn vitest run && yarn build
grep -rn "@techdebt" . --include="*.ts" --include="*.json" --exclude-dir=node_modules --exclude-dir=.yarn --exclude-dir=docs --exclude-dir=.superpowers   # expect NO output
git add -A && git commit -m "chore: rename internal packages to @debt-ledger/*

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: LICENSE + create repo + push

- [ ] **Step 1: MIT license**

Create `LICENSE` with the standard MIT text, `Copyright (c) 2026 Mike McEwen (bakebean)`. Add `"license": "MIT"` to the root package.json and to `plugin/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` plugin entry. Commit:

```bash
git add LICENSE package.json plugin/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "chore: MIT license

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Create and push**

```bash
gh repo create bakebean/debt-ledger --public --description "Track tech debt in a versioned ledger: humans confirm, arithmetic ranks. CLI + Claude Code plugin + GitHub Action." --disable-wiki
git remote add origin https://github.com/bakebean/debt-ledger.git
git push -u origin main
```

- [ ] **Step 3: Watch CI (the first-ever run — including the Windows leg)**

```bash
gh run watch --repo bakebean/debt-ledger --exit-status $(gh run list --repo bakebean/debt-ledger --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: both matrix legs (ubuntu, windows) green — tests, build, bundle-drift guard. A Windows failure here is a finding, not a disaster: report it verbatim.

- [ ] **Step 4: Post-publish smoke**

- `gh repo view bakebean/debt-ledger --json licenseInfo,description` shows MIT.
- README renders sanely (`gh repo view --web` optional for the human).
- Report the two commands teammates now run, verbatim, as the task's final output.

---

## Self-Review

**Coverage:** repo/plugin/marketplace/command names per the user's choices (Task 1-2), MIT (Task 3), public bakebean repo + push + CI proof (Task 3). Ledger path deliberately unrenamed and recorded. Grep gates make the sweep provable rather than hopeful.
**Placeholder scan:** commands and manifests exact; sweep steps use explicit greps with allowed-remainder rules rather than trusting memory.
**Post-plan follow-ups:** user must locally re-add the marketplace (`/plugin marketplace remove techdebt` then `add bakebean/debt-ledger`, `install debt-ledger@bakebean`) since the ids changed; Stratum's workflow/settings files (if already copied) need the new names.
