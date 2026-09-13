import type { Json } from "../../../../packages/protocol/src/index.ts";
import { isRecord, nonEmptyString } from "./types.ts";

/** Version negotiated by OMP's opt-in virtual TUI surface. */
export const CARET_VIRTUAL_UI_VERSION = 1 as const;

export const CARET_TERMINAL_MIN_COLUMNS = 2;
export const CARET_TERMINAL_MAX_COLUMNS = 500;
export const CARET_TERMINAL_MIN_ROWS = 1;
export const CARET_TERMINAL_MAX_ROWS = 200;
export const CARET_TERMINAL_MAX_OUTPUT_BYTES = 64 * 1024;
export const CARET_TERMINAL_MAX_INPUT_BYTES = 64 * 1024;

/** Keep replay useful without allowing a long-lived session to exhaust the phone. */
export const CARET_TERMINAL_MAX_HISTORY_BYTES = 4 * 1024 * 1024;
export const CARET_TERMINAL_MAX_HISTORY_CHUNKS = 4_096;

export interface VirtualTerminalOutput {
  readonly sequence: number;
  readonly data: string;
}

/** Identity captured by a renderer before it can send a durable command. */
export interface VirtualTerminalIdentity {
  readonly sessionId: string;
  readonly incarnation: string;
  readonly terminalId: string;
}

export interface VirtualTerminalSnapshot {
  readonly terminalId: string;
  readonly title?: string;
  readonly cols: number;
  readonly rows: number;
  readonly closed: boolean;
  readonly closeReason?: string;
  /** Output chunks remain separate so the renderer can suppress duplicates. */
  readonly outputs: readonly VirtualTerminalOutput[];
  readonly lastOutputSequence: number;
  readonly historyBytes: number;
  /** True once the bounded history has dropped any prefix of the stream. */
  readonly historyTruncated: boolean;
}

/**
 * Messages sent from the mobile shell to one embedded terminal renderer.
 *
 * A renderer is allowed to replay its retained tail only after a fresh ready
 * event.  Once that replay is complete, output messages are incremental and
 * never reset the emulator merely because the host's bounded history trimmed
 * an older prefix.
 */
export type VirtualTerminalRendererMessage =
  | { readonly type: "replay_start"; readonly cols: number; readonly rows: number; readonly historyTruncated: boolean; readonly recovery?: boolean }
  | { readonly type: "output"; readonly sequence: number; readonly data: string }
  | { readonly type: "replay_end" };

export interface VirtualTerminalRendererPlan {
  readonly readyGeneration: number;
  readonly messages: readonly VirtualTerminalRendererMessage[];
  /** Request an OMP redraw after the renderer was reset for a missing prefix. */
  readonly requestRecovery: boolean;
}

function identityKey(identity: VirtualTerminalIdentity): string {
  return `${identity.sessionId}\u0000${identity.incarnation}\u0000${identity.terminalId}`;
}

/**
 * Coordinates replay and live output for one mounted terminal renderer.
 *
 * The mobile event reducer owns the bounded history.  This coordinator owns
 * only renderer progress, so a history trim does not reset an intact emulator
 * and a missing sequence is recovered exactly once per renderer generation.
 */
export class VirtualTerminalRendererCoordinator {
  readonly #identity: string;
  #readyGeneration = 0;
  #rendererReady = false;
  #sentSequence = -1;
  #recoveryRequested = false;

  constructor(identity: VirtualTerminalIdentity) {
    this.#identity = identityKey(identity);
  }

  get readyGeneration(): number {
    return this.#readyGeneration;
  }

  get sentSequence(): number {
    return this.#sentSequence;
  }

  /**
   * Invalidate the current renderer without changing the React mount key.
   * The next ready event is a new replay generation.
   */
  resetRenderer(): void {
    this.#rendererReady = false;
    this.#sentSequence = -1;
    this.#recoveryRequested = false;
  }

  ready(identity: VirtualTerminalIdentity, terminal: VirtualTerminalSnapshot): VirtualTerminalRendererPlan | null {
    if (identityKey(identity) !== this.#identity || terminal.terminalId !== identity.terminalId) return null;
    this.#rendererReady = true;
    this.#readyGeneration += 1;
    this.#sentSequence = -1;
    this.#recoveryRequested = terminal.historyTruncated && !terminal.closed;

    const messages: VirtualTerminalRendererMessage[] = [{ type: "replay_start", cols: terminal.cols, rows: terminal.rows, historyTruncated: terminal.historyTruncated, ...(terminal.historyTruncated && !terminal.closed ? { recovery: true } : {}) }];
    if (terminal.historyTruncated) {
      // The retained tail starts after an unknown emulator state. Do not
      // replay it as if it were a complete screen; the OMP redraw below owns
      // reconstruction of the current TUI state.
      this.#sentSequence = terminal.lastOutputSequence;
    } else {
      for (const output of terminal.outputs) {
        if (output.sequence <= this.#sentSequence) continue;
        messages.push({ type: "output", sequence: output.sequence, data: output.data });
        this.#sentSequence = output.sequence;
      }
      if (terminal.outputs.length === 0) this.#sentSequence = terminal.lastOutputSequence;
    }
    messages.push({ type: "replay_end" });
    return { readyGeneration: this.#readyGeneration, messages, requestRecovery: terminal.historyTruncated && !terminal.closed };
  }

  update(identity: VirtualTerminalIdentity, terminal: VirtualTerminalSnapshot): VirtualTerminalRendererPlan | null {
    if (identityKey(identity) !== this.#identity || terminal.terminalId !== identity.terminalId || !this.#rendererReady) return null;

    const firstUnsent = terminal.outputs.find(output => output.sequence > this.#sentSequence);
    const gap = terminal.lastOutputSequence > this.#sentSequence + 1
      && (firstUnsent === undefined || firstUnsent.sequence > this.#sentSequence + 1);
    if (gap && !terminal.closed && !this.#recoveryRequested) {
      this.#recoveryRequested = true;
      this.#sentSequence = terminal.lastOutputSequence;
      return {
        readyGeneration: this.#readyGeneration,
        messages: [
          { type: "replay_start", cols: terminal.cols, rows: terminal.rows, historyTruncated: true, recovery: true },
          { type: "replay_end" },
        ],
        requestRecovery: true,
      };
    }

    const messages: VirtualTerminalRendererMessage[] = [];
    for (const output of terminal.outputs) {
      if (output.sequence <= this.#sentSequence) continue;
      messages.push({ type: "output", sequence: output.sequence, data: output.data });
      this.#sentSequence = output.sequence;
    }
    // The reducer can retain the last sequence while all chunks are trimmed.
    // Advancing the watermark here prevents replaying that old tail later.
    if (messages.length === 0 && terminal.outputs.length === 0) this.#sentSequence = Math.max(this.#sentSequence, terminal.lastOutputSequence);
    return { readyGeneration: this.#readyGeneration, messages, requestRecovery: false };
  }
}

export interface CaretTerminalOpenFrame {
  readonly type: "caret_terminal_open";
  readonly terminalId: string;
  readonly title?: string;
  readonly cols: number;
  readonly rows: number;
}

export interface CaretTerminalOutputFrame {
  readonly type: "caret_terminal_output";
  readonly terminalId: string;
  readonly sequence: number;
  readonly data: string;
}

export interface CaretTerminalCloseFrame {
  readonly type: "caret_terminal_close";
  readonly terminalId: string;
  readonly reason: string;
}

export type CaretVirtualTerminalFrame = CaretTerminalOpenFrame | CaretTerminalOutputFrame | CaretTerminalCloseFrame;

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function validTerminalId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function validDimension(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function validOpenFrame(value: Record<string, unknown>): value is Record<string, Json> & CaretTerminalOpenFrame {
  return value.type === "caret_terminal_open"
    && validTerminalId(value.terminalId)
    && validDimension(value.cols, CARET_TERMINAL_MIN_COLUMNS, CARET_TERMINAL_MAX_COLUMNS)
    && validDimension(value.rows, CARET_TERMINAL_MIN_ROWS, CARET_TERMINAL_MAX_ROWS)
    && (value.title === undefined || (typeof value.title === "string" && value.title.length <= 200));
}

function validOutputFrame(value: Record<string, unknown>): value is Record<string, Json> & CaretTerminalOutputFrame {
  return value.type === "caret_terminal_output"
    && validTerminalId(value.terminalId)
    && typeof value.sequence === "number"
    && Number.isSafeInteger(value.sequence)
    && value.sequence >= 0
    && typeof value.data === "string"
    && utf8Bytes(value.data) <= CARET_TERMINAL_MAX_OUTPUT_BYTES;
}

function validCloseFrame(value: Record<string, unknown>): value is Record<string, Json> & CaretTerminalCloseFrame {
  return value.type === "caret_terminal_close"
    && validTerminalId(value.terminalId)
    && typeof value.reason === "string"
    && value.reason.length <= 200;
}

export function isCaretVirtualTerminalFrame(value: unknown): value is CaretVirtualTerminalFrame {
  if (!isRecord(value)) return false;
  return validOpenFrame(value) || validOutputFrame(value) || validCloseFrame(value);
}

function trimHistory(outputs: readonly VirtualTerminalOutput[], historyBytes: number): { outputs: readonly VirtualTerminalOutput[]; historyBytes: number; truncated: boolean } {
  let next = [...outputs];
  let bytes = historyBytes;
  let truncated = false;
  while (next.length > CARET_TERMINAL_MAX_HISTORY_CHUNKS || bytes > CARET_TERMINAL_MAX_HISTORY_BYTES) {
    const first = next.shift();
    if (!first) break;
    bytes -= utf8Bytes(first.data);
    truncated = true;
  }
  return { outputs: next, historyBytes: Math.max(0, bytes), truncated };
}

function initialTerminal(frame: CaretTerminalOpenFrame): VirtualTerminalSnapshot {
  return {
    terminalId: frame.terminalId,
    ...(frame.title === undefined ? {} : { title: frame.title }),
    cols: frame.cols,
    rows: frame.rows,
    closed: false,
    outputs: [],
    lastOutputSequence: -1,
    historyBytes: 0,
    historyTruncated: false,
  };
}

/**
 * Apply one OMP terminal frame. Invalid or late frames are ignored. Keeping
 * this reducer pure lets both native WebView and web iframe share the exact
 * replay/ordering rules.
 */
export function applyVirtualTerminalFrame(terminals: readonly VirtualTerminalSnapshot[], value: unknown): readonly VirtualTerminalSnapshot[] {
  if (!isCaretVirtualTerminalFrame(value)) return terminals;
  const index = terminals.findIndex(item => item.terminalId === value.terminalId);
  if (value.type === "caret_terminal_open") {
    if (index < 0) return [...terminals, initialTerminal(value)];
    const existing = terminals[index]!;
    const next: VirtualTerminalSnapshot = {
      ...existing,
      ...(value.title === undefined ? {} : { title: value.title }),
      cols: value.cols,
      rows: value.rows,
      // OMP may reopen a renderer after a mobile reconnect. Keep the old
      // scrollback and sequence, but make the terminal writable again.
      closed: false,
      closeReason: undefined,
    };
    const copy = terminals.slice();
    copy[index] = next;
    return copy;
  }
  if (index < 0) return terminals;
  const existing = terminals[index]!;
  if (value.type === "caret_terminal_output") {
    // A terminal cannot produce output before its open frame. Output received
    // after close is also ignored until a new open frame, avoiding late replay
    // from resurrecting a stopped screen.
    if (existing.closed || value.sequence <= existing.lastOutputSequence) return terminals;
    const output = { sequence: value.sequence, data: value.data };
    const trimmed = trimHistory([...existing.outputs, output], existing.historyBytes + utf8Bytes(value.data));
    const copy = terminals.slice();
    copy[index] = { ...existing, outputs: trimmed.outputs, historyBytes: trimmed.historyBytes, lastOutputSequence: value.sequence, historyTruncated: existing.historyTruncated || trimmed.truncated };
    return copy;
  }
  if (existing.closed && existing.closeReason === value.reason) return terminals;
  const copy = terminals.slice();
  copy[index] = { ...existing, closed: true, closeReason: value.reason };
  return copy;
}

export function terminalInputPayload(terminalId: string, data: string): Record<string, Json> {
  if (!validTerminalId(terminalId)) throw new TypeError("terminalId is required");
  if (typeof data !== "string" || data.length === 0) throw new TypeError("terminal input is required");
  if (utf8Bytes(data) > CARET_TERMINAL_MAX_INPUT_BYTES) throw new RangeError("terminal input exceeds 64 KiB");
  return { terminalId, data };
}

export function terminalResizePayload(terminalId: string, cols: number, rows: number): Record<string, Json> {
  if (!validTerminalId(terminalId)) throw new TypeError("terminalId is required");
  if (!validDimension(cols, CARET_TERMINAL_MIN_COLUMNS, CARET_TERMINAL_MAX_COLUMNS)) throw new RangeError("cols is out of range");
  if (!validDimension(rows, CARET_TERMINAL_MIN_ROWS, CARET_TERMINAL_MAX_ROWS)) throw new RangeError("rows is out of range");
  return { terminalId, cols, rows };
}

export function terminalInputCommand(terminalId: string, data: string): { command: "caret_terminal_input"; payload: Record<string, Json> } {
  return { command: "caret_terminal_input", payload: terminalInputPayload(terminalId, data) };
}

export function terminalResizeCommand(terminalId: string, cols: number, rows: number): { command: "caret_terminal_resize"; payload: Record<string, Json> } {
  return { command: "caret_terminal_resize", payload: terminalResizePayload(terminalId, cols, rows) };
}

export function terminalNegotiateCommand(cols: number, rows: number): { command: "caret_terminal_negotiate"; payload: Record<string, Json> } {
  if (!validDimension(cols, CARET_TERMINAL_MIN_COLUMNS, CARET_TERMINAL_MAX_COLUMNS)) throw new RangeError("cols is out of range");
  if (!validDimension(rows, CARET_TERMINAL_MIN_ROWS, CARET_TERMINAL_MAX_ROWS)) throw new RangeError("rows is out of range");
  return {
    command: "caret_terminal_negotiate",
    payload: { version: CARET_VIRTUAL_UI_VERSION, cols, rows },
  };
}
