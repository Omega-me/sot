import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { ASSET_KINDS, CLI_MAX_BUFFER_BYTES } from "../src/lib/constants.js";
import {
  escapePowerShellSingleQuoted,
  openFolder,
  pickFolder,
  startGuiServer,
  type GuiServer,
} from "../src/lib/server.js";

// The real CLI entry, spawned exactly like the GUI server does in dev (tsx).
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
      { maxBuffer: CLI_MAX_BUFFER_BYTES },
      (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === "number" ? error.code : 1;
        resolve({ stdout, stderr, code });
      },
    );
  });
}

let target: string;
let gui: GuiServer;

before(async () => {
  target = fs.mkdtempSync(path.join(os.tmpdir(), "sot-gui-test-"));
  gui = await startGuiServer(0); // ephemeral port, 127.0.0.1 only
});

after(async () => {
  gui.server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    gui.server.close((error) => (error ? reject(error) : resolve()));
  });
  fs.rmSync(target, { recursive: true, force: true });
});

test("list --json prints a machine-readable inventory", async () => {
  const run = await runCli(["list", "--json"]);
  assert.equal(run.code, 0, run.stderr);
  const inventory = JSON.parse(run.stdout) as {
    kinds: string[];
    agents: string[];
    skills: string[];
    targets: Record<string, Record<string, string>>;
  };
  assert.deepEqual(inventory.kinds, ASSET_KINDS);
  assert.ok(inventory.agents.includes("sot-build"));
  assert.ok(inventory.skills.includes("sot-navigator"));
  assert.equal(inventory.targets.claude?.agents, ".claude/agents");
});

test("inject --json --only injects just the named skills and reports JSON", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sot-gui-only-"));
  try {
    const run = await runCli([
      "inject",
      "--target",
      dir,
      "--skills",
      "--only",
      "sot-navigator",
      "--json",
    ]);
    assert.equal(run.code, 0, run.stderr);
    const report = JSON.parse(run.stdout) as {
      kinds: string[];
      result: { created: string[]; updated: string[]; skipped: string[] };
    };
    assert.deepEqual(report.kinds, ["skills"]);
    assert.ok(
      report.result.created.includes(
        path.join(".claude", "skills", "sot-navigator", "SKILL.md"),
      ),
    );
    assert.ok(
      fs.existsSync(path.join(dir, ".claude", "skills", "sot-navigator", "SKILL.md")),
    );
    assert.ok(
      !fs.existsSync(path.join(dir, ".claude", "skills", "guardrail-audit")),
      "--only must exclude unnamed skills",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("GET /api/assets returns the CLI inventory", async () => {
  const res = await fetch(`${gui.url}api/assets`);
  assert.equal(res.status, 200);
  const inventory = (await res.json()) as { agents: string[]; skills: string[] };
  assert.ok(inventory.agents.includes("sot-review"));
  assert.ok(inventory.skills.includes("caveman"));
});

test("GET /api/browse lists only subdirectories", async () => {
  fs.mkdirSync(path.join(target, "sub-dir"));
  fs.writeFileSync(path.join(target, "a-file.txt"), "not a directory", "utf8");

  const res = await fetch(`${gui.url}api/browse?path=${encodeURIComponent(target)}`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    path: string;
    entries: { name: string; path: string }[];
  };
  assert.equal(body.path, target);
  const names = body.entries.map((entry) => entry.name);
  assert.ok(names.includes("sub-dir"));
  assert.ok(!names.includes("a-file.txt"), "files must never be listed");
});

test("GET /api/browse without a path is rejected", async () => {
  const res = await fetch(`${gui.url}api/browse`);
  assert.equal(res.status, 400);
});

test("GET /api/browse reports a nonexistent path as 404 with exists: false", async () => {
  const missing = path.join(target, "does-not-exist");
  const res = await fetch(`${gui.url}api/browse?path=${encodeURIComponent(missing)}`);
  assert.equal(res.status, 404);
  const body = (await res.json()) as { error: string; exists: boolean };
  assert.equal(body.exists, false);
  assert.match(body.error, /does not exist/i);
});

test("GET /api/browse rejects a path that is a file", async () => {
  const file = path.join(target, "browse-file.txt");
  fs.writeFileSync(file, "not a directory", "utf8");
  const res = await fetch(`${gui.url}api/browse?path=${encodeURIComponent(file)}`);
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: string };
  assert.match(body.error, /not a directory/i);
});

test("pickFolder rejects platforms without a native dialog", async () => {
  await assert.rejects(pickFolder("aix"), /no native folder picker/i);
});

// /api/open-folder success would launch the real OS file manager, so only the
// validation paths (which return before spawning) are exercised here.
test("GET /api/open-folder without a path is rejected", async () => {
  const res = await fetch(`${gui.url}api/open-folder`);
  assert.equal(res.status, 400);
});

test("GET /api/open-folder reports a nonexistent path as 404 with exists: false", async () => {
  const missing = path.join(target, "does-not-exist");
  const res = await fetch(`${gui.url}api/open-folder?path=${encodeURIComponent(missing)}`);
  assert.equal(res.status, 404);
  const body = (await res.json()) as { error: string; exists: boolean };
  assert.equal(body.exists, false);
  assert.match(body.error, /does not exist/i);
});

test("GET /api/open-folder rejects a path that is a file", async () => {
  const file = path.join(target, "open-folder-file.txt");
  fs.writeFileSync(file, "not a directory", "utf8");
  const res = await fetch(`${gui.url}api/open-folder?path=${encodeURIComponent(file)}`);
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: string };
  assert.match(body.error, /not a directory/i);
});

test("openFolder rejects platforms without a file manager opener", async () => {
  await assert.rejects(openFolder(target, "aix"), /no file manager opener/i);
});

// The win32 open script embeds the folder path in a single-quoted PowerShell
// literal; only the escaping is testable without spawning a real window.
test("escapePowerShellSingleQuoted doubles embedded single quotes", () => {
  assert.equal(escapePowerShellSingleQuoted("C:\\it's a 'test'"), "C:\\it''s a ''test''");
  assert.equal(escapePowerShellSingleQuoted("C:\\no quotes"), "C:\\no quotes");
});

test("POST /api/inject drives the real CLI end-to-end", async () => {
  const res = await fetch(`${gui.url}api/inject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target,
      kinds: ["skills", "guardrails"],
      only: ["sot-navigator"],
      force: false,
      harnesses: ["claude"],
    }),
  });
  assert.equal(res.status, 200);
  const report = (await res.json()) as {
    result: { created: string[]; updated: string[]; skipped: string[] };
  };
  assert.ok(
    report.result.created.includes(
      path.join(".claude", "skills", "sot-navigator", "SKILL.md"),
    ),
  );
  assert.ok(report.result.created.includes("sot-guardrails.md"));
  assert.ok(
    fs.existsSync(path.join(target, ".claude", "skills", "sot-navigator", "SKILL.md")),
  );
  assert.ok(fs.existsSync(path.join(target, "sot-guardrails.md")));
  assert.ok(
    !fs.existsSync(path.join(target, ".claude", "agents")),
    "unselected kinds must not be injected",
  );
});

test("GET /api/status reports the injected state", async () => {
  const res = await fetch(`${gui.url}api/status?target=${encodeURIComponent(target)}`);
  assert.equal(res.status, 200);
  const status = (await res.json()) as {
    exists: boolean;
    agents: { installed: string[] };
    skills: { installed: string[] };
    rules: { present: boolean };
    categories: { present: boolean };
    guardrails: { present: boolean };
  };
  assert.equal(status.exists, true);
  assert.deepEqual(status.agents.installed, []);
  assert.ok(status.skills.installed.includes("sot-navigator"));
  assert.equal(status.rules.present, false);
  assert.equal(status.categories.present, false);
  assert.equal(status.guardrails.present, true);
});

test("POST /api/inject rejects invalid payloads", async () => {
  const res = await fetch(`${gui.url}api/inject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, kinds: ["not-a-kind"] }),
  });
  assert.equal(res.status, 400);
});

test("POST /api/remove drives the real CLI end-to-end", async () => {
  // Removes what the /api/inject test above created (skills + guardrails).
  const res = await fetch(`${gui.url}api/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target,
      kinds: ["skills", "guardrails"],
      only: ["sot-navigator"],
      harnesses: ["claude"],
    }),
  });
  assert.equal(res.status, 200);
  const report = (await res.json()) as {
    result: { removed: string[]; skipped: string[]; missing: string[] };
  };
  assert.ok(
    report.result.removed.includes(path.join(".claude", "skills", "sot-navigator")),
  );
  assert.ok(report.result.removed.includes("sot-guardrails.md"));
  assert.ok(!fs.existsSync(path.join(target, "sot-guardrails.md")));
  assert.ok(
    !fs.existsSync(path.join(target, ".claude")),
    "empty .claude tree must be pruned after the last asset is removed",
  );

  const statusRes = await fetch(
    `${gui.url}api/status?target=${encodeURIComponent(target)}`,
  );
  const status = (await statusRes.json()) as {
    skills: { installed: string[] };
    guardrails: { present: boolean };
  };
  assert.deepEqual(status.skills.installed, []);
  assert.equal(status.guardrails.present, false);
});

test("POST /api/remove rejects invalid payloads", async () => {
  const res = await fetch(`${gui.url}api/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, purge: "yes" }),
  });
  assert.equal(res.status, 400);
});
