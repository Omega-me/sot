import fs from "node:fs";
import path from "node:path";

export interface InjectResult {
  created: string[];
  updated: string[];
  skipped: string[];
}

export function emptyResult(): InjectResult {
  return { created: [], updated: [], skipped: [] };
}

export function mergeResults(...results: InjectResult[]): InjectResult {
  return {
    created: results.flatMap((r) => r.created),
    updated: results.flatMap((r) => r.updated),
    skipped: results.flatMap((r) => r.skipped),
  };
}

/** Per-file report of a removal run, mirroring InjectResult. */
export interface RemoveResult {
  removed: string[];
  /** Existed but intentionally left in place (user-owned, not explicitly selected). */
  skipped: string[];
  /** Nothing to remove — the injected file/block was not found. */
  missing: string[];
}

export function emptyRemoveResult(): RemoveResult {
  return { removed: [], skipped: [], missing: [] };
}

export function mergeRemoveResults(...results: RemoveResult[]): RemoveResult {
  return {
    removed: results.flatMap((r) => r.removed),
    skipped: results.flatMap((r) => r.skipped),
    missing: results.flatMap((r) => r.missing),
  };
}

/**
 * Write `content` to `destPath` with the same skip/force policy as copyDir:
 * existing files are skipped unless `force` is set.
 */
export function writeFileWithPolicy(
  destPath: string,
  content: string,
  force: boolean,
  result: InjectResult,
  relativeTo: string,
): void {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const label = path.relative(relativeTo, destPath);
  if (fs.existsSync(destPath)) {
    if (!force) {
      result.skipped.push(label);
      return;
    }
    fs.writeFileSync(destPath, content, "utf8");
    result.updated.push(label);
  } else {
    fs.writeFileSync(destPath, content, "utf8");
    result.created.push(label);
  }
}

/**
 * Copy a single file with the same skip/force policy as copyDir:
 * existing files are skipped unless `force` is set.
 */
export function copyFileWithPolicy(
  srcPath: string,
  destPath: string,
  force: boolean,
  result: InjectResult,
  relativeTo: string,
): void {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const label = path.relative(relativeTo, destPath);
  if (fs.existsSync(destPath)) {
    if (!force) {
      result.skipped.push(label);
      return;
    }
    fs.copyFileSync(srcPath, destPath);
    result.updated.push(label);
  } else {
    fs.copyFileSync(srcPath, destPath);
    result.created.push(label);
  }
}

/**
 * Recursively copy every file under `srcDir` into `destDir`, preserving
 * structure. Existing files are skipped unless `force` is set.
 */
export function copyDir(
  srcDir: string,
  destDir: string,
  force: boolean,
  result: InjectResult,
  relativeTo: string,
): void {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, force, result, relativeTo);
      continue;
    }
    copyFileWithPolicy(srcPath, destPath, force, result, relativeTo);
  }
}
