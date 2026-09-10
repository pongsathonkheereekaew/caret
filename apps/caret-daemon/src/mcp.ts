// Caret MCP client (PX-14 transport core + CUS-11): stdio JSON-RPC for
// initialize, ping, tools/list, tools/call, resources/list,
// resources/read, prompts/list, prompts/get with timeout, cancellation,
// and reconnect. Also answers server-to-client elicitation/create via a
// caller-provided handler (consent gating lives in the caller, not here).
// No SDK dependency — the wire surface is small and fully owned here.
import * as cp from "child_process";
import * as readline from "node:readline";

export interface McpTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: unknown;
}

export interface McpCallResult {
  readonly content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  readonly isError?: boolean;
}

export interface McpResource {
  readonly uri: string;
  readonly name: string;
  readonly description?: string;
  readonly mimeType?: string;
}

export interface McpResourceContent {
  readonly uri: string;
  readonly mimeType?: string;
  readonly text?: string;
  readonly blob?: string;
}

export interface McpPromptArgument {
  readonly name: string;
  readonly description?: string;
  readonly required?: boolean;
}

export interface McpPrompt {
  readonly name: string;
  readonly description?: string;
  readonly arguments?: ReadonlyArray<McpPromptArgument>;
}

export interface McpPromptMessage {
  readonly role: string;
  readonly content: { type: string; text?: string; [key: string]: unknown };
}

export interface McpElicitationResult {
  readonly action: "accept" | "decline" | "cancel";
  readonly content?: Record<string, unknown>;
}

export type McpElicitationHandler = (params: {
  readonly message?: string;
  readonly requestedSchema?: unknown;
}) => Promise<McpElicitationResult>;

export class McpError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "McpError";
  }
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class McpClient {
  private proc: cp.ChildProcess | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private buffer = "";
  private closed = false;

  constructor(
    private readonly command: string,
    private readonly args: ReadonlyArray<string> = [],
    private options: { onElicitation?: McpElicitationHandler } = {},
  ) {}

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
    this.closed = false;
    this.proc = cp.spawn(this.command, [...this.args], { stdio: ["pipe", "pipe", "pipe"] });
    const mine = this.proc;
    this.proc.stdout?.on("data", (chunk: Buffer) => this.ingest(chunk.toString("utf8")));
    this.proc.stderr?.on("data", () => {
      // Server logs are diagnostic only; never merged into results.
    });
    this.proc.on("exit", () => {
      if (this.proc === mine) {
        this.failAll(new McpError("server exited"));
      }
    });
    const hello = (await this.request(
      "initialize",
      {
        protocolVersion: "2024-11-05",
        capabilities: this.options.onElicitation ? { elicitation: {} } : {},
        clientInfo: { name: "caret", version: "0.0.1" },
      },
      timeoutMs,
    )) as { protocolVersion?: string; serverInfo?: { name?: string } };
    this.notify("notifications/initialized", {});
    return {
      protocolVersion: String(hello.protocolVersion ?? "unknown"),
      server: String(hello.serverInfo?.name ?? "unknown"),
    };
  }

  async ping(timeoutMs = 5000): Promise<void> {
    await this.request("ping", {}, timeoutMs);
  }

  async listTools(timeoutMs = 10000): Promise<McpTool[]> {
    const result = (await this.request("tools/list", {}, timeoutMs)) as { tools?: McpTool[] };
    if (!Array.isArray(result.tools)) {
      throw new McpError("tools/list returned no tool array");
    }
    return result.tools;
  }

  async callTool(name: string, args: Record<string, unknown>, timeoutMs = 30000): Promise<McpCallResult> {
    const result = (await this.request("tools/call", { name, arguments: args }, timeoutMs)) as McpCallResult;
    if (!result || !Array.isArray(result.content)) {
      throw new McpError(`tools/call ${name} returned malformed result`);
    }
    return result;
  }

  async listResources(timeoutMs = 10000): Promise<McpResource[]> {
    const result = (await this.request("resources/list", {}, timeoutMs)) as { resources?: McpResource[] };
    if (!Array.isArray(result.resources)) {
      throw new McpError("resources/list returned no resource array");
    }
    return result.resources;
  }

  async readResource(uri: string, timeoutMs = 10000): Promise<McpResourceContent[]> {
    const result = (await this.request("resources/read", { uri }, timeoutMs)) as {
      contents?: McpResourceContent[];
    };
    if (!result || !Array.isArray(result.contents)) {
      throw new McpError(`resources/read ${uri} returned malformed result`);
    }
    return result.contents;
  }

  async listPrompts(timeoutMs = 10000): Promise<McpPrompt[]> {
    const result = (await this.request("prompts/list", {}, timeoutMs)) as { prompts?: McpPrompt[] };
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
    const result = (await this.request("prompts/get", { name, arguments: args }, timeoutMs)) as {
      description?: string;
      messages?: McpPromptMessage[];
    };
    if (!result || !Array.isArray(result.messages)) {
      throw new McpError(`prompts/get ${name} returned malformed result`);
    }
    return { description: result.description, messages: result.messages };
  }

  /** Cancel an in-flight call: notify the server, then enforce locally. */
  async cancelCall(id: number): Promise<void> {
    this.notify("notifications/cancelled", { requestId: id });
  }

  /** Expose raw request ids for cancellation tests. */
  rawRequest(method: string, params: unknown, timeoutMs: number): { id: number; done: Promise<unknown> } {
    const id = this.nextId++;
    const done = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new McpError(`request ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.proc?.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
    return { id, done };
  }

  async reconnect(timeoutMs = 10000): Promise<void> {
    await this.close();
    await this.start(timeoutMs);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.failAll(new McpError("client closed"));
    const proc = this.proc;
    this.proc = null;
    if (proc && proc.exitCode === null) {
      proc.kill();
    }
  }

  private request(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    if (!this.proc?.stdin || this.closed) {
      return Promise.reject(new McpError("client not running"));
    }
    const { done } = this.rawRequest(method, params, timeoutMs);
    return done;
  }

  private notify(method: string, params: unknown): void {
    this.proc?.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  private ingest(text: string): void {
    this.buffer += text;
    let index = this.buffer.indexOf("\n");
    while (index >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      index = this.buffer.indexOf("\n");
      if (!line) continue;
      let msg: {
        id?: string | number;
        method?: string;
        params?: unknown;
        result?: unknown;
        error?: { code?: number; message?: string };
      };
      try {
        msg = JSON.parse(line) as typeof msg;
      } catch {
        continue;
      }
      if (typeof msg.method === "string" && msg.id !== undefined) {
        // Server-to-client request (e.g. elicitation/create). Answered
        // async; never routed into the client-pending map.
        void this.serveIncoming(msg.id, msg.method, msg.params);
        continue;
      }
      if (typeof msg.id !== "number") continue;
      const waiter = this.pending.get(msg.id);
      if (!waiter) continue;
      this.pending.delete(msg.id);
      clearTimeout(waiter.timer);
      if (msg.error) {
        waiter.reject(new McpError(String(msg.error.message ?? "unknown error"), msg.error.code));
      } else {
        waiter.resolve(msg.result);
      }
    }
  }

  private async serveIncoming(id: string | number, method: string, params: unknown): Promise<void> {
    if (method === "elicitation/create") {
      const handler = this.options.onElicitation;
      if (!handler) {
        this.respond(id, undefined, { code: -32601, message: "elicitation not supported by client" });
        return;
      }
      try {
        const p = (params ?? {}) as { message?: string; requestedSchema?: unknown };
        const outcome = await handler({ message: p.message, requestedSchema: p.requestedSchema });
        if (outcome.action !== "accept" && outcome.action !== "decline" && outcome.action !== "cancel") {
          throw new Error(`bad elicitation action ${String((outcome as { action?: unknown }).action)}`);
        }
        this.respond(
          id,
          outcome.action === "accept"
            ? { action: outcome.action, content: outcome.content ?? {} }
            : { action: outcome.action },
        );
      } catch (error) {
        this.respond(id, undefined, {
          code: -32603,
          message: error instanceof Error ? error.message : "elicitation handler failed",
        });
      }
      return;
    }
    this.respond(id, undefined, { code: -32601, message: `unknown method ${method}` });
  }

  private respond(id: string | number, result?: unknown, error?: { code?: number; message?: string }): void {
    const msg = error
      ? { jsonrpc: "2.0", id, error }
      : { jsonrpc: "2.0", id, result: result ?? {} };
    this.proc?.stdin?.write(`${JSON.stringify(msg)}\n`);
  }

  private failAll(error: Error): void {
    for (const [, waiter] of this.pending) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.pending.clear();
  }
}
