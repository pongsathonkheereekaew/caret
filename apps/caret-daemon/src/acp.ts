// Caret ACP adapter (PX-24 seed): Agent Client Protocol JSON-RPC over the
// session API. V1 scope, honestly bounded: initialize / authenticate
// (pairing token) / session new+prompt+cancel, review diff as the turn's
// message content, approvals as `caret/approval` notifications with a
// `caret/approve` answer method. NOT here: streaming message chunks (one
// message content, engine-event streaming as agent_message_chunk updates,
// approvals as `caret/approval` notifications with a `caret/approve`
// answer method, NDJSON stdio framing (`serveAcpLines`, also used by
// serve-acp.ts). NOT here: image/audio blocks (turn.send is string-only),
// multi-session (one live run — a second new fails loudly, matching the
// session API one-live-subscription design), ACP-native permission
// round-trips (extension notification + method instead).
import * as Effect from "effect/Effect";

export type AcpHandler = (params: never) => Effect.Effect<unknown, unknown>;

export interface AcpRequest {
  jsonrpc?: string;
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
}

/**
 * Thin NDJSON stdio framing around handle(): lines in, responses out.
 * serve-acp.ts uses this with real stdin/stdout; keepers drive it with
 * in-memory streams so the framing is pinned without booting a daemon.
 */
export const serveAcpLines = async (opts: {
  lines: AsyncIterable<string>;
  send: (msg: unknown) => void;
  handle: (message: AcpRequest) => Promise<unknown>;
}): Promise<void> => {
  for await (const line of opts.lines) {
    const trimmed = String(line).trim();
    if (!trimmed) continue;
    try {
      opts.send(await opts.handle(JSON.parse(trimmed) as AcpRequest));
    } catch {
      opts.send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
    }
  }
};

const ok = (id: string | number, result: unknown) => ({ jsonrpc: "2.0", id, result });
const fail = (id: string | number | null, code: number, message: string) => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

export const createAcpAdapter = (deps: {
  api: Record<string, AcpHandler>;
  runEffect: <A>(eff: Effect.Effect<A, unknown>) => Promise<A>;
  /** Outbound JSON-RPC notifications toward the ACP client. */
  notify: (msg: unknown) => void;
  expectedToken: string;
  newRunId: () => string;
}) => {
  const { api, runEffect, notify } = deps;
  let liveSession: string | null = null;

  const run = async (method: string, params: unknown): Promise<unknown> => {
    const handler = api[method];
    if (!handler) throw new Error(`no session method ${method}`);
    return runEffect(handler(params as never));
  };

  const textOf = (prompt: unknown): string => {
    if (!Array.isArray(prompt)) throw new Error("prompt must be an array");
    const parts: string[] = [];
    for (const block of prompt) {
      const entry = block as { type?: unknown; text?: unknown };
      if (entry.type !== "text") {
        throw new Error(`V1 supports text blocks only (got ${String(entry.type)})`);
      }
      if (typeof entry.text !== "string") throw new Error("text block needs a string");
      parts.push(entry.text);
    }
    return parts.join("\n");
  };

  const requireSession = (sessionId: unknown): void => {
    if (typeof sessionId !== "string" || sessionId !== liveSession) {
      throw new Error(`unknown session ${String(sessionId)}`);
    }
  };

  /**
   * Translate session-API notifications for the ACP client. Engine events
   * carrying text detail stream as `session/update` agent_message_chunk
   * updates for the live session; everything else keeps the caret/*
   * extension channel. With no live session there is nothing to attribute
   * a chunk to, so events fall back to caret/notify.
   */
  const onApiNotify = (msg: { event?: unknown; [key: string]: unknown }): void => {
    if (msg.event === "approval.requested") {
      notify({ jsonrpc: "2.0", method: "caret/approval", params: msg });
    } else if (msg.event === "engine" && typeof msg.detail === "string" && liveSession) {
      notify({
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          sessionId: liveSession,
          update: { sessionUpdate: "agent_message_chunk", content: [{ type: "text", text: msg.detail }] },
        },
      });
    } else {
      notify({ jsonrpc: "2.0", method: "caret/notify", params: msg });
    }
  };

  const handle = async (message: AcpRequest): Promise<unknown> => {
    const id = message.id ?? null;
    try {
      if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
        return fail(id, -32600, "invalid request envelope");
      }
      switch (message.method) {
        case "initialize": {
          return ok(id as string | number, {
            protocolVersion: 1,
            agentCapabilities: {
              promptCapabilities: { text: true, image: false, audio: false },
              mcpCapabilities: { http: false, stdio: false, sse: false },
            },
            authMethods: [{ id: "token", name: "Pairing token" }],
          });
        }
        case "authenticate": {
          const params = message.params ?? {};
          if (params["methodId"] !== "token" || params["token"] !== deps.expectedToken) {
            return fail(id, -32000, "authentication failed");
          }
          return ok(id as string | number, {});
        }
        case "session/new": {
          if (liveSession) {
            return fail(id, -32000, "one live session (V1 scope): cancel it first");
          }
          const params = message.params ?? {};
          const runId = deps.newRunId();
          await run("session.start", { repoDir: String(params["cwd"] ?? ""), runId });
          liveSession = `caret-${runId}`;
          return ok(id as string | number, { sessionId: liveSession });
        }
        case "session/prompt": {
          const params = message.params ?? {};
          requireSession(params["sessionId"]);
          const input = textOf(params["prompt"]);
          await run("turn.send", { input });
          const review = (await run("run.review", {})) as { diff?: unknown };
          const diff = typeof review.diff === "string" ? review.diff : "";
          if (diff) {
            notify({
              jsonrpc: "2.0",
              method: "session/update",
              params: {
                sessionId: liveSession,
                update: { sessionUpdate: "agent_message_chunk", content: [{ type: "text", text: diff }] },
              },
            });
          }
          return ok(id as string | number, { stopReason: "end_turn" });
        }
        case "session/cancel": {
          const params = message.params ?? {};
          requireSession(params["sessionId"]);
          await run("session.stop", {}).catch(() => {});
          liveSession = null;
          return ok(id as string | number, {});
        }
        case "caret/approve": {
          const params = message.params ?? {};
          await run("approval.answer", {
            requestId: String(params["requestId"] ?? ""),
            answer: params["answer"] === "decline" ? "decline" : "accept",
          });
          return ok(id as string | number, {});
        }
        default:
          return fail(id, -32601, `unknown method ${message.method}`);
      }
    } catch (error) {
      return fail(id, -32602, error instanceof Error ? error.message : String(error));
    }
  };

  return { handle, onApiNotify, session: () => liveSession };
};
