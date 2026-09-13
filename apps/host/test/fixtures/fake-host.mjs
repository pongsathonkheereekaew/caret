import readline from "node:readline";

const args = process.argv.slice(2);
const sessionIndex = args.indexOf("--session");
const sessionFile = sessionIndex >= 0 ? args[sessionIndex + 1] : undefined;
const mode = process.env.CARET_FAKE_HOST_MODE ?? "normal";

const frame = value => process.stdout.write(`${JSON.stringify(value)}\n`);
const response = (command, id, data) => frame({
  type: "response",
  command,
  id,
  success: true,
  ...(data === undefined ? {} : { data }),
});

frame({
  type: "ready",
  protocolVersion: 1,
  supportedProtocolVersions: [1, 2],
  maxFrameBytes: 1024 * 1024,
  maxReassembledFrameBytes: 64 * 1024 * 1024,
  fixture: "caret-host",
  ...(mode === "native-permission" ? { caretNativeBridgeVersion: 1 } : {}),
});

let permissionPromptId;
const handle = command => {
  if (!command || typeof command !== "object" || typeof command.type !== "string") return;
  if (command.type === "negotiate_protocol") {
    response(command.type, command.id, { protocolVersion: command.protocolVersion });
    return;
  }
  if (command.type === "get_state") {
    response(command.type, command.id, { sessionFile, fixture: "caret-host" });
    if (mode === "exit-after-start") setTimeout(() => process.exit(17), 10);
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
      frame({ type: "host_tool_call", id: "native-permission-call", toolCallId: "native-tool-1", toolName: "caret_native_permission", arguments: { kind: "permission", toolCall: { toolCallId: "native-tool-1", toolName: "bash", title: "Run command?", rawInput: { command: "printf fixture" } }, options: [{ optionId: "allow_once", name: "Allow once", kind: "allow_once" }, { optionId: "reject_once", name: "Reject", kind: "reject_once" }] } }); return;
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
