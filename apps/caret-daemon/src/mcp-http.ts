// Caret MCP client, streamable-HTTP transport (PX-14 tail + CUS-11):
// POST JSON-RPC with SSE-or-JSON responses, Mcp-Session-Id continuity,
// per-request timeout, cancellation, and transparent recovery from
// dropped sessions. Covers tools, resources, prompts, and server-initiated
// elicitation/create over a long-lived GET event stream (stdio already
// had this; HTTP was the documented gap). No SDK dependency — same
// owned-wire posture as the stdio client.
// Full OAuth (discovery + PKCE) is NOT here: callers inject a bearer token
// via `auth`; HTTP 401 surfaces as McpError so the harness stops/waits
// instead of silently switching to a billed path.
import {
  McpCallResult,
  McpError,
  McpPrompt,
  McpPromptMessage,
  McpResource,
  McpResourceContent,
  McpTool,
  type McpElicitationHandler,
} from "./mcp.ts";
import * as http from "node:http";
import * as https from "node:https";

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
  private listenReq: http.ClientRequest | null = null;
  private listenBuf = "";

  constructor(
    private readonly url: string,
    private readonly auth?: McpHttpAuth,
    private options: { onElicitation?: McpElicitationHandler } = {},
  ) {}

  /** Current session id (diagnostics/tests only). */
  get session(): string | null {
    return this.sessionId;
  }

  /** Register (or clear) the handler for server-to-client elicitation/create. */
  setElicitationHandler(handler: McpElicitationHandler | null): void {
    if (handler) {
      this.options = { ...this.options, onElicitation: handler };
    } else {
      const { onElicitation: _dropped, ...rest } = this.options;
      this.options = rest;
    }
  }

  async start(timeoutMs = 10000): Promise<{ protocolVersion: string; server: string }> {
    this.listenReq?.destroy();
    this.listenReq = null;
    this.listenBuf = "";
    this.closed = false;
    this.sessionId = null;
    const hello = (await this.post(
      {
        jsonrpc: "2.0",
        id: this.nextId++,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: this.options.onElicitation ? { elicitation: {} } : {},
          clientInfo: { name: "caret", version: "0.0.1" },
        },
      },
      timeoutMs,
      false,
    )) as { protocolVersion?: string; serverInfo?: { name?: string } };
    await this.postNotification("notifications/initialized", {});
    if (this.options.onElicitation) {
      await this.openListen(timeoutMs);
    }
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

  async listResources(timeoutMs = 10000): Promise<McpResource[]> {
    const result = (await this.post(
      { jsonrpc: "2.0", id: this.nextId++, method: "resources/list", params: {} },
      timeoutMs,
      true,
    )) as { resources?: McpResource[] };
    if (!Array.isArray(result.resources)) {
      throw new McpError("resources/list returned no resource array");
    }
    return result.resources;
  }

  async readResource(uri: string, timeoutMs = 10000): Promise<McpResourceContent[]> {
    const result = (await this.post(
      { jsonrpc: "2.0", id: this.nextId++, method: "resources/read", params: { uri } },
      timeoutMs,
      true,
    )) as { contents?: McpResourceContent[] };
    if (!result || !Array.isArray(result.contents)) {
      throw new McpError(`resources/read ${uri} returned malformed result`);
    }
    return result.contents;
  }

  async listPrompts(timeoutMs = 10000): Promise<McpPrompt[]> {
    const result = (await this.post(
      { jsonrpc: "2.0", id: this.nextId++, method: "prompts/list", params: {} },
      timeoutMs,
      true,
    )) as { prompts?: McpPrompt[] };
    if (!Array.isArray(result.prompts)) {
      throw new McpError("prompts/list returned no prompt array");
    }
    return result.prompts;
  }

  async getPrompt(
    name: string,
    args: Record<string, unknown> = {},
    timeoutMs = 10000,
  ): Promise<{ description?: string; messages: McpPromptMessage[] }> {
    const result = (await this.post(
      { jsonrpc: "2.0", id: this.nextId++, method: "prompts/get", params: { name, arguments: args } },
      timeoutMs,
      true,
    )) as { description?: string; messages?: McpPromptMessage[] };
    if (!result || !Array.isArray(result.messages)) {
      throw new McpError(`prompts/get ${name} returned malformed result`);
    }
    return { description: result.description, messages: result.messages };
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
    this.listenReq?.destroy();
    this.listenReq = null;
    this.listenBuf = "";
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

  private openListen(timeoutMs: number): Promise<void> {
    if (!this.sessionId || this.closed) {
      return Promise.reject(new McpError("mcp: cannot open GET stream without a session"));
    }
    const target = new URL(this.url);
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Mcp-Session-Id": this.sessionId,
    };
    const token = this.auth?.token();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const transport = target.protocol === "https:" ? https : http;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const req = transport.request(
        {
          hostname: target.hostname,
          port: target.port,
          path: target.pathname + target.search,
          method: "GET",
          headers,
        },
        (res) => {
          if (res.statusCode === 401) {
            if (!settled) {
              settled = true;
              reject(new McpError("mcp: unauthorized — no usable bearer token (OAuth seam, not silent retry)", 401));
            }
            res.resume();
            return;
          }
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            if (!settled) {
              settled = true;
              reject(new McpError(`mcp: GET event stream HTTP ${res.statusCode ?? 0}`));
            }
            res.resume();
            return;
          }
          if (!settled) {
            settled = true;
            req.setTimeout(0);
            resolve();
          }
          res.setEncoding("utf8");
          res.on("data", (chunk: string) => this.ingestListen(chunk));
          res.on("error", () => {
            // Dropped stream is not a client call failure.
          });
        },
      );
      this.listenReq = req;
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        if (!settled) {
          settled = true;
          reject(new McpError(`mcp: GET event stream timed out after ${timeoutMs}ms`));
        }
      });
      req.on("error", (error) => {
        if (!settled) {
          settled = true;
          reject(new McpError(`mcp: GET event stream failed: ${error.message}`));
        }
      });
      req.end();
    });
  }

  private ingestListen(chunk: string): void {
    this.listenBuf += chunk;
    const parts = this.listenBuf.split(/\r?\n\r?\n/);
    this.listenBuf = parts.pop() ?? "";
    for (const frame of parts) {
      const data = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trim())
        .join("\n");
      if (!data || data === "[DONE]") continue;
      let msg: { id?: string | number; method?: string; params?: unknown };
      try {
        msg = JSON.parse(data) as typeof msg;
      } catch {
        continue;
      }
      if (typeof msg.method === "string" && msg.id !== undefined) {
        void this.serveIncoming(msg.id, msg.method, msg.params);
      }
    }
  }

  private async serveIncoming(id: string | number, method: string, params: unknown): Promise<void> {
    if (method === "elicitation/create") {
      const handler = this.options.onElicitation;
      if (!handler) {
        await this.postReply(id, undefined, { code: -32601, message: "elicitation not supported by client" });
        return;
      }
      try {
        const p = (params ?? {}) as { message?: string; requestedSchema?: unknown };
        const outcome = await handler({ message: p.message, requestedSchema: p.requestedSchema });
        if (outcome.action !== "accept" && outcome.action !== "decline" && outcome.action !== "cancel") {
          throw new Error(`bad elicitation action ${String((outcome as { action?: unknown }).action)}`);
        }
        await this.postReply(
          id,
          outcome.action === "accept"
            ? { action: outcome.action, content: outcome.content ?? {} }
            : { action: outcome.action },
        );
      } catch (error) {
        await this.postReply(id, undefined, {
          code: -32603,
          message: error instanceof Error ? error.message : "elicitation handler failed",
        });
      }
      return;
    }
    await this.postReply(id, undefined, { code: -32601, message: `unknown method ${method}` });
  }

  private async postReply(
    id: string | number,
    result?: unknown,
    error?: { code?: number; message?: string },
  ): Promise<void> {
    if (this.closed || !this.sessionId) return;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Session-Id": this.sessionId,
    };
    const token = this.auth?.token();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const body = error
      ? { jsonrpc: "2.0", id, error }
      : { jsonrpc: "2.0", id, result: result ?? {} };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      await fetch(this.url, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
    } catch {
      // Reply delivery is best-effort; the original tools/call still times out locally.
    } finally {
      clearTimeout(timer);
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
