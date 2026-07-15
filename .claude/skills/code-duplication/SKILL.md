---
name: code-duplication
description: Report duplicated code — exact clones, near clones, structural
  clones, duplicated constants/types/schemas. Use when the user says
  duplication, duplicated code, copy-paste, DRY, or find duplicates.
  REPORT ONLY — pinpoints every instance and suggests a fix, but never edits;
  the user decides what to consolidate.
---

# Code duplication

Find duplicated code and report it precisely: every instance with exact file
and line spans, plus a suggested fix. **This skill never edits files** — the
user reviews the report and takes action themselves.

## What to detect

- **Exact clones** — byte-identical blocks in more than one place.
- **Near clones** — same logic with renamed variables or trivial reordering.
- **Structural clones** — same shape and flow with different types or
  literals.
- **Duplicated constants, types, and schemas** — the same value, contract, or
  validation shape declared independently in multiple modules.

Use a clone detector when one is available for the stack (e.g. `jscpd`) plus
a manual search with your fastest available text-search tool for copied
names, distinctive literals, and repeated error messages. Detector output is
a candidate list — read every candidate before reporting it; never report on
a detector hit alone.

## Suggested fix (recommendation only)

For each clone set, recommend where the single copy *could* live, following
module-placement rules:

1. Duplicated **within one module** → a local helper inside that module.
2. Duplicated across **sibling children of one grouping module** → the
   `core/` of that grouping subtree (only when ≥2 siblings use it).
3. Duplicated across **unrelated modules in one app** → the app-wide common
   module.
4. Duplicated across **packages/apps** → a shared package.

Recommend the canonical copy by ownership — the module that owns the domain —
with other consumers importing through its public barrel. Flag likely
**coincidental duplication** (same shape, different reasons to change) as
"leave as is" rather than recommending a merge.

## Hard boundary — no action

- Do not edit, move, delete, or consolidate anything, even when the fix looks
  obvious. Report and stop.
- Do not weaken the recommendation to force mergability (no suggestions that
  require untyped escape hatches or lowest-common-denominator signatures).
- If a recommendation would need a new shared package or conflicts with an
  SOT-tagged pattern, say so in the report — that is the user's call.

## Report format

Group findings as clone sets, each instance with exact file and line spans:

```
### Clone set N — short description (exact | near | structural | constant/type/schema)

Instances:
- path/to/a.ts:10-42
- path/to/b.ts:15-47

Suggested fix: extract to path/to/owner/module (reason: owns the domain);
rewire b.ts through its public barrel.
```

End with: `Found N clone sets across M files. No changes made — review and pick the fixes to apply.`

If nothing is duplicated → output: **No actionable duplication found. ✅**
