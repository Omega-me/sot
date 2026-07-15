import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
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
import {
  removeAgents,
  removeCategories,
  removeGuardrails,
  removeRules,
  removeSkills,
} from "../src/lib/remove.js";

const CLI = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "src",
  "index.ts",
);

function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ["--import", "tsx", CLI, ...args],
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === "number" ? error.code : 1;
        resolve({ stdout, stderr, code });
      },
    );
  });
}

function makeTarget(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sot-remove-test-"));
}

test("remove after inject leaves the target clean (user-owned registries via explicit removers)", () => {
  const target = makeTarget();
  try {
    injectAgents(target, false);
    injectSkills(target, false);
    injectRules(target);
    injectCategories(target);
    injectGuardrails(target);

    const agents = removeAgents(target);
    assert.ok(agents.removed.includes(path.join(".claude", "agents", "sot-build.md")));
    assert.ok(agents.removed.includes(path.join(".claude", "agents", "sot-review.md")));

    const skills = removeSkills(target);
    assert.ok(skills.removed.includes(path.join(".claude", "skills", "sot-navigator")));

    const rules = removeRules(target);
    assert.deepEqual(rules.removed, ["CLAUDE.md"]);
    assert.ok(
      !fs.existsSync(path.join(target, "CLAUDE.md")),
      "a rules file that held only the block must be deleted",
    );

    assert.ok(
      !fs.existsSync(path.join(target, ".claude")),
      "empty .claude tree must be pruned",
    );

    const categories = removeCategories(target);
    assert.deepEqual(categories.removed, ["sot-categories.md"]);
    const guardrails = removeGuardrails(target);
    assert.deepEqual(guardrails.removed, ["sot-guardrails.md"]);

    assert.deepEqual(fs.readdirSync(target), [], "target must be empty after full remove");
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("removeRules strips only the marker block and preserves user content", () => {
  const target = makeTarget();
  try {
    const claudePath = path.join(target, "CLAUDE.md");
    const prose = "# My project\n\nExisting notes.\n";
    fs.writeFileSync(claudePath, prose, "utf8");
    injectRules(target);

    const result = removeRules(target);
    assert.deepEqual(result.removed, ["CLAUDE.md"]);
    const content = fs.readFileSync(claudePath, "utf8");
    assert.ok(content.startsWith(prose.trimEnd()), "user content must survive untouched");
    assert.ok(!content.includes(PROTOCOL_MARKER_BEGIN));
    assert.ok(!content.includes(PROTOCOL_MARKER_END));

    const again = removeRules(target);
    assert.deepEqual(again.missing, ["CLAUDE.md"], "no block left to remove");
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("removeAgents and removeSkills honor --only and never touch the project's own assets", () => {
  const target = makeTarget();
  try {
    injectAgents(target, false);
    injectSkills(target, false);
    const ownAgent = path.join(target, ".claude", "agents", "my-own-agent.md");
    const ownSkill = path.join(target, ".claude", "skills", "my-own-skill", "SKILL.md");
    fs.writeFileSync(ownAgent, "# mine\n", "utf8");
    fs.mkdirSync(path.dirname(ownSkill), { recursive: true });
    fs.writeFileSync(ownSkill, "# mine\n", "utf8");

    const agents = removeAgents(target, "claude", ["sot-build"]);
    assert.deepEqual(agents.removed, [path.join(".claude", "agents", "sot-build.md")]);
    assert.ok(fs.existsSync(path.join(target, ".claude", "agents", "sot-review.md")));

    const skills = removeSkills(target, "claude", ["sot-navigator"]);
    assert.deepEqual(skills.removed, [path.join(".claude", "skills", "sot-navigator")]);
    assert.ok(fs.existsSync(path.join(target, ".claude", "skills", "guardrail-audit")));

    // The project's own files are never candidates, even on a full remove.
    removeAgents(target);
    removeSkills(target);
    assert.ok(fs.existsSync(ownAgent), "project's own agent must survive");
    assert.ok(fs.existsSync(ownSkill), "project's own skill must survive");
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("removeAgents deletes the per-harness converted filenames", () => {
  const target = makeTarget();
  try {
    injectAgents(target, false, "codex");
    injectAgents(target, false, "copilot");

    const codex = removeAgents(target, "codex");
    assert.ok(codex.removed.includes(path.join(".codex", "agents", "sot-build.toml")));
    const copilot = removeAgents(target, "copilot");
    assert.ok(
      copilot.removed.includes(path.join(".github", "agents", "sot-build.agent.md")),
    );
    assert.ok(!fs.existsSync(path.join(target, ".codex")));
    assert.ok(!fs.existsSync(path.join(target, ".github")));
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("CLI remove with no kind flags skips the user-owned registries; --purge deletes them", async () => {
  const target = makeTarget();
  try {
    let run = await runCli(["inject", "--target", target, "--json"]);
    assert.equal(run.code, 0, run.stderr);

    run = await runCli(["remove", "--target", target, "--json"]);
    assert.equal(run.code, 0, run.stderr);
    const report = JSON.parse(run.stdout) as {
      result: { removed: string[]; skipped: string[]; missing: string[] };
    };
    assert.ok(report.result.skipped.includes("sot-categories.md"));
    assert.ok(report.result.skipped.includes("sot-guardrails.md"));
    assert.ok(
      fs.existsSync(path.join(target, "sot-categories.md")),
      "user-owned registry must survive a default remove-all",
    );
    assert.ok(fs.existsSync(path.join(target, "sot-guardrails.md")));
    assert.ok(!fs.existsSync(path.join(target, ".claude")));
    assert.ok(!fs.existsSync(path.join(target, "CLAUDE.md")));

    run = await runCli(["remove", "--target", target, "--json", "--purge"]);
    assert.equal(run.code, 0, run.stderr);
    const purged = JSON.parse(run.stdout) as {
      result: { removed: string[]; skipped: string[]; missing: string[] };
    };
    assert.ok(purged.result.removed.includes("sot-categories.md"));
    assert.ok(purged.result.removed.includes("sot-guardrails.md"));
    assert.deepEqual(fs.readdirSync(target), []);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("CLI remove with an explicit kind flag deletes a user-owned registry", async () => {
  const target = makeTarget();
  try {
    let run = await runCli(["inject", "--target", target, "--guardrails", "--json"]);
    assert.equal(run.code, 0, run.stderr);
    assert.ok(fs.existsSync(path.join(target, "sot-guardrails.md")));

    run = await runCli(["remove", "--target", target, "--guardrails", "--json"]);
    assert.equal(run.code, 0, run.stderr);
    const report = JSON.parse(run.stdout) as {
      result: { removed: string[]; skipped: string[]; missing: string[] };
    };
    assert.deepEqual(report.result.removed, ["sot-guardrails.md"]);
    assert.ok(!fs.existsSync(path.join(target, "sot-guardrails.md")));
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});
