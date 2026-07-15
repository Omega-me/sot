import fs from "node:fs";
import path from "node:path";
import {
  ASSET_KINDS,
  HARNESS_TARGETS,
  HARNESSES,
  TEMPLATE_PATHS,
  TEMPLATES_DIR,
} from "../lib/constants.js";
import { heading, listItem, subtle } from "../lib/ui.js";

export interface ListOptions {
  json?: boolean;
}

/** Machine-readable inventory printed by `sot list --json` (consumed by the GUI). */
interface ListInventory {
  templatesDir: string;
  kinds: typeof ASSET_KINDS;
  harnesses: typeof HARNESSES;
  targets: typeof HARNESS_TARGETS;
  agents: string[];
  skills: string[];
}

function collectInventory(): ListInventory {
  const agents = fs
    .readdirSync(path.join(TEMPLATES_DIR, TEMPLATE_PATHS.agents))
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
  const skills = fs
    .readdirSync(path.join(TEMPLATES_DIR, TEMPLATE_PATHS.skills), {
      withFileTypes: true,
    })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  return {
    templatesDir: TEMPLATES_DIR,
    kinds: ASSET_KINDS,
    harnesses: HARNESSES,
    targets: HARNESS_TARGETS,
    agents,
    skills,
  };
}

export function runList(options: ListOptions = {}): void {
  const inventory = collectInventory();

  if (options.json) {
    console.log(JSON.stringify(inventory, null, 2));
    return;
  }

  console.log(heading("sot list"));
  console.log(`  ${subtle("templates")} ${inventory.templatesDir}`);

  console.log(`\n${heading("agents")} ${subtle(`→ ${destinations("agents")}`)}`);
  for (const agent of inventory.agents) console.log(listItem(agent));

  console.log(`\n${heading("skills")} ${subtle(`→ ${destinations("skills")}`)}`);
  for (const skill of inventory.skills) console.log(listItem(skill));

  console.log(`\n${heading("rules")} ${subtle(`→ ${destinations("rules")}`)}`);
  console.log(`  ${subtle("marker-managed SOT protocol block")}`);

  console.log(
    `\n${heading("categories")} ${subtle(`→ ${HARNESS_TARGETS.claude.categories} for every harness`)}`,
  );
  console.log(`  ${subtle("user-owned tag-category registry, created once")}`);

  console.log(
    `\n${heading("guardrails")} ${subtle(`→ ${HARNESS_TARGETS.claude.guardrails} for every harness`)}`,
  );
  console.log(`  ${subtle("user-owned project-guardrails registry, created once")}`);
}

function destinations(kind: "agents" | "skills" | "rules"): string {
  const isDir = kind === "agents" || kind === "skills";
  return HARNESSES.map(
    (harness) => `${harness}: ${HARNESS_TARGETS[harness][kind]}${isDir ? "/" : ""}`,
  ).join(" | ");
}
