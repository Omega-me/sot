// @source-of-truth: gui-server
// File purpose: Canonical local GUI HTTP server — loopback-only API that serves the static GUI page, validates a directory and lists its subfolder names, opens the native OS folder picker, opens a folder in the OS file manager, reports injected state, and drives the real CLI (spawned `sot list/inject/remove --json`) instead of duplicating injector/remover logic.
import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {
  ASSET_KINDS,
  CLI_ENTRY,
  CLI_MAX_BUFFER_BYTES,
  DEFAULT_HARNESS,
  GUI_API_PATHS,
  GUI_DIR,
  GUI_HOST,
  GUI_INDEX_FILE,
  GUI_MAX_BODY_BYTES,
  GUI_PICKER_TIMEOUT_MS,
  HARNESS_TARGETS,
  HARNESSES,
  PROTOCOL_MARKER_BEGIN,
  type AssetKind,
  type Harness,
} from "./constants.js";

export interface GuiServer {
  server: http.Server;
  port: number;
  url: string;
}

/**
 * Start the GUI server. Binds to 127.0.0.1 only — this server can spawn the
 * CLI and browse the filesystem, so it must never be reachable from the
 * network. Pass port 0 for an ephemeral port (tests).
 */
export function startGuiServer(port: number): Promise<GuiServer> {
  const server = http.createServer((req, res) => {
    void handle(req, res);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, GUI_HOST, () => {
      const address = server.address();
      const actualPort =
        typeof address === "object" && address !== null ? address.port : port;
      resolve({ server, port: actualPort, url: `http://${GUI_HOST}:${actualPort}/` });
    });
  });
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", `http://${GUI_HOST}`);
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === `/${GUI_INDEX_FILE}`)) {
      serveIndex(res);
      return;
    }
    if (req.method === "GET" && url.pathname === GUI_API_PATHS.assets) {
      await handleAssets(res);
      return;
    }
    if (req.method === "GET" && url.pathname === GUI_API_PATHS.browse) {
      handleBrowse(url, res);
      return;
    }
    if (req.method === "GET" && url.pathname === GUI_API_PATHS.status) {
      handleStatus(url, res);
      return;
    }
    if (req.method === "GET" && url.pathname === GUI_API_PATHS.pickFolder) {
      await handlePickFolder(res);
      return;
    }
    if (req.method === "GET" && url.pathname === GUI_API_PATHS.openFolder) {
      await handleOpenFolder(url, res);
      return;
    }
    if (req.method === "POST" && url.pathname === GUI_API_PATHS.inject) {
      await handleCliAction(req, res, "inject");
      return;
    }
    if (req.method === "POST" && url.pathname === GUI_API_PATHS.remove) {
      await handleCliAction(req, res, "remove");
      return;
    }
    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: errorMessage(error) });
  }
}

// --- CLI bridge -------------------------------------------------------------

interface CliRun {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Spawn the real CLI. Re-invokes process.execPath: as a packaged exe the
 * binary itself is the CLI; otherwise the entry script runs with the current
 * exec args (minus test-runner flags) so tsx loaders survive in dev.
 */
function runCli(args: string[]): Promise<CliRun> {
  const isPkg = "pkg" in process;
  const passthrough = process.execArgv.filter((arg) => !arg.startsWith("--test"));
  const argv = isPkg ? args : [...passthrough, CLI_ENTRY, ...args];
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      argv,
      { maxBuffer: CLI_MAX_BUFFER_BYTES },
      (error, stdout, stderr) => {
        const code =
          error === null ? 0 : typeof error.code === "number" ? error.code : 1;
        resolve({ stdout, stderr, code });
      },
    );
  });
}

async function handleAssets(res: http.ServerResponse): Promise<void> {
  const run = await runCli(["list", "--json"]);
  if (run.code !== 0) {
    sendJson(res, 500, { error: run.stderr.trim() || "sot list failed" });
    return;
  }
  sendRawJson(res, 200, run.stdout);
}

/** Shared body shape of POST /api/inject and /api/remove. */
interface CliActionRequest {
  target: string;
  kinds?: AssetKind[];
  harnesses?: Harness[];
  only?: string[];
  /** inject only */
  force?: boolean;
  /** remove only */
  purge?: boolean;
}

/** POST handler for inject/remove: validate the body, spawn the CLI, relay its JSON. */
async function handleCliAction(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  command: "inject" | "remove",
): Promise<void> {
  const body = await readBody(req);
  const parsed = parseCliActionRequest(body);
  if (typeof parsed === "string") {
    sendJson(res, 400, { error: parsed });
    return;
  }

  const args = [command, "--target", parsed.target, "--json"];
  for (const kind of parsed.kinds ?? []) args.push(`--${kind}`);
  if (command === "inject" && parsed.force) args.push("--force");
  if (command === "remove" && parsed.purge) args.push("--purge");
  if (parsed.harnesses && parsed.harnesses.length > 0) {
    args.push("--harness", parsed.harnesses.join(","));
  }
  if (parsed.only && parsed.only.length > 0) args.push("--only", ...parsed.only);

  const run = await runCli(args);
  if (run.code !== 0) {
    sendJson(res, 500, { error: run.stderr.trim() || `sot ${command} failed` });
    return;
  }
  sendRawJson(res, 200, run.stdout);
}

/** Validate the POST body; returns the parsed request or an error message. */
function parseCliActionRequest(body: string): CliActionRequest | string {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return "Body must be JSON";
  }
  if (typeof raw !== "object" || raw === null) return "Body must be a JSON object";
  const record = raw as Record<string, unknown>;

  const { target, kinds, force, purge, harnesses, only } = record;
  if (typeof target !== "string" || target.trim() === "") {
    return "target must be a non-empty string";
  }
  if (kinds !== undefined) {
    if (!isStringArray(kinds)) return "kinds must be an array of strings";
    const invalid = kinds.filter((k) => !ASSET_KINDS.includes(k as AssetKind));
    if (invalid.length > 0) return `Unknown kind(s): ${invalid.join(", ")}`;
  }
  if (force !== undefined && typeof force !== "boolean") {
    return "force must be a boolean";
  }
  if (purge !== undefined && typeof purge !== "boolean") {
    return "purge must be a boolean";
  }
  if (harnesses !== undefined) {
    if (!isStringArray(harnesses)) return "harnesses must be an array of strings";
    const invalid = harnesses.filter((h) => !HARNESSES.includes(h as Harness));
    if (invalid.length > 0) return `Unknown harness(es): ${invalid.join(", ")}`;
  }
  if (only !== undefined && !isStringArray(only)) {
    return "only must be an array of strings";
  }
  return {
    target,
    kinds: kinds as AssetKind[] | undefined,
    force,
    purge,
    harnesses: harnesses as Harness[] | undefined,
    only,
  };
}

// --- Directory browser (names only, never file contents) --------------------
// Validates the GUI's target path and lists one level of subfolder names for
// the read-only tree. A missing folder is a 404 with `exists: false` so the
// GUI can tell "does not exist" apart from other errors.

interface BrowseEntry {
  name: string;
  path: string;
}

function handleBrowse(url: URL, res: http.ServerResponse): void {
  const resolved = resolveDirParam(url, res);
  if (resolved === null) return;
  sendJson(res, 200, browseDir(resolved));
}

/**
 * Validate the `path` query parameter shared by /api/browse and
 * /api/open-folder: 400 when missing or not a directory, 404 + `exists: false`
 * when absent. Sends the error response itself and returns null; otherwise
 * returns the resolved absolute path (path.resolve normalizes ".." segments).
 */
function resolveDirParam(url: URL, res: http.ServerResponse): string | null {
  const requested = url.searchParams.get("path") ?? "";
  if (requested.trim() === "") {
    sendJson(res, 400, { error: "path query parameter is required" });
    return null;
  }
  const resolved = path.resolve(requested);
  let stats: fs.Stats;
  try {
    stats = fs.statSync(resolved);
  } catch {
    sendJson(res, 404, { error: `Folder does not exist: ${resolved}`, exists: false });
    return null;
  }
  if (!stats.isDirectory()) {
    sendJson(res, 400, { error: `Not a directory: ${resolved}` });
    return null;
  }
  return resolved;
}

function browseDir(dir: string): { path: string; entries: BrowseEntry[] } {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, path: path.join(dir, entry.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { path: dir, entries };
}

// --- Native OS folder picker --------------------------------------------------
// Unlike /api/assets and /api/inject (which spawn the real CLI), this endpoint
// spawns the OS folder-picker dialog. Browsers cannot return filesystem paths
// from their own pickers; the loopback-only server can.

/**
 * PowerShell script: FolderBrowserDialog owned by a shown-but-invisible
 * taskbar form (Opacity 0, ShowInTaskbar) so the dialog gets a taskbar button
 * users can spot. A background-spawned process may not steal focus (Windows
 * foreground lock), so the script P/Invokes AttachThreadInput +
 * SetForegroundWindow to bring the dialog in front of the browser with
 * keyboard focus. Prints SelectedPath only on OK — Cancel prints nothing.
 * Contains double quotes and newlines, so it must be passed via
 * -EncodedCommand (see WIN32_PICKER_SCRIPT_B64), never -Command.
 */
const WIN32_PICKER_SCRIPT = [
  "Add-Type -AssemblyName System.Windows.Forms",
  "Add-Type -Namespace SotPicker -Name Native -MemberDefinition '[DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr lpdwProcessId); [DllImport(\"kernel32.dll\")] public static extern uint GetCurrentThreadId(); [DllImport(\"user32.dll\")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach); [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);'",
  "$owner = New-Object System.Windows.Forms.Form",
  "$owner.Text = 'Browse For Folder'",
  "$owner.FormBorderStyle = 'None'",
  "$owner.StartPosition = 'CenterScreen'",
  "$owner.Width = 1",
  "$owner.Height = 1",
  "$owner.Opacity = 0",
  "$owner.ShowInTaskbar = $true",
  "$owner.TopMost = $true",
  "$owner.Show()",
  "$fgThread = [SotPicker.Native]::GetWindowThreadProcessId([SotPicker.Native]::GetForegroundWindow(), [IntPtr]::Zero)",
  "$myThread = [SotPicker.Native]::GetCurrentThreadId()",
  "[void][SotPicker.Native]::AttachThreadInput($myThread, $fgThread, $true)",
  "[void][SotPicker.Native]::SetForegroundWindow($owner.Handle)",
  "[void][SotPicker.Native]::AttachThreadInput($myThread, $fgThread, $false)",
  "$owner.Activate()",
  "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
  "if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) }",
  "$owner.Close()",
].join("\n");

/** UTF-16LE base64 of WIN32_PICKER_SCRIPT for powershell.exe -EncodedCommand. */
const WIN32_PICKER_SCRIPT_B64 = Buffer.from(
  WIN32_PICKER_SCRIPT,
  "utf16le",
).toString("base64");

const DARWIN_PICKER_SCRIPT = "POSIX path of (choose folder)";

/** osascript exits non-zero on Cancel (error -128, "User canceled"). */
const DARWIN_CANCEL_PATTERN = /-128|cancel/i;

/** zenity exit code meaning the user cancelled the dialog. */
const LINUX_CANCEL_EXIT_CODE = 1;

async function handlePickFolder(res: http.ServerResponse): Promise<void> {
  // Failures (unsupported platform, missing dialog tool) reject and become a
  // JSON 500 in handle(); the GUI shows the error and the user types the path.
  sendJson(res, 200, { path: await pickFolder() });
}

/**
 * Open the native OS folder picker and resolve the chosen absolute path, or
 * null when the user cancels. Rejects on unsupported platforms or when the
 * dialog tool is unavailable. `platform` is parameterized for tests only.
 */
export async function pickFolder(
  platform: NodeJS.Platform = process.platform,
): Promise<string | null> {
  switch (platform) {
    case "win32": {
      const run = await runDialog("powershell.exe", [
        "-NoProfile",
        "-EncodedCommand",
        WIN32_PICKER_SCRIPT_B64,
      ]);
      if (run.code !== 0) {
        throw new Error(run.stderr.trim() || "Folder picker failed");
      }
      const picked = run.stdout.trim();
      return picked === "" ? null : picked;
    }
    case "darwin": {
      const run = await runDialog("osascript", ["-e", DARWIN_PICKER_SCRIPT]);
      if (run.code !== 0) {
        if (DARWIN_CANCEL_PATTERN.test(run.stderr)) return null;
        throw new Error(run.stderr.trim() || "Folder picker failed");
      }
      const picked = run.stdout.trim();
      return picked === "" ? null : picked;
    }
    case "linux": {
      const run = await runDialog("zenity", ["--file-selection", "--directory"]);
      if (run.code === LINUX_CANCEL_EXIT_CODE) return null;
      if (run.code !== 0) {
        throw new Error(
          run.stderr.trim() || "zenity is not available — type the folder path instead",
        );
      }
      const picked = run.stdout.trim();
      return picked === "" ? null : picked;
    }
    default:
      throw new Error(
        `No native folder picker on platform "${platform}" — type the folder path instead`,
      );
  }
}

interface DialogRun {
  stdout: string;
  stderr: string;
  /** Numeric exit code, or a string spawn error like "ENOENT" (tool missing). */
  code: number | string;
}

function runDialog(command: string, args: string[]): Promise<DialogRun> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { timeout: GUI_PICKER_TIMEOUT_MS, windowsHide: true },
      (error, stdout, stderr) => {
        const code =
          error === null
            ? 0
            : typeof error.code === "number" || typeof error.code === "string"
              ? error.code
              : 1;
        resolve({ stdout, stderr: stderr || (error?.message ?? ""), code });
      },
    );
  });
}

// --- Open in the OS file manager ----------------------------------------------
// Validates the folder like /api/browse, then opens it in the platform's file
// manager so the user can inspect the target outside the GUI. On win32 a
// PowerShell wrapper (not raw explorer.exe) reuses an already-open Explorer
// window on that folder instead of spawning a duplicate and brings it to the
// foreground — a background-spawned explorer.exe opens behind the browser
// without focus (Windows foreground lock). Best-effort, like the picker:
// failures become a JSON error the GUI shows.

/** Placeholder in WIN32_OPEN_SCRIPT replaced with the single-quote-escaped folder path. */
const WIN32_OPEN_DIR_PLACEHOLDER = "__SOT_OPEN_DIR__";

/**
 * PowerShell script template: opens $dir in Explorer without duplicates and
 * with focus. Enumerates existing Explorer windows via Shell.Application and
 * reuses the one already showing $dir; otherwise spawns explorer.exe and polls
 * (up to $POLL_TRIES × $POLL_INTERVAL_MS) for its window. A background-spawned
 * process may not steal focus (Windows foreground lock), so the script
 * P/Invokes AttachThreadInput + SetForegroundWindow — the same technique as
 * WIN32_PICKER_SCRIPT — plus ShowWindow SW_RESTORE in case the window is
 * minimized. Exits 0 once Explorer was handed the folder even if focusing
 * fails; non-zero only when nothing could be opened. Contains double quotes
 * and newlines, so it must be passed via -EncodedCommand (see
 * buildWin32OpenScriptB64), never -Command.
 */
const WIN32_OPEN_SCRIPT = [
  `$dir = '${WIN32_OPEN_DIR_PLACEHOLDER}'`,
  "$SW_RESTORE = 9",
  "$POLL_TRIES = 30",
  "$POLL_INTERVAL_MS = 100",
  "Add-Type -Namespace SotOpen -Name Native -MemberDefinition '[DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr lpdwProcessId); [DllImport(\"kernel32.dll\")] public static extern uint GetCurrentThreadId(); [DllImport(\"user32.dll\")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach); [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);'",
  "$shell = New-Object -ComObject Shell.Application",
  "function Find-ExplorerWindow($dir) {",
  "  foreach ($w in @($shell.Windows())) {",
  "    try { if ($w.Document.Folder.Self.Path -eq $dir) { return $w } } catch { }",
  "  }",
  "  return $null",
  "}",
  "$win = Find-ExplorerWindow $dir",
  "if ($null -eq $win) {",
  "  explorer.exe $dir",
  "  for ($i = 0; $i -lt $POLL_TRIES -and $null -eq $win; $i++) {",
  "    Start-Sleep -Milliseconds $POLL_INTERVAL_MS",
  "    $win = Find-ExplorerWindow $dir",
  "  }",
  "  if ($null -eq $win) { exit 0 }",
  "}",
  "try {",
  "  $win.Visible = $true",
  "  $hwnd = [IntPtr]$win.HWND",
  "  [void][SotOpen.Native]::ShowWindow($hwnd, $SW_RESTORE)",
  "  $fgThread = [SotOpen.Native]::GetWindowThreadProcessId([SotOpen.Native]::GetForegroundWindow(), [IntPtr]::Zero)",
  "  $myThread = [SotOpen.Native]::GetCurrentThreadId()",
  "  [void][SotOpen.Native]::AttachThreadInput($myThread, $fgThread, $true)",
  "  [void][SotOpen.Native]::SetForegroundWindow($hwnd)",
  "  [void][SotOpen.Native]::AttachThreadInput($myThread, $fgThread, $false)",
  "} catch { }",
  "exit 0",
].join("\n");

/** Escape a value for a single-quoted PowerShell string literal (' doubles to ''). */
export function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * UTF-16LE base64 of WIN32_OPEN_SCRIPT with the folder path embedded, for
 * powershell.exe -EncodedCommand — built per call, unlike the constant
 * WIN32_PICKER_SCRIPT_B64, because the path varies.
 */
function buildWin32OpenScriptB64(dir: string): string {
  // Replacer function: a string replacement would let `$&`/`$'` sequences in
  // the path be interpreted as replacement patterns and corrupt the script.
  const script = WIN32_OPEN_SCRIPT.replace(
    WIN32_OPEN_DIR_PLACEHOLDER,
    () => escapePowerShellSingleQuoted(dir),
  );
  return Buffer.from(script, "utf16le").toString("base64");
}

async function handleOpenFolder(url: URL, res: http.ServerResponse): Promise<void> {
  const resolved = resolveDirParam(url, res);
  if (resolved === null) return;
  // Failures (unsupported platform, missing opener) reject and become a JSON
  // 500 in handle(); the GUI shows the error. The openers return as soon as
  // the file manager is handed the folder (win32 waits up to a few seconds to
  // find and focus the window), so awaiting them does not block for long.
  await openFolder(resolved);
  sendJson(res, 200, { ok: true, path: resolved });
}

/**
 * Open a folder in the OS file manager. Rejects on unsupported platforms or
 * when the opener fails. `platform` is parameterized for tests only.
 */
export async function openFolder(
  dir: string,
  platform: NodeJS.Platform = process.platform,
): Promise<void> {
  switch (platform) {
    case "win32": {
      // Raw explorer.exe exits 1 even on success; the PowerShell wrapper
      // controls its own exit code, so non-zero here is a real failure.
      const run = await runDialog("powershell.exe", [
        "-NoProfile",
        "-EncodedCommand",
        buildWin32OpenScriptB64(dir),
      ]);
      if (run.code !== 0) {
        throw new Error(run.stderr.trim() || "explorer.exe failed to open the folder");
      }
      return;
    }
    case "darwin": {
      const run = await runDialog("open", [dir]);
      if (run.code !== 0) {
        throw new Error(run.stderr.trim() || "open failed to open the folder");
      }
      return;
    }
    case "linux": {
      const run = await runDialog("xdg-open", [dir]);
      if (run.code !== 0) {
        throw new Error(run.stderr.trim() || "xdg-open failed to open the folder");
      }
      return;
    }
    default:
      throw new Error(`No file manager opener on platform "${platform}"`);
  }
}

// --- Injected-state report ---------------------------------------------------

function handleStatus(url: URL, res: http.ServerResponse): void {
  const targetParam = url.searchParams.get("target");
  if (targetParam === null || targetParam.trim() === "") {
    sendJson(res, 400, { error: "target query parameter is required" });
    return;
  }
  const harnessParam = url.searchParams.get("harness") ?? DEFAULT_HARNESS;
  if (!HARNESSES.includes(harnessParam as Harness)) {
    sendJson(res, 400, {
      error: `Unknown harness: ${harnessParam}. Valid values: ${HARNESSES.join(", ")}.`,
    });
    return;
  }
  const harness = harnessParam as Harness;
  const target = path.resolve(targetParam);

  let exists = false;
  try {
    exists = fs.statSync(target).isDirectory();
  } catch {
    exists = false;
  }
  if (!exists) {
    sendJson(res, 200, { target, harness, exists: false });
    return;
  }

  const targets = HARNESS_TARGETS[harness];
  sendJson(res, 200, {
    target,
    harness,
    exists: true,
    agents: {
      dir: targets.agents,
      installed: installedNames(path.join(target, targets.agents), "file"),
    },
    skills: {
      dir: targets.skills,
      installed: installedNames(path.join(target, targets.skills), "dir"),
    },
    rules: { file: targets.rules, present: rulesPresent(path.join(target, targets.rules)) },
    categories: {
      file: targets.categories,
      present: fs.existsSync(path.join(target, targets.categories)),
    },
    guardrails: {
      file: targets.guardrails,
      present: fs.existsSync(path.join(target, targets.guardrails)),
    },
  });
}

/** Per-harness agent file suffixes, longest first so ".agent.md" wins over ".md". */
const AGENT_FILE_SUFFIXES = [".agent.md", ".toml", ".md"];

function installedNames(dir: string, kind: "file" | "dir"): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => (kind === "dir" ? entry.isDirectory() : entry.isFile()))
    .map((entry) => {
      if (kind === "dir") return entry.name;
      const suffix = AGENT_FILE_SUFFIXES.find((s) => entry.name.endsWith(s));
      return suffix ? entry.name.slice(0, -suffix.length) : entry.name;
    })
    .sort((a, b) => a.localeCompare(b));
}

/** The protocol counts as injected only when its begin marker stands alone on a line. */
function rulesPresent(rulesPath: string): boolean {
  let content: string;
  try {
    content = fs.readFileSync(rulesPath, "utf8");
  } catch {
    return false;
  }
  return content
    .split(/\r?\n/)
    .some((line) => line.trim() === PROTOCOL_MARKER_BEGIN);
}

// --- HTTP plumbing -----------------------------------------------------------

function serveIndex(res: http.ServerResponse): void {
  const page = fs.readFileSync(path.join(GUI_DIR, GUI_INDEX_FILE));
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(page);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > GUI_MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  sendRawJson(res, status, JSON.stringify(payload));
}

function sendRawJson(res: http.ServerResponse, status: number, json: string): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(json);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
