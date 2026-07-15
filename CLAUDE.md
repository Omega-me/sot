# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`sot` is a CLI (bin name: `sot`) that injects reusable coding-agent assets — subagents, skills, and an SOT-protocol rules block — into whatever project it is run in. Templates are **self-contained** and must stay both **harness-agnostic** (work identically under Claude Code, Codex, Copilot — no `.claude/` paths or harness-specific wording; the protocol file is referenced generically, e.g. "`CLAUDE.md`, `AGENTS.md`, `AGENT.md`, or the harness equivalent") and **project-agnostic** (framework-agnostic, no absolute paths, no personal/org names: stack-specific constructs appear only as parenthetical examples (e.g. "untyped escape hatches (e.g. TypeScript's `any`)"), never as the rule itself). Sibling skills are referenced by name ("the `guardrail-audit` skill alongside this one"), never by an injected path.

## Commands

Requires Node ≥ 20.6.

- `pnpm install` — install deps
- `pnpm build` — compile `src/` → `dist/` with tsc
- `pnpm test` — run the full test suite (`node --import tsx --test test/inject.test.ts test/remove.test.ts test/gui.test.ts`); narrow to one test with `node --import tsx --test --test-name-pattern="<name>" test/<file>.test.ts`
- `pnpm typecheck` — tsc without emit
- `pnpm dev <cmd>` — run the CLI from source via tsx (e.g. `pnpm dev inject --target <dir>`; no `--` separator — pnpm ≥7 forwards it literally and commander chokes on it)
- `pnpm link --global` — make the built `sot` command available in any project (re-run `pnpm build` after src changes; templates need no rebuild)
- `pnpm exe` — build a standalone `build/sot.exe` (esbuild bundles to CJS, then `@yao-pkg/pkg` embeds Node 22 + `templates/` + `gui/` per `pkg.json`; unlike the linked command, templates are baked in, so re-run after template changes too)
- `sot gui` (or `pnpm dev gui`) — local web GUI on `http://127.0.0.1:4400/` (`--port <n>`, `--no-open`); loopback-only, opens the default browser, Ctrl+C to stop

## Architecture

Two halves, deliberately decoupled:

1. **`src/` — the machinery** (ESM, strict TS, runtime deps are commander and picocolors only).
   - `src/index.ts` — commander program defining `inject`, `remove`, `list`, and `gui`; thin, delegates to `src/commands/`.
   - `src/commands/inject.ts` — flag handling: no selection flags means inject *all* kinds; maps each kind to its runner. `--only <names...>` restricts agents/skills to the named ones; `--json` (also on `list` and `remove`) prints a machine-readable result — the GUI's contract.
   - `src/commands/remove.ts` + `src/lib/remove.ts` — the removers, one per kind, mirroring the injection strategies: agents/skills delete **only names that exist in `templates/`** (a project's own agents/skills in the same directories are never touched; emptied parent dirs are pruned up to, never past, the target root); rules strips the marker-managed block, leaving other content untouched (the file is deleted only if nothing but whitespace remains); categories/guardrails are **user-owned** — on a no-flag remove-all they are reported skipped, deleted only when their kind flag is passed explicitly or with `--purge`.
   - `src/commands/gui.ts` — starts the GUI server, prints the URL, best-effort opens the default browser (`--no-open` to skip).
   - `src/lib/server.ts` — the GUI HTTP server (Node built-in `http`, no new deps). Binds to **127.0.0.1 only** (it can spawn the CLI and browse the filesystem). Serves `gui/index.html` plus JSON endpoints: `GET /api/assets`, `POST /api/inject`, and `POST /api/remove` **spawn the real CLI** (`process.execPath` + `CLI_ENTRY` with `list --json` / `inject --json …` / `remove --json …`; as a pkg exe the binary itself is re-invoked) — never duplicate injector/remover logic here; `GET /api/browse` validates a required `path` and lists its subdirectory names only (`{ path, entries }`; 404 + `exists: false` when the folder does not exist, 400 when the path is missing or not a directory) — the GUI uses it to auto-validate the typed/pasted/picked target and render the read-only subfolder tree; `GET /api/pick-folder` spawns the **native OS folder picker** (win32: PowerShell `FolderBrowserDialog` with a topmost owner form; darwin: `osascript choose folder`; linux: `zenity`) and returns `{ path }` (null on cancel) or a JSON error so the GUI shows it and the user types the path; `GET /api/open-folder` validates a required `path` exactly like `/api/browse`, then opens it in the **OS file manager** (win32: `explorer.exe`, whose exit code is ignored because it exits 1 even on success; darwin: `open`; linux: `xdg-open`) and returns `{ ok: true, path }` — the GUI's "Open" button next to the target input, enabled only for a validated target; `GET /api/status` reports what is already injected in a target via `HARNESS_TARGETS` + fs checks.
   - `src/lib/inject.ts` — the injectors. Three distinct strategies, don't mix them up:
     - agents/skills: recursive copy (skip existing unless `--force`);
     - rules: **marker-managed block** in the target's `CLAUDE.md` between `<!-- sot-protocol:begin/end -->` markers — created, replaced in place, or appended, never touching content outside the markers. This is what makes `inject` idempotent and safe on projects with an existing CLAUDE.md;
     - categories/guardrails: **create-once** copy of a registry file to the target root — `sot-categories.md` (the `@source-of-truth` tag categories) and `sot-guardrails.md` (the project's own guardrails; the safe place to add one, since the protocol block is replaced on re-inject). Never overwritten, not even with `--force` (the project owns their content after injection). Harness-neutral: the same files serve every harness, and the protocol block references them by name.
   - `src/lib/constants.ts` — `TEMPLATES_DIR`, `GUI_DIR`, and `CLI_ENTRY` are resolved relative to the module file so paths work identically from `src/` (tsx) and `dist/` (built); per-harness target paths (`.claude/agents`, `.claude/skills`, `CLAUDE.md`, …) live in `HARNESS_TARGETS`; GUI defaults (host, port, API paths, size limits) live here too.
   - `src/lib/ui.ts` — the only place terminal styling lives (picocolors wrapper: headings, status lines, summary, errors); commands never import picocolors directly.

2. **`templates/` — the payload** (shipped as-is via the `files` field, never compiled). Adding an agent `.md` or a skill folder (`<name>/SKILL.md`) requires no code change — the injectors and `list` enumerate the directories at runtime. `gui/` (a single static `index.html`, vanilla JS, view-only — all logic stays in the server/CLI) ships the same way and is also listed in `pkg.json` assets so the exe keeps working.

## Conventions

- New asset kinds: add to `ASSET_KINDS`/`HARNESS_TARGETS` in constants, an injector in `src/lib/inject.ts` returning `InjectResult`, a runner entry in `src/commands/inject.ts`, a CLI flag in `src/index.ts`, and a test in `test/inject.test.ts`.
- Tests run the real injectors against a temp dir (no mocks); keep it that way — the failure modes here are filesystem edge cases (re-runs, existing files, a pre-existing `CLAUDE.md`).

<!-- sot-protocol:begin -->
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
- `sot-cli` — how to install and drive the `sot` CLI itself (inject, remove,
  list, gui).

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
<!-- sot-protocol:end -->
