import { describe, expect, test } from "bun:test";
import { commandFailurePlan } from "../core/command-recovery.ts";

function coded(message: string, code: unknown): Error {
  return Object.assign(new Error(message), { code });
}

describe("command failure recovery plan", () => {
  test("plans a bounded refresh-and-retry for a refused stale incarnation", () => {
    const error = coded("Refresh the task before submitting this command", "stale_incarnation");
    expect(commandFailurePlan(error)).toBe("refresh_and_retry");
    expect(commandFailurePlan(error, 1)).toBe("refresh_and_retry");
    expect(commandFailurePlan(error, 2)).toBe("unknown");
    expect(commandFailurePlan(error, 3)).toBe("unknown");
  });

  test("plans a bounded refresh-and-retry while the host is still starting the session", () => {
    const error = coded("The OMP session is starting; retry when it is ready", "session_starting");
    expect(commandFailurePlan(error)).toBe("refresh_and_retry");
    expect(commandFailurePlan(error, 2)).toBe("unknown");
  });

  test("surfaces recovery when the host requires reconciliation", () => {
    expect(commandFailurePlan(coded("Reconcile the task", "recovery_required"))).toBe("surface_recovery");
    expect(commandFailurePlan({ code: "recovery_required" }, 2)).toBe("surface_recovery");
  });

  test("treats plain errors and non-host codes as unknown", () => {
    expect(commandFailurePlan(new Error("boom"))).toBe("unknown");
    expect(commandFailurePlan({ code: 42 })).toBe("unknown");
    expect(commandFailurePlan({ code: "" })).toBe("unknown");
    expect(commandFailurePlan({ code: "something_else" })).toBe("unknown");
    expect(commandFailurePlan(undefined)).toBe("unknown");
    expect(commandFailurePlan(null)).toBe("unknown");
    expect(commandFailurePlan("stale_incarnation")).toBe("unknown");
  });
});
