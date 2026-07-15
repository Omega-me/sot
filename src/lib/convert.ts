/**
 * Format converters for non-Claude harnesses. Template agents are markdown
 * with YAML frontmatter (the Claude subagent shape); codex wants one TOML
 * file per agent and copilot wants `<name>.agent.md` profiles. The `tools:`
 * key is dropped on conversion — tool names are Claude-specific.
 */

export interface AgentDoc {
  meta: Record<string, string>;
  body: string;
}

/**
 * Minimal frontmatter parser: `key: value` at column 0, indented lines are
 * folded continuations of the previous key (enough for our templates — not
 * a general YAML parser).
 */
export function parseAgentMarkdown(source: string): AgentDoc {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") {
    return { meta: {}, body: lines.join("\n").trim() };
  }

  const meta: Record<string, string> = {};
  let currentKey: string | null = null;
  let bodyStart = lines.length;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "---") {
      bodyStart = i + 1;
      break;
    }
    const match = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (match) {
      currentKey = match[1] ?? "";
      meta[currentKey] = (match[2] ?? "").trim();
    } else if (currentKey && /^\s+\S/.test(line)) {
      meta[currentKey] = `${meta[currentKey] ?? ""} ${line.trim()}`.trim();
    }
  }
  return { meta, body: lines.slice(bodyStart).join("\n").trim() };
}

/** Codex custom agent definition (.codex/agents/<name>.toml). */
export function toCodexAgentToml(doc: AgentDoc): string {
  const lines: string[] = [];
  if (doc.meta.name) lines.push(`name = ${tomlString(doc.meta.name)}`);
  if (doc.meta.description) {
    lines.push(`description = ${tomlString(doc.meta.description)}`);
  }
  lines.push("");
  lines.push(`developer_instructions = ${tomlMultilineString(doc.body)}`);
  return lines.join("\n") + "\n";
}

/** Copilot custom agent profile (.github/agents/<name>.agent.md). */
export function toCopilotAgentMarkdown(doc: AgentDoc): string {
  const front: string[] = ["---"];
  if (doc.meta.name) front.push(`name: ${yamlScalar(doc.meta.name)}`);
  if (doc.meta.description) {
    front.push(`description: ${yamlScalar(doc.meta.description)}`);
  }
  front.push("---", "");
  return front.join("\n") + doc.body + "\n";
}

function tomlString(value: string): string {
  // JSON string escaping is a valid TOML basic-string encoding.
  return JSON.stringify(value);
}

function tomlMultilineString(value: string): string {
  if (!value.includes("'''") && !value.endsWith("'")) {
    return `'''\n${value}\n'''`;
  }
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"""\n${escaped}\n"""`;
}

function yamlScalar(value: string): string {
  if (/^[A-Za-z0-9]/.test(value) && !value.includes(": ") && !value.includes(" #")) {
    return value;
  }
  return `'${value.replace(/'/g, "''")}'`;
}
