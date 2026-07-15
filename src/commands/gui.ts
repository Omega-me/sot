import { spawn } from "node:child_process";
import { startGuiServer } from "../lib/server.js";
import { errorLine, heading, label, subtle } from "../lib/ui.js";

export interface GuiOptions {
  port: string;
  open: boolean;
}

export async function runGui(options: GuiOptions): Promise<void> {
  const port = Number.parseInt(options.port, 10);
  if (Number.isNaN(port) || port < 0 || port > 65535) {
    console.error(errorLine(`Invalid port: ${options.port}`));
    process.exitCode = 1;
    return;
  }

  let url: string;
  try {
    ({ url } = await startGuiServer(port));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(errorLine(`Could not start the GUI server: ${message}`));
    process.exitCode = 1;
    return;
  }

  console.log(heading("sot gui"));
  console.log(`  ${label("url")}  ${url}`);
  console.log(subtle("  bound to 127.0.0.1 only — press Ctrl+C to stop"));

  if (options.open) openBrowser(url);
}

/** Best-effort default-browser launch; failures are ignored (the URL is printed). */
function openBrowser(url: string): void {
  let command: string;
  let args: string[];
  if (process.platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else {
    command = "xdg-open";
    args = [url];
  }
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.on("error", () => {
    /* opening the browser is best-effort */
  });
  child.unref();
}
