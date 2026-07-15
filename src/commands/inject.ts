import fs from "node:fs";
import path from "node:path";
import {
  ASSET_KINDS,
  DEFAULT_HARNESS,
  HARNESSES,
  type AssetKind,
  type Harness,
} from "../lib/constants.js";
import { mergeResults, type InjectResult } from "../lib/fs-utils.js";
import {
  injectAgents,
  injectCategories,
  injectGuardrails,
  injectRules,
  injectSkills,
} from "../lib/inject.js";

export interface InjectOptions {
  agents?: boolean;
  skills?: boolean;
  rules?: boolean;
  categories?: boolean;
  guardrails?: boolean;
  force?: boolean;
  target?: string;
  harness?: string[];
}

const RUNNERS: Record<
  AssetKind,
  (target: string, force: boolean, harness: Harness) => InjectResult
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
    console.error(`Target is not a directory: ${target}`);
    process.exitCode = 1;
    return;
  }

  const harnesses = resolveHarnesses(options.harness);
  if (harnesses === null) return;

  // No selection flags means "inject everything".
  const anySelected = ASSET_KINDS.some((kind) => options[kind]);
  const kinds = anySelected ? ASSET_KINDS.filter((kind) => options[kind]) : ASSET_KINDS;
  const force = options.force ?? false;

  console.log(
    `Injecting [${kinds.join(", ")}] for [${harnesses.join(", ")}] into ${target}\n`,
  );
  const result = mergeResults(
    ...harnesses.flatMap((harness) =>
      kinds.map((kind) => RUNNERS[kind](target, force, harness)),
    ),
  );

  report("created", result.created);
  report("updated", result.updated);
  report("skipped (already exists — use --force to overwrite)", result.skipped);

  const touched = result.created.length + result.updated.length;
  console.log(
    `\nDone: ${touched} file(s) written, ${result.skipped.length} skipped.`,
  );
}

/** Normalize --harness values (repeatable and comma-separated); null on invalid input. */
function resolveHarnesses(input: string[] | undefined): Harness[] | null {
  const names = (input ?? [DEFAULT_HARNESS])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  const selected = names.length > 0 ? [...new Set(names)] : [DEFAULT_HARNESS];

  const invalid = selected.filter((name) => !HARNESSES.includes(name as Harness));
  if (invalid.length > 0) {
    console.error(
      `Unknown harness(es): ${invalid.join(", ")}. Valid values: ${HARNESSES.join(", ")}.`,
    );
    process.exitCode = 1;
    return null;
  }
  return selected as Harness[];
}

function report(title: string, items: string[]): void {
  if (items.length === 0) return;
  console.log(`${title}:`);
  for (const item of items) console.log(`  ${item}`);
}
