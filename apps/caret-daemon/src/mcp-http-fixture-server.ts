// Fixture MCP server (streamable HTTP) for transport conformance. Speaks
// protocol 2024-11-05 core over POST: initialize (SSE + session id),
// ping/tools-list (plain JSON), tools/call (SSE), notifications,
// session expiry (404), optional bearer auth. Kept as test harness.
// Test-only surface: POST /test/drop clears all sessions.
import * as http from "node:http";

const portIndex = process.argv.indexOf("--port");
const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 18923;
const requireAuth = process.argv.includes("--require-auth");

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

const sessions = new Set<string>();
const cancelled = new Set<string | number>();
let counter = 1;

const json = (res: http.ServerResponse, status: number, body: unknown, session?: string) => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session) headers["Mcp-Session-Id"] = session;
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
};

const sse = (res: http.ServerResponse, status: number, body: unknown, session?: string) => {
  const headers: Record<string, string> = { "Content-Type": "text/event-stream" };
  if (session) headers["Mcp-Session-Id"] = session;
  res.writeHead(status, headers);
  res.end(`data: ${JSON.stringify(body)}\n\n`);
};

const rpcError = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/test/drop") {
    sessions.clear();
    res.writeHead(200);
    res.end("dropped");
    return;
  }
  if (req.method === "DELETE" && req.url === "/mcp") {
    const sid = req.headers["mcp-session-id"];
    if (typeof sid === "string") sessions.delete(sid);
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "POST" || req.url !== "/mcp") {
    res.writeHead(404);
    res.end();
    return;
  }
  let raw = "";
  req.on("data", (chunk: Buffer) => {
    raw += chunk.toString("utf8");
  });
  req.on("end", () => {
    let msg: { jsonrpc?: string; id?: string | number; method?: string; params?: Record<string, unknown> };
    try {
      msg = JSON.parse(raw) as typeof msg;
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    if (requireAuth && req.headers["authorization"] !== "Bearer test-token") {
      json(res, 401, rpcError(msg.id, -32001, "missing bearer token"));
      return;
    }
    // Notifications carry no id and get an empty 202.
    if (msg.method && msg.id === undefined) {
      if (msg.method === "notifications/cancelled") {
        const rid = (msg.params as { requestId?: string | number } | undefined)?.requestId;
        if (rid !== undefined) cancelled.add(rid);
      }
      res.writeHead(202);
      res.end();
      return;
    }
    const id = msg.id;
    if (msg.method === "initialize") {
      const session = `s-${counter++}`;
      sessions.add(session);
      sse(
        res,
        200,
        {
          jsonrpc: "2.0",
          id,
          result: { protocolVersion: "2024-11-05", serverInfo: { name: "caret-fixture-http" } },
        },
        session,
      );
      return;
    }
    const sid = req.headers["mcp-session-id"];
    if (typeof sid !== "string" || !sessions.has(sid)) {
      json(res, 404, rpcError(id, -32001, "unknown session"));
      return;
    }
    switch (msg.method) {
      case "ping": {
        json(res, 200, { jsonrpc: "2.0", id, result: {} });
        return;
      }
      case "tools/list": {
        json(res, 200, { jsonrpc: "2.0", id, result: { tools: TOOLS } });
        return;
      }
      case "tools/call": {
        const params = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
        if (params.name === "echo") {
          const text = ((params.arguments ?? {}) as { text?: unknown }).text;
          sse(res, 200, {
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: String(text ?? "") }] },
          }, sid);
          return;
        }
        if (params.name === "fail") {
          sse(res, 200, {
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: "fixture failure" }], isError: true },
          }, sid);
          return;
        }
        if (params.name === "sleep") {
          const ms = Number(((params.arguments ?? {}) as { ms?: unknown }).ms ?? 1000);
          const started = Date.now();
          const tick = setInterval(() => {
            if (typeof id !== "undefined" && cancelled.has(id)) {
              clearInterval(tick);
              sse(res, 200, {
                jsonrpc: "2.0",
                id,
                result: { content: [{ type: "text", text: "cancelled" }], isError: true },
              }, sid);
            } else if (Date.now() - started >= ms) {
              clearInterval(tick);
              sse(res, 200, {
                jsonrpc: "2.0",
                id,
                result: { content: [{ type: "text", text: "done" }] },
              }, sid);
            }
          }, 25);
          return;
        }
        json(res, 200, rpcError(id, -32602, `unknown tool ${String(params.name)}`));
        return;
      }
      default: {
        json(res, 200, rpcError(id, -32601, `unknown method ${String(msg.method)}`));
      }
    }
  });
});

server.listen(port, () => {
  console.log(`listening ${port}`);
});
