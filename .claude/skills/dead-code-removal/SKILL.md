---
name: dead-code-removal
description: Find AND delete dead code — unused exports, unreachable branches,
  unused files, unused dependencies, commented-out blocks. Use when the user
  says dead code, unused, remove unused, cleanup, or prune. Evidence-first;
  deletes in small verified batches.
---

# Dead-code removal

Find dead code, prove it is dead, then delete it. This skill both detects and
removes — a finding that survives verification gets deleted, not just
reported.

## What counts as dead

- Exports/symbols with no references anywhere in the repository.
- Unreachable branches (conditions that can never be true, code after
  unconditional returns/throws).
- Files nothing imports or executes.
- Declared dependencies no source file uses.
- Commented-out code blocks (version control is the archive).

## Detection — evidence, not authority

1. Build candidates with a whole-repository reference search using your
   fastest available text-search tool (e.g. `rg`), excluding VCS, dependency,
   generated, and build-output directories. Search for the symbol name, the
   file's import path, and any string forms of either.
2. When the stack has a dead-code analyzer, run it as a second source (e.g.
   `knip` or `ts-prune` for TypeScript, `vulture` for Python, compiler
   dead-code warnings elsewhere). **Analyzers produce candidates, never
   verdicts** — every finding is confirmed by reading the source.
3. A candidate is confirmed dead only when both the reference search and a
   read of the surrounding code agree nothing reaches it.

## Never delete on a finding alone

Do not remove any of these on a search/analyzer finding — each needs explicit
confirmation that nothing discovers it by convention or at runtime:

- Framework-convention files discovered by name or location (e.g. routes,
  migrations, config files).
- Entry points (bin/main files, exported CLI commands, lifecycle handlers).
- The public API of a published or shared package.
- SOT-tagged canonical pattern files.
- Symbols referenced via reflection, dependency injection, or string lookups.
- External contracts (webhook handlers, scheduled jobs, API surface consumed
  by other systems).
- Test fixtures and factory data loaded dynamically.

When in doubt, report the candidate instead of deleting it.

## Removal protocol

1. Delete the **whole dead unit**: the file or export plus its now-orphaned
   imports, types, constants, and tests — never leave half-removed remains.
2. Work in the smallest safe batch (one unit or one tightly-related cluster
   at a time).
3. After each batch, re-run the narrowest finite checks the project defines
   (typecheck, lint, tests for the touched area). Finite non-server checks
   only — never start dev/watch/server processes.
4. If a check fails, restore the batch and reclassify the candidate as live.

## Report format

One line per removal:

```
Removed: path/to/file:LINE — symbolName (evidence: no references in repo; analyzer agrees)
```

End with: `Removed N dead units across M files.`

If nothing is dead → output: **No dead code found. ✅**
