// Caret ACP adapter (PX-24 seed): Agent Client Protocol JSON-RPC over the
// session API. V1 scope, honestly bounded: initialize / authenticate
// (pairing token) / session new+prompt+cancel, review diff as the turn's
// message content, approvals as `caret/approval` notifications with a
// `caret/approve` answer method. NOT here: streaming message chunks (one
// content update per turn), image/audio blocks, multi-session (one live
// run — a second new fails loudly), ACP-native permission round-trips
// (extension notification + method instead).
import * as Effect from "effect/Effect";

export type AcpHandler = (params: never) => Effect.Effect<unknown, unknown>;

interface AcpRequest {
  jsonrpc?: string;
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
}

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

  /** Translate session-API notifications for the ACP client. */
  const onApiNotify = (msg: { event?: unknown; [key: string]: unknown }): void => {
    if (msg.event === "approval.requested") {
      notify({ jsonrpc: "2.0", method: "caret/approval", params: msg });
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
