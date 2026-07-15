# sot

**One command that turns any repo into a source-of-truth-driven codebase for coding agents** — Claude Code, Codex, GitHub Copilot, and Cursor.

`sot inject` drops a complete, self-contained agent setup into your project: two subagents, seven skills, a protocol rules block, and two project-owned registry files. No config, no runtime dependency — after injection, `sot` is out of the picture and the files are yours.

## The problem

Coding agents invent patterns. Ask one to add a feature and it will happily write a second HTTP client, a third error-handling convention, or a data-access layer that ignores the one you already have. Rules files help, but they drift from the code they describe.

**SOT-driven development** flips this: the codebase itself is the memory. Canonical patterns are marked with `@source-of-truth` comment tags next to the _real implementation_, and every injected agent follows a strict lookup chain before writing code:

1. **Tags** — search `@source-of-truth` tags and copy the matched pattern.
2. **Skills** — if no tag covers it, follow the matching injected skill.
3. **Ask** — if neither covers it, stop and ask the user, offering concrete suggestions. Never improvise: an invented pattern is likely hallucinated.

Because the pattern lives beside working code, it can't go stale the way a wiki or a rules file does.

## Quick start

Two ways to get the `sot` command — pick one:

### Option 1 — from source (requires Node ≥ 20.6 and pnpm)

```sh
git clone https://github.com/Omega-me/sot.git && cd sot
pnpm install
pnpm build
pnpm link --global
```

`pnpm link --global` puts `sot` on your PATH via pnpm's global bin — no extra setup. After changing `src/`, re-run `pnpm build`; template changes need no rebuild.

### Option 2 — standalone `sot.exe` (Windows x64, no Node required)

Build it once from a clone (this is the only step that needs Node):

```sh
pnpm install
pnpm exe          # → build/sot.exe (Node 22, templates, and the GUI baked in)
```

Copy `build/sot.exe` to any machine and run it as-is — every CLI command and the GUI work identically:

```powershell
.\sot.exe list
.\sot.exe inject -t path\to\your-project
.\sot.exe gui
```

To call it as plain `sot` from anywhere, put it on your PATH — see [Add `sot.exe` to your PATH](#add-sotexe-to-your-path) below.

### Use it

Then, in any project:

```sh
cd path/to/your-project
sot inject                    # everything, for Claude Code (the default harness)
sot inject -H codex,cursor    # target one or more harnesses
sot inject --skills           # only skills (also: --agents, --rules,
                              #   --categories, --guardrails)
sot inject --force            # overwrite existing agents/skills
sot inject -t path/to/proj    # target a directory other than cwd
sot list                      # show what would be injected and where
sot remove                    # remove everything sot injected (keeps the
                              #   user-owned registries; see below)
sot gui                       # do all of the above from a local web GUI
```

### Add `sot.exe` to your PATH

So `sot` works from any terminal, in any directory:

1. Move the exe to a stable folder (the PATH entry points at the **folder**, not the file):

   ```powershell
   New-Item -ItemType Directory -Force C:\Tools\sot
   Copy-Item build\sot.exe C:\Tools\sot\
   ```

2. Append that folder to your **user** PATH (no admin rights needed):

   ```powershell
   [Environment]::SetEnvironmentVariable(
     'Path',
     [Environment]::GetEnvironmentVariable('Path', 'User') + ';C:\Tools\sot',
     'User'
   )
   ```

   Or through the UI: **Start → "Edit environment variables for your account" → Path → Edit → New →** `C:\Tools\sot` **→ OK**.

3. Open a **new** terminal (PATH changes don't reach already-open ones) and verify:

   ```powershell
   sot --version
   sot list
   ```

From then on `sot inject`, `sot remove`, `sot list`, and `sot gui` are available everywhere, with no Node or pnpm on the machine.

## The GUI

Everything the CLI does, point-and-click:

```sh
sot gui               # start + open http://127.0.0.1:4400/ in your default browser
sot gui --port 5000   # pick another port (-p also works)
sot gui --no-open     # print the URL without opening a browser
```

From the browser you can:

- **Pick a target project** with the native OS folder picker (Browse…) or by pasting/typing the path — it is validated instantly and the selected folder's subfolders are shown as a read-only tree.
- **Pick a harness** (Claude Code, Codex, Copilot, Cursor) and **see live status** — which agents, skills, rules, and registry files are already injected in that target.
- **Select exactly what to inject** — individual agents and skills, or whole asset kinds — with an optional _force re-inject_ checkbox (same semantics as `--force`).
- **Inject or remove** and get the per-file result back.

A few things worth knowing:

- The server binds to **127.0.0.1 only** — it can spawn the CLI and browse your filesystem, so it is never exposed to the network. Stop it with Ctrl+C.
- The GUI has no logic of its own: `Inject`, `Remove`, and the asset list **spawn the real CLI** (`sot inject --json` / `sot remove --json` / `sot list --json`) under the hood, so the browser and the terminal can never disagree.
- It also works from the standalone exe: `sot.exe gui` (the GUI page is baked into the binary).
- During development, run it from source with `pnpm gui:dev` (tsx, no build step) or from the compiled output with `pnpm gui` (runs `dist/`, requires `pnpm build` first).

## What gets injected

| Asset          | What it is                                                            | Lands in (per `-H` harness)                                                                                                         |
| -------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **agents**     | `sot-build` (implementation) and `sot-review` (audit + fix) subagents | `.claude/agents/*.md` · `.codex/agents/*.toml` · `.github/agents/*.agent.md` · `.cursor/agents/*.md`                                |
| **skills**     | Seven step-by-step playbooks (see below)                                | `.claude/skills/` · `.codex/skills/` · `.github/skills/` · `.cursor/skills/` — cross-harness `<name>/SKILL.md` format, copied as-is |
| **rules**      | The SOT protocol block                                                | Marker-managed section in `CLAUDE.md` (Claude Code) · `AGENTS.md` (Codex, Cursor) · `.github/copilot-instructions.md` (Copilot)     |
| **categories** | Registry of valid `@source-of-truth` tag categories                   | `sot-categories.md` at the project root (harness-neutral)                                                                           |
| **guardrails** | Registry of the project's own guardrails                              | `sot-guardrails.md` at the project root (harness-neutral)                                                                           |

Agents are converted per harness (markdown for Claude Code and Cursor, TOML for Codex, `*.agent.md` for Copilot). Skills and the two registries are identical across harnesses, so injecting for several harnesses shares one source of truth.

### The skills

- **`sot-navigator`** — the lookup chain itself; the entry point every agent runs before implementing anything.
- **`guardrail-audit`** — full compliance audit against the guardrails; reports only, never fixes.
- **`guardrail-fix`** — smallest fixes for audit findings; always audits first, never redesigns.
- **`dead-code-removal`** — find and delete dead code, each deletion backed by verified evidence.
- **`code-duplication`** — report duplicated code with exact locations and suggested fixes; never edits.
- **`caveman`** — terse communication style: minimal prose, technical content byte-exact.
- **`sot-cli`** — how to install and drive the `sot` CLI itself: inject, remove, list, gui.

## Safe to re-run

`inject` is idempotent, with a deliberate write strategy per asset kind:

- **agents / skills** — copied; existing files are skipped unless `--force`.
- **rules** — written between `<!-- sot-protocol:begin/end -->` markers in the rules file: created if absent, replaced in place if present, and everything _outside_ the markers is never touched. Your existing `CLAUDE.md` / `AGENTS.md` content is safe, and re-injecting picks up protocol updates.
- **categories / guardrails** — created once, then owned by your project. Never overwritten, **not even with `--force`**. This is the point: `sot-guardrails.md` is where you record project-specific guardrails, and `sot-categories.md` is where you register new tag categories — both survive every re-inject, unlike the protocol block.

## Safe to remove

`sot remove` undoes an injection with the same care, per asset kind:

```sh
sot remove                    # all kinds — except the user-owned registries,
                              #   which are reported as skipped
sot remove --skills           # only skills (also: --agents, --rules,
                              #   --categories, --guardrails)
sot remove --only caveman     # restrict agents/skills to the named ones
sot remove -H codex,cursor    # target one or more harnesses
sot remove -t path/to/proj    # target a directory other than cwd
sot remove --purge            # remove-all that ALSO deletes the registries
```

- **agents / skills** — only names that exist in `sot`'s own templates are deleted; your project's own agents and skills living in the same directories are never touched. Emptied parent directories are pruned, never past the project root.
- **rules** — only the marker-managed protocol block is stripped; everything else in `CLAUDE.md` / `AGENTS.md` stays. The file itself is deleted only if nothing but whitespace remains.
- **categories / guardrails** — user-owned, so a plain `sot remove` skips them (your recorded guardrails and tag categories are not sot's to delete). They are deleted only when you ask explicitly — `--categories` / `--guardrails` — or with `--purge`.

## Extending

Templates are plain files enumerated at runtime — adding assets needs no code change:

- New agent: drop a `.md` file into `templates/agents/`.
- New skill: drop a `<name>/SKILL.md` folder into `templates/skills/`.

Rebuild (`pnpm build`) only when `src/` changes. The standalone exe bakes templates in, so re-run `pnpm exe` after template changes too.

Templates must stay **harness-agnostic** (no `.claude/` paths or harness-specific wording) and **project-agnostic** (no framework assumptions; stack-specific constructs only as parenthetical examples). See [CLAUDE.md](CLAUDE.md) for the full conventions.

## Development

```sh
pnpm install
pnpm dev list         # run the CLI from source via tsx (no -- separator)
pnpm gui:dev          # run the GUI from source
pnpm build            # compile src/ → dist/
pnpm start list       # run the compiled CLI (node dist/index.js)
pnpm gui              # run the compiled GUI
pnpm test             # node:test suite against a real temp dir — no mocks
pnpm typecheck        # tsc without emit
pnpm bundle           # esbuild: src/ → one build/bundle/sot.cjs (pkg's input)
pnpm exe              # bundle + pkg → standalone build/sot.exe
```

### Running the CLI and GUI

- **`pnpm dev <cmd>`** — runs `src/index.ts` directly via tsx: no build step, source changes take effect immediately. Don't put a `--` separator before the CLI args — pnpm ≥ 7 forwards it literally and commander chokes on it (`pnpm dev inject --target <dir>`, not `pnpm dev -- inject`).
- **`pnpm start <cmd>`** — runs the compiled `node dist/index.js`; requires `pnpm build` first, and reflects `src/` changes only after a rebuild.
- **`pnpm gui:dev`** / **`pnpm gui`** — shorthands for `pnpm dev gui` / `pnpm start gui`: start the local web GUI on `http://127.0.0.1:4400/` (`--port <n>` to change it, `--no-open` to skip opening the browser, Ctrl+C to stop).

### The build pipeline: `build` vs `bundle` vs `exe`

Three scripts, three different outputs for three different consumers:

| Script        | Tool                    | Output                                                       | Who runs it                                                            | Needs Node at runtime |
| ------------- | ----------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- | --------------------- |
| `pnpm build`  | `tsc`                   | `dist/` — one ESM `.js` per `.ts`, deps stay in `node_modules` | `pnpm start`, `pnpm link --global`, and the npm `bin` entry            | yes                   |
| `pnpm bundle` | `esbuild`               | `build/bundle/sot.cjs` — a single CJS file with `commander`/`picocolors` inlined | pkg, as its input — rarely run on its own                              | yes                   |
| `pnpm exe`    | `pnpm bundle` + `@yao-pkg/pkg` | `build/sot.exe` — the bundle with a Node 22 runtime, `templates/`, and `gui/` embedded (per `pkg.json`) | end users on machines without Node                                     | **no**                |

`bundle` exists only because pkg cannot ingest ESM that uses `import.meta.url`: esbuild flattens the source to CJS and the `--define`/`--banner` pair replaces `import.meta.url` with a CJS equivalent, which keeps the path resolution in `src/lib/constants.ts` working inside the bundle.

Two staleness rules follow from this:

- `dist/` reads `templates/` and `gui/` live from disk, so `pnpm build` is needed only after `src/` changes.
- The exe snapshots everything at build time, so re-run `pnpm exe` after **template or GUI changes too** — and note it bundles straight from `src/` (via `bundle`), so a stale `dist/` never affects it.

The code is two decoupled halves: `src/` (the injection machinery — strict TS, ESM, runtime deps are commander and picocolors only) and `templates/` (the payload, shipped as-is). The GUI is a third, thin layer: a single static `gui/index.html` served by a loopback-only Node `http` server that shells out to the CLI for anything that writes. Tests exercise the real injectors against a temp directory, because the failure modes that matter here are filesystem edge cases: re-runs, pre-existing files, a `CLAUDE.md` that already has content.

## License

[MIT](LICENSE)
