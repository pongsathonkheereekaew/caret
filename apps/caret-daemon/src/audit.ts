// Caret audit trail (M11 seed): read-only summaries over recorded journal
// events — per-type counts, approval decisions, ordered timeline. Pure,
// sync, no I/O: the caller reads the JSONL. Unknown/malformed entries are
// carried with ""/"unknown" markers, never dropped (an audit that hides
// rows is worse than none).
export interface AuditEntry {
  readonly t: string;
  readonly type: string;
  readonly summary: string;
}

export interface ApprovalDecision {
  readonly type: string;
  readonly decision: unknown;
}

type JournalEvent = {
  t?: unknown;
  type?: unknown;
  payload?: unknown;
  [key: string]: unknown;
};

const text = (value: unknown): string => (typeof value === "string" ? value : "");

const summarize = (event: JournalEvent): string => {
  if (event.type === "request.resolved") {
    const payload = (event.payload ?? {}) as { requestType?: unknown; decision?: unknown };
    return `${text(payload.requestType) || "?"} → ${text(payload.decision) || "answered"}`;
  }
  if (typeof event.type === "string" && event.type.startsWith("caret.run.")) {
    if (event.type === "caret.run.isolated") {
      const workDir = (event as { workDir?: unknown }).workDir;
      return `workdir ${text(workDir)}`;
    }
    return text((event as { results?: unknown }).results as string) || text(event.payload) || "";
  }
  const payload = event.payload;
  const flat = typeof payload === "string" ? payload : JSON.stringify(payload ?? "");
  return (flat ?? "").slice(0, 200);
};

/** Full timeline, stable for missing/duplicate timestamps. */
export const buildAuditTrail = (events: ReadonlyArray<JournalEvent>): AuditEntry[] =>
  events.map((event, index) => ({
    t: text(event.t),
    type: text(event.type) || "unknown",
    summary: summarize(event),
    index,
  })).sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.index - b.index))
    .map(({ t, type, summary }) => ({ t, type, summary }));

/** Approval record (same rule as the handoff assembly). */
export const approvalDecisions = (events: ReadonlyArray<JournalEvent>): ApprovalDecision[] => {
  const decisions = new Map<string, unknown>();
  for (const event of events) {
    const payload = (event.payload ?? {}) as { requestType?: unknown; decision?: unknown };
    if (event.type === "request.resolved" && typeof payload.requestType === "string") {
      decisions.set(payload.requestType, payload.decision ?? "answered");
    }
  }
  return [...decisions].map(([type, decision]) => ({ type, decision }));
};

export const countByType = (events: ReadonlyArray<JournalEvent>): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const type = text(event.type) || "unknown";
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
};
