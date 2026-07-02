# techdebt-tracker

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
git clone <this-repo-url> ~/tech-debt-tracker
cd ~/tech-debt-tracker
yarn install && yarn build
```

**Step 2 — make the `techdebt` command available everywhere.** Add this line
to your shell config file (that's `~/.zshrc` on a Mac; `~/.bashrc` on most
Linux setups), then open a new terminal window:

```sh
alias techdebt="node $HOME/tech-debt-tracker/packages/cli/dist/index.js"
```

If you'd rather have a real command than an alias (handy if you skip the
plugin install described below), link it onto your PATH instead:

```sh
ln -s ~/tech-debt-tracker/packages/cli/dist/index.js /usr/local/bin/techdebt
```

**Windows note:** instead of the alias above, add this function to your
PowerShell profile (run `notepad $PROFILE` to open it), then start a new
terminal:

```powershell
function techdebt { node "$HOME\tech-debt-tracker\packages\cli\dist\index.js" @args }
```

**Step 3 — check it works.** `techdebt --help` should print the list of
commands. That's it — there's no account, no API key, and nothing leaves your
machine.

## Everyday use

Run all of these **inside the repo you want to track**, not inside this one.

**Find candidates.** This looks through your code for `TODO`, `FIXME`, `HACK`
and `XXX` comments — debt your past self already flagged:

```sh
techdebt scan
```

**Record the real ones.** Nothing goes on the list automatically — you review
each candidate and put numbers on it. The prompts explain every question as
you go:

```sh
techdebt scan --json > /tmp/candidates.json
techdebt triage --candidates /tmp/candidates.json
```

You can also record something no comment marks (a clunky module, a missing
test) with plain `techdebt triage` and describe it yourself. Afterwards,
**commit the `.techdebt/items.json` file** — it's part of your repo now.

**See what matters most:**

```sh
techdebt report
```

**Ask what's worth fixing right now.** Pass the files you're currently
touching and it favours debt in those files; or cap by effort when you just
have a spare afternoon:

```sh
techdebt suggest --files src/auth.ts,src/session.ts
techdebt suggest --max-effort 2
```

**When you fix something** (or decide you never will):

```sh
techdebt status td-a4f2 fixed      # or: wontfix / planned / open
```

**When an estimate feels wrong** or a ticket it was blocking has shipped:

```sh
techdebt triage --revisit td-a4f2
```

## Let Claude find the deeper debt

The `scan` command only finds debt someone already wrote a comment about. The
included Claude Code skill makes Claude actually read your code and propose
the un-flagged debt — design problems, missing tests, copy-pasted logic —
with suggested numbers and a written reason for each. You approve or edit
everything in the chat before anything is saved.

The easiest way to get it is the plugin. Inside Claude Code, run these two
commands once (they work in any project):

```
/plugin marketplace add <this-repo-on-github>     # e.g. your-name/tech-debt-tracker
/plugin install techdebt
```

That's the whole install. The plugin carries its own copy of the `techdebt`
command, so there is nothing to add to your PATH — the Step 2 alias above is
only needed if you want to run `techdebt` yourself in a terminal.

Until this repo is on GitHub, point the marketplace at your local copy
instead: `/plugin marketplace add ~/tech-debt-tracker`.

**For a whole team:** commit the file `examples/claude-settings-plugin.json`
into the repo you're tracking as `.claude/settings.json` (fill in the real
GitHub name). Anyone who opens that repo in Claude Code gets asked once
whether to install the plugin — one click and they have it.

Then just talk to Claude Code inside that repo:

- *"scan src/auth for tech debt"*
- *"what debt should I fix while I'm in this file?"*
- *"I've got a slack afternoon — what's worth fixing?"*
- *"td-a4f2 is fixed"*

## Get comments on pull requests (GitHub)

The included GitHub Action leaves **one** comment on any pull request that
touches files with known debt — showing which items live in the files being
changed and how they rank. It updates that same comment on every push, stays
completely silent on PRs that don't touch tracked debt, and won't nag a PR
about the very item it fixes.

To set it up:

1. Copy `examples/techdebt-workflow.yml` into your repo as
   `.github/workflows/techdebt.yml`.
2. In that file, change the `- uses: ./action` line to point at wherever this
   repo lives on GitHub, e.g. `- uses: your-name/tech-debt-tracker/action@main`.
3. Push. That's all — the workflow file already asks GitHub for the two
   permissions it needs (reading the code, writing the comment).

## A nudge before you push (optional)

If you'd like git to catch you adding new `TODO` comments *before* they leave
your machine, there's a small hook for that. When (and only when) the commits
you're pushing add new TODO-style comments, it asks one question — "push
anyway?" — and pressing Enter pushes. It never bothers scripts or CI.

Install it into the repo you're tracking:

```sh
cp ~/tech-debt-tracker/examples/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

To remove it later: `rm .git/hooks/pre-push`.

**Windows note:** this works as-is if you installed Git for Windows (git runs
hooks through its own bundled shell, even when you push from PowerShell).

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
plain TypeScript, no dependencies), `packages/cli` (the `techdebt` command),
`plugin/` (the Claude Code plugin: the skill plus a bundled copy of the CLI),
and `action/` (the GitHub Action).
