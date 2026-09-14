import * as vscode from "vscode";
import type { SessionEvent } from "../../../packages/protocol/src/index.ts";
import { isSyntheticTerminalReply, takeTerminalParserQueries } from "../../../packages/protocol/src/terminal-queries.js";

type Send = (sessionId: string, incarnation: string, command: string, payload: Record<string, string | number>) => Promise<void>;

const MAX_HISTORY_BYTES = 4 * 1024 * 1024;
const MAX_HISTORY_CHUNKS = 4_096;
const HISTORY_TRUNCATED_MARKER = "\r\n[caret] Terminal history was truncated while this panel was closed. The retained tail follows; resizing requested a fresh redraw.\r\n";

interface TerminalChunk {
	readonly sequence: number;
	readonly data: string;
}

interface TerminalDimensions {
	readonly columns: number;
	readonly rows: number;
}

interface RemoteTerminal {
	readonly sessionId: string;
	readonly incarnation: string;
	readonly id: string;
	sequence: number;
	title: string;
	terminal: vscode.Terminal | undefined;
	write: vscode.EventEmitter<string> | undefined;
	exit: vscode.EventEmitter<number | void> | undefined;
	closed: boolean;
	opened: boolean;
	ended: boolean;
	closing: boolean;
	generation: number;
	history: TerminalChunk[];
	historyBytes: number;
	historyTruncated: boolean;
	queryCarry: string;
	lastDimensions: TerminalDimensions | undefined;
}

function keyFor(sessionId: string, incarnation: string, terminalId: string): string {
	return `${sessionId}:${incarnation}:${terminalId}`;
}

function clampDimensions(dimensions: vscode.TerminalDimensions): TerminalDimensions {
	return {
		columns: Math.max(20, Math.min(400, Math.trunc(dimensions.columns))),
		rows: Math.max(5, Math.min(200, Math.trunc(dimensions.rows))),
	};
}

/**
 * Renders OMP's in-process custom TUI/PTY output; this terminal owns no shell
 * process. A terminal view can be disposed by VS Code while its remote OMP
 * terminal keeps running. In that case the record and bounded output history
 * stay alive until {@link show} or {@link reopen} is called.
 */
export class OmpTerminalViews {
	readonly #send: Send;
	readonly #terminals = new Map<string, RemoteTerminal>();

	constructor(send: Send) { this.#send = send; }

	/**
	 * Show all known terminal views for a session/incarnation, recreating a
	 * disposed local pseudoterminal when necessary. Returns false when no OMP
	 * terminal for that session is known yet.
	 */
	show(sessionId: string, incarnation: string): boolean {
		let shown = false;
		for (const record of this.#terminals.values()) {
			if (record.sessionId !== sessionId || record.incarnation !== incarnation) continue;
			shown = true;
			if (record.terminal && !record.closed) {
				record.terminal.show(true);
				continue;
			}
			this.#attach(record);
		}
		return shown;
	}

	/** Alias for callers that describe this action as reopening the terminal. */
	reopen(sessionId: string, incarnation: string): boolean {
		return this.show(sessionId, incarnation);
	}

	ingest(event: SessionEvent): void {
		const frame = event.frame;
		if (!frame || typeof frame !== "object" || Array.isArray(frame) || typeof frame.terminalId !== "string") return;
		const id = frame.terminalId;
		const key = keyFor(event.sessionId, event.incarnation, id);
		let record = this.#terminals.get(key);

		if (frame.type === "caret_terminal_open") {
			if (!record) {
				record = {
					sessionId: event.sessionId,
					incarnation: event.incarnation,
					id,
					sequence: -1,
					title: typeof frame.title === "string" && frame.title.trim() ? frame.title : "OMP interaction",
					terminal: undefined,
					write: undefined,
					exit: undefined,
					closed: true,
					opened: false,
					ended: false,
					closing: false,
					generation: 0,
					history: [],
					historyBytes: 0,
					historyTruncated: false,
					queryCarry: "",
					lastDimensions: undefined,
				};
				this.#terminals.set(key, record);
				this.#attach(record);
			} else if (typeof frame.title === "string" && frame.title.trim() && record.title === "OMP interaction") {
				record.title = frame.title;
			}
		}

		if (!record) return;
		const sequence = frame.sequence;
		if (frame.type === "caret_terminal_output" && typeof frame.data === "string" && typeof sequence === "number" && Number.isSafeInteger(sequence) && sequence > record.sequence) {
			record.sequence = sequence;
			this.#retain(record, sequence, frame.data);
			if (record.terminal && !record.closed && record.opened && record.write) this.#writeVisible(record, record.write, frame.data);
			return;
		}
		if (frame.type === "caret_terminal_close") {
			if (record.ended) return;
			record.ended = true;
			if (record.opened && !record.closed) record.write?.fire("\r\n[Caret interaction ended]\r\n");
		}
	}

	preview(sessionId: string, incarnation: string): readonly {
		readonly id: string;
		readonly title: string;
		readonly ended: boolean;
		readonly truncated: boolean;
		readonly text: string;
	}[] {
		const rows = [];
		for (const record of this.#terminals.values()) {
			if (record.sessionId !== sessionId || record.incarnation !== incarnation) continue;
			let carry = "";
			let text = "";
			if (record.historyTruncated) text += HISTORY_TRUNCATED_MARKER;
			for (const chunk of record.history) {
				const next = takeTerminalParserQueries(chunk.data, carry);
				carry = next.carry;
				if (next.text) text += next.text;
			}
			if (text.length > 8_000) text = text.slice(-8_000);
			rows.push({ id: record.id, title: record.title, ended: record.ended, truncated: record.historyTruncated, text });
		}
		return rows;
	}

	/** Dispose local terminal views while retaining no state after extension shutdown. */
	dispose(): void {
		for (const record of this.#terminals.values()) this.#detach(record, undefined, true);
		this.#terminals.clear();
	}

	#attach(record: RemoteTerminal): void {
		if (record.terminal && !record.closed) {
			record.terminal.show(true);
			return;
		}
		// Invalidate every callback owned by the old local PTY before creating a
		// replacement. VS Code may deliver its close callback after disposal.
		if (record.terminal || record.write || record.exit) this.#detach(record);
		const key = keyFor(record.sessionId, record.incarnation, record.id);
		record.generation += 1;
		const generation = record.generation;
		const write = new vscode.EventEmitter<string>();
		const exit = new vscode.EventEmitter<number | void>();
		const isCurrent = (): boolean => this.#terminals.get(key) === record && record.generation === generation;
		const send = (command: string, payload: Record<string, string | number>): void => {
			if (!isCurrent() || record.closed || record.ended) return;
			void this.#send(record.sessionId, record.incarnation, command, { terminalId: record.id, ...payload }).catch(error => {
				if (isCurrent() && !record.closed && record.opened) write.fire(`\r\nCaret could not deliver input: ${String(error)}\r\n`);
			});
		};
		const pty: vscode.Pseudoterminal = {
			onDidWrite: write.event,
			onDidClose: exit.event,
			open: dimensions => {
				if (!isCurrent()) return;
				record.opened = true;
				record.closed = false;
				this.#replay(record, write);
				const nextDimensions = dimensions ? clampDimensions(dimensions) : record.lastDimensions;
				if (nextDimensions) {
					record.lastDimensions = nextDimensions;
					// A resize is the OMP-side redraw request. It is deliberately sent
					// after replaying the retained tail so a live TUI can repaint it.
					send("caret_terminal_resize", { cols: nextDimensions.columns, rows: nextDimensions.rows });
				}
				if (record.ended) write.fire("\r\n[Caret interaction ended]\r\n");
			},
			close: () => {
				if (!isCurrent() || record.closing) return;
				this.#detach(record);
			},
			handleInput: data => {
				if (!isCurrent() || record.closed || record.ended) return;
				if (Buffer.byteLength(data, "utf8") > 64 * 1024) return;
				// Drop unambiguous emulator replies. Modified F3 (`CSI 1;2-8 R`)
				// is forwarded; other CSI-R cursor reports are not.
				if (isSyntheticTerminalReply(data)) return;
				send("caret_terminal_input", { data });
			},
			setDimensions: dimensions => {
				if (!isCurrent() || record.closed || record.ended) return;
				const nextDimensions = clampDimensions(dimensions);
				record.lastDimensions = nextDimensions;
				send("caret_terminal_resize", { cols: nextDimensions.columns, rows: nextDimensions.rows });
			},
		};

		record.write = write;
		record.exit = exit;
		record.closed = false;
		record.opened = false;
		const terminal = vscode.window.createTerminal({ name: record.title, pty });
		record.terminal = terminal;
		terminal.show(true);
	}

	#detach(record: RemoteTerminal, exitCode?: number, emitExit = false): void {
		if (record.closing) return;
		record.closing = true;
		const terminal = record.terminal;
		const write = record.write;
		const exit = record.exit;
		// Invalidate captured callbacks before invoking dispose/fire. This makes a
		// late close from an old terminal harmless after #attach creates a new one.
		record.generation += 1;
		record.terminal = undefined;
		record.write = undefined;
		record.exit = undefined;
		record.closed = true;
		record.opened = false;
		if (emitExit && exit) exit.fire(exitCode);
		if (terminal && emitExit) {
			try { terminal.dispose(); } catch { /* VS Code disposal is best effort. */ }
		}
		try { write?.dispose(); } catch { /* Isolated from replacement creation. */ }
		try { exit?.dispose(); } catch { /* Isolated from replacement creation. */ }
		record.closing = false;
	}

	#retain(record: RemoteTerminal, sequence: number, data: string): void {
		if (!data) return;
		let retained = data;
		let bytes = Buffer.byteLength(retained, "utf8");
		if (bytes > MAX_HISTORY_BYTES) {
			retained = Buffer.from(retained, "utf8").subarray(-MAX_HISTORY_BYTES).toString("utf8");
			bytes = Buffer.byteLength(retained, "utf8");
			record.historyTruncated = true;
		}
		record.history.push({ sequence, data: retained });
		record.historyBytes += bytes;
		while (record.history.length > MAX_HISTORY_CHUNKS || record.historyBytes > MAX_HISTORY_BYTES) {
			const first = record.history.shift();
			if (!first) break;
			record.historyBytes -= Buffer.byteLength(first.data, "utf8");
			record.historyTruncated = true;
		}
	}

	#writeVisible(record: RemoteTerminal, write: vscode.EventEmitter<string>, data: string): void {
		const next = takeTerminalParserQueries(data, record.queryCarry);
		record.queryCarry = next.carry;
		if (next.text) write.fire(next.text);
	}

	#replay(record: RemoteTerminal, write: vscode.EventEmitter<string>): void {
		record.queryCarry = "";
		if (record.historyTruncated) write.fire(HISTORY_TRUNCATED_MARKER);
		for (const chunk of record.history) this.#writeVisible(record, write, chunk.data);
	}
}

export const CARET_TERMINAL_HISTORY_LIMIT_BYTES = MAX_HISTORY_BYTES;
export const CARET_TERMINAL_HISTORY_TRUNCATED_MARKER = HISTORY_TRUNCATED_MARKER;
