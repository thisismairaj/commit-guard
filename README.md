<h1 align="center">commit-guard</h1>

<p align="center">
  Blocks a git commit when the staged diff looks like it contains a real secret -<br/>
  an API key, a private key, a token - before it ships.
</p>

---

## Why this matters

A leaked API key doesn't cost you the five minutes it takes to rotate it. It
costs whatever happens in the window between the push and the rotation - and
by the time you notice, a key that hit a public repo may already be scraped
and replayed. The entire value of commit-guard is closing that window before
it opens: catching the secret at `git commit`, not at `git push`, not after a
security bot emails you.

It's a free, always-on check with nothing to configure and nothing to
maintain. Most commits, it does nothing at all. The one time it matters,
it's the difference between an awkward five-second fix and an incident.

**Two honest limits.** It only watches commits that go through Claude Code's
own Bash tool, so a commit typed directly into a terminal outside a session
isn't covered. And it scans the diff before the commit runs, so a single
chained command like `git add -A && git commit -m "..."` stages its changes
after the scan already ran against the old state - a secret added in that
same command can slip through. Treat it as a strong last line of defense
against the common mistake, not a guarantee against every possible sequence
of commands.

## What it does

Hooks every `git commit`, scans `git diff --cached` (and the working tree too,
if the command used `-a`/`--all`) against a set of known secret shapes - AWS
keys, GitHub/Anthropic/OpenAI/Google/Stripe tokens, PEM private key blocks,
JWTs, and a generic `password = "..."` / `api_key: "..."` pattern - and
refuses the commit outright if anything matches. The tool never runs; nothing
reaches git, nothing reaches a remote.

```
$ git commit -m "wip"

✘ commit-guard: the staged diff looks like it contains GitHub token. Remove
  it (or move it to an untracked .env) before committing.
```

This is a heuristic, not a hard security boundary. It only catches
well-known shapes, so it will miss things - treat it as a last line of
defense, not a substitute for actually not committing secrets.

## Install

```
/plugin install commit-guard --marketplace thisismairaj/commit-guard
```

## How it works

A `tool.call` hook scoped to `{ tool: 'Bash' }` checks whether the command is
a `git commit`. If it is, it runs `git diff --cached` through `$.process.run`
*before* calling `next(e)` - the real commit never executes until the hook
decides to let it. A match returns `{ deny: reason }` directly, which refuses
the call entirely; no match (or no match at all if the command wasn't a
commit) falls through to `next(e)` and the commit runs normally.

The patterns live in `hooks/register.ts` as a plain array - add your own
there if you want to catch something specific to your own stack.

**Fails open, deliberately.** If the scan itself throws for any reason
(`$.process.run` erroring, not being in a git repo, whatever), the `.catch`
handler just calls `next(e)` and lets the commit through. A bug in this
plugin should never be the reason `git commit` stops working.

## Development

Built and iterated inside a live Claude Code session using a dev-mod's hot
reload - see [token-weather](https://github.com/thisismairaj/token-weather)
for more on that workflow. No build step; the hooks module runs directly as
TypeScript.

```bash
claude plugin validate .
```

## License

MIT
