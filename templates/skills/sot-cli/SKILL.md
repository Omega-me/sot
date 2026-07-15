---
name: sot-cli
description: How to install and drive the `sot` CLI itself — inject, remove,
  list, gui. Use when the user says install sot, inject sot, set up sot, add
  the sot protocol, remove sot assets, update sot assets, re-inject, or asks
  how the sot CLI works.
---

# sot CLI

`sot` injects reusable coding-agent assets — subagents, skills, a protocol
rules block, and two project-owned registry files — into any project. This
skill is the playbook for operating the CLI on the user's behalf.

## Getting the CLI

1. Check first: `sot --version`. If it prints a version, the CLI is on PATH —
   skip installation.
2. If not available, two install routes:
   - **From source** (requires Node ≥ 20.6 and pnpm):
     ```sh
     git clone https://github.com/Omega-me/sot.git && cd sot
     pnpm install
     pnpm build
     pnpm link --global
     ```
   - **Standalone `sot.exe`** (Windows, no Node needed): place a prebuilt
     `sot.exe` in a stable folder on PATH.
3. If neither route is possible, **stop and ask the user** how they want the
   CLI installed — never improvise an alternative.

## Commands

- `sot inject` — inject everything for the default harness (Claude Code).
  - `sot inject -H codex,cursor` — target other harnesses (`claude`, `codex`,
    `copilot`, `cursor`; one or more, comma-separated).
  - Kind flags restrict what is injected: `--agents`, `--skills`, `--rules`,
    `--categories`, `--guardrails`.
  - `--only <names...>` — restrict agents/skills to the named ones.
  - `--force` — overwrite existing agents/skills.
  - `-t <dir>` — target a directory other than the current one.
  - `--json` — machine-readable result. Agents should prefer `--json` and
    parse the output.
- `sot list` (`--json`) — show what would be injected and where.
- `sot remove` — undo an injection; same flags as `inject` except `--force`
  (which `remove` does not have), plus `--purge`. A plain
  remove-all **skips the user-owned registries** (`sot-categories.md`,
  `sot-guardrails.md`); they are deleted only with their explicit kind flag
  (`--categories` / `--guardrails`) or `--purge`. Only agent/skill names that
  exist in `sot`'s own templates are deleted — the project's own agents and
  skills living in the same directories are never touched.
- `sot gui` — local web GUI at http://127.0.0.1:4400/ (`--port <n>`,
  `--no-open`), loopback-only. **Never start the GUI yourself** — it is a
  long-running server for humans. Mention it only so the user knows it
  exists.

## Safety semantics

- `inject` is idempotent — re-running is always safe.
- Rules live in a marker-managed block between `<!-- sot-protocol:begin -->`
  and `<!-- sot-protocol:end -->` in the protocol file (`CLAUDE.md`,
  `AGENTS.md`, `AGENT.md`, or the harness equivalent). Content outside the
  markers is never touched; re-injecting refreshes the block in place.
- Categories and guardrails (`sot-categories.md`, `sot-guardrails.md`) are
  **create-once**: never overwritten, not even with `--force`. The project
  owns their content after injection.

## Playbook

1. Verify the CLI is available (`sot --version`); install per the routes
   above if not, or ask the user.
2. Run `sot list --json` to see the available assets and where they land.
3. Run the **narrowest** inject/remove command for the request, with
   `--json` (e.g. only the asked-for kinds, `--only` for named
   agents/skills, `-H` for the requested harnesses).
4. Report the per-file results from the JSON output.
5. After injecting rules, tell the user the protocol block landed in their
   protocol file.

Never edit injected files by hand to "update" them — re-run `sot inject`
instead. Never hand-edit content inside the protocol markers.
