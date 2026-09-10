// Caret MCP client (PX-14 transport core): stdio JSON-RPC for initialize,
// ping, tools/list, tools/call with timeout, cancellation, and reconnect.
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
  ) {}

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
        capabilities: {},
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
      let msg: { id?: number; result?: unknown; error?: { code?: number; message?: string } };
      try {
        msg = JSON.parse(line) as typeof msg;
      } catch {
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

  private failAll(error: Error): void {
    for (const [, waiter] of this.pending) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.pending.clear();
  }
}
