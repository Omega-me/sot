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

The entries below are seed examples — replace them with this project's real
guardrails.

- Never log secrets, tokens, or personal data — redact before writing to any
  log sink.
- All user-facing text goes through the project's localization or copy
  mechanism — no hard-coded display strings in code.
- Every public entry point (e.g. API handlers, exposed functions, form
  submissions) validates its inputs before any business logic runs.
