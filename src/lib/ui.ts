// @source-of-truth: cli-output
// File purpose: Canonical terminal-output styling — colors, status glyphs, and line formatters shared by every command.
import pc from "picocolors";
import type { InjectResult, RemoveResult } from "./fs-utils.js";

/** File statuses reported by the injectors and removers, plus fatal errors. */
export type Status = "created" | "updated" | "skipped" | "error" | "removed" | "missing";

const STATUS_GLYPHS: Record<Status, string> = {
  created: "✓",
  updated: "↻",
  skipped: "○",
  error: "✖",
  removed: "−",
  missing: "∅",
};

const STATUS_COLORS: Record<Status, (text: string) => string> = {
  created: pc.green,
  updated: pc.yellow,
  skipped: pc.dim,
  error: pc.red,
  removed: pc.magenta,
  missing: pc.dim,
};

/** Longest status word, so per-file lines align into columns. */
const STATUS_PAD = Math.max(...Object.keys(STATUS_GLYPHS).map((s) => s.length));

const LIST_BULLET = "•";

/** Bold cyan section heading. */
export function heading(text: string): string {
  return pc.bold(pc.cyan(text));
}

/** Dim secondary text (paths, destinations, notes). */
export function subtle(text: string): string {
  return pc.dim(text);
}

/** Bold key in a `key value` context line. */
export function label(text: string): string {
  return pc.bold(text);
}

/** Indented bullet line for asset-list items. */
export function listItem(text: string): string {
  return `  ${LIST_BULLET} ${text}`;
}

/** One aligned per-file line: colored glyph + status word + path (+ dim note). */
export function statusLine(status: Status, item: string, note?: string): string {
  const paint = STATUS_COLORS[status];
  const badge = paint(`${STATUS_GLYPHS[status]} ${status.padEnd(STATUS_PAD)}`);
  return `  ${badge}  ${item}${note ? ` ${pc.dim(note)}` : ""}`;
}

/** One-line colored tally of an injection run: "3 created · 1 updated · 2 skipped". */
export function summaryLine(result: InjectResult): string {
  const part = (status: Status, count: number): string => {
    const text = `${count} ${status}`;
    return count > 0 ? STATUS_COLORS[status](pc.bold(text)) : pc.dim(text);
  };
  return [
    part("created", result.created.length),
    part("updated", result.updated.length),
    part("skipped", result.skipped.length),
  ].join(pc.dim(" · "));
}

/** One-line colored tally of a removal run: "3 removed · 1 skipped · 2 missing". */
export function removeSummaryLine(result: RemoveResult): string {
  const part = (status: Status, count: number): string => {
    const text = `${count} ${status}`;
    return count > 0 ? STATUS_COLORS[status](pc.bold(text)) : pc.dim(text);
  };
  return [
    part("removed", result.removed.length),
    part("skipped", result.skipped.length),
    part("missing", result.missing.length),
  ].join(pc.dim(" · "));
}

/** Red error line for fatal command failures. */
export function errorLine(message: string): string {
  return `${pc.red(`${STATUS_GLYPHS.error} error`)}  ${message}`;
}
