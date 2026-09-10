// Caret session state contract (parity §10, ADOPT now): the status
// machine + runtime kinds + emitted-event catalog shared by daemon, IDE
// sidepane, and the future Agents shell. Cloud/ssh/selfHosted exist as
// enum values with NO backend (local-only per user decision) — UI must
// render them disabled-with-reason, never silently retask.
export type AgentSessionStatus =
  | "draft"
  | "queued"
  | "starting"
  | "running"
  | "waitingForUser"
  | "waitingForApproval"
  | "steering"
  | "reviewing"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentRuntimeKind = "local" | "cloud" | "ssh" | "selfHosted";

/** Backends actually present on this machine. */
export const AVAILABLE_RUNTIMES: ReadonlyArray<AgentRuntimeKind> = ["local"];

const TRANSITIONS: Record<AgentSessionStatus, ReadonlyArray<AgentSessionStatus>> = {
  draft: ["queued", "starting", "cancelled"],
  queued: ["starting", "cancelled"],
  starting: ["running", "failed", "cancelled"],
  running: ["waitingForUser", "waitingForApproval", "steering", "reviewing", "completed", "failed", "cancelled"],
  waitingForUser: ["running", "failed", "cancelled"],
  waitingForApproval: ["running", "failed", "cancelled"],
  steering: ["running", "completed", "failed", "cancelled"],
  reviewing: ["running", "completed", "failed", "cancelled"],
  // Terminal, except explicit user intent: follow-up reopens, retry restarts.
  completed: ["running"],
  failed: ["starting", "cancelled"],
  cancelled: ["starting"],
};

export const canTransition = (from: AgentSessionStatus, to: AgentSessionStatus): boolean =>
  TRANSITIONS[from]?.includes(to) ?? false;

export interface SessionEventDef {
  readonly name: string;
  /** emitted = observed on the wire today; planned = vocabulary reserved. */
  readonly state: "emitted" | "planned";
  readonly source: string;
}

/** Events this daemon actually emits (loopback + live proven). */
export const EMITTED_EVENTS: ReadonlyArray<SessionEventDef> = [
  { name: "daemon.ready", state: "emitted", source: "server.ts stdio" },
  { name: "remote.ready", state: "emitted", source: "serve-tcp.ts" },
  { name: "approval.requested", state: "emitted", source: "session-api.ts onApproval" },
  { name: "caret.run.isolated", state: "emitted", source: "daemon.ts journal" },
  { name: "caret.run.setup", state: "emitted", source: "daemon.ts journal" },
  { name: "turn.steered", state: "emitted", source: "Codex adapter stream (AG-05 live)" },
];

/** Full target vocabulary (parity §10). Anything not in EMITTED_EVENTS is planned. */
export const TARGET_EVENTS: ReadonlyArray<string> = [
  ...EMITTED_EVENTS.map((e) => e.name),
  "session.created",
  "session.updated",
  "session.statusChanged",
  "user.promptCreated",
  "user.promptQueued",
  "user.promptSteered",
  "assistant.messageStarted",
  "assistant.messageDelta",
  "assistant.messageCompleted",
  "tool.started",
  "tool.progress",
  "tool.approvalRequested",
  "tool.completed",
  "tool.failed",
  "tool.cancelled",
  "context.attached",
  "file.changed",
  "file.diffAvailable",
  "terminal.started",
  "terminal.output",
  "terminal.completed",
  "checkpoint.created",
  "checkpoint.restored",
  "question.requested",
  "question.answered",
  "plan.ready",
  "plan.buildStarted",
  "review.started",
  "review.findingCreated",
  "review.completed",
  "run.completed",
  "run.failed",
  "run.cancelled",
];
