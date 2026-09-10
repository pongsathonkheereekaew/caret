// Audit trail conformance (M11 seed): ordering with bad timestamps,
// decision extraction, counts, malformed tolerance. Pure sync.
import { describe, expect, it } from "vitest";

import { buildAuditTrail, approvalDecisions, countByType } from "./audit.ts";

describe("AuditTrail", () => {
  it("orders the timeline and carries malformed rows visibly", () => {
    const trail = buildAuditTrail([
      { t: "2026-09-10T02:00:00Z", type: "turn.completed", payload: { state: "completed" } },
      { t: "2026-09-10T01:00:00Z", type: "request.resolved", payload: { requestType: "command", decision: "accept" } },
      { type: "caret.run.isolated", workDir: "/tmp/wt-1" },
      {},
    ]);
    expect(trail.map((e) => e.type)).toEqual([
      "caret.run.isolated",
      "unknown",
      "request.resolved",
      "turn.completed",
    ]);
    expect(trail[0]).toMatchObject({ t: "", summary: "workdir /tmp/wt-1" });
    expect(trail[1]).toMatchObject({ t: "", type: "unknown" });
    expect(trail[2]).toMatchObject({ summary: "command → accept" });
    expect(trail[3].summary).toContain("completed");
  });

  it("extracts the approval record and counts by type", () => {
    const events = [
      { t: "t1", type: "request.resolved", payload: { requestType: "command", decision: "accept" } },
      { t: "t2", type: "request.resolved", payload: { requestType: "command", decision: "decline" } },
      { t: "t3", type: "request.resolved", payload: {} },
      { t: "t4", type: "caret.run.setup", payload: "x" },
    ];
    // Last decision per type wins (same rule as handoff assembly).
    expect(approvalDecisions(events)).toEqual([{ type: "command", decision: "decline" }]);
    expect(countByType(events)).toEqual({ "request.resolved": 3, "caret.run.setup": 1 });
    expect(countByType([])).toEqual({});
  });
});
