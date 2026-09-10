// Caret MCP server (tool breadth seed): exposes web_fetch + test_run
// over MCP stdio JSON-RPC for MCP clients without their own shell (our
// McpClient included — round-trip proven in keepers). No SDK. Trust
// posture: execFile only (no shell), byte/time caps, localhost +
// cloud-metadata ranges refused on fetch.
import * as readline from "node:readline";
import * as cp from "node:child_process";
import * as Net from "node:net";

const PROTOCOL = "2024-11-05";
const FETCH_MAX_BYTES = 64 * 1024;
const FETCH_TIMEOUT_MS = 15000;
const EXEC_TIMEOUT_MS = 60000;
const EXEC_MAX_BUFFER = 1024 * 1024;

const refusedHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "metadata.google.internal") return true;
  if (Net.isIP(host) === 4) {
    const parts = host.split(".").map(Number);
    const [a = 0, b = 0] = parts;
    if (a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  if (Net.isIP(host) === 6) {
    if (host === "::1" || host.toLowerCase().startsWith("fc") || host.toLowerCase().startsWith("fd")) return true;
  }
  return false;
};

const TOOLS = [
  {
    name: "web_fetch",
    description: "Fetch an http(s) URL as text (64KB cap, 15s timeout). Local/metadata hosts refused.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" }, maxBytes: { type: "number" }, timeoutMs: { type: "number" } },
      required: ["url"],
    },
  },
  {
    name: "test_run",
    description: "Run a binary with args (no shell) in a cwd with timeout. Reports exit code + output tails.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" },
        args: { type: "array", items: { type: "string" } },
        cwd: { type: "string" },
        timeoutMs: { type: "number" },
      },
      required: ["command"],
    },
  },
];

const send = (msg: unknown) => process.stdout.write(`${JSON.stringify(msg)}\n`);

const webFetch = async (args: { url?: unknown; maxBytes?: unknown; timeoutMs?: unknown }) => {
  if (typeof args.url !== "string") throw new Error("web_fetch needs url");
  let parsed: URL;
  try {
    parsed = new URL(args.url);
  } catch {
    throw new Error(`web_fetch: bad url ${args.url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("web_fetch: http(s) only");
  }
  if (parsed.username || parsed.password || args.url.includes("@")) {
    throw new Error("web_fetch: credentials in URL refused");
  }
  if (refusedHost(parsed.hostname)) {
    throw new Error(`web_fetch: host refused ${parsed.hostname}`);
  }
  const maxBytes = Math.min(
    typeof args.maxBytes === "number" && args.maxBytes > 0 ? Math.floor(args.maxBytes) : FETCH_MAX_BYTES,
    1024 * 1024,
  );
  const timeoutMs =
    typeof args.timeoutMs === "number" && args.timeoutMs > 0 ? Math.min(Math.floor(args.timeoutMs), 60000) : FETCH_TIMEOUT_MS;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(args.url, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`web_fetch: HTTP ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error("web_fetch: no body");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error(`web_fetch: over ${maxBytes} byte cap`);
      }
      chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.byteLength, 0);
    const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8").slice(0, total);
    return { content: [{ type: "text", text }] };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`web_fetch: timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const testRun = async (args: { command?: unknown; args?: unknown; cwd?: unknown; timeoutMs?: unknown }) => {
  if (typeof args.command !== "string" || !args.command) throw new Error("test_run needs command");
  const cmdArgs = Array.isArray(args.args) ? args.args.filter((a): a is string => typeof a === "string") : [];
  const timeoutMs =
    typeof args.timeoutMs === "number" && args.timeoutMs > 0 ? Math.min(Math.floor(args.timeoutMs), 300000) : EXEC_TIMEOUT_MS;
  const tail = (s: string) => (s.length > 4000 ? `${s.slice(0, 2000)} … ${s.slice(-2000)}` : s);
  return new Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>((resolve) => {
    cp.execFile(
      args.command as string,
      cmdArgs,
      {
        cwd: typeof args.cwd === "string" ? args.cwd : process.cwd(),
        timeout: timeoutMs,
        maxBuffer: EXEC_MAX_BUFFER,
      },
      (error, stdout, stderr) => {
        const err = error as (NodeJS.ErrnoException & { killed?: boolean; code?: unknown }) | null;
        const out = `exit=${err?.killed ? "timeout" : (err?.code ?? 0)}\n--- stdout ---\n${tail(String(stdout ?? ""))}\n--- stderr ---\n${tail(String(err?.stderr ?? stderr ?? ""))}`;
        if (err) {
          resolve({
            content: [{ type: "text", text: err.killed === true ? `timed out after ${timeoutMs}ms\n${out}` : out }],
            isError: true,
          });
        } else {
          resolve({ content: [{ type: "text", text: out }] });
        }
      },
    );
  });
};

const cancelled = new Set<string | number>();

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
      const rid = (msg.params as { requestId?: string | number } | undefined)?.requestId;
      if (rid !== undefined) cancelled.add(rid);
    }
    return;
  }
  const id = msg.id;
  const reply = (result: unknown) => send({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) => send({ jsonrpc: "2.0", id, error: { code, message } });
  void (async () => {
    try {
      switch (msg.method) {
        case "initialize":
          reply({ protocolVersion: PROTOCOL, serverInfo: { name: "caret-tools" } });
          break;
        case "ping":
          reply({});
          break;
        case "tools/list":
          reply({ tools: TOOLS });
          break;
        case "tools/call": {
          const params = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
          if (typeof id !== "undefined" && cancelled.has(id)) {
            reply({ content: [{ type: "text", text: "cancelled" }], isError: true });
            break;
          }
          if (params.name === "web_fetch") {
            reply(await webFetch((params.arguments ?? {}) as never));
          } else if (params.name === "test_run") {
            reply(await testRun((params.arguments ?? {}) as never));
          } else {
            fail(-32602, `unknown tool ${String(params.name)}`);
          }
          break;
        }
        default:
          fail(-32601, `unknown method ${String(msg.method)}`);
      }
    } catch (error) {
      fail(-32602, error instanceof Error ? error.message : String(error));
    }
  })();
});
