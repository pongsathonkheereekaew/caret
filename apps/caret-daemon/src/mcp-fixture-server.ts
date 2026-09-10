// Fixture MCP server (stdio, newline-delimited JSON-RPC) for transport
// conformance. Speaks protocol 2024-11-05 core: initialize, ping,
// tools/list, tools/call, notifications/cancelled. Kept as test harness.
import * as readline from "node:readline";

const TOOLS = [
  {
    name: "echo",
    description: "Return the input text back.",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "fail",
    description: "Always return a tool-level error.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "sleep",
    description: "Wait ms then return done. Honors notifications/cancelled.",
    inputSchema: { type: "object", properties: { ms: { type: "number" } }, required: ["ms"] },
  },
];

const send = (msg: unknown) => process.stdout.write(`${JSON.stringify(msg)}\n`);
const cancelled = new Set<string | number>();

const sleepers = new Map<string | number, (value: string) => void>();

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg: { jsonrpc?: string; id?: string | number; method?: string; params?: Record<string, unknown> };
  try {
    msg = JSON.parse(trimmed) as typeof msg;
  } catch {
    return;
  }
  if (msg.method && msg.id === undefined) {
    if (msg.method === "notifications/cancelled") {
      const params = msg.params as { requestId?: string | number } | undefined;
      if (params?.requestId !== undefined) {
        cancelled.add(params.requestId);
      }
    }
    return;
  }
  const id = msg.id;
  const reply = (result: unknown) => send({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) => send({ jsonrpc: "2.0", id, error: { code, message } });
  switch (msg.method) {
    case "initialize": {
      const params = (msg.params ?? {}) as { protocolVersion?: string };
      reply({
        protocolVersion: params.protocolVersion ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "caret-fixture", version: "0.0.1" },
      });
      break;
    }
    case "ping": {
      reply({});
      break;
    }
    case "tools/list": {
      reply({ tools: TOOLS });
      break;
    }
    case "tools/call": {
      const params = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      if (params.name === "echo") {
        reply({ content: [{ type: "text", text: String((params.arguments ?? {}).text ?? "") }] });
      } else if (params.name === "fail") {
        reply({ content: [{ type: "text", text: "intentional failure" }], isError: true });
      } else if (params.name === "sleep") {
        const ms = Number((params.arguments ?? {}).ms ?? 0);
        const key = id as string | number;
        const done = (text: string, isError?: boolean) =>
          reply(isError ? { content: [{ type: "text", text }], isError: true } : { content: [{ type: "text", text }] });
        if (cancelled.has(key)) {
          done("cancelled", true);
        } else {
          sleepers.set(key, (text: string) => done(text, true));
          setTimeout(() => {
            sleepers.delete(key);
            if (cancelled.has(key)) {
              done("cancelled", true);
            } else {
              done(`slept ${ms}`);
            }
          }, Math.min(ms, 5000));
        }
      } else {
        fail(-32602, `unknown tool ${String(params.name)}`);
      }
      break;
    }
    default: {
      fail(-32601, `unknown method ${String(msg.method)}`);
    }
  }
});
