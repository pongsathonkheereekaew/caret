import readline from "node:readline";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

if (process.argv.includes("--version")) {
  process.stdout.write("omp/18.1.18\n");
  process.exit(0);
}
const emit = frame => process.stdout.write(`${JSON.stringify(frame)}\n`);
const model = { id: "fixture-model", name: "Fixture model", provider: "fixture", reasoning: true, thinking: ["low", "medium", "high"], contextWindow: 128000, maxTokens: 4096, input: ["text"] };
const arg = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const forkSource = arg("--fork");
const sessionFile = forkSource ? join(arg("--session-dir"), "fixture-fork.jsonl") : arg("--session");
let messages = [];
try { messages = JSON.parse(readFileSync(forkSource ?? sessionFile, "utf8")); } catch {}
const persist = () => {
  if (!sessionFile) return;
  mkdirSync(dirname(sessionFile), { recursive: true });
  writeFileSync(sessionFile, JSON.stringify(messages));
};
persist();
let active;
let thinkingLevel = "medium";
const response = (command, data) => emit({ type: "response", command: command.type, id: command.id, success: true, data });
emit({ type: "ready", protocolVersion: 1, supportedProtocolVersions: [1, 2], maxFrameBytes: 1024 * 1024, maxReassembledFrameBytes: 64 * 1024 * 1024 });
readline.createInterface({ input: process.stdin }).on("line", line => {
  const command = JSON.parse(line);
  switch (command.type) {
    case "negotiate_protocol": return response(command, { protocolVersion: command.protocolVersion });
    case "get_state": return response(command, { model, thinkingLevel, isStreaming: !!active, sessionFile, contextUsage: { tokens: messages.length ? 32000 : 0, contextWindow: model.contextWindow, percent: messages.length ? 25 : 0 } });
    case "get_available_models": return response(command, { models: [model] });
    case "get_login_providers": return response(command, { providers: [{ id: "fixture", name: "Fixture", authenticated: true }] });
    case "get_messages": return response(command, { messages });
    case "get_commands": return response(command, { commands: [] });
    case "get_model_roles": return response(command, { roles: [], cycleOrder: [] });
    case "set_model":
      if (command.modelId !== model.id || command.provider !== model.provider) {
        return emit({ type: "response", command: command.type, id: command.id, success: false, error: "Unknown fixture model" });
      }
      return response(command, { model });
    case "set_thinking_level": thinkingLevel = command.level; return response(command, { level: thinkingLevel });
    case "abort":
      if (active) clearTimeout(active);
      active = undefined;
      response(command, {});
      emit({ type: "agent_end", isTerminal: true, messages: [] });
      return;
    case "prompt": {
      response(command, { accepted: true });
      emit({ type: "agent_start" });
      const user = { role: "user", content: [{ type: "text", text: command.message }], timestamp: Date.now() };
      messages.push(user);
      emit({ type: "message_start", message: user });
      emit({ type: "message_end", message: user });
      const assistant = { role: "assistant", content: [{ type: "text", text: `Fixture response: ${command.message}` }], timestamp: Date.now(), provider: model.provider, model: model.id, stopReason: "stop" };
      emit({ type: "message_start", message: { ...assistant, content: [] } });
      active = setTimeout(() => {
        emit({ type: "message_update", message: assistant, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: assistant.content[0].text, partial: assistant } });
        emit({ type: "message_end", message: assistant });
        messages.push(assistant);
        persist();
        emit({ type: "prompt_result", id: command.id, result: {} });
        emit({ type: "agent_end", isTerminal: true, messages: [assistant] });
        active = undefined;
      }, 250);
      return;
    }
    default: return response(command, {});
  }
});
