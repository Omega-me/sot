// @source-of-truth: harness-registry
// File purpose: Canonical registry of supported harnesses, asset kinds, per-harness template/target paths, and shared CLI/GUI constants.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = fileURLToPath(new URL(".", import.meta.url));

// Resolved relative to this file so it works both from src/ (tsx) and dist/ (built).
export const TEMPLATES_DIR = path.resolve(MODULE_DIR, "..", "..", "templates");

// Static GUI assets (never compiled), resolved like TEMPLATES_DIR.
export const GUI_DIR = path.resolve(MODULE_DIR, "..", "..", "gui");

/**
 * The CLI entry point next to this module — dist/index.js when built,
 * src/index.ts under tsx. The GUI server spawns it so the web UI always
 * drives the real CLI instead of duplicating injector logic.
 */
export const CLI_ENTRY =
  ["index.js", "index.ts"]
    .map((file) => path.resolve(MODULE_DIR, "..", file))
    .find((candidate) => fs.existsSync(candidate)) ??
  path.resolve(MODULE_DIR, "..", "index.js");

/** GUI server: loopback-only — it can spawn the CLI and browse the filesystem. */
export const GUI_HOST = "127.0.0.1";
export const GUI_DEFAULT_PORT = 4400;
export const GUI_INDEX_FILE = "index.html";
export const GUI_API_PATHS = {
  assets: "/api/assets",
  browse: "/api/browse",
  status: "/api/status",
  inject: "/api/inject",
  remove: "/api/remove",
  pickFolder: "/api/pick-folder",
  openFolder: "/api/open-folder",
} as const;
/** Max accepted request-body size for the GUI API (bytes). */
export const GUI_MAX_BODY_BYTES = 1024 * 1024;
/** Max stdout/stderr captured from a spawned CLI run (bytes). */
export const CLI_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
/** Max time the native OS folder-picker dialog may stay open (ms). */
export const GUI_PICKER_TIMEOUT_MS = 5 * 60 * 1000;

/** Template source subpaths, relative to TEMPLATES_DIR. */
export const TEMPLATE_PATHS = {
  agents: "agents",
  skills: "skills",
  protocol: path.join("rules", "sot-protocol.md"),
  categories: path.join("rules", "sot-categories.md"),
  guardrails: path.join("rules", "sot-guardrails.md"),
} as const;

export const PROTOCOL_MARKER_BEGIN = "<!-- sot-protocol:begin -->";
export const PROTOCOL_MARKER_END = "<!-- sot-protocol:end -->";

export type Harness = "claude" | "codex" | "copilot" | "cursor";

export const HARNESSES: Harness[] = ["claude", "codex", "copilot", "cursor"];

export const DEFAULT_HARNESS: Harness = "claude";

export interface HarnessTargets {
  agents: string;
  skills: string;
  rules: string;
  categories: string;
  guardrails: string;
}

/**
 * Where each asset kind lands, per harness. Skills use the cross-harness
 * SKILL.md format everywhere; agents need format conversion for
 * codex (TOML) and copilot (*.agent.md), while cursor reads the Claude
 * markdown format as-is. The categories and guardrails registries are
 * harness-neutral — one shared file each at the target root.
 */
export const HARNESS_TARGETS: Record<Harness, HarnessTargets> = {
  claude: {
    agents: ".claude/agents",
    skills: ".claude/skills",
    rules: "CLAUDE.md",
    categories: "sot-categories.md",
    guardrails: "sot-guardrails.md",
  },
  codex: {
    agents: ".codex/agents",
    skills: ".codex/skills",
    rules: "AGENTS.md",
    categories: "sot-categories.md",
    guardrails: "sot-guardrails.md",
  },
  copilot: {
    agents: ".github/agents",
    skills: ".github/skills",
    rules: ".github/copilot-instructions.md",
    categories: "sot-categories.md",
    guardrails: "sot-guardrails.md",
  },
  cursor: {
    agents: ".cursor/agents",
    skills: ".cursor/skills",
    rules: "AGENTS.md",
    categories: "sot-categories.md",
    guardrails: "sot-guardrails.md",
  },
};

export type AssetKind = "agents" | "skills" | "rules" | "categories" | "guardrails";

export const ASSET_KINDS: AssetKind[] = [
  "agents",
  "skills",
  "rules",
  "categories",
  "guardrails",
];

/**
 * Kinds whose files the project owns after injection (create-once, never
 * overwritten). `remove` deletes them only when explicitly selected or with
 * --purge, mirroring how --force never overwrites them on inject.
 */
export const USER_OWNED_KINDS: AssetKind[] = ["categories", "guardrails"];
