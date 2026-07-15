#!/usr/bin/env node
import { Command } from "commander";
import { runInject } from "./commands/inject.js";
import { runList } from "./commands/list.js";
import { DEFAULT_HARNESS } from "./lib/constants.js";

const program = new Command();

program
  .name("sot")
  .description(
    "Inject agents, skills, rules, and the tag-category and guardrails registries into a project, for Claude Code, Codex, Copilot, or Cursor.",
  )
  .version("0.1.0");

program
  .command("inject")
  .description(
    "Inject assets into the current project (all kinds by default; pass flags to select).",
  )
  .option("--agents", "inject subagents (e.g. .claude/agents/)")
  .option("--skills", "inject skills (e.g. .claude/skills/)")
  .option(
    "--rules",
    "write the SOT protocol block into the harness rules file (e.g. CLAUDE.md)",
  )
  .option(
    "--categories",
    "create sot-categories.md, the user-owned tag-category registry (never overwritten)",
  )
  .option(
    "--guardrails",
    "create sot-guardrails.md, the user-owned project-guardrails registry (never overwritten)",
  )
  .option(
    "-H, --harness <harness...>",
    "target harness(es): claude, codex, copilot, cursor (repeatable or comma-separated)",
    [DEFAULT_HARNESS],
  )
  .option("-f, --force", "overwrite files that already exist")
  .option("-t, --target <dir>", "target project directory (defaults to cwd)")
  .action(runInject);

program
  .command("list")
  .description("List the assets this CLI can inject and where they land.")
  .action(runList);

program.parse();
