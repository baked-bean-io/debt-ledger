# debt-ledger

Every codebase collects shortcuts and "we'll fix this later" spots — that's
technical debt. This tool keeps an honest list of yours, saved as a small file
inside your own repo, and ranks the list so you always know what's worth
fixing next.

The idea in one paragraph: when a piece of debt turns up, you answer a few
quick questions about it — how big is the fix, how much pain does it cause,
is it getting worse over time. Your answers are saved to `.techdebt/items.json`
in your repo, committed to git like any other file. From then on a simple
formula ranks everything, and (if you want) GitHub comments on pull requests
that touch files with known debt. Nothing decides for you and no AI is
involved in the ranking — the same list comes out in the same order every
time, and you can always see why.

**The main way to use it is by talking to [Claude Code](https://claude.com/claude-code).**
You install one plugin, then just ask — "scan this module for tech debt,"
"what should I fix while I'm here?" — and Claude does the reading, proposes
the entries, and keeps the books, with you approving every number. There's
also a plain terminal command for people and scripts that don't use Claude;
that's further down.

Full design decisions live in [DESIGN.md](DESIGN.md).

## Get started (two commands)

You need [Claude Code](https://claude.com/claude-code) and git — that's it.
Inside Claude Code, run these two commands once; they work in every project
from then on:

```
/plugin marketplace add baked-bean-io/debt-ledger
/plugin install debt-ledger@baked-bean-io
```

That's the whole install. The plugin carries its own copy of the `debt`
command inside it, so there is nothing to download, build, or add to your
PATH. (Works on Mac, Linux, and Windows — tests run on all of them.)

Then open the repo you want to track and start with:

> *"Scan this repo for tech debt and triage the results with me."*

Claude will look for existing `TODO`-style comments, read the code for the
deeper problems nobody flagged, and walk you through recording the real ones
— you approve or adjust every estimate in the chat. The result is a new
`.techdebt/items.json` file: **commit it.** That file is the debt list, and
it lives in your repo like any other code.

## What you can ask Claude to do

The plugin gives Claude four jobs. In all of them Claude works through the
same `debt` commands listed later in this file — it never edits the list
file directly, and it never records anything without your yes in the chat.

**1. Find debt.** Say things like *"scan src/auth for tech debt"* or *"look
at the diff on this branch — any debt worth recording?"* Claude reads the
code, proposes candidates in a table (with suggested numbers and a written
reason for each, scored against the shared rubric), and iterates with you.
Only when you confirm does it record them — and it checks the existing list
first so it won't re-propose something already tracked.

**2. Triage.** Say *"run a scan and triage the results with me"* or *"log
this as tech debt: the retry logic in client.ts is copy-pasted from
retry.ts."* Same confirmation gate: you set or approve every number before
anything is saved. For re-estimating an existing item, Claude will point
you at `debt triage --revisit <id>` (that one's interactive on purpose —
the numbers are yours to change, not Claude's).

**3. Suggest.** Say *"what debt should I fix while I'm in this file?"* or
*"I've got a slack afternoon — what's worth fixing?"* Claude works out
which files you're touching from git, asks the ranking for the answer, and
presents it with each item's why-it-surfaced reason. It's not allowed to
reorder the list or add its own picks — the ranking is arithmetic, and what
you see is what the math said.

**4. Bookkeeping.** Say *"td-a4f2 is fixed"* or *"we're never fixing that
one."* Claude flips the status (confirming the id with you first if it's
ambiguous) and reminds you to commit the change alongside the fix. If a
command ever reports the list file is unhealthy — usually right after a
merge — Claude will suggest `debt doctor`.

## Rolling it out to a team

Two files, both already in this repo's `examples/` folder:

- **One-click plugin install for everyone:** commit
  `examples/claude-settings-plugin.json` into the repo you're tracking as
  `.claude/settings.json`. Anyone who opens that repo in Claude Code gets
  asked once whether to install the plugin — one click and they have it.
- **Debt comments on pull requests:** copy `examples/debt-workflow.yml` into
  the repo as `.github/workflows/debt-ledger.yml` and push. From then on,
  any pull request that touches files with known debt gets **one** comment
  showing which items live in the files being changed and how they rank. It
  updates that same comment on every push, stays completely silent on PRs
  that don't touch tracked debt, and won't nag a PR about the very item it
  fixes. Teammates who never installed anything still see these.

Updates ship automatically: when this repo improves, `/plugin update
debt-ledger@baked-bean-io` (or auto-update, if you enable it in the settings
file) picks up the latest.

## How the ranking works, in plain words

Each item's score is: **how much it hurts × how fast it's getting worse ×
whether it's blocking other work, divided by how big the fix is.** Big pain,
spreading fast, blocking a feature, cheap to fix → top of the list. Ugly but
harmless and expensive to fix → bottom. The numbers come from you at triage
time and never change on their own, so the order is stable, and two people
looking at the same list see the same thing.

For the formula itself and the reasoning behind it, see
[DESIGN.md](DESIGN.md).

## Using the terminal instead (no Claude required)

Everything also works as a plain command-line tool — for teammates who don't
use Claude Code, for scripts, or for quick checks. The tool isn't on npm
yet, so you run it straight from a copy of this repo:

**Step 1 — get the code and build it** (needs Node.js 20 or newer and yarn):

```sh
git clone https://github.com/baked-bean-io/debt-ledger ~/debt-ledger
cd ~/debt-ledger
yarn install && yarn build
```

**Step 2 — make the `debt` command available everywhere.** Add this line
to your shell config file (that's `~/.zshrc` on a Mac; `~/.bashrc` on most
Linux setups), then open a new terminal window:

```sh
alias debt="node $HOME/debt-ledger/packages/cli/dist/index.js"
```

**Windows note:** instead of the alias, add this function to your PowerShell
profile (run `notepad $PROFILE` to open it), then start a new terminal:

```powershell
function debt { node "$HOME\debt-ledger\packages\cli\dist\index.js" @args }
```

**Step 3 — check it works.** `debt --help` should print the list of
commands. There's no account, no API key, and nothing leaves your machine.

The terminal loop mirrors what Claude does: `debt scan` to find candidate
TODO comments, `debt scan --json > /tmp/c.json && debt triage --candidates
/tmp/c.json` to review and record them (or plain `debt triage` to describe
something yourself), `debt report` for the ranked list, `debt suggest
--files a.ts,b.ts` or `--max-effort 2` for what's worth fixing now, and
`debt status <id> fixed` when something's done. Commit
`.techdebt/items.json` after it changes.

(A local clone also works as a plugin marketplace, by the way:
`/plugin marketplace add ~/debt-ledger`.)

## Every command, in one place

Eight commands total. The first five are the daily tools; the last three
mostly work behind the scenes (Claude uses them for you), but they're all
yours to run.

**`debt scan`** — reads your code and lists every `TODO`, `FIXME`,
`HACK` and `XXX` comment as a *candidate*: something that might deserve a
spot on the list. It never writes anything. It only looks at files git
knows about, so build output and other ignored junk can't slow it down. It
also warns you if any recorded item points at a file that no longer exists.
Add `--json` to get the candidates as data you can pipe into `triage`.

**`debt triage`** — the front door to the list. Everything on the list
went through this (or through Claude asking you). Three ways to use it:

- `debt triage` on its own: describe one piece of debt yourself,
  question by question.
- `debt triage --candidates <file>`: walk through what `scan --json`
  found, one candidate at a time — skip the noise, keep the real ones.
- `debt triage --revisit <id>`: reopen an existing item to change its
  numbers, prune a blocker that shipped, or change its status.

Every question shows you the measuring stick (see `rubric`) as you answer,
and each confirmed item is saved immediately — quitting halfway loses
nothing.

**`debt report`** — the ranked list: every open item, best
value-for-effort first, with a warning line under anything whose rank
depends on a "this blocks other work" claim, so stale claims get noticed
and pruned. `--json` gives the same thing as data.

**`debt suggest`** — "what should I fix right now?" With
`--files a.ts,b.ts` it shows only debt living in those files (fix it while
you're already there — the whole point of the tool). Without `--files` it
falls back to the overall top of the list. `--max-effort 2` keeps
suggestions small enough for the time you actually have, `--limit` changes
how many you get (normally 3), and every suggestion says *why* it came up.

**`debt status <id> <status>`** — one-line bookkeeping when things
change: `debt status td-a4f2 fixed`. The four statuses: `open`,
`planned` (scheduled but not done — still ranks), `fixed` and `wontfix`
(both drop out of the ranking but stay in the file as history). Do this in
the same commit as the fix.

**`debt add`** — records already-confirmed items from a JSON file
(`--file`) or piped input, and prints the new ids. This is how Claude
writes to the list after you've said yes in chat; you'll rarely type it
yourself. See `examples/confirmed-items.example.json` for the shape.

**`debt rubric`** — prints the measuring stick: what a 1-2-3-5-8 means
for effort and for impact, and which "getting worse" rates to use. It
exists so everyone on a team scores debt against the same yardstick.
`--json` for tools.

**`debt doctor`** — health check for the list file. On its own it only
reports problems: broken JSON, leftover merge-conflict markers, duplicate
ids, wrong formatting, or an item that looks like a mis-resolved merge.
With `--fix` it repairs what's safe to repair automatically (duplicate ids,
formatting) and refuses anything that needs your judgment. Run it any
time; it's also the second step of the merge-conflict recipe below.

## A nudge before you push (optional)

If you'd like git to catch you adding new `TODO` comments *before* they leave
your machine, there's a small hook for that. When (and only when) the commits
you're pushing add new TODO-style comments, it asks one question — "push
anyway?" — and pressing Enter pushes. It never bothers scripts or CI.

Install it into the repo you're tracking:

```sh
cp ~/debt-ledger/examples/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

To remove it later: `rm .git/hooks/pre-push`.

**Windows note:** this works as-is if you installed Git for Windows (git runs
hooks through its own bundled shell, even when you push from PowerShell).

## If two branches change the debt list at once (merge conflicts)

This is rare — the list only changes when someone records or updates an item,
and the file is formatted so every item sits in its own tidy block. But when
two branches both touch `.techdebt/items.json`, git may ask you to resolve a
conflict. Here's the whole recipe:

1. Open `.techdebt/items.json` and look closely at the conflicted area. Git
   usually puts the conflict *inside* a single item block, because both
   branches' new entries begin and end with the same lines. Delete the
   markers (`<<<<<<<`, `=======`, `>>>>>>>`) and rebuild the two versions as
   **two complete items** — each wrapped in its own `{ ... }`, separated by
   a comma, each with its own `"id"` line. Keeping both items is the goal;
   this is the one situation where editing the file by hand is exactly right.
2. Run `debt doctor --fix`. It checks the whole file, gives any
   accidentally duplicated id a fresh one, and restores the standard
   formatting.
   If the two versions were accidentally squashed into one item, doctor
   refuses to fix and tells you — rebuild that item from git history
   (`git log -p .techdebt/items.json`) and run it again.
3. Commit. Done.

`debt doctor` (without `--fix`) is also safe to run any time you just
want to check the ledger's health — it changes nothing.

## For contributors

```sh
yarn test    # run the whole test suite (vitest)
yarn build   # type-check and build all packages
```

The monorepo has four parts: `packages/core` (the data model and ranking —
plain TypeScript, no dependencies), `packages/cli` (the `debt` command),
`plugin/` (the Claude Code plugin: the skill plus a bundled copy of the CLI),
and `action/` (the GitHub Action).
