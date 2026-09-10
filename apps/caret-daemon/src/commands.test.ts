// Headless command conformance (PX-25): output lines, usage errors,
// refusal branches — against an in-memory client double. No network.
import { describe, expect, it } from "vitest";

import {
  cmdStatus,
  cmdStart,
  cmdSend,
  cmdSteer,
  cmdAnswer,
  cmdReview,
  cmdReject,
  cmdBringBack,
  cmdList,
  cmdRemove,
  cmdExport,
  cmdStop,
  createApprovalLoop,
  createJsonLog,
} from "./commands.ts";
import type { CaretClient } from "./client.ts";

const stubClient = (over: Record<string, unknown> = {}): CaretClient => {
  const calls: string[] = [];
  const base: Record<string, (...args: never[]) => unknown> = {
    pairingStatus: async () => ({ paired: true }),
    startSession: async () => ({ threadId: "caret-test-1" }),
    sendTurn: async () => ({ state: "completed" }),
    steerTurn: async () => ({ steered: true }),
    answerApproval: async () => ({}),
    reviewRun: async () => ({ diff: "a\n".repeat(100) }),
    rejectRun: async () => ({ reversed: true }),
    bringBackRun: async () => ({ brought: true }),
    listRuns: async () => ({ runs: ["/tmp/caret-wt-x", "/tmp/caret-wt-y"] }),
    removeRun: async () => ({ removed: true }),
    exportRun: async () => ({ path: "/tmp/out/bundle.json", files: 2, events: 9 }),
    stopSession: async () => ({}),
    ...over,
  };
  const proxy = new Proxy(base, {
    get: (target, prop: string) => {
      const fn = target[prop];
      if (typeof fn !== "function") throw new Error(`unstubbed ${prop}`);
      return (...args: never[]) => {
        calls.push(prop);
        return fn(...args);
      };
    },
  });
  (proxy as Record<string, unknown>)["calls"] = calls;
  return proxy as unknown as CaretClient;
};

const run = async (fn: (c: CaretClient, log: (l: string) => void, ...a: never[]) => Promise<void>, client: CaretClient, ...args: never[]) => {
  const lines: string[] = [];
  await fn(client, (line) => lines.push(line), ...args);
  return lines;
};

describe("HeadlessCommands", () => {
  it("reports status and starts sessions with usage guard", async () => {
    expect(await run(cmdStatus, stubClient())).toEqual(["paired: true"]);
    expect(await run(cmdStart, stubClient(), "r" as never, "run-1" as never)).toEqual(["thread: caret-test-1"]);
    await expect(run(cmdStart, stubClient(), "" as never, "" as never)).rejects.toThrow(/usage/);
    await expect(run(cmdSend, stubClient(), "  " as never)).rejects.toThrow(/usage/);
  });

  it("sends, steers, and answers explicitly", async () => {
    expect(await run(cmdSend, stubClient(), "hi" as never)).toEqual(["turn: completed"]);
    expect(await run(cmdSteer, stubClient(), "more" as never)).toEqual(["steered: true"]);
    expect(await run(cmdAnswer, stubClient(), "a1" as never, "accept" as never)).toEqual(["approval a1: accept"]);
    await expect(run(cmdAnswer, stubClient(), "a1" as never, "maybe" as never)).rejects.toThrow(/usage/);
    await expect(run(cmdAnswer, stubClient(), "" as never, "accept" as never)).rejects.toThrow(/usage/);
  });

  it("passes explicit send ids for safe retry", async () => {
    const seen: Array<{ input: string; id: unknown }> = [];
    const client = stubClient({
      sendTurn: (async (input: string, id: unknown) => {
        seen.push({ input, id });
        return { state: "completed" };
      }) as never,
    });
    expect(await run(cmdSend, client, "hi" as never, 77 as never)).toEqual(["turn: completed"]);
    expect(seen).toEqual([{ input: "hi", id: 77 }]);
  });

  it("renders review truncated and both refusal branches", async () => {
    const review = await run(cmdReview, stubClient());
    expect(review[0]).toBe("diff 200 chars:");
    expect(review).toHaveLength(41);
    expect(await run(cmdReject, stubClient())).toEqual(["reversed: true"]);
    expect(await run(cmdBringBack, stubClient())).toEqual(["brought back onto the main checkout"]);
    const refused = stubClient({ bringBackRun: async () => ({ brought: false }) });
    expect(await run(cmdBringBack, refused)).toEqual(["bring-back refused — resolve conflicts first"]);
    const dirty = stubClient({ removeRun: async () => ({ removed: false }) });
    expect(await run(cmdRemove, dirty, "/tmp/w" as never)).toEqual(["refused — dirty run, review or reject first"]);
    await expect(run(cmdRemove, stubClient(), "" as never)).rejects.toThrow(/usage/);
  });

  it("lists, exports, and stops", async () => {
    const listed = await run(cmdList, stubClient());
    expect(listed).toHaveLength(2);
    expect(listed[0]).toContain("caret-wt-x");
    expect(await run(cmdList, stubClient({ listRuns: async () => ({ runs: [] }) }))).toEqual(["no isolated runs"]);
    expect(await run(cmdExport, stubClient(), "/tmp/out" as never, false as never)).toEqual([
      "exported 2 files, 9 events → /tmp/out/bundle.json",
    ]);
    await expect(run(cmdExport, stubClient(), "" as never, false as never)).rejects.toThrow(/usage/);
    expect(await run(cmdStop, stubClient())).toEqual(["stopped"]);
  });

  it("envelopes command lines as one JSON object", async () => {
    const out: string[] = [];
    const json = createJsonLog("status", (line) => out.push(line));
    await cmdStatus(stubClient(), json.log);
    json.finish();
    expect(out).toHaveLength(1);
    expect(JSON.parse(out[0] ?? "")).toEqual({ command: "status", ok: true, lines: ["paired: true"] });
    const failed: string[] = [];
    const bad = createJsonLog("start", (line) => failed.push(line));
    try {
      await cmdStart(stubClient(), bad.log, "" as never, "" as never);
      bad.finish();
    } catch (error) {
      bad.finish(error);
    }
    expect(failed).toHaveLength(1);
    expect(JSON.parse(failed[0] ?? "")).toMatchObject({ command: "start", ok: false, error: expect.stringMatching(/usage/) });
  });

  it("asks once per approval id, defaulting to decline", async () => {
    const answered: Array<{ id: string; verdict: string }> = [];
    const lines: string[] = [];
    const answers = ["y", ""];
    const loop = createApprovalLoop({
      answer: (async (id: string, verdict: "accept" | "decline") => {
        answered.push({ id, verdict });
      }) as never,
      ask: (async () => answers.shift() ?? "") as never,
      log: (line) => lines.push(line),
    });
    await loop.push({ event: "approval.requested", requestId: "a1", requestType: "shell", detail: "rm -rf /" });
    await loop.push({ event: "approval.requested", requestId: "a1" });
    await loop.push({ event: "approval.requested", requestId: "a2" });
    await loop.push({ event: "engine", type: "turn.completed" });
    expect(answered).toEqual([
      { id: "a1", verdict: "accept" },
      { id: "a2", verdict: "decline" },
    ]);
    expect(lines).toEqual(["approval a1: accept", "approval a2: decline"]);
  });
});
