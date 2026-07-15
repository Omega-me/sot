# SOT tag categories

Registry of the categories usable in `@source-of-truth: <category>` tags.
This file is owned by the project: `sot inject` creates it once and never
overwrites it. To register a new category, add one bullet under
**Categories** — agents read this file before tagging, so a new line is all
it takes.

Format: one bullet per category — `` `category-name` `` — one sentence saying
what the tagged pattern is canonical for.

## Categories

- `injection-strategy` — canonical implementations of the asset-injection strategies (recursive copy, marker-managed block, create-once).
- `harness-registry` — canonical registry of supported harnesses, asset kinds, and per-harness template/target paths.
- `cli-output` — canonical terminal-output styling: colors, status glyphs, and line formatters shared by every command.
- `gui-server` — canonical local GUI HTTP server: loopback-only API that serves the static page, browses directories, and drives the real CLI via child processes.
- `removal-strategy` — canonical implementations of the asset-removal strategies mirroring injection: template-matched delete, marker-block strip, explicit-only delete of the user-owned registries.
