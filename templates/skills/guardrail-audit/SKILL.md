---
name: guardrail-audit
description: Full architecture guardrail audit. Use when reviewing compliance,
  checking drift, verifying patterns, auditing architecture, or when the user
  says audit, check compliance, verify architecture, or check guardrails.
  Reports violations without fixing them.
---

# Guardrail audit

Audit the codebase against the project's guardrails and report every
violation. **This skill never edits files** — fixing is owned by the sibling
`guardrail-fix` skill.

## References

- The project's agent instructions file at the repository root (e.g.
  `CLAUDE.md`, `AGENTS.md`, `AGENT.md`, or the harness equivalent — "the
  protocol file") — the source of truth for the project's own rules.
- `sot-guardrails.md` at the repository root — the project's own guardrail
  registry; audit every entry in it exactly like a checklist rule. If
  references conflict, `sot-guardrails.md` wins, then the protocol file.
- `references/audit-checklist.md` alongside this skill — the audit categories
  and report format.

## Execution

1. Read the protocol file and `sot-guardrails.md` at the repository root to
   load the current project guardrails.
2. Read `references/audit-checklist.md` for the audit categories and report
   format.
3. Search the full scope with your fastest available text-search tool (e.g.
   `rg`), excluding VCS, dependency, generated, and build-output directories.
4. **Inspect matching files before reporting a violation** — never flag on a
   filename or a search hit alone.
5. Group findings by category with precise file and line references.
6. End with the summary table required by the checklist.

## Output rules

For each violation, include the category, rule number, file and line, what is
wrong, the violated rule, and the expected fix — in the exact block format
from the checklist. If no violations are found, output the exact pass message
from `references/audit-checklist.md`.
