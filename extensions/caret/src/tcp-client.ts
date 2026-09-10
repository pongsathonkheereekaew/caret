// Caret TCP daemon client for the extension (multi-endpoint UI): NDJSON
// over TCP with id matching, timeouts, and event fan-in. No vscode
// import — checked directly with bun against the real gateway.
import * as Net from "node:net";

export interface DaemonEvent {
  event?: string;
  [key: string]: unknown;
}

export class TcpDaemonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TcpDaemonError";
  }
}

export class TcpDaemonClient {
  private socket: Net.Socket | null = null;
  private buffer = "";
  private nextId = 1;
  private readonly pending = new Map<
    string | number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();
  private token = "";
  constructor(
    private readonly onNotification: (msg: DaemonEvent) => void,
    private readonly onExit: (code: string) => void,
  ) {}

  async connect(host: string, port: number, token: string): Promise<void> {
    if (this.socket) return;
    this.token = token;
    const socket = await new Promise<Net.Socket>((resolve, reject) => {
      const s = Net.connect(port, host, () => resolve(s));
      s.on("error", reject);
    });
    socket.on("data", (chunk: Buffer) => this.ingest(chunk.toString("utf8")));
    socket.on("close", () => {
      this.socket = null;
      this.failAll(new TcpDaemonError("connection closed"));
      this.onExit("tcp-closed");
    });
    this.socket = socket;
  }

  request(method: string, params: unknown, timeoutMs = 240000): Promise<unknown> {
    const socket = this.socket;
    if (!socket) {
      return Promise.reject(new TcpDaemonError("not connected"));
    }
    const id = this.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new TcpDaemonError(`request ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
        timer,
      });
      socket.write(`${JSON.stringify({ id, method, params, auth: this.token })}\n`);
    });
  }

  close(): void {
    this.failAll(new TcpDaemonError("client closed"));
    this.socket?.destroy();
    this.socket = null;
  }

  private ingest(text: string): void {
    this.buffer += text;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let msg: { id?: unknown; ok?: boolean; result?: unknown; error?: unknown } & DaemonEvent;
      try {
        msg = JSON.parse(trimmed) as typeof msg;
      } catch {
        continue;
      }
      if ((typeof msg.id === "number" || typeof msg.id === "string") && this.pending.has(msg.id)) {
        const waiter = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.ok === true) {
          waiter?.resolve(msg.result);
        } else {
          waiter?.reject(new TcpDaemonError(typeof msg.error === "string" ? msg.error : "protocol error"));
        }
      } else {
        try {
          this.onNotification(msg);
        } catch {
          // Notification handlers must never break the reader loop.
        }
      }
    }
  }

  private failAll(error: Error): void {
    for (const [, waiter] of this.pending) {
      try {
        waiter.reject(error);
      } catch {
        // Reject handlers belong to the caller.
      }
    }
    this.pending.clear();
  }
}
