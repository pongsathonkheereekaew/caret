import type { Json, TerminalCheckpoint, TerminalCheckpointRun } from "../../../../packages/protocol/src/index.ts";
import { isRecord, nonEmptyString } from "./types.ts";

/** Version negotiated by OMP's opt-in virtual TUI surface. */
export const CEDIA_VIRTUAL_UI_VERSION = 1 as const;

export const CEDIA_TERMINAL_MIN_COLUMNS = 2;
export const CEDIA_TERMINAL_MAX_COLUMNS = 500;
export const CEDIA_TERMINAL_MIN_ROWS = 1;
export const CEDIA_TERMINAL_MAX_ROWS = 200;
export const CEDIA_TERMINAL_MAX_OUTPUT_BYTES = 64 * 1024;
export const CEDIA_TERMINAL_MAX_INPUT_BYTES = 64 * 1024;

/** Keep replay useful without allowing a long-lived session to exhaust the phone. */
export const CEDIA_TERMINAL_MAX_HISTORY_BYTES = 4 * 1024 * 1024;
export const CEDIA_TERMINAL_MAX_HISTORY_CHUNKS = 4_096;

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
  | { readonly type: "replay_start"; readonly cols: number; readonly rows: number; readonly historyTruncated: boolean; readonly recovery?: boolean; readonly checkpoint?: boolean }
  | { readonly type: "output"; readonly sequence: number; readonly data: string }
  | { readonly type: "replay_end" };

/**
 * Terminal bytes that paint a host checkpoint onto an xterm.js screen.
 *
 * The host's checkpoint is a grid (rows, cursor), not the byte stream that produced
 * it, so the screen is rebuilt directly: clear, place each row, then put the cursor
 * where the host had it. A row the checkpoint carries styled runs for is painted run
 * by run with true-colour SGR; a row without runs stays plain text.
 */
export function terminalCheckpointSeed(checkpoint: TerminalCheckpoint): string {
  const rows = Math.max(1, checkpoint.rows);
  const cols = Math.max(1, checkpoint.cols);
  const parts: string[] = ["\u001b[?25l\u001b[2J\u001b[H"];
  const runsByRow = new Map<number, TerminalCheckpointRun[]>();
  for (const run of checkpoint.runs ?? []) {
    if (run.text.length === 0 || run.row < 0 || run.row >= rows) continue;
    const row = runsByRow.get(run.row);
    if (row) row.push(run);
    else runsByRow.set(run.row, [run]);
  }
  checkpoint.lines.slice(0, rows).forEach((line, index) => {
    const runs = runsByRow.get(index);
    if (!runs) {
      parts.push(`\u001b[${index + 1};1H${line}\u001b[K`);
      return;
    }
    for (const run of runs) {
      // Runs are positioned explicitly, so gaps and unsorted input stay safe. The
      // leading reset is required: moving the cursor does not clear SGR state, so a
      // style-less or partial run would inherit the previous run's colours.
      const sgr = sgrSequence(run);
      parts.push(`\u001b[${index + 1};${run.col + 1}H\u001b[0m${sgr}${run.text}`);
    }
    // Reset so stale cells clear and the next row starts unstyled.
    parts.push("\u001b[0m\u001b[K");
  });
  const cursorRow = Math.min(Math.max(checkpoint.cursorRow, 0), rows - 1) + 1;
  const cursorCol = Math.min(Math.max(checkpoint.cursorCol, 0), cols - 1) + 1;
  parts.push(`\u001b[${cursorRow};${cursorCol}H\u001b[?25h`);
  return parts.join("");
}

function parseHexColour(value: string | undefined): readonly [number, number, number] | undefined {
  const match = value === undefined ? null : /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) return undefined;
  const packed = Number.parseInt(match[1]!, 16);
  return [(packed >> 16) & 0xff, (packed >> 8) & 0xff, packed & 0xff];
}

function sgrSequence(run: TerminalCheckpointRun): string {
  const parameters: number[] = [];
  if (run.bold) parameters.push(1);
  if (run.italic) parameters.push(3);
  if (run.underline) parameters.push(4);
  const foreground = parseHexColour(run.foreground);
  if (foreground) parameters.push(38, 2, ...foreground);
  const background = parseHexColour(run.background);
  if (background) parameters.push(48, 2, ...background);
  return parameters.length === 0 ? "" : `\u001b[${parameters.join(";")}m`;
}

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

  ready(identity: VirtualTerminalIdentity, terminal: VirtualTerminalSnapshot, checkpoint?: TerminalCheckpoint): VirtualTerminalRendererPlan | null {
    if (identityKey(identity) !== this.#identity || terminal.terminalId !== identity.terminalId) return null;
    this.#rendererReady = true;
    this.#readyGeneration += 1;
    this.#sentSequence = -1;
    this.#recoveryRequested = terminal.historyTruncated && !terminal.closed;

    // A checkpoint beats a redraw: the host already holds the screen, so the renderer
    // paints it instead of clearing to an empty grid and asking OMP to draw again.
    const seed = terminal.historyTruncated && !terminal.closed && checkpoint
      && checkpoint.terminalId === terminal.terminalId && checkpoint.lastSequence >= 0
      ? checkpoint
      : undefined;
    if (seed) {
      this.#recoveryRequested = false;
      this.#sentSequence = seed.lastSequence;
      return {
        readyGeneration: this.#readyGeneration,
        messages: [
          { type: "replay_start", cols: seed.cols, rows: seed.rows, historyTruncated: true, checkpoint: true },
          { type: "output", sequence: seed.lastSequence, data: terminalCheckpointSeed(seed) },
          { type: "replay_end" },
        ],
        requestRecovery: false,
      };
    }

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

export interface CediaTerminalOpenFrame {
  readonly type: "cedia_terminal_open";
  readonly terminalId: string;
  readonly title?: string;
  readonly cols: number;
  readonly rows: number;
}

export interface CediaTerminalOutputFrame {
  readonly type: "cedia_terminal_output";
  readonly terminalId: string;
  readonly sequence: number;
  readonly data: string;
}

export interface CediaTerminalCloseFrame {
  readonly type: "cedia_terminal_close";
  readonly terminalId: string;
  readonly reason: string;
}

export type CediaVirtualTerminalFrame = CediaTerminalOpenFrame | CediaTerminalOutputFrame | CediaTerminalCloseFrame;

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function validTerminalId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function validDimension(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function validOpenFrame(value: Record<string, unknown>): value is Record<string, Json> & CediaTerminalOpenFrame {
  return value.type === "cedia_terminal_open"
    && validTerminalId(value.terminalId)
    && validDimension(value.cols, CEDIA_TERMINAL_MIN_COLUMNS, CEDIA_TERMINAL_MAX_COLUMNS)
    && validDimension(value.rows, CEDIA_TERMINAL_MIN_ROWS, CEDIA_TERMINAL_MAX_ROWS)
    && (value.title === undefined || (typeof value.title === "string" && value.title.length <= 200));
}

function validOutputFrame(value: Record<string, unknown>): value is Record<string, Json> & CediaTerminalOutputFrame {
  return value.type === "cedia_terminal_output"
    && validTerminalId(value.terminalId)
    && typeof value.sequence === "number"
    && Number.isSafeInteger(value.sequence)
    && value.sequence >= 0
    && typeof value.data === "string"
    && utf8Bytes(value.data) <= CEDIA_TERMINAL_MAX_OUTPUT_BYTES;
}

function validCloseFrame(value: Record<string, unknown>): value is Record<string, Json> & CediaTerminalCloseFrame {
  return value.type === "cedia_terminal_close"
    && validTerminalId(value.terminalId)
    && typeof value.reason === "string"
    && value.reason.length <= 200;
}

export function isCediaVirtualTerminalFrame(value: unknown): value is CediaVirtualTerminalFrame {
  if (!isRecord(value)) return false;
  return validOpenFrame(value) || validOutputFrame(value) || validCloseFrame(value);
}

function trimHistory(outputs: readonly VirtualTerminalOutput[], historyBytes: number): { outputs: readonly VirtualTerminalOutput[]; historyBytes: number; truncated: boolean } {
  let next = [...outputs];
  let bytes = historyBytes;
  let truncated = false;
  while (next.length > CEDIA_TERMINAL_MAX_HISTORY_CHUNKS || bytes > CEDIA_TERMINAL_MAX_HISTORY_BYTES) {
    const first = next.shift();
    if (!first) break;
    bytes -= utf8Bytes(first.data);
    truncated = true;
  }
  return { outputs: next, historyBytes: Math.max(0, bytes), truncated };
}

function initialTerminal(frame: CediaTerminalOpenFrame): VirtualTerminalSnapshot {
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
  if (!isCediaVirtualTerminalFrame(value)) return terminals;
  const index = terminals.findIndex(item => item.terminalId === value.terminalId);
  if (value.type === "cedia_terminal_open") {
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
  if (value.type === "cedia_terminal_output") {
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
  if (utf8Bytes(data) > CEDIA_TERMINAL_MAX_INPUT_BYTES) throw new RangeError("terminal input exceeds 64 KiB");
  return { terminalId, data };
}

export function terminalResizePayload(terminalId: string, cols: number, rows: number): Record<string, Json> {
  if (!validTerminalId(terminalId)) throw new TypeError("terminalId is required");
  if (!validDimension(cols, CEDIA_TERMINAL_MIN_COLUMNS, CEDIA_TERMINAL_MAX_COLUMNS)) throw new RangeError("cols is out of range");
  if (!validDimension(rows, CEDIA_TERMINAL_MIN_ROWS, CEDIA_TERMINAL_MAX_ROWS)) throw new RangeError("rows is out of range");
  return { terminalId, cols, rows };
}

export function terminalInputCommand(terminalId: string, data: string): { command: "cedia_terminal_input"; payload: Record<string, Json> } {
  return { command: "cedia_terminal_input", payload: terminalInputPayload(terminalId, data) };
}

export function terminalResizeCommand(terminalId: string, cols: number, rows: number): { command: "cedia_terminal_resize"; payload: Record<string, Json> } {
  return { command: "cedia_terminal_resize", payload: terminalResizePayload(terminalId, cols, rows) };
}

export function terminalNegotiateCommand(cols: number, rows: number): { command: "cedia_terminal_negotiate"; payload: Record<string, Json> } {
  if (!validDimension(cols, CEDIA_TERMINAL_MIN_COLUMNS, CEDIA_TERMINAL_MAX_COLUMNS)) throw new RangeError("cols is out of range");
  if (!validDimension(rows, CEDIA_TERMINAL_MIN_ROWS, CEDIA_TERMINAL_MAX_ROWS)) throw new RangeError("rows is out of range");
  return {
    command: "cedia_terminal_negotiate",
    payload: { version: CEDIA_VIRTUAL_UI_VERSION, cols, rows },
  };
}
