// Fixture MCP server (stdio, newline-delimited JSON-RPC) for transport
// conformance. Speaks protocol 2024-11-05 core: initialize, ping,
// tools/list, tools/call, resources/list, resources/read, prompts/list,
// prompts/get, elicitation/create (via the ask tool), and
// notifications/cancelled. Kept as test harness.
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
  {
    name: "ask",
    description: "Elicit a name from the client, then greet it.",
    inputSchema: { type: "object", properties: {} },
  },
];

const RESOURCES = [
  {
    uri: "caret://notes/welcome",
    name: "welcome",
    description: "Fixture welcome note.",
    mimeType: "text/plain",
  },
  {
    uri: "caret://config/snippet",
    name: "snippet",
    description: "Fixture config snippet.",
    mimeType: "application/json",
  },
];

const RESOURCE_TEXT: Record<string, { text: string; mimeType: string }> = {
  "caret://notes/welcome": { text: "welcome to the caret fixture", mimeType: "text/plain" },
  "caret://config/snippet": { text: `{"tab":"single-line"}`, mimeType: "application/json" },
};

const PROMPTS = [
  {
    name: "review",
    description: "Fixture review prompt.",
    arguments: [{ name: "diff", description: "Diff to review.", required: true }],
  },
  {
    name: "summarize",
    description: "Fixture summarize prompt.",
    arguments: [],
  },
];

const send = (msg: unknown) => process.stdout.write(`${JSON.stringify(msg)}\n`);
const cancelled = new Set<string | number>();

const sleepers = new Map<string | number, (value: string) => void>();

// Elicitation round-trips started by the ask tool: elicitId -> original call id.
let elicitCounter = 1;
const pendingAsk = new Map<string | number, string | number>();

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg: {
    jsonrpc?: string;
    id?: string | number;
    method?: string;
    params?: Record<string, unknown>;
    result?: { action?: string; content?: Record<string, unknown> };
    error?: { message?: string };
  };
  try {
    msg = JSON.parse(trimmed) as typeof msg;
  } catch {
    return;
  }
  if (msg.method === undefined && msg.id !== undefined && pendingAsk.has(msg.id)) {
    // Client answer to our elicitation/create for the ask tool.
    const origId = pendingAsk.get(msg.id) as string | number;
    pendingAsk.delete(msg.id);
    const action = msg.result?.action;
    if (action === "accept") {
      const content = msg.result?.content as { name?: unknown } | undefined;
      send({
        jsonrpc: "2.0",
        id: origId,
        result: { content: [{ type: "text", text: `hello ${String(content?.name ?? "stranger")}` }] },
      });
    } else if (action === "decline" || action === "cancel") {
      send({
        jsonrpc: "2.0",
        id: origId,
        result: { content: [{ type: "text", text: `elicitation ${action}d` }], isError: true },
      });
    } else {
      send({
        jsonrpc: "2.0",
        id: origId,
        result: {
          content: [{ type: "text", text: `elicitation failed: ${msg.error?.message ?? "unknown"}` }],
          isError: true,
        },
      });
    }
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
        capabilities: { tools: {}, resources: {}, prompts: {} },
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
    case "resources/list": {
      reply({ resources: RESOURCES });
      break;
    }
    case "resources/read": {
      const uri = String((msg.params as { uri?: unknown } | undefined)?.uri ?? "");
      const entry = RESOURCE_TEXT[uri];
      if (!entry) {
        fail(-32002, `unknown resource ${uri}`);
      } else {
        reply({ contents: [{ uri, mimeType: entry.mimeType, text: entry.text }] });
      }
      break;
    }
    case "prompts/list": {
      reply({ prompts: PROMPTS });
      break;
    }
    case "prompts/get": {
      const params = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      if (params.name === "review") {
        reply({
          description: "Review the given diff.",
          messages: [
            {
              role: "user",
              content: { type: "text", text: `review this: ${String(params.arguments?.["diff"] ?? "")}` },
            },
          ],
        });
      } else if (params.name === "summarize") {
        reply({
          description: "Summarize the conversation.",
          messages: [{ role: "user", content: { type: "text", text: "summarize please" } }],
        });
      } else {
        fail(-32602, `unknown prompt ${String(params.name)}`);
      }
      break;
    }
    case "tools/call": {
      const params = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      if (params.name === "echo") {
        reply({ content: [{ type: "text", text: String((params.arguments ?? {}).text ?? "") }] });
      } else if (params.name === "fail") {
        reply({ content: [{ type: "text", text: "intentional failure" }], isError: true });
      } else if (params.name === "ask") {
        const elicitId = `elicit-${elicitCounter++}`;
        pendingAsk.set(elicitId, id as string | number);
        send({
          jsonrpc: "2.0",
          id: elicitId,
          method: "elicitation/create",
          params: {
            message: "What is your name?",
            requestedSchema: {
              type: "object",
              properties: { name: { type: "string" } },
              required: ["name"],
            },
          },
        });
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
