import readline from "node:readline";
import { join } from "node:path";
import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const sessionIndex = args.indexOf("--session");
const sessionFile = sessionIndex >= 0 ? args[sessionIndex + 1] : undefined;
const forkIndex = args.indexOf("--fork");
const sessionDirIndex = args.indexOf("--session-dir");
const sessionDir = sessionDirIndex >= 0 ? args[sessionDirIndex + 1] : undefined;
const mode = process.env.CEDIA_FAKE_HOST_MODE ?? "normal";
const isFork = forkIndex >= 0 || process.env.CEDIA_FAKE_FORK_MODE === "1";
const forkSessionFile = isFork
  ? (process.env.CEDIA_FAKE_FORK_SESSION_FILE ?? join(sessionDir ?? process.cwd(), "forked-child.jsonl"))
  : sessionFile;
if (process.env.CEDIA_FAKE_FORK_ARGS_LOG && forkIndex >= 0) {
  writeFileSync(process.env.CEDIA_FAKE_FORK_ARGS_LOG, JSON.stringify({ args, source: args[forkIndex + 1], sessionDir }));
}

const frame = value => process.stdout.write(`${JSON.stringify(value)}\n`);
const response = (command, id, data) => frame({
  type: "response",
  command,
  id,
  success: true,
  ...(data === undefined ? {} : { data }),
});

const emitReady = () => frame({
  type: "ready",
  protocolVersion: 1,
  supportedProtocolVersions: [1, 2],
  maxFrameBytes: 1024 * 1024,
  maxReassembledFrameBytes: 64 * 1024 * 1024,
  fixture: "cedia-host",
  ...(mode === "native-permission" ? { cediaNativeBridgeVersion: 1 } : {}),
});
// `delay-ready` keeps the host inside its startup window long enough for a test to
// observe it; every other mode, and everything after the frame, stays unchanged.
if (mode === "delay-ready") setTimeout(emitReady, 300);
else emitReady();

let permissionPromptId;
const handle = command => {
  if (!command || typeof command !== "object" || typeof command.type !== "string") return;
  if (command.type === "negotiate_protocol") {
    response(command.type, command.id, { protocolVersion: command.protocolVersion });
    return;
  }
  if (command.type === "get_state") {
    const materialized = forkSessionFile;
    if (typeof materialized === "string") {
      mkdirSync(dirname(materialized), { recursive: true });
      writeFileSync(materialized, "fixture-session\n");
    }
    response(command.type, command.id, { sessionFile: forkSessionFile, fixture: "cedia-host" });
    if (mode === "exit-after-start") setTimeout(() => process.exit(17), 10);
    return;
  }
  if (command.type === "get_messages") {
    response(command.type, command.id, { messages: [{ role: "user", text: "inherited" }] });
    return;
  }
  if (command.type === "host_tool_result" && command.id === "native-permission-call") {
    const outcome = JSON.parse(command.result.content[0].text);
    frame({ type: "fixture_permission_outcome", outcome });
    frame({ type: "prompt_result", id: permissionPromptId, result: outcome });
    frame({ type: "agent_end", isTerminal: true }); return;
  }
  if (command.type === "prompt") {
    if (mode === "native-permission") {
      permissionPromptId = command.id;
      response(command.type, command.id, { accepted: true });
      frame({ type: "host_tool_call", id: "native-permission-call", toolCallId: "native-tool-1", toolName: "cedia_native_permission", arguments: { kind: "permission", toolCall: { toolCallId: "native-tool-1", toolName: "bash", title: "Run command?", rawInput: { command: "printf fixture" } }, options: [{ optionId: "allow_once", name: "Allow once", kind: "allow_once" }, { optionId: "reject_once", name: "Reject", kind: "reject_once" }] } }); return;
    }
    if (mode === "local-only") {
      response(command.type, command.id, { accepted: true, agentInvoked: false, fixture: "local-only" });
      return;
    }
    response(command.type, command.id, { accepted: true, fixture: "prompt" });
    if (mode === "exit-after-ack") {
      setTimeout(() => process.exit(17), 10);
      return;
    }
    setTimeout(() => {
      frame({ type: "agent_start", id: `agent-${command.id}` });
      frame({ type: "prompt_result", id: command.id, result: { text: "fixture complete" } });
      frame({ type: "agent_end", id: `end-${command.id}`, isTerminal: true, reason: "completed" });
    }, 5);
    return;
  }
  if (command.type === "handoff" && mode === "handoff-no-end") {
    response(command.type, command.id, { accepted: true, fixture: "handoff-no-end" });
    return;
  }
  if (command.type === "bash") {
    response(command.type, command.id, { stdout: "fixture", stderr: "", exitCode: 0 });
    return;
  }
  response(command.type, command.id, { fixture: command.type });
};

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", line => {
  if (!line.trim()) return;
  try { handle(JSON.parse(line)); } catch { /* malformed fixture input is ignored */ }
});
input.on("close", () => process.exit(0));
