// Caret M5 remote gateway (LOC-01/02/04 backbone): TCP NDJSON pairing,
// per-client idempotency, revoke. Loopback-proven; LAN/relay are deploy
// flags over this gateway. Pairing files are owner-only (0600).
import * as Net from "node:net";
import * as Crypto from "node:crypto";
import * as Fs from "node:fs";
import * as Effect from "effect/Effect";

export type RemoteHandler = (params: never) => Effect.Effect<unknown, unknown>;

export interface RemoteOptions {
  /** Bind host. 127.0.0.1 default; LAN is an explicit deploy-time flag. */
  host?: string;
  /** Bind port. 0 = ephemeral (tests), reported back. */
  port?: number;
  /** Pairing token. Default random; CARET_PAIRING env overrides for dev. */
  token?: string;
  /** Idempotency cache cap per token. Default 200. */
  idempotencyCap?: number;
}

export interface RemoteServer {
  readonly port: number;
  readonly token: string;
  close(): Promise<void>;
}

const timingSafeEqualString = (a: string, b: string): boolean => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && Crypto.timingSafeEqual(ba, bb);
};

/** Write the pairing token with owner-only permissions. */
export const writePairingFile = (path: string, token: string): void => {
  Fs.writeFileSync(path, `${token}\n`, { mode: 0o600 });
};

/** Remove a pairing file (stale boot cleanup, shutdown). False when absent. */
export const removePairingFile = (path: string): boolean => {
  try {
    Fs.rmSync(path);
    return true;
  } catch {
    return false;
  }
};
export const serveRemote = async (
  createApi: (notify: (msg: unknown) => void) => Record<string, RemoteHandler>,
  runEffect: <A>(eff: Effect.Effect<A, unknown>) => Promise<A>,
  opts: RemoteOptions = {},
): Promise<RemoteServer> => {
  const host = opts.host ?? "127.0.0.1";
  const cap = opts.idempotencyCap ?? 200;
  let token = opts.token ?? process.env["CARET_PAIRING"] ?? Crypto.randomBytes(32).toString("hex");
  // Cached ok-responses by token:id. Failures are NOT cached: a failed
  // attempt may be retried for real (operator intent), while a replayed
  // success must never re-execute (no duplicate tool effects, M5 gate).
  const seen = new Map<string, unknown>();
  const sockets = new Set<Net.Socket>();

  const remember = (key: string, response: unknown) => {
    seen.set(key, response);
    if (seen.size > cap) {
      const oldest = seen.keys().next();
      if (!oldest.done) seen.delete(oldest.value);
    }
  };

  const broadcast = (msg: unknown) => {
    const line = `${JSON.stringify(msg)}\n`;
    for (const socket of sockets) {
      try {
        socket.write(line);
      } catch {
        // Best effort; dead sockets drop at close/error below.
      }
    }
  };

  const api = createApi(broadcast);

  const answer = (socket: Net.Socket, response: unknown) => {
    try {
      socket.write(`${JSON.stringify(response)}\n`);
    } catch {
      // Client already gone; its retry carries the same id.
    }
  };

  const onEnvelope = async (
    socket: Net.Socket,
    raw: { id?: unknown; method?: unknown; params?: unknown; auth?: unknown },
  ) => {
    if (typeof raw.auth !== "string" || !timingSafeEqualString(raw.auth, token)) {
      answer(socket, { id: raw.id ?? null, ok: false, error: "unauthorized" });
      return;
    }
    if ((typeof raw.id !== "number" && typeof raw.id !== "string") || typeof raw.method !== "string") {
      answer(socket, { id: raw.id ?? null, ok: false, error: "envelope needs {id, method}" });
      return;
    }
    const key = `${token}:${String(raw.id)}`;
    const cached = seen.get(key);
    if (cached !== undefined) {
      answer(socket, cached);
      return;
    }
    if (raw.method === "pairing.status") {
      const response = { id: raw.id, ok: true, result: { paired: true } };
      remember(key, response);
      answer(socket, response);
      return;
    }
    if (raw.method === "pairing.revoke") {
      // Rotate over the already-authed connection; the response carries the
      // replacement, so the operator is never locked out by their own revoke.
      token = Crypto.randomBytes(32).toString("hex");
      const response = { id: raw.id, ok: true, result: { token } };
      remember(`${token}:${String(raw.id)}`, response);
      answer(socket, response);
      return;
    }
    const handler = api[raw.method];
    if (!handler) {
      answer(socket, { id: raw.id, ok: false, error: `unknown method ${raw.method}` });
      return;
    }
    try {
      const result = await runEffect(handler(raw.params as never));
      const response = { id: raw.id, ok: true, result };
      remember(key, response);
      answer(socket, response);
    } catch (error) {
      answer(socket, { id: raw.id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  };

  const server = Net.createServer((socket) => {
    sockets.add(socket);
    let buffer = "";
    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let raw: { id?: unknown; method?: unknown; params?: unknown; auth?: unknown };
        try {
          raw = JSON.parse(trimmed) as typeof raw;
        } catch {
          answer(socket, { id: null, ok: false, error: "invalid json" });
          continue;
        }
        void onEnvelope(socket, raw);
      }
    });
    const drop = () => {
      sockets.delete(socket);
    };
    socket.on("close", drop);
    socket.on("error", drop);
  });

  await new Promise<void>((resolve) => server.listen(opts.port ?? 0, host, resolve));
  const address = server.address();
  const bound = typeof address === "object" && address !== null ? address.port : (opts.port ?? 0);
  return {
    port: bound,
    get token() {
      return token;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        for (const socket of sockets) socket.destroy();
        sockets.clear();
        server.close((error?: Error) => (error ? reject(error) : resolve()));
      }),
  };
};
