# Audit checklist

Scan the **entire audit scope** (the whole repository unless the user narrows
it) and report every violation of the categories below plus any additional
rules defined in the project's protocol file and in `sot-guardrails.md` at
the repository root (report those under the category **Project guardrails**).
Exclude VCS, dependency, generated, and build-output directories.

Two module kinds are referenced throughout:

- **Working module** — implements a feature; owns source files and constants.
- **Grouping module** — groups related child modules by domain; owns **only**
  a public barrel plus child folders, never source files or constants.

A "barrel" is a module's single public entry file — whatever the language uses
(e.g. `index.ts` in TypeScript, `__init__.py` in Python, `mod.rs` in Rust, a
package's exported surface elsewhere).

---

## 1 — Structural / SOT

| #   | Rule |
| --- | ---- |
| 1.1 | Every structural decision traces to a `@source-of-truth` tag or a skill — no invented patterns |
| 1.2 | Every canonical pattern file has the correct `@source-of-truth` tag with a category registered in `sot-categories.md` at the repository root |
| 1.3 | Every SOT-tagged source/config file keeps a one-sentence `// File purpose: ...` line directly under the contiguous tag block |
| 1.4 | No untagged canonical code — if a file defines a pattern others should follow, it must be tagged |

## 2 — Module structure

| #   | Rule |
| --- | ---- |
| 2.1 | Every module is classifiable as working (owns source) or grouping (barrel + child folders only); grouping modules own no source files, no constants, no logic |
| 2.2 | Each standalone working module and each grouping module exposes exactly one public barrel; that barrel is the module's contract |
| 2.3 | No leaf or namespace barrels — a module's internal subfolders (e.g. its components/, hooks/, lib/ folders) do not get their own barrels; working modules nested under a grouping module are surfaced by the nearest grouping barrel, not their own |
| 2.4 | A `core/` folder under a grouping subtree contains only code used by at least two sibling child modules of that same subtree; one-sibling code stays in the owning sibling |
| 2.5 | No child module aliases or re-exports a `core/` symbol to fake ownership — core symbols are imported directly where needed |

## 3 — Constants & magic values

| #   | Rule |
| --- | ---- |
| 3.1 | Every owning working module has a constants file |
| 3.2 | No inline module-owned magic strings, numbers, arrays, records, env-variable names, or route keys — they live in the nearest owning constants file |
| 3.3 | Grouping modules own no constants files |

## 4 — Imports & boundaries

| #   | Rule |
| --- | ---- |
| 4.1 | Imports inside the same module/group subtree use direct relative paths; imports that leave the subtree go through the parent module/group barrel — never deep into another module's internals |
| 4.2 | Cross-package imports use the package's public name or alias, never relative paths that escape a package |
| 4.3 | Layer boundaries respected: view/UI code contains no business logic, the backend owns data access and business logic, and shared packages import nothing app-specific |

## 5 — Guardrails

| #   | Rule |
| --- | ---- |
| 5.1 | No untyped escape hatches (e.g. TypeScript's `any`, `Object`-typed catch-alls, untyped dynamic values) — type the value properly or use a safe narrowing pattern |
| 5.2 | No checker-suppression comments (e.g. `@ts-ignore`, `# type: ignore`, `eslint-disable`, `#pragma warning disable`) — fix the underlying error |
| 5.3 | Domain errors use the project's error convention — never bare generic throws where a typed/domain error type exists |
| 5.4 | Inputs are validated at public entry points (e.g. API handlers, exposed functions, form submissions) |

## 6 — View/route hygiene

| #   | Rule |
| --- | ---- |
| 6.1 | View code delegates logic to the project's logic layer (e.g. React components delegate to hooks; templates delegate to services) — no state machines, data fetching, or business rules inline in view code |
| 6.2 | Routes orchestrate only: param validation, auth checks, redirects, and data-load delegation — no business logic in route files |

---

## Report format

Group findings by category. For each violation:

```
### [Category] — Rule #X.Y

**File**: `path/to/file:LINE`
**Violation**: What is wrong
**Rule**: The exact guardrail being violated
**Fix**: What needs to change
```

At the end, output a summary table:

| Category                 | Violations | Status |
| ------------------------ | ---------- | ------ |
| Structural / SOT         | 0          | ✅     |
| Module structure         | 2          | ❌     |
| ...                      | ...        | ...    |

If zero violations → output: **All guardrails pass. ✅**
