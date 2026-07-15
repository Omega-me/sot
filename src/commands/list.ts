import fs from "node:fs";
import path from "node:path";
import {
  HARNESS_TARGETS,
  HARNESSES,
  TEMPLATE_PATHS,
  TEMPLATES_DIR,
} from "../lib/constants.js";

export function runList(): void {
  console.log(`Assets in ${TEMPLATES_DIR}\n`);

  const agents = fs
    .readdirSync(path.join(TEMPLATES_DIR, TEMPLATE_PATHS.agents))
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
  console.log(`agents  → ${destinations("agents")}`);
  for (const agent of agents) console.log(`  ${agent}`);

  const skills = fs
    .readdirSync(path.join(TEMPLATES_DIR, TEMPLATE_PATHS.skills), {
      withFileTypes: true,
    })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  console.log(`\nskills  → ${destinations("skills")}`);
  for (const skill of skills) console.log(`  ${skill}`);

  console.log(
    `\nrules   → ${destinations("rules")} (marker-managed SOT protocol block)`,
  );

  console.log(
    `\ncategories → ${HARNESS_TARGETS.claude.categories} for every harness (user-owned tag-category registry, created once)`,
  );

  console.log(
    `\nguardrails → ${HARNESS_TARGETS.claude.guardrails} for every harness (user-owned project-guardrails registry, created once)`,
  );
}

function destinations(kind: "agents" | "skills" | "rules"): string {
  const isDir = kind === "agents" || kind === "skills";
  return HARNESSES.map(
    (harness) => `${harness}: ${HARNESS_TARGETS[harness][kind]}${isDir ? "/" : ""}`,
  ).join(" | ");
}
