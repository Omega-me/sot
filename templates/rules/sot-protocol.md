<!--
  DO NOT EDIT THIS BLOCK. Everything between the sot-protocol markers is
  owned and rewritten by the `sot` CLI on every `sot inject` — manual edits
  here are lost on the next run. It documents how the sot-injected agents
  and skills are used. Add project-specific notes OUTSIDE the markers (or in
  `sot-guardrails.md` for guardrails); those are never touched.
-->

# SOT protocol (managed by `sot` — do not edit inside the markers)

The codebase is the memory: canonical patterns live as tagged comments next to
real implementations. Follow this protocol for every change.

## Before writing code — the lookup chain

1. Search `@source-of-truth` tags and read the matching tagged files (primary
   authority). Each tag carries a `// File purpose:` line for fast triage.
   The valid tag categories are registered in `sot-categories.md` at the
   repo root — read it to know which categories exist.
2. If the tags are not enough, rely on the injected skills (in the skills
   directory for your harness): read every skill whose description matches
   the task — start with `sot-navigator`.
3. If neither a tag nor a skill covers the pattern, **stop and ask the user
   how to implement it, offering concrete suggestions** (candidate
   approaches, or the closest tag/skill to extend). Never implement on your
   own — an invented pattern is likely hallucinated and lands outside the
   guardrails.

## Precedence when guidance conflicts

1. `sot-guardrails.md` at the repo root (the project's own guardrails)
2. This file  3. The matching skill  4. The matching SOT-tagged implementation

## Hard rules

The baseline rules below apply to every project. The project's own guardrails
live in `sot-guardrails.md` at the repo root — read it before writing code and
enforce its entries exactly like the rules here. **To add, change, or remove a
project guardrail, edit `sot-guardrails.md` — never this injected block, which
is replaced wholesale on every re-inject.**

- No untyped escape hatches (e.g. TypeScript's `any`) and no
  checker-suppression comments — fix the underlying error.
- No magic values — constants live in the owning module's constants file.
- One public barrel/entry file per module; never deep-import another module's
  internals.
- Logic stays out of view code and routes; backend owns data + business logic.
- Never silently modify a canonical tagged pattern — surface the conflict first.
- Communicate per the `caveman` skill: terse prose, technical content
  byte-exact.

## After writing code

- Tag genuinely new canonical patterns: `@source-of-truth: <category>` +
  `// File purpose:` line. Use a category registered in `sot-categories.md`
  at the repo root; if none fits, add the new category there first — never
  tag with an unregistered category.
- Re-read changed files against the tags/skills used; run the narrowest finite
  checks (lint/typecheck for touched files). Never start dev/watch/server
  processes.

## Using the injected skills

The skills live in the skills directory for your harness. Each is a
step-by-step playbook: when its description matches the task, read the whole
skill and follow its steps literally — do not paraphrase or improvise around
it. Skills are step 2 of the lookup chain, the authority when tags alone
don't cover the pattern.

- `sot-navigator` — the lookup chain itself; run it before implementing
  anything. Entry point to every other skill.
- `guardrail-audit` — full compliance audit against the guardrails; report
  only, never fixes.
- `guardrail-fix` — smallest fixes for `guardrail-audit` findings; always
  audits first, never redesigns.
- `dead-code-removal` — find and delete dead code, each deletion backed by
  verified evidence.
- `code-duplication` — report duplicated code with exact locations and
  suggested fixes; never edits — the user applies fixes.
- `caveman` — the terse communication style required for all output.

## Using the injected agents

The agents live in the agents directory for your harness. Delegate to them
via your harness's subagent mechanism; if the harness has none, open the
agent file and follow its instructions inline as your own. Pick by task
shape — implementation goes to `sot-build`, compliance to `sot-review`:

- `sot-build` — day-to-day implementation ("build X", "add Y", "implement
  this"). Runs the lookup chain, then builds to the matched pattern and
  verifies with the narrowest finite checks.
- `sot-review` — invoke before a commit/PR, after a batch of work, or when
  asked to audit or fix guardrails. Audits against the guardrails, then
  applies the smallest fixes that restore compliance and re-verifies.
