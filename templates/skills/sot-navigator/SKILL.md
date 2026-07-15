---
name: sot-navigator
description: Use BEFORE implementing any feature, module, or structural change.
  Runs the source-of-truth lookup chain (SOT tags → skills → ask) so new code
  matches canonical patterns instead of inventing new ones. Triggers on "add",
  "build", "implement", "create", "refactor" tasks.
---

# SOT navigator

This skill owns the **lookup chain**: how to find the canonical pattern before
writing code. The codebase is the memory — authoritative patterns live as tagged
comments next to real implementations, not in external docs.

## SOT tags

Canonical files are marked with a tag + intent line, written in whatever
comment syntax the file's language uses:

```
// @source-of-truth: <category-name>
// File purpose: <one sentence describing this file's role>.
```

Categories are a closed vocabulary registered in `sot-categories.md` at the
repository root — one bullet per category. Read it to know which categories
exist; adding a bullet there is how the vocabulary grows. Never tag with an
unregistered category. The `// File purpose:` line is the triage signal —
read it with the search hit before opening the whole file.

## The lookup chain (mandatory, in order)

1. **Search SOT tags first.** Search the whole repository for
   `@source-of-truth` with your fastest available text-search tool, excluding
   VCS, dependency, generated, and build-output directories (e.g.
   `rg -n -A2 '@source-of-truth' --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/dist/**'`).
   Then narrow to the specific category for what you're building. Read the
   matching tagged files — they are the primary authority.
2. **Fall back to skills when tags are not enough.** If no tag covers the
   pattern — or the tagged examples don't answer the specific decision — rely
   on the injected skills: read every skill whose description matches the
   task. Mandatory skills apply even when a tagged example exists.
3. **Ask when unsupported — never implement on your own.** If neither a tag
   nor a skill covers the pattern, stop. Do not improvise: an invented
   pattern is likely hallucinated and lands outside the guardrails. Ask the
   user how the implementation should be done and **offer concrete
   suggestions** (2–3 candidate approaches with trade-offs, or the closest
   existing tag/skill that could be extended), then wait for their choice.
4. **Implement** following the matched tag + skill exactly. If they conflict,
   surface the conflict before changing code.
5. **Verify.** Re-read every created/modified file against the tags and skills
   used. Every structural decision must trace to a tag or skill.
6. **Tag new canonical patterns.** A genuinely new pattern gets its own
   `@source-of-truth` tag + `// File purpose:` line so the next change finds it.
   Use a category registered in `sot-categories.md`; if none fits, register
   the new category there first.

## Precedence when guidance conflicts

1. `sot-guardrails.md` at the repository root — the project's own guardrail
   registry, read before writing code
2. The protocol file at the repository root (e.g. `CLAUDE.md`, `AGENTS.md`,
   `AGENT.md`, or the harness equivalent)
3. The matching skill playbook
4. The matching SOT-tagged implementation

## Skill routing

- Full compliance audits → the `guardrail-audit` skill alongside this one.
- Fixing reported violations → the `guardrail-fix` skill.
- Finding and deleting unused code → the `dead-code-removal` skill.
- Reporting duplicated code (report only — the user applies fixes) → the
  `code-duplication` skill.

## Stop conditions

Ask the user before proceeding when:

- No SOT tag or skill covers the pattern being introduced — ask how to
  implement it and suggest options; never proceed on your own.
- The requested change conflicts with an existing SOT tag or skill.
- The change would require a new dependency.

## Runtime testing ownership

The user owns runtime app verification and manual UI testing. Never start,
restart, or keep alive dev/watch/server processes for verification. Use finite
non-server checks only: lint, typecheck, build, unit tests, codegen commands
that exit. If runtime or app-flow verification is needed, hand the user the
exact manual checks to run.

## Verification checklist (run before reporting done)

- [ ] Named the SOT tags and skills used for this change.
- [ ] Every new/modified file re-read against those tags/skills.
- [ ] Every structural decision traces to a tag or skill — nothing invented.
- [ ] Every modified SOT-tagged file keeps its `// File purpose:` line directly
      under the contiguous tag block.
- [ ] New canonical patterns tagged with a category registered in
      `sot-categories.md` + `// File purpose:`.
- [ ] Narrowest relevant finite checks run (lint/typecheck/tests for touched
      files); skipped checks named with the reason; no dev/watch/server
      processes started.
