# sot

**One command that turns any repo into a source-of-truth-driven codebase for coding agents** — Claude Code, Codex, GitHub Copilot, and Cursor.

`sot inject` drops a complete, self-contained agent setup into your project: two subagents, six skills, a protocol rules block, and two project-owned registry files. No config, no runtime dependency — after injection, `sot` is out of the picture and the files are yours.

## The problem

Coding agents invent patterns. Ask one to add a feature and it will happily write a second HTTP client, a third error-handling convention, or a data-access layer that ignores the one you already have. Rules files help, but they drift from the code they describe.

**SOT-driven development** flips this: the codebase itself is the memory. Canonical patterns are marked with `@source-of-truth` comment tags next to the _real implementation_, and every injected agent follows a strict lookup chain before writing code:

1. **Tags** — search `@source-of-truth` tags and copy the matched pattern.
2. **Skills** — if no tag covers it, follow the matching injected skill.
3. **Ask** — if neither covers it, stop and ask the user, offering concrete suggestions. Never improvise: an invented pattern is likely hallucinated.

Because the pattern lives beside working code, it can't go stale the way a wiki or a rules file does.

## Quick start

Requires Node ≥ 20.6. Not on npm yet — install from source:

```sh
git clone https://github.com/Omega-me/sot.git && cd sot
pnpm install
pnpm build
pnpm link --global
```

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
```

Prefer a dependency-free binary? `pnpm exe` builds a standalone `build/sot.exe` (currently Windows x64; Node 22 and the templates are baked in — no Node needed on the target machine).

## What gets injected

| Asset          | What it is                                                            | Lands in (per `-H` harness)                                                                                                         |
| -------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **agents**     | `sot-build` (implementation) and `sot-review` (audit + fix) subagents | `.claude/agents/*.md` · `.codex/agents/*.toml` · `.github/agents/*.agent.md` · `.cursor/agents/*.md`                                |
| **skills**     | Six step-by-step playbooks (see below)                                | `.claude/skills/` · `.codex/skills/` · `.github/skills/` · `.cursor/skills/` — cross-harness `<name>/SKILL.md` format, copied as-is |
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

## Safe to re-run

`inject` is idempotent, with a deliberate write strategy per asset kind:

- **agents / skills** — copied; existing files are skipped unless `--force`.
- **rules** — written between `<!-- sot-protocol:begin/end -->` markers in the rules file: created if absent, replaced in place if present, and everything _outside_ the markers is never touched. Your existing `CLAUDE.md` / `AGENTS.md` content is safe, and re-injecting picks up protocol updates.
- **categories / guardrails** — created once, then owned by your project. Never overwritten, **not even with `--force`**. This is the point: `sot-guardrails.md` is where you record project-specific guardrails, and `sot-categories.md` is where you register new tag categories — both survive every re-inject, unlike the protocol block.

## Extending

Templates are plain files enumerated at runtime — adding assets needs no code change:

- New agent: drop a `.md` file into `templates/agents/`.
- New skill: drop a `<name>/SKILL.md` folder into `templates/skills/`.

Rebuild (`pnpm build`) only when `src/` changes. The standalone exe bakes templates in, so re-run `pnpm exe` after template changes too.

Templates must stay **harness-agnostic** (no `.claude/` paths or harness-specific wording) and **project-agnostic** (no framework assumptions; stack-specific constructs only as parenthetical examples). See [CLAUDE.md](CLAUDE.md) for the full conventions.

## Development

```sh
pnpm install
pnpm dev -- list      # run the CLI from source via tsx
pnpm test             # node:test suite against a real temp dir — no mocks
pnpm typecheck
```

The code is two decoupled halves: `src/` (the injection machinery — strict TS, ESM, sole dependency is commander) and `templates/` (the payload, shipped as-is). Tests exercise the real injectors against a temp directory, because the failure modes that matter here are filesystem edge cases: re-runs, pre-existing files, a `CLAUDE.md` that already has content.

## License

[MIT](LICENSE)
