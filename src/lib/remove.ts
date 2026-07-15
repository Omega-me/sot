// @source-of-truth: removal-strategy
// File purpose: Canonical implementations of the asset-removal strategies mirroring injection — template-matched delete for agents/skills, marker-block strip for rules, explicit-only delete for the user-owned registries.
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_HARNESS,
  HARNESS_TARGETS,
  PROTOCOL_MARKER_BEGIN,
  PROTOCOL_MARKER_END,
  TEMPLATE_PATHS,
  TEMPLATES_DIR,
  type Harness,
} from "./constants.js";
import { emptyRemoveResult, type RemoveResult } from "./fs-utils.js";
import { findMarkerIndex } from "./inject.js";

/**
 * Delete injected agent files. Conservative: only names that exist in
 * templates/agents are candidates (per-harness filename: .md, .toml, or
 * .agent.md) — a project's own agents in the same directory are never
 * touched. Empty parent directories are pruned afterwards.
 */
export function removeAgents(
  target: string,
  harness: Harness = DEFAULT_HARNESS,
  only?: string[],
): RemoveResult {
  const result = emptyRemoveResult();
  const srcDir = path.join(TEMPLATES_DIR, TEMPLATE_PATHS.agents);
  const destDir = path.join(target, HARNESS_TARGETS[harness].agents);

  for (const entry of fs.readdirSync(srcDir)) {
    if (!entry.endsWith(".md")) continue;
    const base = entry.replace(/\.md$/, "");
    if (only && !only.includes(base)) continue;
    const destName =
      harness === "codex"
        ? `${base}.toml`
        : harness === "copilot"
          ? `${base}.agent.md`
          : entry;
    removePath(path.join(destDir, destName), target, result);
  }
  pruneEmptyDirs(destDir, target);
  return result;
}

/**
 * Delete injected skill folders. Conservative: only folder names that exist
 * in templates/skills are candidates — a project's own skills stay. Empty
 * parent directories are pruned afterwards.
 */
export function removeSkills(
  target: string,
  harness: Harness = DEFAULT_HARNESS,
  only?: string[],
): RemoveResult {
  const result = emptyRemoveResult();
  const srcRoot = path.join(TEMPLATES_DIR, TEMPLATE_PATHS.skills);
  const destRoot = path.join(target, HARNESS_TARGETS[harness].skills);

  for (const entry of fs.readdirSync(srcRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (only && !only.includes(entry.name)) continue;
    removePath(path.join(destRoot, entry.name), target, result);
  }
  pruneEmptyDirs(destRoot, target);
  return result;
}

/**
 * Strip the marker-managed SOT protocol block from the harness rules file,
 * leaving all other content untouched. Markers count only when they stand
 * alone on their own line (same rule as the injector). If nothing but
 * whitespace remains, the file itself is deleted.
 */
export function removeRules(
  target: string,
  harness: Harness = DEFAULT_HARNESS,
): RemoveResult {
  const result = emptyRemoveResult();
  const relPath = HARNESS_TARGETS[harness].rules;
  const destPath = path.join(target, relPath);
  if (!fs.existsSync(destPath)) {
    result.missing.push(relPath);
    return result;
  }

  const current = fs.readFileSync(destPath, "utf8");
  const beginIdx = findMarkerIndex(current, PROTOCOL_MARKER_BEGIN);
  const endIdx =
    beginIdx === -1
      ? -1
      : findMarkerIndex(current, PROTOCOL_MARKER_END, beginIdx + PROTOCOL_MARKER_BEGIN.length);
  if (beginIdx === -1 || endIdx === -1) {
    result.missing.push(relPath);
    return result;
  }

  // Remove whole marker lines: from the start of the begin-marker line to the
  // end-marker line's trailing newline (or end of file).
  const blockStart = current.lastIndexOf("\n", beginIdx - 1) + 1;
  const endLineBreak = current.indexOf("\n", endIdx + PROTOCOL_MARKER_END.length);
  const blockEnd = endLineBreak === -1 ? current.length : endLineBreak + 1;
  const next = current.slice(0, blockStart) + current.slice(blockEnd);

  if (next.trim() === "") {
    fs.rmSync(destPath);
    pruneEmptyDirs(path.dirname(destPath), target);
  } else {
    fs.writeFileSync(destPath, next, "utf8");
  }
  result.removed.push(relPath);
  return result;
}

/**
 * Delete the tag-category registry. The file is user-owned after injection,
 * so callers must only invoke this when the kind was explicitly selected
 * (kind flag or --purge) — the command layer enforces that.
 */
export function removeCategories(
  target: string,
  harness: Harness = DEFAULT_HARNESS,
): RemoveResult {
  const result = emptyRemoveResult();
  removePath(path.join(target, HARNESS_TARGETS[harness].categories), target, result);
  return result;
}

/**
 * Delete the project-guardrails registry. Same explicit-only contract as
 * removeCategories — the file is user-owned after injection.
 */
export function removeGuardrails(
  target: string,
  harness: Harness = DEFAULT_HARNESS,
): RemoveResult {
  const result = emptyRemoveResult();
  removePath(path.join(target, HARNESS_TARGETS[harness].guardrails), target, result);
  return result;
}

/** Delete one file or directory tree, reporting removed/missing by relative path. */
function removePath(destPath: string, relativeTo: string, result: RemoveResult): void {
  const label = path.relative(relativeTo, destPath);
  if (!fs.existsSync(destPath)) {
    result.missing.push(label);
    return;
  }
  fs.rmSync(destPath, { recursive: true });
  result.removed.push(label);
}

/**
 * Remove `dir` and its ancestors while they are empty, never crossing
 * `stopAt` (the target root) — so .claude/agents, then .claude, disappear
 * once the last injected asset is gone, but the project dir never does.
 */
function pruneEmptyDirs(dir: string, stopAt: string): void {
  let current = path.resolve(dir);
  const stop = path.resolve(stopAt);
  while (current !== stop) {
    const relative = path.relative(stop, current);
    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return;
    if (!fs.existsSync(current) || fs.readdirSync(current).length > 0) return;
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}
