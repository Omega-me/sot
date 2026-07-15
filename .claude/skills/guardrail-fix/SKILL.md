---
name: guardrail-fix
description: Fix architecture guardrail violations. Use when fixing compliance
  issues, correcting imports, repairing module structure, adding missing
  barrels, fixing SOT tags, resolving architecture violations, or when the
  user says fix violations, fix guardrails, or fix compliance. Audits first,
  edits files, then re-verifies.
---

# Guardrail fix

Find guardrail violations, fix them directly, and re-verify the result. Audit
first; this skill is for editing, not just reporting.

## References

- The project's agent instructions file at the repository root (e.g.
  `CLAUDE.md`, `AGENTS.md`, `AGENT.md`, or the harness equivalent — "the
  protocol file") — the source of truth for the project's own rules.
- `sot-guardrails.md` at the repository root — the project's own guardrail
  registry; its entries are enforced exactly like protocol rules. If
  references conflict, `sot-guardrails.md` wins, then the protocol file.
- The `guardrail-audit` skill alongside this one — its
  `references/audit-checklist.md` is the checklist used before and after
  fixes (not duplicated here; both skills are always injected together).
- `references/fix-actions.md` alongside this skill — fix workflow and allowed
  fix actions.

## Workflow

1. Read the protocol file, `sot-guardrails.md` at the repository root, the
   sibling `guardrail-audit` skill's `references/audit-checklist.md`, and
   `references/fix-actions.md`.
2. Run the full audit checklist to identify violations.
3. For each violation, inspect the relevant SOT tag or skill **before**
   editing.
4. Apply the smallest fix that restores compliance — nothing more.
5. Re-run the relevant audit checks and confirm no new violations were
   introduced; run the narrowest finite project checks (lint/typecheck for
   touched files). Never start dev/watch/server processes.
6. Summarize fixed files and counts.

## Fix boundaries

Do not invent new architecture. If a fix requires a pattern that has no
matching SOT tag or skill, stop and ask the user. Ask before adding
dependencies, moving large module boundaries, or changing SOT-tagged canonical
code in a way that alters the pattern. Never weaken a guardrail to silence it
(new suppression comment, loosened check, untyped escape hatch, or editing a
rule out of `sot-guardrails.md` to make a finding pass) — that is itself a
violation. Only the user decides to relax a guardrail; when they do, record
the change in `sot-guardrails.md`, never in the injected protocol block.

## Output rules

Report each applied fix in the format from `references/fix-actions.md`, then
end with the final count: `Fixed N violations across M files.` If there is
nothing to fix, output the exact no-op pass message from that reference.
