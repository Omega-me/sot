# Fix actions

Run the sibling `guardrail-audit` skill's `references/audit-checklist.md`
first to discover violations, apply the fixes below directly, re-verify, then
summarize. Category numbers mirror the checklist.

---

## 1 — Structural / SOT fixes

- **Missing `@source-of-truth` tag on canonical pattern** → Add the correct
  tag using a category registered in `sot-categories.md` at the repository
  root.
- **Wrong SOT category** → Replace with the correct category.
- **Missing or misplaced `// File purpose: ...` line** → Add or move a
  one-sentence purpose comment directly under the contiguous SOT tag block.
- **New canonical pattern introduced without a tag** → Add the tag + purpose
  line so the next change finds it.
- **Invented structure with no covering tag or skill** → Stop and ask; do not
  retro-fit a rule that does not exist.

## 2 — Module structure fixes

- **Missing public barrel** → Create the standalone working module or
  grouping module barrel that re-exports the subtree's public API.
- **Leaf/namespace barrel exists** → Move any public exports to the parent
  module/group barrel, then remove the leaf barrel.
- **Grouping module owns source files or constants** → Move implementation to
  the owning child working module (public surface stays on the grouping
  barrel), then remove the grouping-owned files.
- **Mis-scoped `core/` code** → Trace imports: code used by one sibling moves
  into that sibling's owning module; code shared across unrelated modules
  moves to the app common module or a shared package.
- **Child alias/re-export of a `core/` symbol** → Remove the alias and import
  the core symbol directly wherever it is needed.

## 3 — Constants & magic value fixes

- **Missing constants file** → Create it in the owning working module and
  move the module's constants there. Do not create constants files in
  grouping modules.
- **Inline magic strings/numbers/arrays/records/env names/route keys** →
  Extract to the nearest owning constants file.

## 4 — Import & boundary fixes

- **External import bypasses the parent barrel** → Rewrite imports that leave
  a module/group subtree to go through the parent barrel; keep direct
  relative imports inside the same subtree.
- **Cross-package relative import** → Replace with the package's public name
  or alias.
- **Layer violation** → Move business logic out of view code into the
  project's logic layer, move data access into the backend's owning module,
  and remove app-specific imports from shared packages.

## 5 — Guardrail fixes

- **Untyped escape hatch (e.g. TypeScript's `any`)** → Replace with the
  proper type or a safe narrowing pattern.
- **Checker-suppression comment (e.g. `@ts-ignore`, `eslint-disable`)** →
  Remove it and fix the underlying error.
- **Bare generic throw where the project has an error convention** → Replace
  with the project's domain error type.
- **Unvalidated input at a public entry point** → Add validation using the
  project's validation convention.

## 6 — View/route hygiene fixes

- **Business logic in view code** → Extract to the project's logic layer
  (e.g. a React component's logic moves to a hook).
- **Business logic in a route file** → Move it to the owning module; the
  route keeps only orchestration (param validation, auth checks, redirects,
  data-load delegation).

---

## SOT categories

Category names are project-defined: the closed vocabulary lives in
`sot-categories.md` at the repository root. When tagging, reuse an existing
category that fits before proposing a new one — and propose additions to the
user rather than silently extending the registry.

## Fix boundaries (always apply)

- Never invent architecture; a fix with no covering tag or skill goes back to
  the user as a question.
- Ask before adding dependencies or altering canonical tagged patterns.
- Never weaken a guardrail to silence it.

---

## Output

For each fix applied:

```
✅ Fixed: [file:line] — [short description of what was fixed]
```

End with a summary count: `Fixed N violations across M files.`

If nothing to fix → output: **All guardrails pass. No fixes needed. ✅**
