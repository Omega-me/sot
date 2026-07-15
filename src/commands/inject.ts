import fs from "node:fs";
import path from "node:path";
import {
  ASSET_KINDS,
  HARNESSES,
  type AssetKind,
  type Harness,
} from "../lib/constants.js";
import { mergeResults, type InjectResult } from "../lib/fs-utils.js";
import { parseHarnesses } from "../lib/harness.js";
import {
  injectAgents,
  injectCategories,
  injectGuardrails,
  injectRules,
  injectSkills,
} from "../lib/inject.js";
import { errorLine, heading, label, statusLine, summaryLine } from "../lib/ui.js";

export interface InjectOptions {
  agents?: boolean;
  skills?: boolean;
  rules?: boolean;
  categories?: boolean;
  guardrails?: boolean;
  force?: boolean;
  target?: string;
  harness?: string[];
  only?: string[];
  json?: boolean;
}

const RUNNERS: Record<
  AssetKind,
  (target: string, force: boolean, harness: Harness, only?: string[]) => InjectResult
> = {
  agents: injectAgents,
  skills: injectSkills,
  rules: (target, _force, harness) => injectRules(target, harness),
  categories: (target, _force, harness) => injectCategories(target, harness),
  guardrails: (target, _force, harness) => injectGuardrails(target, harness),
};

export function runInject(options: InjectOptions): void {
  const target = path.resolve(options.target ?? process.cwd());
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    console.error(errorLine(`Target is not a directory: ${target}`));
    process.exitCode = 1;
    return;
  }

  const { harnesses, invalid } = parseHarnesses(options.harness);
  if (invalid.length > 0) {
    console.error(
      errorLine(
        `Unknown harness(es): ${invalid.join(", ")}. Valid values: ${HARNESSES.join(", ")}.`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  // No selection flags means "inject everything".
  const anySelected = ASSET_KINDS.some((kind) => options[kind]);
  const kinds = anySelected ? ASSET_KINDS.filter((kind) => options[kind]) : ASSET_KINDS;
  const force = options.force ?? false;
  const only = options.only;

  if (!options.json) {
    console.log(heading("sot inject"));
    console.log(`  ${label("target")}   ${target}`);
    console.log(`  ${label("kinds")}    ${kinds.join(", ")}`);
    console.log(`  ${label("harness")}  ${harnesses.join(", ")}`);
    if (only) console.log(`  ${label("only")}     ${only.join(", ")}`);
    console.log();
  }

  const result = mergeResults(
    ...harnesses.flatMap((harness) =>
      kinds.map((kind) => RUNNERS[kind](target, force, harness, only)),
    ),
  );

  if (options.json) {
    console.log(JSON.stringify({ target, kinds, harnesses, force, only, result }, null, 2));
    return;
  }

  for (const item of result.created) console.log(statusLine("created", item));
  for (const item of result.updated) console.log(statusLine("updated", item));
  for (const item of result.skipped) {
    console.log(statusLine("skipped", item, "(exists — use --force to overwrite)"));
  }

  console.log();
  console.log(`  ${summaryLine(result)}`);
}
