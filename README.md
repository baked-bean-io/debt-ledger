# debt-ledger

Every codebase collects shortcuts and "we'll fix this later" spots — that's
technical debt. This tool keeps an honest list of yours, saved as a small file
inside your own repo, and ranks the list so you always know what's worth
fixing next.

The idea in one paragraph: when you find a piece of debt, you answer a few
quick questions about it — how big is the fix, how much pain does it cause,
is it getting worse over time. Your answers are saved to `.techdebt/items.json`
in your repo, committed to git like any other file. From then on a simple
formula ranks everything, one command shows you the ranked list, and (if you
want) GitHub comments on pull requests that touch files with known debt.
Nothing decides for you and no AI is involved in the ranking — the same list
comes out in the same order every time, and you can always see why.

Full design decisions live in [DESIGN.md](DESIGN.md).

## What you need

- A Mac, Linux, or Windows machine
- Node.js version 20 or newer — check with `node --version`
- git
- Optional: [Claude Code](https://claude.com/claude-code), if you want AI help *finding* debt

On Windows, everything below works from PowerShell except where a Windows
note says otherwise. (Continuous tests run on both Linux and Windows, so
both are first-class.)

## Install (about two minutes)

The tool isn't on npm yet, so you run it straight from a copy of this repo.

**Step 1 — get the code and build it.** In your terminal:

```sh
git clone https://github.com/bakebean/debt-ledger ~/debt-ledger
cd ~/debt-ledger
yarn install && yarn build
```

**Step 2 — make the `debt` command available everywhere.** Add this line
to your shell config file (that's `~/.zshrc` on a Mac; `~/.bashrc` on most
Linux setups), then open a new terminal window:

```sh
alias debt="node $HOME/debt-ledger/packages/cli/dist/index.js"
```

If you'd rather have a real command than an alias (handy if you skip the
plugin install described below), link it onto your PATH instead:

```sh
ln -s ~/debt-ledger/packages/cli/dist/index.js /usr/local/bin/debt
```

**Windows note:** instead of the alias above, add this function to your
PowerShell profile (run `notepad $PROFILE` to open it), then start a new
terminal:

```powershell
function debt { node "$HOME\debt-ledger\packages\cli\dist\index.js" @args }
```

**Step 3 — check it works.** `debt --help` should print the list of
commands. That's it — there's no account, no API key, and nothing leaves your
machine.

## Everyday use

Run all of these **inside the repo you want to track**, not inside this one.

**Find candidates.** This looks through your code for `TODO`, `FIXME`, `HACK`
and `XXX` comments — debt your past self already flagged:

```sh
debt scan
```

**Record the real ones.** Nothing goes on the list automatically — you review
each candidate and put numbers on it. The prompts explain every question as
you go:

```sh
debt scan --json > /tmp/candidates.json
debt triage --candidates /tmp/candidates.json
```

You can also record something no comment marks (a clunky module, a missing
test) with plain `debt triage` and describe it yourself. Afterwards,
**commit the `.techdebt/items.json` file** — it's part of your repo now.

**See what matters most:**

```sh
debt report
```

**Ask what's worth fixing right now.** Pass the files you're currently
touching and it favours debt in those files; or cap by effort when you just
have a spare afternoon:

```sh
debt suggest --files src/auth.ts,src/session.ts
debt suggest --max-effort 2
```

**When you fix something** (or decide you never will):

```sh
debt status td-a4f2 fixed      # or: wontfix / planned / open
```

**When an estimate feels wrong** or a ticket it was blocking has shipped:

```sh
debt triage --revisit td-a4f2
```

## Every command, in one place

Eight commands total. The first five are your daily tools; the last three
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

## Let Claude find the deeper debt

The `scan` command only finds debt someone already wrote a comment about. The
included Claude Code skill makes Claude actually read your code and propose
the un-flagged debt — design problems, missing tests, copy-pasted logic —
with suggested numbers and a written reason for each. You approve or edit
everything in the chat before anything is saved.

The easiest way to get it is the plugin. Inside Claude Code, run these two
commands once (they work in any project):

```
/plugin marketplace add bakebean/debt-ledger
/plugin install debt-ledger@bakebean
```

That's the whole install. The plugin carries its own copy of the `debt`
command, so there is nothing to add to your PATH — the Step 2 alias above is
only needed if you want to run `debt` yourself in a terminal.

A local checkout works as a marketplace path too — `/plugin marketplace add
~/debt-ledger` — handy if you're working from a clone instead of GitHub.

**For a whole team:** commit the file `examples/claude-settings-plugin.json`
into the repo you're tracking as `.claude/settings.json`. Anyone who opens
that repo in Claude Code gets asked once whether to install the plugin —
one click and they have it.

### What you can ask Claude to do

The skill gives Claude four jobs. In every one of them, Claude uses the same
`debt` commands described above — it never edits the list file directly,
and it never records anything without your yes in the chat.

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
you at `debt triage --revisit <id>` (that one's interactive on
purpose — the numbers are yours to change, not Claude's).

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

## Get comments on pull requests (GitHub)

The included GitHub Action leaves **one** comment on any pull request that
touches files with known debt — showing which items live in the files being
changed and how they rank. It updates that same comment on every push, stays
completely silent on PRs that don't touch tracked debt, and won't nag a PR
about the very item it fixes.

To set it up:

1. Copy `examples/debt-workflow.yml` into your repo as
   `.github/workflows/debt-ledger.yml`.
2. Push. That's all — the workflow file already asks GitHub for the two
   permissions it needs (reading the code, writing the comment), and it
   already points at `bakebean/debt-ledger/action@main`.

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

## How the ranking works, in plain words

Each item's score is: **how much it hurts × how fast it's getting worse ×
whether it's blocking other work, divided by how big the fix is.** Big pain,
spreading fast, blocking a feature, cheap to fix → top of the list. Ugly but
harmless and expensive to fix → bottom. The numbers come from you at triage
time and never change on their own, so the order is stable, and two people
looking at the same list see the same thing.

For the formula itself and the reasoning behind it, see
[DESIGN.md](DESIGN.md).

## For contributors

```sh
yarn test    # run the whole test suite (vitest)
yarn build   # type-check and build all packages
```

The monorepo has four parts: `packages/core` (the data model and ranking —
plain TypeScript, no dependencies), `packages/cli` (the `debt` command),
`plugin/` (the Claude Code plugin: the skill plus a bundled copy of the CLI),
and `action/` (the GitHub Action).
