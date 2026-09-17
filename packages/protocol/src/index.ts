/** Caret application protocol. OMP remains the execution/transcript authority. */
export const CARET_PROTOCOL_VERSION = 1 as const;
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface Project {
  id: string;
  path: string;
  name: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
}

export interface Session {
  pinned?: boolean;
  id: string;
  projectId: string;
  title: string;
  cwd: string;
  sessionFile: string;
  incarnation: string;
  status: "idle" | "running" | "stopped" | "recovery_required";
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CommandStatus = "claimed" | "acknowledged" | "completed" | "failed" | "outcome_unknown" | "not_dispatched";
export interface Command {
  sessionId: string;
  commandId: string;
  deviceId: string;
  incarnation: string;
  kind: string;
  payload: Json;
  payloadHash: string;
  status: CommandStatus;
  ack?: Json;
  result?: Json;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionEvent {
  sessionId: string;
  incarnation: string;
  sequence: number;
  timestamp: string;
  frame: Json;
}

/**
 * One checkpoint of a virtual terminal, as the host keeps it.
 *
 * OMP owns the PTY; the host keeps a headless screen per terminal so a client that
 * attaches (or reattaches) can restore the screen instead of replaying a bounded chunk
 * history. `lastSequence` is the highest `caret_terminal_output` sequence folded into
 * this screen, and `historyIncomplete` says the host itself dropped a gap and cannot
 * vouch for the whole grid.
 */
export interface TerminalCheckpoint {
  terminalId: string;
  title?: string;
  cols: number;
  rows: number;
  cursorRow: number;
  cursorCol: number;
  /** Visible rows, right-trimmed; trailing blank rows are dropped. */
  lines: string[];
  lastSequence: number;
  closed: boolean;
  closeReason?: string;
  historyIncomplete: boolean;
}

export interface CommandRequest {
  commandId: string;
  incarnation: string;
  command: string;
  payload?: { [key: string]: Json };
}

export interface UiResponseRequest {
  commandId: string;
  incarnation: string;
  token: string;
  answer: string | boolean | { cancelled: true; timedOut?: boolean };
}

export interface EventPage {
  events: SessionEvent[];
  cursor: number;
  hasMore: boolean;
}

export interface HostDescriptor {
  protocolVersion: typeof CARET_PROTOCOL_VERSION;
  url: string;
  /** Stored only in the private local descriptor; never returned by health. */
  token: string;
  pid: number;
}

export interface ApiError {
  error: { code: string; message: string };
}
