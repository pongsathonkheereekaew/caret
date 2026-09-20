import { describe, expect, it } from "bun:test";

import { CediaHost } from "../src/service.ts";
import type { DurableStore } from "../src/store.ts";
import {
  type WorkspaceJudge,
  TYPESAFE_API_KEY_ENV,
  WORKSPACE_SUGGESTION_ENV,
  WORKSPACE_SUGGESTION_MODE,
  suggestWorkspaceMode,
  suggestionFromProbability,
  suggestionFromResponse,
  workspaceJudgeFromEnv,
} from "../src/workspace-mode.ts";

/** G0: every judge here is a local stub, so no test in this file can reach a provider. */
const stubJudge = (result: { mode: "local" | "worktree"; probability: number; confidence: number } | undefined): WorkspaceJudge =>
  ({ suggest: async () => result });

describe("workspace suggestion mapping", () => {
  it("turns a yes/no probability into a mode with its distance from the midpoint", () => {
    expect(suggestionFromProbability(0.9)).toEqual({ mode: "worktree", probability: 0.9, confidence: 0.8 });
    expect(suggestionFromProbability(0.1)).toEqual({ mode: "local", probability: 0.1, confidence: 0.8 });
    expect(suggestionFromProbability(0.5)).toEqual({ mode: "worktree", probability: 0.5, confidence: 0 });
  });

  it("refuses a probability that is not a probability", () => {
    for (const value of [Number.NaN, -0.01, 1.01, Number.POSITIVE_INFINITY]) {
      expect(suggestionFromProbability(value)).toBeUndefined();
    }
  });

  it("reads only the answer shape it asked for", () => {
    const payload = { answers: { isolation_needed: { type: "noul", noul: 0.82 } } };
    expect(suggestionFromResponse(payload)).toMatchObject({ mode: "worktree", probability: 0.82 });
    expect(suggestionFromResponse({ answers: {} })).toBeUndefined();
    expect(suggestionFromResponse({ answers: { isolation_needed: { type: "choice", choice: "worktree" } } })).toBeUndefined();
    expect(suggestionFromResponse({ answers: { isolation_needed: { type: "noul", noul: "0.8" } } })).toBeUndefined();
    expect(suggestionFromResponse(null)).toBeUndefined();
  });
});

describe("workspace suggestion deadline", () => {
  it("gives up instead of holding a caller open", async () => {
    const hanging: WorkspaceJudge = { suggest: () => new Promise(() => {}) };
    const started = Date.now();
    expect(await suggestWorkspaceMode(hanging, "delete the stale worktrees", 40)).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("treats a judge failure as no opinion rather than an error", async () => {
    const failing: WorkspaceJudge = { suggest: async () => { throw new Error("offline"); } };
    expect(await suggestWorkspaceMode(failing, "rewrite the history", 40)).toBeUndefined();
  });

  it("does not ask at all when there is no prompt to judge", async () => {
    let asked = 0;
    const counting: WorkspaceJudge = { suggest: async () => { asked++; return undefined; } };
    expect(await suggestWorkspaceMode(counting, "   ")).toBeUndefined();
    expect(asked).toBe(0);
  });
});

describe("workspace judge opt-in", () => {
  it("stays off unless the operator turned it on and supplied a key", () => {
    expect(workspaceJudgeFromEnv({})).toBeUndefined();
    expect(workspaceJudgeFromEnv({ [WORKSPACE_SUGGESTION_ENV]: "off", [TYPESAFE_API_KEY_ENV]: "key" })).toBeUndefined();
    expect(workspaceJudgeFromEnv({ [WORKSPACE_SUGGESTION_ENV]: WORKSPACE_SUGGESTION_MODE })).toBeUndefined();
    expect(workspaceJudgeFromEnv({ [WORKSPACE_SUGGESTION_ENV]: WORKSPACE_SUGGESTION_MODE, [TYPESAFE_API_KEY_ENV]: "key" })).toBeDefined();
  });
});

describe("host wiring", () => {
  const host = (judge?: WorkspaceJudge) => new CediaHost({
    store: {} as DurableStore,
    stateDir: "/tmp/cedia-workspace-mode-test",
    ...(judge ? { workspaceJudge: judge } : {}),
  });

  it("returns the configured judge's suggestion", async () => {
    const suggestion = await host(stubJudge({ mode: "worktree", probability: 0.91, confidence: 0.82 })).suggestWorkspaceMode("drop the local database");
    expect(suggestion).toEqual({ mode: "worktree", probability: 0.91, confidence: 0.82 });
  });

  it("has no opinion when no judge is configured", async () => {
    // The default for every existing caller: the endpoint answers `mode: null`, and
    // `createSession` keeps choosing local or worktree exactly as it did before.
    expect(await host().suggestWorkspaceMode("do something risky")).toBeUndefined();
  });
});
