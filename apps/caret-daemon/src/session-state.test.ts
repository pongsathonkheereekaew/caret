// Session state conformance (parity §10): transition legality, runtime
// availability honesty, event catalog integrity. Pure sync.
import { describe, expect, it } from "vitest";

import {
  canTransition,
  AVAILABLE_RUNTIMES,
  EMITTED_EVENTS,
  TARGET_EVENTS,
  shouldForwardEngineEvent,
  engineRowKind,
  type AgentSessionStatus,
} from "./session-state.ts";

const ALL: AgentSessionStatus[] = [
  "draft", "queued", "starting", "running", "waitingForUser",
  "waitingForApproval", "steering", "reviewing", "completed", "failed", "cancelled",
];

describe("SessionState", () => {
  it("walks the happy path and blocks teleporting", () => {
    const path: AgentSessionStatus[] = ["draft", "queued", "starting", "running", "waitingForApproval", "running", "reviewing", "completed"];
    for (let i = 1; i < path.length; i++) {
      expect(canTransition(path[i - 1] as AgentSessionStatus, path[i] as AgentSessionStatus)).toBe(true);
    }
    expect(canTransition("completed", "failed")).toBe(false);
    expect(canTransition("draft", "completed")).toBe(false);
    expect(canTransition("failed", "reviewing")).toBe(false);
    expect(canTransition("cancelled", "completed")).toBe(false);
  });

  it("reopens only through explicit user intent", () => {
    expect(canTransition("completed", "running")).toBe(true);
    expect(canTransition("failed", "starting")).toBe(true);
    expect(canTransition("cancelled", "starting")).toBe(true);
    expect(canTransition("completed", "starting")).toBe(false);
  });

  it("admits only local runtime on this machine", () => {
    expect(AVAILABLE_RUNTIMES).toEqual(["local"]);
  });

  it("keeps the event catalog duplicate-free and honest", () => {
    const names = TARGET_EVENTS;
    expect(new Set(names).size).toBe(names.length);
    for (const emitted of EMITTED_EVENTS) {
      expect(emitted.state).toBe("emitted");
      expect(names).toContain(emitted.name);
    }
    expect(names).toContain("tool.approvalRequested");
    expect(names).toContain("checkpoint.restored");
  });

  it("covers every status in the transition table", () => {
    for (const status of ALL) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("forwards states, drops deltas and the approval duplicate", () => {
    expect(shouldForwardEngineEvent("turn.completed")).toBe(true);
    expect(shouldForwardEngineEvent("thread.started")).toBe(true);
    expect(shouldForwardEngineEvent("checkpoint.created")).toBe(true);
    expect(shouldForwardEngineEvent("assistant.messageDelta")).toBe(false);
    expect(shouldForwardEngineEvent("tool.progress.delta")).toBe(false);
    expect(shouldForwardEngineEvent("request.opened")).toBe(false);
    expect(shouldForwardEngineEvent("")).toBe(false);
    expect(shouldForwardEngineEvent(undefined)).toBe(false);
    expect(engineRowKind("turn.failed")).toBe("failed");
    expect(engineRowKind("session/threadOpenResolved")).toBe("done");
    expect(engineRowKind("thread.started")).toBe("start");
    expect(engineRowKind("something.unknown")).toBe("info");
  });
});
