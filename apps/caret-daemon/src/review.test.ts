// Review model conformance (parity §5): state machine, finding
// lifecycle, validation. Pure sync.
import { describe, expect, it } from "vitest";

import {
  createReview,
  addFinding,
  setFindingStatus,
  openFindings,
  canReviewTransition,
} from "./review.ts";

describe("AgentReview", () => {
  it("walks review to merge and blocks jumps", () => {
    const path = ["changesAvailable", "reviewQueued", "reviewRunning", "findingsAvailable", "approved", "committed", "pullRequestOpened", "merged"] as const;
    for (let i = 1; i < path.length; i++) {
      expect(canReviewTransition(path[i - 1], path[i])).toBe(true);
    }
    expect(canReviewTransition("noChanges", "merged")).toBe(false);
    expect(canReviewTransition("merged", "approved")).toBe(false);
    expect(canReviewTransition("failed", "merged")).toBe(false);
    expect(canReviewTransition("approved", "merged")).toBe(false);
  });

  it("starts empty or changeless and manages findings", () => {
    const empty = createReview("r0", "t0", false);
    expect(empty.state).toBe("noChanges");
    expect(empty.findings).toEqual([]);
    let review = createReview("r1", "t1", true);
    review = addFinding(review, { file: "a.ts", line: 3, severity: "error", message: "null deref" });
    review = addFinding(review, { file: "b.ts", message: "typo" });
    expect(review.findings).toHaveLength(2);
    expect(review.findings[1]).toMatchObject({ file: "b.ts", line: null, severity: "info", status: "open" });
    expect(openFindings(review)).toHaveLength(2);
    review = setFindingStatus(review, review.findings[0]?.id ?? "", "dismissed");
    expect(openFindings(review)).toHaveLength(1);
    review = setFindingStatus(review, review.findings[1]?.id ?? "", "fixed");
    expect(openFindings(review)).toHaveLength(0);
    expect(() => setFindingStatus(review, "f999", "fixed")).toThrow(/unknown finding/);
    expect(() => addFinding(review, { file: "", message: "x" })).toThrow(/file \+ message/);
  });
});
