import { expect, test } from "bun:test";
import { openNativeAgentIntent } from "../src/native-handoff";

test("IDE return selects the exact durable task, even when another project was active", async () => {
  const navigated: string[] = [];
  const reads: string[] = [];
  const api = { orchestration: {
    getShellSnapshot: async () => { throw new Error("Should not choose another task"); },
    getThreadDetailSnapshot: async ({ threadId }: { threadId: string }) => { reads.push(threadId); return {}; },
    dispatchCommand: async () => { throw new Error("Should not create a duplicate"); },
  } };
  await openNativeAgentIntent(api, undefined, { scheme: "cedia", authority: "session", path: "/existing-task" }, id => navigated.push(id));
  expect(reads).toEqual(["existing-task"]);
  expect(navigated).toEqual(["existing-task"]);
});

test("folder handoff reuses an existing project and task", async () => {
  const navigated: string[] = [];
  const api = { orchestration: {
    getShellSnapshot: async () => ({ projects: [{ id: "p", workspaceRoot: "/workspace" }], threads: [{ id: "t", projectId: "p", archivedAt: null }] }),
    getThreadDetailSnapshot: async () => ({}),
    dispatchCommand: async () => { throw new Error("Should not create a duplicate"); },
  } };
  await openNativeAgentIntent(api, { scheme: "file", path: "/workspace" }, undefined, id => navigated.push(id));
  expect(navigated).toEqual(["t"]);
  await openNativeAgentIntent(api, undefined, undefined, id => navigated.push(id));
  expect(navigated).toEqual(["t"]);
});
