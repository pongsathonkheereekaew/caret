// Caret daemon client (PX-26 seed): typed TCP NDJSON client for the 12
// session-API methods served over stdio and the TCP gateway. Ids
// auto-increment; pass an explicit id to safely retry a timed-out call
// (the gateway replays by token:id without re-executing).
import * as Net from "node:net";

export interface CaretEvent {
  event?: string;
  [key: string]: unknown;
}

export class CaretClientError extends Error {
  constructor(
    message: string,
    readonly method: string,
    readonly id: string | number,
  ) {
    super(message);
    this.name = "CaretClientError";
  }
}

export interface ThreadStarted {
  threadId: string;
}
export interface TurnState {
  state: string;
}
export interface RunReview {
  diff: string;
}
export interface BringBackResult {
  brought?: boolean;
  [key: string]: unknown;
}
export interface RunList {
  runs: string[];
}
export interface RemoveResult {
  removed: boolean;
}
export interface ExportResult {
  path: string;
  files: number;
  events: number;
}

export class CaretClient {
  private socket: Net.Socket | null = null;
  private buffer = "";
  private nextId = 1;
  private token: string;
  private readonly pending = new Map<
    string | number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();

  constructor(
    private readonly opts: {
      port: number;
      host?: string;
      token: string;
      timeoutMs?: number;
      onEvent?: (event: CaretEvent) => void;
    },
  ) {
    this.token = opts.token;
  }

  /** Replace the bearer token (e.g. after pairing.revoke). */
  setToken(token: string): void {
    this.token = token;
  }

  async connect(): Promise<void> {
    if (this.socket) return;
    const host = this.opts.host ?? "127.0.0.1";
    const socket = await new Promise<Net.Socket>((resolve, reject) => {
      const s = Net.connect(this.opts.port, host, () => resolve(s));
      s.on("error", reject);
    });
    socket.on("data", (chunk: Buffer) => this.ingest(chunk.toString("utf8")));
    socket.on("close", () => this.failAll(new CaretClientError("connection closed", "", "")));
    this.socket = socket;
  }

  close(): void {
    this.failAll(new CaretClientError("client closed", "", ""));
    this.socket?.destroy();
    this.socket = null;
  }

  startSession(repoDir: string, runId: string): Promise<ThreadStarted> {
    return this.call("session.start", { repoDir, runId });
  }
  sendTurn(input: string, id?: string | number, session?: string): Promise<TurnState> {
    return this.call("turn.send", { input, session }, id);
  }
  steerTurn(input: string, session?: string): Promise<{ steered: boolean }> {
    return this.call("turn.steer", { input, session });
  }
  answerApproval(requestId: string, answer: "accept" | "decline", session?: string): Promise<unknown> {
    return this.call("approval.answer", { requestId, answer, session });
  }
  reviewRun(session?: string): Promise<RunReview> {
    return this.call("run.review", { session });
  }
  rejectRun(session?: string): Promise<{ reversed: boolean }> {
    return this.call("run.reject", { session });
  }
  bringBackRun(session?: string): Promise<BringBackResult> {
    return this.call("run.bringBack", { session });
  }
  listRuns(): Promise<RunList> {
    return this.call("run.list", {});
  }
  removeRun(worktreeDir: string, session?: string): Promise<RemoveResult> {
    return this.call("run.remove", { worktreeDir, session });
  }
  recaptureRun(label: string, session?: string): Promise<unknown> {
    return this.call("run.recapture", { label, session });
  }
  exportRun(dir: string, overwrite = false, session?: string): Promise<ExportResult> {
    return this.call("run.export", { dir, overwrite, session });
  }
  listArtifacts(session?: string): Promise<{ runId: string; revision: string; items: unknown[] }> {
    return this.call("run.artifacts", { session });
  }
  stopSession(session?: string): Promise<unknown> {
    return this.call("session.stop", { session });
  }
  listSessions(): Promise<Array<{ threadId: string; runId: string; repoDir: string; goal: string; live: boolean; current: boolean }>> {
    return this.call("session.list", {});
  }
  pairingStatus(): Promise<{ paired: boolean }> {
    return this.call("pairing.status", {});
  }
  async revokePairing(): Promise<string> {
    const result = (await this.call("pairing.revoke", {})) as { token: string };
    this.token = result.token;
    return result.token;
  }

  call<T>(method: string, params: unknown, id?: string | number, timeoutMs?: number): Promise<T> {
    const socket = this.socket;
    if (!socket) {
      return Promise.reject(new CaretClientError("client not connected", method, id ?? -1));
    }
    const rid = id ?? this.nextId++;
    const limit = timeoutMs ?? this.opts.timeoutMs ?? 240000;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(rid);
        reject(new CaretClientError(`request ${method} timed out after ${limit}ms`, method, rid));
      }, limit);
      this.pending.set(rid, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v as T);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      socket.write(`${JSON.stringify({ id: rid, method, params, auth: this.token })}\n`);
    });
  }

  private ingest(text: string): void {
    this.buffer += text;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let msg: { id?: unknown; ok?: boolean; result?: unknown; error?: unknown } & CaretEvent;
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
          waiter?.reject(
            new CaretClientError(
              typeof msg.error === "string" ? msg.error : "protocol error",
              "",
              msg.id,
            ),
          );
        }
      } else {
        try {
          this.opts.onEvent?.(msg);
        } catch {
          // Event handlers must never break the reader loop.
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
