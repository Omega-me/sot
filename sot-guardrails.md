# SOT guardrails

Registry of this project's own guardrails — hard rules the code must follow,
extending the baseline rules in the injected SOT protocol block. This file is
owned by the project: `sot inject` creates it once and never overwrites it.

**This file is the only place to add, change, or remove a project guardrail.**
When the user asks to add a guardrail, add it here — never inside the injected
protocol block in the protocol file (`CLAUDE.md`, `AGENTS.md`, `AGENT.md`, or
the harness equivalent), which is replaced wholesale on every re-inject.
Agents read this file before writing code, so a new bullet is all it takes.
If an entry here conflicts with the injected baseline rules, this file wins.

Format: one bullet per guardrail under **Guardrails** — a single enforceable
sentence stating what must (or must never) be done, optionally followed by an
indented `Why:` line. Group related guardrails under `###` subheadings once
the list grows.

## Guardrails

### Templates (`templates/`)

- Templates stay harness-agnostic: never reference a harness-specific path
  (e.g. `.claude/`) or harness-specific wording; refer to the protocol file
  generically ("`CLAUDE.md`, `AGENTS.md`, `AGENT.md`, or the harness
  equivalent").
  Why: the same payload is injected unchanged for Claude Code, Codex,
  Copilot, and Cursor.
- Templates stay project-agnostic: no absolute paths, no personal or org
  names; stack-specific constructs appear only as parenthetical examples
  (e.g. "untyped escape hatches (e.g. TypeScript's `any`)"), never as the
  rule itself.
- Reference sibling skills by name ("the `guardrail-audit` skill alongside
  this one"), never by an injected path.
- `templates/` ships as-is and is never compiled; adding an agent `.md` or a
  skill folder must require no change in `src/`.
  Why: the injectors and `list` enumerate the template directories at
  runtime.

### Machinery (`src/`)

- Never mix the three injection strategies: agents/skills = recursive copy
  (skip existing unless `--force`); rules = marker-managed block;
  categories/guardrails = create-once, never overwritten — not even with
  `--force`.
- `injectRules` never touches content outside the protocol markers, and a
  marker counts only when it stands alone on its own line.
  Why: a marker mentioned in prose once corrupted this repo's own
  `CLAUDE.md` on re-inject.
- `commander` and `picocolors` are the only runtime dependencies — do not
  add another. All terminal styling goes through `src/lib/ui.ts`; never
  import `picocolors` elsewhere.
- A new asset kind must be wired end-to-end: `ASSET_KINDS`/`HARNESS_TARGETS`
  in `src/lib/constants.ts`, an injector in `src/lib/inject.ts` returning
  `InjectResult`, a runner entry in `src/commands/inject.ts`, a CLI flag in
  `src/index.ts`, and a test in `test/inject.test.ts`.

### Tests

- Tests run the real injectors against a temp dir — no mocks.
  Why: the failure modes are filesystem edge cases (re-runs, existing
  files, a pre-existing `CLAUDE.md`).
