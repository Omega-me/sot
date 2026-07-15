// @source-of-truth: injection-strategy
// File purpose: Canonical implementations of the three asset-injection strategies (recursive copy, marker-managed block, create-once).
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
import {
  parseAgentMarkdown,
  toCodexAgentToml,
  toCopilotAgentMarkdown,
} from "./convert.js";
import {
  copyDir,
  emptyResult,
  writeFileWithPolicy,
  type InjectResult,
} from "./fs-utils.js";

/**
 * Inject templates/agents/*.md into the harness's agents directory:
 * claude and cursor get the markdown as-is, codex gets one TOML definition
 * per agent, copilot gets `<name>.agent.md` profiles.
 */
export function injectAgents(
  target: string,
  force: boolean,
  harness: Harness = DEFAULT_HARNESS,
): InjectResult {
  const result = emptyResult();
  const srcDir = path.join(TEMPLATES_DIR, TEMPLATE_PATHS.agents);
  const destDir = path.join(target, HARNESS_TARGETS[harness].agents);

  if (harness === "claude" || harness === "cursor") {
    copyDir(srcDir, destDir, force, result, target);
    return result;
  }

  for (const entry of fs.readdirSync(srcDir)) {
    if (!entry.endsWith(".md")) continue;
    const doc = parseAgentMarkdown(fs.readFileSync(path.join(srcDir, entry), "utf8"));
    const base = entry.replace(/\.md$/, "");
    const [destName, content] =
      harness === "codex"
        ? [`${base}.toml`, toCodexAgentToml(doc)]
        : [`${base}.agent.md`, toCopilotAgentMarkdown(doc)];
    writeFileWithPolicy(path.join(destDir, destName), content, force, result, target);
  }
  return result;
}

/**
 * Copy templates/skills/<name>/ trees into the harness's skills directory.
 * SKILL.md is a cross-harness format, so no conversion is needed.
 */
export function injectSkills(
  target: string,
  force: boolean,
  harness: Harness = DEFAULT_HARNESS,
): InjectResult {
  const result = emptyResult();
  copyDir(
    path.join(TEMPLATES_DIR, TEMPLATE_PATHS.skills),
    path.join(target, HARNESS_TARGETS[harness].skills),
    force,
    result,
    target,
  );
  return result;
}

/**
 * Copy a single template file to the target once. Used for the user-owned
 * registry files: after injection the project edits them, so they are never
 * overwritten — not even with --force.
 */
function injectCreateOnce(
  target: string,
  relPath: string,
  templatePath: string,
): InjectResult {
  const result = emptyResult();
  const destPath = path.join(target, relPath);
  if (fs.existsSync(destPath)) {
    result.skipped.push(relPath);
    return result;
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(templatePath, destPath);
  result.created.push(relPath);
  return result;
}

/**
 * Create the `@source-of-truth` tag-category registry at the target root.
 * User-owned after injection (projects register their own categories in it);
 * created once, never overwritten. The same file serves every harness.
 */
export function injectCategories(
  target: string,
  harness: Harness = DEFAULT_HARNESS,
): InjectResult {
  return injectCreateOnce(
    target,
    HARNESS_TARGETS[harness].categories,
    path.join(TEMPLATES_DIR, TEMPLATE_PATHS.categories),
  );
}

/**
 * Create the project-guardrails registry at the target root. User-owned
 * after injection (the project records its own guardrails in it — the only
 * safe place, since the protocol block is replaced on re-inject); created
 * once, never overwritten. The same file serves every harness.
 */
export function injectGuardrails(
  target: string,
  harness: Harness = DEFAULT_HARNESS,
): InjectResult {
  return injectCreateOnce(
    target,
    HARNESS_TARGETS[harness].guardrails,
    path.join(TEMPLATES_DIR, TEMPLATE_PATHS.guardrails),
  );
}

/**
 * Find `marker` where it occupies an entire line — the only way the injector
 * ever writes it. Mentions embedded in prose or code spans must never match,
 * or replacing the "block" between them would destroy the surrounding text.
 */
function findMarkerIndex(content: string, marker: string, fromIndex = 0): number {
  let idx = content.indexOf(marker, fromIndex);
  while (idx !== -1) {
    const lineStart = content.lastIndexOf("\n", idx - 1) + 1;
    const nextNewline = content.indexOf("\n", idx);
    const lineEnd = nextNewline === -1 ? content.length : nextNewline;
    if (content.slice(lineStart, lineEnd).trim() === marker) return idx;
    idx = content.indexOf(marker, idx + marker.length);
  }
  return -1;
}

/**
 * Write the SOT protocol into the harness's rules file (CLAUDE.md,
 * AGENTS.md — shared by codex and cursor — or .github/copilot-instructions.md)
 * between marker comments.
 * Creates the file if missing, replaces the marked block if present, and
 * appends the block otherwise — never touches content outside the markers.
 * Markers count only when they stand alone on their own line.
 */
export function injectRules(
  target: string,
  harness: Harness = DEFAULT_HARNESS,
): InjectResult {
  const result = emptyResult();
  const protocol = fs
    .readFileSync(path.join(TEMPLATES_DIR, TEMPLATE_PATHS.protocol), "utf8")
    .trim();
  const block = `${PROTOCOL_MARKER_BEGIN}\n${protocol}\n${PROTOCOL_MARKER_END}`;

  const relPath = HARNESS_TARGETS[harness].rules;
  const destPath = path.join(target, relPath);
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, block + "\n", "utf8");
    result.created.push(relPath);
    return result;
  }

  const current = fs.readFileSync(destPath, "utf8");
  const beginIdx = findMarkerIndex(current, PROTOCOL_MARKER_BEGIN);
  const endIdx =
    beginIdx === -1
      ? -1
      : findMarkerIndex(current, PROTOCOL_MARKER_END, beginIdx + PROTOCOL_MARKER_BEGIN.length);

  let next: string;
  if (beginIdx !== -1 && endIdx !== -1) {
    next =
      current.slice(0, beginIdx) +
      block +
      current.slice(endIdx + PROTOCOL_MARKER_END.length);
    if (next === current) {
      result.skipped.push(relPath);
      return result;
    }
  } else {
    next = current.trimEnd() + "\n\n" + block + "\n";
  }
  fs.writeFileSync(destPath, next, "utf8");
  result.updated.push(relPath);
  return result;
}
