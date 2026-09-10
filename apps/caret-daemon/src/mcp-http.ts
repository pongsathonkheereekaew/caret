// Caret MCP client, streamable-HTTP transport (PX-14 tail): POST JSON-RPC
// with SSE-or-JSON responses, Mcp-Session-Id continuity, per-request
// timeout, cancellation, and transparent recovery from dropped sessions.
// No SDK dependency — same owned-wire posture as the stdio client.
// Full OAuth (discovery + PKCE) is NOT here: callers inject a bearer token
// via `auth`; HTTP 401 surfaces as McpError so the harness stops/waits
// instead of silently switching to a billed path.
import { McpCallResult, McpError, McpTool } from "./mcp.ts";

export interface McpHttpAuth {
  token: () => string | undefined;
}

interface JsonRpcResponse {
  jsonrpc?: string;
  id?: string | number;
  result?: unknown;
  error?: { code?: number; message?: string };
}

const parseSseMessages = (text: string): unknown[] => {
  const out: unknown[] = [];
  for (const frame of text.split(/\r?\n\r?\n/)) {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .join("\n");
    if (!data || data === "[DONE]") continue;
    try {
      out.push(JSON.parse(data));
    } catch {
      // Non-JSON frames (keep-alives, comments) carry no responses.
    }
  }
  return out;
};

export class McpHttpClient {
  private sessionId: string | null = null;
  private nextId = 1;
  private closed = false;

  constructor(
    private readonly url: string,
    private readonly auth?: McpHttpAuth,
  ) {}

  /** Current session id (diagnostics/tests only). */
  get session(): string | null {
    return this.sessionId;
  }

  async start(timeoutMs = 10000): Promise<{ protocolVersion: string; server: string }> {
    this.closed = false;
    this.sessionId = null;
    const hello = (await this.post(
      {
        jsonrpc: "2.0",
        id: this.nextId++,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "caret", version: "0.0.1" },
        },
      },
      timeoutMs,
      false,
    )) as { protocolVersion?: string; serverInfo?: { name?: string } };
    await this.postNotification("notifications/initialized", {});
    return {
      protocolVersion: String(hello.protocolVersion ?? "unknown"),
      server: String(hello.serverInfo?.name ?? "unknown"),
    };
  }

  async ping(timeoutMs = 5000): Promise<void> {
    await this.post({ jsonrpc: "2.0", id: this.nextId++, method: "ping", params: {} }, timeoutMs, true);
  }

  async listTools(timeoutMs = 10000): Promise<McpTool[]> {
    const result = (await this.post(
      { jsonrpc: "2.0", id: this.nextId++, method: "tools/list", params: {} },
      timeoutMs,
      true,
    )) as { tools?: McpTool[] };
    if (!Array.isArray(result.tools)) {
      throw new McpError("tools/list returned no tool array");
    }
    return result.tools;
  }

  async callTool(name: string, args: Record<string, unknown>, timeoutMs = 30000): Promise<McpCallResult> {
    const result = (await this.post(
      { jsonrpc: "2.0", id: this.nextId++, method: "tools/call", params: { name, arguments: args } },
      timeoutMs,
      true,
    )) as McpCallResult;
    if (!result || !Array.isArray(result.content)) {
      throw new McpError(`tools/call ${name} returned malformed result`);
    }
    return result;
  }

  /** Cancel an in-flight call: notify the server (best effort, mirrors stdio). */
  async cancelCall(id: number): Promise<void> {
    try {
      await this.postNotification("notifications/cancelled", { requestId: id });
    } catch {
      // Notification delivery is advisory; the local timeout still enforces.
    }
  }

  /** Expose raw request ids for cancellation tests. */
  rawRequest(method: string, params: unknown, timeoutMs: number): { id: number; done: Promise<unknown> } {
    const id = this.nextId++;
    return { id, done: this.post({ jsonrpc: "2.0", id, method, params }, timeoutMs, true) };
  }

  async reconnect(timeoutMs = 10000): Promise<void> {
    await this.close();
    await this.start(timeoutMs);
  }

  async close(): Promise<void> {
    this.closed = true;
    const session = this.sessionId;
    this.sessionId = null;
    if (session) {
      try {
        await fetch(this.url, { method: "DELETE", headers: { "Mcp-Session-Id": session } });
      } catch {
        // Termination is advisory; the id is already forgotten locally.
      }
    }
  }

  private async post(
    message: { jsonrpc: string; id: string | number; method: string; params: unknown },
    timeoutMs: number,
    recover: boolean,
  ): Promise<unknown> {
    if (this.closed) {
      throw new McpError("client not running");
    }
    let res = await this.postOnce(message, timeoutMs);
    if (res.status === 404 && recover && this.sessionId) {
      // Server dropped the session (restart/prune): re-initialize once,
      // then replay the original message on the fresh session.
      await this.start(timeoutMs);
      res = await this.postOnce(message, timeoutMs);
    }
    if (res.status === 401) {
      throw new McpError("mcp: unauthorized — no usable bearer token (OAuth seam, not silent retry)", 401);
    }
    if (res.status === 404) {
      throw new McpError("mcp: unknown session or endpoint (HTTP 404)");
    }
    if (res.status < 200 || res.status >= 300) {
      throw new McpError(`mcp: HTTP ${res.status}`);
    }
    const incoming = res.headers.get("mcp-session-id");
    if (incoming) this.sessionId = incoming;
    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    const messages: unknown[] = contentType.includes("text/event-stream")
      ? parseSseMessages(text)
      : [JSON.parse(text)];
    const response = messages.find(
      (m): m is JsonRpcResponse =>
        typeof m === "object" && m !== null && (m as JsonRpcResponse).id === message.id,
    );
    if (!response) {
      throw new McpError(`mcp: no JSON-RPC response for id ${message.id}`);
    }
    if (response.error) {
      throw new McpError(`mcp: ${response.error.message ?? "protocol error"}`, response.error.code);
    }
    return response.result;
  }

  private async postNotification(method: string, params: unknown): Promise<void> {
    if (this.closed || !this.sessionId) return;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Session-Id": this.sessionId,
    };
    const token = this.auth?.token();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      await fetch(this.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ jsonrpc: "2.0", method, params }),
        signal: ctrl.signal,
      });
    } catch {
      // Advisory; see cancelCall.
    } finally {
      clearTimeout(timer);
    }
  }

  private async postOnce(
    message: { jsonrpc: string; id: string | number; method: string; params: unknown },
    timeoutMs: number,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;
    const token = this.auth?.token();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(this.url, {
        method: "POST",
        headers,
        body: JSON.stringify(message),
        signal: ctrl.signal,
      });
    } catch {
      if (this.closed) throw new McpError("client closed");
      throw new McpError(`request ${message.method} timed out after ${timeoutMs}ms`);
    } finally {
      clearTimeout(timer);
    }
  }
}
