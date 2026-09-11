// M5 remote gateway conformance (LOC-01/02/04 backbone): auth, dispatch,
// idempotent replay, second-client shared state, revoke rotation, event
// fan-out — over TCP loopback against a stub API. The engine surface shape
// is asserted against the REAL session factory (keys only, never invoked).
import * as Net from "node:net";
import * as Fs from "node:fs";
import * as Os from "node:os";
import * as NodePath from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";

import { serveRemote, writePairingFile, removePairingFile, type RemoteServer } from "./remote.ts";
import { createSessionApi } from "./session-api.ts";

describe("PairingFiles", () => {
  it("writes owner-only and removes, missing reads false", () => {
    const file = NodePath.join(Fs.mkdtempSync(NodePath.join(Os.tmpdir(), "caret-pair-")), "t.token");
    writePairingFile(file, "s3cret");
    expect(Fs.readFileSync(file, "utf8")).toBe("s3cret\n");
    expect(Fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(removePairingFile(file)).toBe(true);
    expect(Fs.existsSync(file)).toBe(false);
    expect(removePairingFile(file)).toBe(false);
  });
});
const HOST = "127.0.0.1";

class LineClient {
  private buffer = "";
  private readonly waiters = new Map<string | number | null, (v: Record<string, unknown>) => void>();
  readonly events: unknown[] = [];

  constructor(private readonly socket: Net.Socket) {
    socket.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString("utf8");
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const msg = JSON.parse(trimmed) as Record<string, unknown>;
        const key = msg["id"] as string | number | null;
        const waiter = this.waiters.get(key);
        if (waiter !== undefined) {
          this.waiters.delete(key);
          waiter(msg);
        } else {
          this.events.push(msg);
        }
      }
    });
  }

  static connect(port: number): Promise<LineClient> {
    return new Promise((resolve, reject) => {
      const socket = Net.connect(port, HOST, () => resolve(new LineClient(socket)));
      socket.on("error", reject);
    });
  }

  request(id: string | number, method: string, params: unknown, auth: string): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      this.waiters.set(id, resolve);
      this.socket.write(`${JSON.stringify({ id, method, params, auth })}\n`);
    });
  }

  writeRaw(text: string): void {
    this.socket.write(text);
  }

  takeResponse(id: string | number): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      this.waiters.set(id, resolve);
    });
  }

  close(): void {
    this.socket.destroy();
  }
}

describe("M5RemoteGateway", () => {
  let gateway: RemoteServer | null = null;
  let counter = 0;

  const boot = async () => {
    if (gateway) return gateway;
    const next = await serveRemote(
      (notify) => ({
        "test.count": () => Effect.gen(function* () {
          counter += 1;
          return { n: counter };
        }),
        "test.emit": () =>
          Effect.gen(function* () {
            notify({ event: "test.ping", n: counter });
            return { emitted: true };
          }),
        "test.fail": () => Effect.fail(new Error("stub boom")),
      }),
      (eff) => Effect.runPromise(eff as Effect.Effect<never, never>),
      { host: HOST, port: 0, token: "pair-token" },
    );
    gateway = next;
    return next;
  };

  afterAll(async () => {
    await gateway?.close();
    gateway = null;
  });

  it("rejects unauthenticated and malformed envelopes", async () => {
    const gw = await boot();
    const c = await LineClient.connect(gw.port);
    try {
      const noAuth = await c.request(1, "test.count", {}, "wrong-token");
      expect(noAuth).toMatchObject({ id: 1, ok: false, error: "unauthorized" });
      c.writeRaw("not json\n");
      const malformed = await c.takeResponse(null);
      expect(malformed).toMatchObject({ id: null, ok: false, error: "invalid json" });
      const noIdReady = c.takeResponse(null);
      c.writeRaw(JSON.stringify({ method: "test.count", params: {}, auth: gw.token }) + "\n");
      expect(await noIdReady).toMatchObject({ id: null, ok: false, error: "envelope needs {id, method}" });
      const unknown = await c.request(2, "nope.method", {}, gw.token);
      expect(unknown).toMatchObject({ id: 2, ok: false, error: "unknown method nope.method" });
    } finally {
      c.close();
    }
  });

  it("dispatches, reports failures, and never re-executes a replayed id", async () => {
    const gw = await boot();
    const c = await LineClient.connect(gw.port);
    try {
      const before = counter;
      const first = await c.request(10, "test.count", {}, gw.token);
      expect(first).toMatchObject({ id: 10, ok: true, result: { n: before + 1 } });
      const replay = await c.request(10, "test.count", {}, gw.token);
      expect(replay).toEqual(first);
      expect(counter).toBe(before + 1);
      const failed = await c.request(11, "test.fail", {}, gw.token);
      expect(failed).toMatchObject({ id: 11, ok: false, error: "stub boom" });
      // Failures are NOT cached: a retry runs again (operator intent).
      const retry = await c.request(12, "test.fail", {}, gw.token);
      expect(retry).toMatchObject({ id: 12, ok: false });
    } finally {
      c.close();
    }
  });
  it("resyncs across connections after a network switch", async () => {
    const gw = await boot();
    const wifi = await LineClient.connect(gw.port);
    let first: Record<string, unknown>;
    try {
      const before = counter;
      first = await wifi.request(50, "test.count", {}, gw.token);
      expect(first).toMatchObject({ id: 50, ok: true, result: { n: before + 1 } });
    } finally {
      wifi.close();
    }
    const cell = await LineClient.connect(gw.port);
    try {
      const replay = await cell.request(50, "test.count", {}, gw.token);
      expect(replay).toEqual(first);
      expect(counter).toBe((first["result"] as { n: number }).n);
    } finally {
      cell.close();
    }
  });


  it("shares run state with a second client", async () => {
    const gw = await boot();
    const a = await LineClient.connect(gw.port);
    const b = await LineClient.connect(gw.port);
    try {
      const ra = await a.request(20, "test.count", {}, gw.token);
      const rb = await b.request(21, "test.count", {}, gw.token);
      expect((rb["result"] as { n: number }).n).toBe((ra["result"] as { n: number }).n + 1);
    } finally {
      a.close();
      b.close();
    }
  });

  it("fans engine events out to every connected client", async () => {
    const gw = await boot();
    const a = await LineClient.connect(gw.port);
    const b = await LineClient.connect(gw.port);
    try {
      const done = await a.request(30, "test.emit", {}, gw.token);
      expect(done).toMatchObject({ id: 30, ok: true });
      // Sync on b's own next response: same-socket order guarantees the
      // broadcast (written before any later reply to b) already arrived.
      // Awaiting a's response alone proves nothing about b's socket.
      const syncB = await b.request(31, "pairing.status", {}, gw.token);
      expect(syncB).toMatchObject({ id: 31, ok: true });
      expect(a.events).toContainEqual({ event: "test.ping", n: counter });
      expect(b.events).toContainEqual({ event: "test.ping", n: counter });
    } finally {
      a.close();
      b.close();
    }
  });

  it("revokes by rotation without locking out the operator", async () => {
    const gw = await boot();
    const staleToken = gw.token;
    const c = await LineClient.connect(gw.port);
    try {
      const revoked = await c.request(40, "pairing.revoke", {}, staleToken);
      expect(revoked["ok"]).toBe(true);
      const fresh = (revoked["result"] as { token: string }).token;
      expect(typeof fresh).toBe("string");
      expect(fresh).not.toBe(staleToken);
      const stale = await c.request(41, "test.count", {}, staleToken);
      expect(stale).toMatchObject({ id: 41, ok: false, error: "unauthorized" });
      const live = await c.request(42, "test.count", {}, fresh);
      expect(live["ok"]).toBe(true);
    } finally {
      c.close();
    }
  });

  it("serves the real engine surface shape (keys only, engine never invoked)", async () => {
    const keys = Object.keys(createSessionApi(() => {})).sort();
    expect(keys).toEqual([
      "approval.answer",
      "chat.search",
      "code.search",
      "docs.fetch",
      "docs.get",
      "docs.list",
      "docs.refresh",
      "index.pause",
      "index.rebuild",
      "index.resume",
      "index.status",
      "plan.get",
      "plan.revise",
      "run.artifacts",
      "run.bringBack",
      "run.export",
      "run.list",
      "run.recapture",
      "run.reject",
      "run.remove",
      "run.review",
      "session.archive",
      "session.forget",
      "session.list",
      "session.pin",
      "session.rename",
      "session.select",
      "session.start",
      "session.stop",
      "turn.cancel",
      "turn.send",
      "turn.steer",
    ]);
  });
});
