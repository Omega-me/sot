import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import {
  PROTOCOL_MARKER_BEGIN,
  PROTOCOL_MARKER_END,
} from "../src/lib/constants.js";
import {
  injectAgents,
  injectCategories,
  injectGuardrails,
  injectRules,
  injectSkills,
} from "../src/lib/inject.js";

let target: string;

before(() => {
  target = fs.mkdtempSync(path.join(os.tmpdir(), "sot-test-"));
});

after(() => {
  fs.rmSync(target, { recursive: true, force: true });
});

test("injectAgents copies agent files and skips on re-run", () => {
  const first = injectAgents(target, false);
  assert.ok(first.created.includes(path.join(".claude", "agents", "sot-build.md")));
  assert.ok(first.created.includes(path.join(".claude", "agents", "sot-review.md")));

  const second = injectAgents(target, false);
  assert.equal(second.created.length, 0);
  assert.equal(second.skipped.length, first.created.length);

  const forced = injectAgents(target, true);
  assert.equal(forced.updated.length, first.created.length);
});

test("injectSkills copies skill folders", () => {
  const result = injectSkills(target, false);
  assert.ok(
    result.created.includes(path.join(".claude", "skills", "sot-navigator", "SKILL.md")),
  );
  assert.ok(
    fs.existsSync(path.join(target, ".claude", "skills", "guardrail-audit", "SKILL.md")),
  );
});

test("injectAgents for codex converts agents to TOML definitions", () => {
  const first = injectAgents(target, false, "codex");
  assert.ok(first.created.includes(path.join(".codex", "agents", "sot-build.toml")));
  assert.ok(first.created.includes(path.join(".codex", "agents", "sot-review.toml")));

  const toml = fs.readFileSync(
    path.join(target, ".codex", "agents", "sot-build.toml"),
    "utf8",
  );
  assert.ok(toml.includes('name = "sot-build"'));
  assert.ok(/^description = "/m.test(toml));
  assert.ok(toml.includes("developer_instructions = '''"));
  assert.ok(!toml.includes("tools ="), "Claude-specific tools must be dropped");

  const second = injectAgents(target, false, "codex");
  assert.equal(second.created.length, 0);
  assert.equal(second.skipped.length, first.created.length);
});

test("injectAgents for copilot writes *.agent.md profiles without Claude tools", () => {
  const result = injectAgents(target, false, "copilot");
  assert.ok(
    result.created.includes(path.join(".github", "agents", "sot-build.agent.md")),
  );

  const profile = fs.readFileSync(
    path.join(target, ".github", "agents", "sot-build.agent.md"),
    "utf8",
  );
  assert.ok(profile.startsWith("---\nname: sot-build\n"));
  assert.ok(/^description: /m.test(profile));
  assert.ok(!/^tools:/m.test(profile), "Claude-specific tools must be dropped");
  assert.ok(profile.includes("You are the SOT build agent"));
});

test("injectAgents for cursor copies the Claude markdown as-is", () => {
  const first = injectAgents(target, false, "cursor");
  assert.ok(first.created.includes(path.join(".cursor", "agents", "sot-build.md")));
  assert.ok(first.created.includes(path.join(".cursor", "agents", "sot-review.md")));

  const copied = fs.readFileSync(
    path.join(target, ".cursor", "agents", "sot-build.md"),
    "utf8",
  );
  const source = fs.readFileSync(
    path.join(target, ".claude", "agents", "sot-build.md"),
    "utf8",
  );
  assert.equal(copied, source, "cursor uses the Claude format unconverted");

  const second = injectAgents(target, false, "cursor");
  assert.equal(second.created.length, 0);
  assert.equal(second.skipped.length, first.created.length);
});

test("injectSkills for codex, copilot, and cursor copies SKILL.md trees unchanged", () => {
  const codex = injectSkills(target, false, "codex");
  assert.ok(
    codex.created.includes(path.join(".codex", "skills", "sot-navigator", "SKILL.md")),
  );
  const copilot = injectSkills(target, false, "copilot");
  assert.ok(
    copilot.created.includes(
      path.join(".github", "skills", "sot-navigator", "SKILL.md"),
    ),
  );
  const cursor = injectSkills(target, false, "cursor");
  assert.ok(
    cursor.created.includes(
      path.join(".cursor", "skills", "sot-navigator", "SKILL.md"),
    ),
  );
});

test("injectRules targets the harness rules file", () => {
  const codexFirst = injectRules(target, "codex");
  assert.deepEqual(codexFirst.created, ["AGENTS.md"]);
  const agentsMd = fs.readFileSync(path.join(target, "AGENTS.md"), "utf8");
  assert.ok(agentsMd.includes(PROTOCOL_MARKER_BEGIN));

  const codexSecond = injectRules(target, "codex");
  assert.deepEqual(codexSecond.skipped, ["AGENTS.md"]);

  // Cursor reads AGENTS.md natively, so it shares the codex rules file.
  const cursor = injectRules(target, "cursor");
  assert.deepEqual(cursor.skipped, ["AGENTS.md"]);

  const copilot = injectRules(target, "copilot");
  assert.deepEqual(copilot.created, [".github/copilot-instructions.md"]);
  const instructions = fs.readFileSync(
    path.join(target, ".github", "copilot-instructions.md"),
    "utf8",
  );
  assert.ok(instructions.includes(PROTOCOL_MARKER_BEGIN));
  assert.ok(instructions.includes(PROTOCOL_MARKER_END));
});

test("injectCategories creates the registry once and never overwrites it", () => {
  const first = injectCategories(target);
  assert.deepEqual(first.created, ["sot-categories.md"]);

  const registryPath = path.join(target, "sot-categories.md");
  const seeded = fs.readFileSync(registryPath, "utf8");
  assert.ok(seeded.includes("@source-of-truth"));

  // Simulate the user registering their own category, then re-inject:
  // the file is user-owned and must survive untouched, for every harness.
  const edited = seeded + "- `my-category` — canonical widget wiring.\n";
  fs.writeFileSync(registryPath, edited, "utf8");

  const second = injectCategories(target);
  assert.deepEqual(second.skipped, ["sot-categories.md"]);
  const codex = injectCategories(target, "codex");
  assert.deepEqual(codex.skipped, ["sot-categories.md"]);
  assert.equal(fs.readFileSync(registryPath, "utf8"), edited);
});

test("injectGuardrails creates the registry once and never overwrites it", () => {
  const first = injectGuardrails(target);
  assert.deepEqual(first.created, ["sot-guardrails.md"]);

  const registryPath = path.join(target, "sot-guardrails.md");
  const seeded = fs.readFileSync(registryPath, "utf8");
  assert.ok(seeded.includes("## Guardrails"));

  // Simulate the project recording its own guardrail, then re-inject:
  // the file is user-owned and must survive untouched, for every harness.
  const edited = seeded + "- Never call the payment API from view code.\n";
  fs.writeFileSync(registryPath, edited, "utf8");

  const second = injectGuardrails(target);
  assert.deepEqual(second.skipped, ["sot-guardrails.md"]);
  const codex = injectGuardrails(target, "codex");
  assert.deepEqual(codex.skipped, ["sot-guardrails.md"]);
  assert.equal(fs.readFileSync(registryPath, "utf8"), edited);
});

test("injectRules is idempotent and preserves surrounding content", () => {
  const claudePath = path.join(target, "CLAUDE.md");
  fs.writeFileSync(claudePath, "# My project\n\nExisting notes.\n", "utf8");

  const first = injectRules(target);
  assert.deepEqual(first.updated, ["CLAUDE.md"]);
  const content = fs.readFileSync(claudePath, "utf8");
  assert.ok(content.startsWith("# My project"));
  assert.ok(content.includes(PROTOCOL_MARKER_BEGIN));
  assert.ok(content.includes(PROTOCOL_MARKER_END));

  const second = injectRules(target);
  assert.deepEqual(second.skipped, ["CLAUDE.md"]);
  assert.equal(fs.readFileSync(claudePath, "utf8"), content);
});

test("injectRules ignores marker mentions embedded in prose", () => {
  const claudePath = path.join(target, "CLAUDE.md");
  const prose =
    "# My project\n\n" +
    `Docs may mention the ${PROTOCOL_MARKER_BEGIN} and ${PROTOCOL_MARKER_END} markers mid-sentence.\n`;
  fs.writeFileSync(claudePath, prose, "utf8");

  const first = injectRules(target);
  assert.deepEqual(first.updated, ["CLAUDE.md"]);
  const content = fs.readFileSync(claudePath, "utf8");
  assert.ok(
    content.startsWith(prose.trimEnd()),
    "prose mentioning the markers must survive untouched",
  );
  assert.ok(
    content.includes(`\n${PROTOCOL_MARKER_BEGIN}\n`),
    "the block must be appended with markers on their own lines",
  );

  const second = injectRules(target);
  assert.deepEqual(second.skipped, ["CLAUDE.md"]);
  assert.equal(fs.readFileSync(claudePath, "utf8"), content);
});
