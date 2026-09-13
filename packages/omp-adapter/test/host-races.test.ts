import { expect, it } from "bun:test";
import { OmpHostDispatcher } from "../src/host.ts";
import type { OmpHostOutboundFrame } from "../src/host.ts";

const definition = { name: "fixture", description: "fixture", parameters: { type: "object" } };
const request = { type: "host_tool_call", id: "request-1", toolCallId: "tool-1", toolName: "fixture", arguments: {} };

async function settlesWithin(promise: Promise<unknown>, milliseconds: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), milliseconds); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

it("bounds the whole invocation when many queued updates have a stuck writer", async () => {
  const sends: OmpHostOutboundFrame[] = [];
  const bridge = new OmpHostDispatcher({ requestTimeoutMs: 10, authorize: () => true,
    send: frame => { sends.push(frame); return new Promise<void>(() => {}); },
  });
  bridge.registerTool({ definition, handler: (_request, context) => {
    for (let i = 0; i < 50; i++) void context.update(`update ${i}`);
    return "done";
  } });
  try {
    expect(await settlesWithin(bridge.handle(request), 150)).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 30));
    // An already-invoked writer cannot be recalled; unsent backlog must stop.
    expect(sends.length).toBeLessThanOrEqual(2);
    expect(sends.filter(frame => frame.type === "host_tool_result" && frame.isError !== true)).toHaveLength(0);
    expect(bridge.pendingCount).toBe(0);
  } finally { bridge.dispose(); }
});

it("cancels a terminal result still queued behind an update", async () => {
  const sends: OmpHostOutboundFrame[] = [];
  let release!: () => void;
  let updateEntered!: () => void;
  const updateReady = new Promise<void>(resolve => { updateEntered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const bridge = new OmpHostDispatcher({ requestTimeoutMs: 1_000, authorize: () => true,
    send: frame => {
      sends.push(frame);
      if (frame.type === "host_tool_update") { updateEntered(); return gate; }
    },
  });
  bridge.registerTool({ definition, handler: (_request, context) => {
    void context.update("pending update");
    return "queued terminal";
  } });
  try {
    const handled = bridge.handle(request);
    await updateReady;
    expect(await bridge.handle({ type: "host_tool_cancel", id: "cancel-1", targetId: request.id })).toBe(true);
    expect(await settlesWithin(handled, 100)).toBe(true);
    release();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(sends.map(frame => frame.type)).toEqual(["host_tool_update"]);
  } finally { release(); bridge.dispose(); }
});

it("disposal settles a call even when authorization never returns", async () => {
  let authorizeEntered!: () => void;
  const entered = new Promise<void>(resolve => { authorizeEntered = resolve; });
  let effects = 0;
  const bridge = new OmpHostDispatcher({ send: () => {}, authorize: () => {
    authorizeEntered();
    return new Promise<boolean>(() => {});
  } });
  bridge.registerTool({ definition, handler: () => { effects++; return "effect"; } });
  const handled = bridge.handle(request);
  await entered;
  bridge.dispose();
  expect(await settlesWithin(handled, 100)).toBe(true);
  expect(effects).toBe(0);
});

it("does not run a handler after authorization blocks the event loop past expiry", async () => {
  const sends: OmpHostOutboundFrame[] = [];
  let effects = 0;
  const bridge = new OmpHostDispatcher({ requestTimeoutMs: 5,
    send: frame => { sends.push(frame); }, authorize: () => {
      const start = performance.now();
      while (performance.now() - start < 15) { /* Expire before timer runs. */ }
      return true;
    },
  });
  bridge.registerTool({ definition, handler: () => { effects++; return "must not run"; } });
  try {
    await bridge.handle(request);
    expect(effects).toBe(0);
    expect(sends).toHaveLength(1);
    expect(sends[0]).toMatchObject({ type: "host_tool_result", isError: true });
  } finally { bridge.dispose(); }
});

it("does not send a malformed duplicate error while the valid request is authorized", async () => {
  const sends: OmpHostOutboundFrame[] = [];
  let authorize!: (allowed: boolean) => void;
  let effects = 0;
  const gate = new Promise<boolean>(resolve => { authorize = resolve; });
  const bridge = new OmpHostDispatcher({ send: frame => { sends.push(frame); }, authorize: () => gate });
  bridge.registerTool({ definition, handler: () => { effects++; return "done"; } });
  try {
    const handled = bridge.handle(request);
    await bridge.handle({ ...request, arguments: null });
    expect(sends).toHaveLength(0);
    authorize(true);
    await handled;
    expect(effects).toBe(1);
    expect(sends).toHaveLength(1);
    await bridge.handle({ ...request, id: "invalid-first", arguments: null });
    await bridge.handle({ ...request, id: "invalid-first" });
    expect(effects).toBe(1);
    expect(sends).toHaveLength(2);
  } finally { authorize(false); bridge.dispose(); }
});

it("authorizes the exact frozen JSON snapshot including prototype-named keys", async () => {
  let release!: (allowed: boolean) => void;
  const gate = new Promise<boolean>(resolve => { release = resolve; });
  const raw = { ...request, arguments: JSON.parse('{"path":"original","nested":[1],"__proto__":{"path":"injected"}}') };
  let authorized: unknown;
  let executed: unknown;
  const bridge = new OmpHostDispatcher({ send: () => {}, authorize: current => { authorized = current; return gate; } });
  bridge.registerTool({ definition, handler: current => { executed = current; return "done"; } });
  try {
    const handled = bridge.handle(raw);
    raw.arguments.path = "changed";
    raw.arguments.nested.push(2);
    release(true);
    await handled;
    expect(executed).toBe(authorized);
    const args = (executed as typeof raw).arguments;
    expect(args.path).toBe("original");
    expect(args.nested).toEqual([1]);
    expect(Object.hasOwn(args, "__proto__")).toBe(true);
    expect(Object.isFrozen(args.__proto__)).toBe(true);
    expect(Object.getPrototypeOf(args)).toBe(Object.prototype);
  } finally { release(false); bridge.dispose(); }
});

it("drops an overdue terminal send when an update resolves before its timer callback", async () => {
  const sends: OmpHostOutboundFrame[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const bridge = new OmpHostDispatcher({ requestTimeoutMs: 10, authorize: () => true,
    send: frame => { sends.push(frame); if (frame.type === "host_tool_update") return gate; },
  });
  bridge.registerTool({ definition, handler: (_request, context) => {
    void context.update("pending update");
    return "overdue result";
  } });
  try {
    const handled = bridge.handle(request);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(sends).toHaveLength(1);
    const start = performance.now();
    while (performance.now() - start < 25) { /* Block timer while output deadline expires. */ }
    release();
    await handled;
    expect(sends.map(frame => frame.type)).toEqual(["host_tool_update"]);
  } finally { release(); bridge.dispose(); }
});
