#!/usr/bin/env node
import { Command } from "commander";
import { runGui } from "./commands/gui.js";
import { runInject } from "./commands/inject.js";
import { runList } from "./commands/list.js";
import { runRemove } from "./commands/remove.js";
import { DEFAULT_HARNESS, GUI_DEFAULT_PORT } from "./lib/constants.js";
import { errorLine } from "./lib/ui.js";

const program = new Command();

program
  .name("sot")
  .configureOutput({
    outputError: (str, write) => write(errorLine(str.replace(/^error: /, ""))),
  })
  .description(
    "Inject agents, skills, rules, and the tag-category and guardrails registries into a project, for Claude Code, Codex, Copilot, or Cursor.",
  )
  .version("0.1.1");

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
  .option(
    "--only <names...>",
    "restrict agents/skills to the named ones (matches agent and skill names)",
  )
  .option("--json", "print a machine-readable JSON result instead of styled output")
  .action(runInject);

program
  .command("remove")
  .description(
    "Remove injected assets (all kinds by default, except the user-owned registries; pass flags to select).",
  )
  .option("--agents", "remove injected subagents (only names that exist in templates/)")
  .option("--skills", "remove injected skills (only names that exist in templates/)")
  .option(
    "--rules",
    "strip the SOT protocol block from the harness rules file (other content untouched)",
  )
  .option(
    "--categories",
    "delete sot-categories.md (user-owned — only removed when selected explicitly or with --purge)",
  )
  .option(
    "--guardrails",
    "delete sot-guardrails.md (user-owned — only removed when selected explicitly or with --purge)",
  )
  .option(
    "-H, --harness <harness...>",
    "target harness(es): claude, codex, copilot, cursor (repeatable or comma-separated)",
    [DEFAULT_HARNESS],
  )
  .option("-t, --target <dir>", "target project directory (defaults to cwd)")
  .option(
    "--only <names...>",
    "restrict agents/skills to the named ones (matches agent and skill names)",
  )
  .option(
    "--purge",
    "when removing all kinds, also delete the user-owned registries (categories, guardrails)",
  )
  .option("--json", "print a machine-readable JSON result instead of styled output")
  .action(runRemove);

program
  .command("list")
  .description("List the assets this CLI can inject and where they land.")
  .option("--json", "print a machine-readable JSON inventory instead of styled output")
  .action(runList);

program
  .command("gui")
  .description(
    "Start the local web GUI (binds to 127.0.0.1 only; drives this CLI under the hood).",
  )
  .option("-p, --port <port>", "port to listen on", String(GUI_DEFAULT_PORT))
  .option("--no-open", "do not open the default browser automatically")
  .action(runGui);

program.parse();
