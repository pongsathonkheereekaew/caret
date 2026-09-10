// ACP adapter conformance (PX-24): negotiate, auth, session loop with
// diff-as-message, busy/unknown guards, approval translation — against a
// stub session API. No engine, no stdio loop (thin entry tracked open).
import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";

import { createAcpAdapter } from "./acp.ts";

const stubApi = () => {
  const calls: string[] = [];
  const wrap = (name: string, result: unknown) => () =>
    Effect.gen(function* () {
      calls.push(name);
      return result;
    });
  return {
    calls,
    api: {
      "session.start": wrap("session.start", { threadId: "t" }),
      "turn.send": wrap("turn.send", { state: "completed" }),
      "run.review": wrap("run.review", { diff: "+++ b/f.txt" }),
      "session.stop": wrap("session.stop", {}),
      "approval.answer": wrap("approval.answer", {}),
    },
  };
};

const runEffect = <A>(eff: Effect.Effect<A, unknown>): Promise<A> =>
  Effect.runPromise(eff as Effect.Effect<A, never>);

const setup = () => {
  const { calls, api } = stubApi();
  const sent: unknown[] = [];
  let n = 0;
  const adapter = createAcpAdapter({
    api,
    runEffect,
    notify: (msg) => sent.push(msg),
    expectedToken: "acp-token",
    newRunId: () => {
      n += 1;
      return `r${n}`;
    },
  });
  return { calls, sent, adapter };
};

const req = (id: number, method: string, params: Record<string, unknown> = {}) => ({ jsonrpc: "2.0", id, method, params });

describe("AcpAdapter", () => {
  it("negotiates and authenticates", async () => {
    const { adapter } = setup();
    const hello = (await adapter.handle(req(1, "initialize", { protocolVersion: 1 }))) as { result?: { protocolVersion?: number; authMethods?: unknown[] } };
    expect(hello.result?.protocolVersion).toBe(1);
    expect(hello.result?.authMethods).toHaveLength(1);
    expect(await adapter.handle(req(2, "authenticate", { methodId: "token", token: "acp-token" }))).toMatchObject({ id: 2, result: {} });
    expect(await adapter.handle(req(3, "authenticate", { methodId: "token", token: "nope" }))).toMatchObject({ id: 3, error: { code: -32000 } });
    expect(await adapter.handle(req(4, "nope.method"))).toMatchObject({ error: { code: -32601 } });
    expect(await adapter.handle({ jsonrpc: "1.0", id: 5, method: "initialize" })).toMatchObject({ error: { code: -32600 } });
  });

  it("runs new→prompt→cancel with diff-as-message", async () => {
    const { calls, sent, adapter } = setup();
    const opened = (await adapter.handle(req(10, "session/new", { cwd: "/tmp/r" }))) as { result?: { sessionId?: string } };
    const sessionId = opened.result?.sessionId ?? "";
    expect(sessionId.startsWith("caret-")).toBe(true);
    expect(await adapter.handle(req(11, "session/new", { cwd: "/tmp/r" }))).toMatchObject({ error: { code: -32000 } });
    const done = (await adapter.handle(
      req(12, "session/prompt", { sessionId, prompt: [{ type: "text", text: "hi" }] }),
    )) as { result?: { stopReason?: string } };
    expect(done.result?.stopReason).toBe("end_turn");
    const update = (sent as Array<{ method?: string; params?: { update?: { content?: Array<{ text?: string }> } } }>).find(
      (m) => m.method === "session/update",
    );
    expect(update?.params?.update?.content?.[0]?.text).toContain("f.txt");
    expect(calls).toEqual(["session.start", "turn.send", "run.review"]);
    expect(await adapter.handle(req(13, "session/prompt", { sessionId, prompt: [{ type: "image" }] }))).toMatchObject({
      error: { code: -32602 },
    });
    expect(await adapter.handle(req(14, "session/cancel", { sessionId }))).toMatchObject({ id: 14, result: {} });
    expect(adapter.session()).toBeNull();
    expect(await adapter.handle(req(15, "session/prompt", { sessionId, prompt: [{ type: "text", text: "x" }] }))).toMatchObject({
      error: { code: -32602 },
    });
  });

  it("translates approvals and answers them", async () => {
    const { calls, sent, adapter } = setup();
    adapter.onApiNotify({ event: "approval.requested", requestId: "a1" });
    adapter.onApiNotify({ event: "engine", type: "turn.completed" });
    const methods = (sent as Array<{ method?: string }>).map((m) => m.method);
    expect(methods).toEqual(["caret/approval", "caret/notify"]);
    expect(await adapter.handle(req(20, "caret/approve", { requestId: "a1", answer: "accept" }))).toMatchObject({ id: 20, result: {} });
    expect(calls).toContain("approval.answer");
  });
});
