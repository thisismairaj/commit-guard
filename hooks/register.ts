import type { Register } from 'claude-code'

// Heuristic, not a hard security boundary: a best-effort last line of
// defense before an obvious secret ships in a commit. False negatives are
// expected (it only catches well-known shapes); false positives fail OPEN
// (see the .catch below), never closed - a buggy pattern should never be
// the reason `git commit` stops working.
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'AWS secret key', re: /aws_secret_access_key\s*=\s*['"]?[A-Za-z0-9/+=]{40}/i },
  { name: 'GitHub token', re: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: 'Slack token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'Stripe live key', re: /sk_live_[A-Za-z0-9]{24,}/ },
  { name: 'Anthropic API key', re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'OpenAI API key', re: /sk-[A-Za-z0-9]{20,}/ },
  { name: 'Google API key', re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'Private key block', re: /-----BEGIN (RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/ },
  { name: 'JWT', re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'Generic secret assignment', re: /(api[_-]?key|secret|access[_-]?token|password)\s*[:=]\s*['"][A-Za-z0-9_\-/+]{16,}['"]/i },
]

const GIT_COMMIT = /\bgit\s+(?:-\S+\s+)*commit\b/
const COMMITS_ALL_TRACKED = /\bgit\s+commit\b.*\s(-a\b|--all\b)/

function findSecrets(text: string): string[] {
  const hits = new Set<string>()
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(text)) hits.add(name)
  }
  return [...hits]
}

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const command = (e as { command?: string }).command

    if (typeof command === 'string' && GIT_COMMIT.test(command)) {
      const diffs = await Promise.all([
        $.process.run(['git', 'diff', '--cached']),
        COMMITS_ALL_TRACKED.test(command) ? $.process.run(['git', 'diff']) : null,
      ])
      const text = diffs.filter((d): d is NonNullable<typeof d> => d !== null).map(d => d.stdout).join('\n')
      const hits = findSecrets(text)

      if (hits.length > 0) {
        return {
          deny:
            `commit-guard: the staged diff looks like it contains ${hits.join(', ')}. ` +
            `Remove it (or move it to an untracked .env) before committing. If this is a ` +
            `false positive, the patterns live in commit-guard/hooks/register.ts.`,
        }
      }
    }

    return next(e)
  }).catch(($, e, next) => next(e)) // scanning failed for any reason - never block a commit over our own bug
}
