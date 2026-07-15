import { DEFAULT_HARNESS, HARNESSES, type Harness } from "./constants.js";

export interface ParsedHarnesses {
  harnesses: Harness[];
  /** Names that are not valid harnesses; non-empty means the input is unusable. */
  invalid: string[];
}

/**
 * Normalize --harness values (repeatable and comma-separated, case-insensitive,
 * deduplicated; empty input falls back to the default harness).
 */
export function parseHarnesses(input: string[] | undefined): ParsedHarnesses {
  const names = (input ?? [DEFAULT_HARNESS])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  const selected = names.length > 0 ? [...new Set(names)] : [DEFAULT_HARNESS];
  const invalid = selected.filter((name) => !HARNESSES.includes(name as Harness));
  return {
    harnesses: invalid.length > 0 ? [] : (selected as Harness[]),
    invalid,
  };
}
