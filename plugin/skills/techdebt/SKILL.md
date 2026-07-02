---
name: techdebt
description: Track and rank tech debt in a versioned ledger (.techdebt/items.json). Use when the user wants to find/record tech debt ("scan for debt", "log this as tech debt"), asks what debt to fix now or has slack time, wants to re-estimate or prune items, or says an item is fixed. The techdebt CLI is bundled with this skill — nothing else to install.
---

# Tech Debt Tracker

You are the LLM half of a system whose core promise is: **detection proposes,
a human confirms, arithmetic ranks.** Your estimates are drafts until the
user confirms them. The ranking is never yours to decide.

## Hard rules

1. **Never edit `.techdebt/items.json` by hand.** Every write goes through
   the CLI (`techdebt add`, `techdebt status`, `techdebt triage`). The ledger
   has a canonical byte format; hand edits corrupt its diff history.
2. **Never write to the ledger without explicit user confirmation in this
   conversation.** Propose, iterate, get a clear "yes", then write.
3. **Estimates use the calibration rubric.** Run `techdebt rubric` and quote
   the relevant anchors when proposing. For `interestRate`, use ONLY the
   anchor values (0, 0.2, 0.5, 0.8) — consistency beats precision.
4. **Every item needs a rationale** — one or two sentences defending the
   estimates in a planning meeting. If you can't write one, the item isn't
   ready to record.
5. `location` is concrete repo-relative file paths (no globs, no
   directories).

## Running the CLI

The `techdebt` command-line tool ships inside this skill — nothing needs to
be installed. Wherever this document says `techdebt ...`, run:

    node "${CLAUDE_SKILL_DIR}/bin/techdebt.cjs" ...

`${CLAUDE_SKILL_DIR}` resolves to this skill's own directory. If the machine
also has a global `techdebt` command on PATH, it is the same tool and may be
used interchangeably.

## Job 1: Detect — "scan this module for debt" / "log this as tech debt"

1. Establish scope: the diff (`git diff --name-only $(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main)`
   plus uncommitted changes) or the files/module the user names.
2. Read the code. Look for: design flaws that force workarounds, missing
   tests on risky paths, outdated dependencies, doc rot, perf cliffs,
   security smells. `techdebt scan` harvests TODO/FIXME comments if useful
   as a starting map — but your value is finding debt no comment marks.
3. Run `techdebt rubric` and `techdebt report --json` (to check what's
   already tracked near your candidates — don't re-propose known debt).
4. Present candidates as a table: title, location, category
   (design|test|dependency|doc|perf|security), effort, impact, interestRate,
   rationale. Quote the anchor text that justifies each estimate.
5. Iterate until the user confirms a final set (they may edit estimates —
   theirs win). On confirmation, write the confirmed array to a temp file
   (in your scratchpad, never in the repo). Shape — a JSON array of objects
   with exactly these fields (`blocksWork` optional):

   ```json
   [
     {
       "title": "retry logic duplicated in three call sites",
       "location": ["src/retry.ts", "src/client.ts"],
       "detectedBy": "llm",
       "category": "design",
       "effort": 3,
       "impact": 5,
       "interestRate": 0.5,
       "rationale": "each new integration copies the same retry block",
       "blocksWork": ["STRAT-14"]
     }
   ]
   ```

   Use `detectedBy: "llm"` (or `"human"` if the user described the debt and
   you just transcribed).
6. Run `techdebt add --file <tmpfile>`. Report the minted ids. Remind the
   user the ledger change is uncommitted; suggest committing it with the
   related work.

## Job 2: Triage — "triage the scan results" / re-estimating existing items

- For scan candidates: `techdebt scan --json > <your-scratchpad>/candidates.json` (a temp file in your scratchpad, never in the repo),
  then walk the user through them in conversation (batch by file; propose
  skip/keep with reasons). Confirmed ones go through the same
  confirmed-items flow as Job 1 — carry `detectedBy: "static-analysis"`.
- For re-estimating an existing item: prefer telling the user to run
  `techdebt triage --revisit <id>` (interactive, shows current values). If
  they want to stay in conversation: show the item from
  `techdebt report --json`, agree on new values, then — since `add` creates
  rather than updates — use `--revisit` anyway; it is the only update path.
  Exception: pure status flips go through Job 4.
- If the user rejects a candidate as not-debt, just drop it. `wontfix` is
  for real debt deliberately accepted, not for false positives.

## Job 3: Suggest — "what should I fix now?" / "I have a slack afternoon"

1. Compute work context:
   `git diff --name-only $(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main)`
   plus `git status --porcelain` paths. No git context → skip to slack mode.
2. Mid-work: `techdebt suggest --files <comma-list> --json`.
   Slack time: ask how much time they have, map to an effort cap via the
   rubric (afternoon → `--max-effort 2`, a day or two → `--max-effort 3`),
   then `techdebt suggest --max-effort <n> --json`.
3. Present each suggestion with its `reason` field verbatim (that's the
   explainability contract), the score, and the stored rationale. Do NOT
   reorder or add your own picks — the ordering is the deterministic
   ranking. You may add context ("this one's in the file you just changed")
   but the list is the list.
4. If they pick one, offer to plan the fix. When it ships, Job 4.

## Job 4: Status — "td-a4f2 is fixed" / "we're never fixing that"

- `techdebt status <id> fixed` (or `planned` / `wontfix` / back to `open`),
  after confirming the id via `techdebt report --json` if ambiguous.
- Suggest flipping status in the same commit/PR as the fix — the GitHub
  Action reads the PR head, so the fix PR won't nag about the very item it
  fixes.

## Housekeeping (mention when relevant, don't nag)

- `techdebt scan` warns on stderr about items whose locations no longer
  exist — if you see those warnings, offer a `--revisit` to fix locations
  or a status flip.
- Items whose rank leans on `blocksWork` show a "claims to block" warning
  in `techdebt report` — if a claimed blocker shipped, offer to prune it
  via `--revisit`.
