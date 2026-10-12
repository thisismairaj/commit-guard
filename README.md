<h1 align="center">commit-guard</h1>

<p align="center">
  Blocks a git commit when the staged diff looks like it contains a real secret -<br/>
  an API key, a private key, a token - before it ships.
</p>

---

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
