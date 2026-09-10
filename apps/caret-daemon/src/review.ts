// Caret review model (parity §5 data half): review state machine +
// finding lifecycle. Pure — no I/O, no model. The diff text comes from
// run.review; findings attach to it here. Rendering + Monaco overlay ride
// the UI track; depth automation (auto-review) is tracked, not started.
export type ReviewState =
  | "noChanges"
  | "changesAvailable"
  | "reviewQueued"
  | "reviewRunning"
  | "findingsAvailable"
  | "approved"
  | "committed"
  | "pullRequestOpened"
  | "merged"
  | "failed";

export type FindingSeverity = "info" | "warning" | "error";
export type FindingStatus = "open" | "dismissed" | "fixed";

export interface ReviewFinding {
  readonly id: string;
  readonly file: string;
  readonly line: number | null;
  readonly severity: FindingSeverity;
  readonly message: string;
  readonly status: FindingStatus;
}

export interface AgentReview {
  readonly id: string;
  readonly threadId: string;
  readonly state: ReviewState;
  readonly findings: ReadonlyArray<ReviewFinding>;
}

const TRANSITIONS: Record<ReviewState, ReadonlyArray<ReviewState>> = {
  noChanges: ["changesAvailable", "failed"],
  changesAvailable: ["reviewQueued", "approved", "committed", "failed"],
  reviewQueued: ["reviewRunning", "failed"],
  reviewRunning: ["findingsAvailable", "approved", "failed"],
  findingsAvailable: ["approved", "reviewQueued", "failed"],
  approved: ["committed", "reviewQueued"],
  committed: ["pullRequestOpened", "changesAvailable"],
  pullRequestOpened: ["merged", "failed"],
  merged: [],
  failed: ["reviewQueued"],
};

export const canReviewTransition = (from: ReviewState, to: ReviewState): boolean =>
  TRANSITIONS[from]?.includes(to) ?? false;

let findingSerial = 0;

export const createReview = (id: string, threadId: string, hasChanges: boolean): AgentReview => ({
  id,
  threadId,
  state: hasChanges ? "changesAvailable" : "noChanges",
  findings: [],
});

export const addFinding = (
  review: AgentReview,
  finding: { file: string; line?: number; severity?: FindingSeverity; message: string },
): AgentReview => {
  if (!finding.file || !finding.message) {
    throw new Error("finding needs file + message");
  }
  findingSerial += 1;
  return {
    ...review,
    findings: [
      ...review.findings,
      {
        id: `f${findingSerial}`,
        file: finding.file,
        line: finding.line ?? null,
        severity: finding.severity ?? "info",
        message: finding.message,
        status: "open",
      },
    ],
  };
};

export const setFindingStatus = (review: AgentReview, id: string, status: FindingStatus): AgentReview => {
  let seen = false;
  const findings = review.findings.map((finding) => {
    if (finding.id !== id) return finding;
    seen = true;
    return { ...finding, status };
  });
  if (!seen) throw new Error(`unknown finding ${id}`);
  return { ...review, findings };
};

export const openFindings = (review: AgentReview): ReviewFinding[] =>
  review.findings.filter((finding) => finding.status === "open");
