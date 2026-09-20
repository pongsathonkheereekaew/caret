/**
 * Headless terminal state for the PTY streams OMP relays.
 *
 * Why this exists: the mobile renderer keeps a bounded chunk history, so a client that
 * reconnects after the history was trimmed can only ask OMP for a redraw - there is no
 * serialized checkpoint of the screen (its own receipt says so). The host is the one
 * place that sees every `cedia_terminal_*` frame, so it keeps the authoritative screen
 * here and publishes it as a {@link TerminalCheckpoint}.
 *
 * The engine - libghostty-vt through `@coder/libghostty-vt-node` - is deliberately
 * optional: a host without the platform prebuild still runs, keeps no state and simply
 * reports no checkpoints. Measurements against xterm.js are in
 * `docs/maintenance/evidence/terminal-vt-spike-2026-09-16/`.
 */

import type { TerminalCheckpoint, TerminalCheckpointRun } from "../../../packages/protocol/src/index.ts";

/** Terminals kept per session. OMP opens one at a time today; the bound is for safety. */
const MAX_TERMINALS = 8;
/** Frames held while the engine loads. Dropped past this bound - state stays empty. */
const MAX_PENDING_FRAMES = 512;
const MAX_SCROLLBACK = 2000;
/** Cells arrive per visible grid cell, so cap the styled runs one checkpoint can carry. */
const MAX_CHECKPOINT_RUNS = 5000;

export interface TerminalEngineTerminal {
  feed(data: string): void;
  resize(cols: number, rows: number): void;
  snapshot(options?: { includeCells?: boolean }): {
    cols: number;
    rows: number;
    cursorRow: number;
    cursorCol: number;
    visibleLines: readonly { text: string }[];
    cells?: readonly {
      row: number;
      col: number;
      text: string;
      width: number;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      foreground?: string;
      background?: string;
    }[];
  };
  dispose(): void;
}

export interface TerminalEngine {
  createTerminal(options: { cols: number; rows: number; scrollbackLimit?: number }): TerminalEngineTerminal;
  getNativeInfo(): { platform?: string; arch?: string; packageVersion?: string; ghosttyVersion?: string };
}

export type TerminalEngineLoader = () => Promise<TerminalEngine | undefined>;

/** Built at runtime so nothing here has a static dependency on the native package. */
async function loadTerminalEngine(): Promise<TerminalEngine | undefined> {
  const specifier = "@coder/libghostty-vt-node";
  try {
    return (await import(specifier)) as TerminalEngine;
  } catch {
    return undefined;
  }
}

interface TerminalRecord {
  terminal: TerminalEngineTerminal;
  title?: string;
  cols: number;
  rows: number;
  lastSequence: number;
  closed: boolean;
  closeReason?: string;
  historyIncomplete: boolean;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

type TerminalEngineSnapshot = ReturnType<TerminalEngineTerminal["snapshot"]>;

/** Accumulates one run; `width` stays local because the checkpoint carries text and style only. */
interface PendingRun {
  row: number;
  col: number;
  text: string;
  width: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  foreground?: string;
  background?: string;
}

/** Groups the engine's styled cells into runs of adjacent cells sharing a style. */
function checkpointRuns(snapshot: TerminalEngineSnapshot): TerminalCheckpointRun[] {
  const cells = snapshot.cells;
  if (!cells || cells.length === 0) return [];
  // The snapshot contract does not promise order, so sort rows and columns before merging.
  const visible = cells
    .filter(cell => cell.text.length > 0 && cell.row >= 0 && cell.row < snapshot.rows)
    .sort((left, right) => left.row - right.row || left.col - right.col);
  const runs: TerminalCheckpointRun[] = [];
  let pending: PendingRun | undefined;
  const flush = (): void => {
    if (!pending) return;
    runs.push({
      row: pending.row,
      col: pending.col,
      text: pending.text,
      ...(pending.bold === undefined ? {} : { bold: pending.bold }),
      ...(pending.italic === undefined ? {} : { italic: pending.italic }),
      ...(pending.underline === undefined ? {} : { underline: pending.underline }),
      ...(pending.foreground === undefined ? {} : { foreground: pending.foreground }),
      ...(pending.background === undefined ? {} : { background: pending.background }),
    });
    pending = undefined;
  };
  for (const cell of visible) {
    const width = cell.width > 0 ? cell.width : 1;
    if (
      pending
      && pending.row === cell.row
      && pending.col + pending.width === cell.col
      && pending.bold === cell.bold
      && pending.italic === cell.italic
      && pending.underline === cell.underline
      && pending.foreground === cell.foreground
      && pending.background === cell.background
    ) {
      pending.text += cell.text;
      pending.width += width;
      continue;
    }
    flush();
    // The grid is client-resized and the checkpoint travels over HTTP, so bound the
    // runs; rows past it keep their plain `lines` text.
    if (runs.length >= MAX_CHECKPOINT_RUNS) break;
    pending = {
      row: cell.row,
      col: cell.col,
      text: cell.text,
      width,
      ...(cell.bold === undefined ? {} : { bold: cell.bold }),
      ...(cell.italic === undefined ? {} : { italic: cell.italic }),
      ...(cell.underline === undefined ? {} : { underline: cell.underline }),
      ...(cell.foreground === undefined ? {} : { foreground: cell.foreground }),
      ...(cell.background === undefined ? {} : { background: cell.background }),
    };
  }
  flush();
  return runs;
}

/**
 * Keeps one headless screen per terminal for one session runtime.
 *
 * Frames are accepted in arrival order; duplicates (`sequence` not newer than what was
 * folded in) are ignored and a gap marks the screen as incomplete instead of pretending
 * the missing bytes were seen.
 */
export class TerminalStateRegistry {
  readonly #loader: TerminalEngineLoader;
  #engine: TerminalEngine | undefined;
  #engineFailed = false;
  #loading = false;
  #pending: unknown[] = [];
  #terminals = new Map<string, TerminalRecord>();

  constructor(loader: TerminalEngineLoader = loadTerminalEngine) {
    this.#loader = loader;
  }

  /** True when the native engine is in use (false = no checkpoints are kept). */
  get active(): boolean {
    return this.#engine !== undefined;
  }

  get terminalCount(): number {
    return this.#terminals.size;
  }

  apply(frame: unknown): void {
    const value = record(frame);
    const type = value ? value.type : undefined;
    if (type !== "cedia_terminal_open" && type !== "cedia_terminal_output" && type !== "cedia_terminal_close") return;
    if (!this.#engine) {
      if (this.#engineFailed) return; // No engine: keep running, keep no state.
      if (this.#pending.length < MAX_PENDING_FRAMES) this.#pending.push(frame);
      void this.#ensureEngine();
      return;
    }
    this.#applyWithEngine(value!);
  }

  resize(terminalId: string, cols: number, rows: number): void {
    const terminal = this.#terminals.get(terminalId);
    if (!terminal || terminal.closed) return;
    if (terminal.cols === cols && terminal.rows === rows) return;
    terminal.cols = cols;
    terminal.rows = rows;
    terminal.terminal.resize(cols, rows);
  }

  snapshots(): readonly TerminalCheckpoint[] {
    const checkpoints: TerminalCheckpoint[] = [];
    for (const [terminalId, terminal] of [...this.#terminals.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const snapshot = terminal.terminal.snapshot({ includeCells: true });
      const lines = snapshot.visibleLines
        .map(line => line.text.replace(/\s+$/, ""))
        .filter((line, index, all) => all.slice(index).some(candidate => candidate.length > 0));
      const runs = checkpointRuns(snapshot);
      checkpoints.push({
        terminalId,
        ...(terminal.title === undefined ? {} : { title: terminal.title }),
        cols: snapshot.cols,
        rows: snapshot.rows,
        cursorRow: snapshot.cursorRow,
        cursorCol: snapshot.cursorCol,
        lines,
        ...(runs.length === 0 ? {} : { runs }),
        lastSequence: terminal.lastSequence,
        closed: terminal.closed,
        ...(terminal.closeReason === undefined ? {} : { closeReason: terminal.closeReason }),
        historyIncomplete: terminal.historyIncomplete,
      });
    }
    return checkpoints;
  }

  dispose(): void {
    for (const terminal of this.#terminals.values()) terminal.terminal.dispose();
    this.#terminals.clear();
    this.#pending = [];
  }

  async #ensureEngine(): Promise<void> {
    if (this.#engine || this.#loading || this.#engineFailed) return;
    this.#loading = true;
    try {
      this.#engine = await this.#loader();
    } catch {
      this.#engine = undefined;
    }
    this.#loading = false;
    if (!this.#engine) {
      // No prebuild for this platform (or the package is absent): stay honest and
      // keep running without checkpoints rather than failing the session.
      this.#engineFailed = true;
      this.#pending = [];
      return;
    }
    const pending = this.#pending;
    this.#pending = [];
    for (const frame of pending) {
      const value = record(frame);
      if (value) this.#applyWithEngine(value);
    }
  }

  #applyWithEngine(value: Record<string, unknown>): void {
    const engine = this.#engine;
    const terminalId = typeof value.terminalId === "string" ? value.terminalId : undefined;
    if (!engine || !terminalId) return;
    if (value.type === "cedia_terminal_open") {
      const cols = positiveInteger(value.cols) ?? 80;
      const rows = positiveInteger(value.rows) ?? 24;
      const title = typeof value.title === "string" ? value.title : undefined;
      const existing = this.#terminals.get(terminalId);
      if (existing) {
        // OMP reopens a renderer after a client reconnect: keep the screen, follow
        // the new dimensions and make the terminal writable again.
        existing.cols = cols;
        existing.rows = rows;
        existing.title = title ?? existing.title;
        existing.closed = false;
        existing.closeReason = undefined;
        existing.terminal.resize(cols, rows);
        return;
      }
      if (this.#terminals.size >= MAX_TERMINALS) {
        const oldestClosed = [...this.#terminals.entries()].find(([, terminal]) => terminal.closed);
        if (!oldestClosed) return;
        oldestClosed[1].terminal.dispose();
        this.#terminals.delete(oldestClosed[0]);
      }
      this.#terminals.set(terminalId, {
        terminal: engine.createTerminal({ cols, rows, scrollbackLimit: MAX_SCROLLBACK }),
        ...(title === undefined ? {} : { title }),
        cols,
        rows,
        lastSequence: -1,
        closed: false,
        historyIncomplete: false,
      });
      return;
    }
    const terminal = this.#terminals.get(terminalId);
    if (!terminal) return;
    if (value.type === "cedia_terminal_close") {
      if (!terminal.closed) {
        terminal.closed = true;
        terminal.closeReason = typeof value.reason === "string" ? value.reason : "closed";
      }
      return;
    }
    if (terminal.closed) return;
    const sequence = typeof value.sequence === "number" && Number.isSafeInteger(value.sequence) ? value.sequence : undefined;
    const data = typeof value.data === "string" ? value.data : undefined;
    if (sequence === undefined || data === undefined) return;
    if (sequence <= terminal.lastSequence) return; // Duplicate frame: the bytes are already on this screen.
    if (sequence > terminal.lastSequence + 1) terminal.historyIncomplete = true;
    terminal.terminal.feed(data);
    terminal.lastSequence = sequence;
  }
}
