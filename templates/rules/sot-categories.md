# SOT tag categories

Registry of the categories usable in `@source-of-truth: <category>` tags.
This file is owned by the project: `sot inject` creates it once and never
overwrites it. To register a new category, add one bullet under
**Categories** — agents read this file before tagging, so a new line is all
it takes.

Format: one bullet per category — `` `category-name` `` — one sentence saying
what the tagged pattern is canonical for.

## Categories

The entries below are seed examples — replace them with this project's real
categories.

- `api-client` — canonical wiring for calling an external service (e.g. an HTTP client wrapper).
- `data-access` — canonical pattern for reading/writing persistent data (e.g. a repository or query module).
- `error-handling` — canonical shape for raising, wrapping, and reporting errors.
