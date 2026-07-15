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
    const label = path.relative(relativeTo, destPath);
    if (fs.existsSync(destPath)) {
      if (!force) {
        result.skipped.push(label);
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
      result.updated.push(label);
    } else {
      fs.copyFileSync(srcPath, destPath);
      result.created.push(label);
    }
  }
}
