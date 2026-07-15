// @source-of-truth: harness-registry
// File purpose: Canonical registry of supported harnesses, asset kinds, and per-harness template/target paths.
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolved relative to this file so it works both from src/ (tsx) and dist/ (built).
export const TEMPLATES_DIR = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "..",
  "templates",
);

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
