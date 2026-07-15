import fs from "node:fs";
import path from "node:path";
import {
  ASSET_KINDS,
  HARNESS_TARGETS,
  HARNESSES,
  USER_OWNED_KINDS,
  type AssetKind,
  type Harness,
} from "../lib/constants.js";
import { parseHarnesses } from "../lib/harness.js";
import {
  emptyRemoveResult,
  mergeRemoveResults,
  type RemoveResult,
} from "../lib/fs-utils.js";
import {
  removeAgents,
  removeCategories,
  removeGuardrails,
  removeRules,
  removeSkills,
} from "../lib/remove.js";
import {
  errorLine,
  heading,
  label,
  removeSummaryLine,
  statusLine,
} from "../lib/ui.js";

export interface RemoveOptions {
  agents?: boolean;
  skills?: boolean;
  rules?: boolean;
  categories?: boolean;
  guardrails?: boolean;
  target?: string;
  harness?: string[];
  only?: string[];
  purge?: boolean;
  json?: boolean;
}

const RUNNERS: Record<
  AssetKind,
  (target: string, harness: Harness, only?: string[]) => RemoveResult
> = {
  agents: removeAgents,
  skills: removeSkills,
  rules: (target, harness) => removeRules(target, harness),
  categories: (target, harness) => removeCategories(target, harness),
  guardrails: (target, harness) => removeGuardrails(target, harness),
};

export function runRemove(options: RemoveOptions): void {
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

  // No selection flags means "remove everything" — except the user-owned
  // registries, which are only deleted when explicitly selected or with --purge.
  const anySelected = ASSET_KINDS.some((kind) => options[kind]);
  const kinds = anySelected ? ASSET_KINDS.filter((kind) => options[kind]) : ASSET_KINDS;
  const purge = options.purge ?? false;
  const only = options.only;

  if (!options.json) {
    console.log(heading("sot remove"));
    console.log(`  ${label("target")}   ${target}`);
    console.log(`  ${label("kinds")}    ${kinds.join(", ")}`);
    console.log(`  ${label("harness")}  ${harnesses.join(", ")}`);
    if (only) console.log(`  ${label("only")}     ${only.join(", ")}`);
    console.log();
  }

  const result = mergeRemoveResults(
    ...harnesses.flatMap((harness) =>
      kinds.map((kind) => {
        if (USER_OWNED_KINDS.includes(kind) && !anySelected && !purge) {
          const skippedResult = emptyRemoveResult();
          skippedResult.skipped.push(HARNESS_TARGETS[harness][kind]);
          return skippedResult;
        }
        return RUNNERS[kind](target, harness, only);
      }),
    ),
  );

  if (options.json) {
    console.log(
      JSON.stringify({ target, kinds, harnesses, only, purge, result }, null, 2),
    );
    return;
  }

  for (const item of result.removed) console.log(statusLine("removed", item));
  for (const item of result.skipped) {
    console.log(
      statusLine("skipped", item, "(user-owned — select it explicitly or use --purge)"),
    );
  }
  for (const item of result.missing) {
    console.log(statusLine("missing", item, "(nothing to remove)"));
  }

  console.log();
  console.log(`  ${removeSummaryLine(result)}`);
}
