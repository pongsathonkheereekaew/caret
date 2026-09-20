import { createRequire } from "node:module";
import { statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import type {
	TerminalAckOutputInput,
	TerminalClearInput,
	TerminalCloseInput,
	TerminalEvent,
	TerminalOpenInput,
	TerminalResizeInput,
	TerminalRestartInput,
	TerminalSessionSnapshot,
	TerminalWriteInput,
} from "../agent-window/vendor/synara/packages/contracts/src/terminal.ts";

export const CEDIA_AGENT_TERMINAL_CHANNEL = "vscode:cediaAgentTerminal";
export const MAX_TERMINAL_HISTORY_BYTES = 2 * 1024 * 1024;

const TERMINAL_MIN_COLS = 20;
const TERMINAL_MAX_COLS = 2_000;
const TERMINAL_MIN_ROWS = 5;
const TERMINAL_MAX_ROWS = 1_000;
const MAX_TERMINAL_INPUT_BYTES = 65_536;
const MAX_TERMINAL_OUTPUT_CHUNK_BYTES = 64 * 1024;
const MAX_UNACKNOWLEDGED_OUTPUT_BYTES = 8 * 1024 * 1024;
const DEFAULT_TERMINAL_COLS = 120;
const DEFAULT_TERMINAL_ROWS = 30;

export interface AgentTerminalPty {
	readonly pid: number;
	onData(listener: (data: string) => void): { dispose(): void } | void;
	onExit(listener: (event: { exitCode: number; signal?: number }) => void): { dispose(): void } | void;
	write(data: string): void;
	resize(cols: number, rows: number): void;
	clear?(): void;
	kill(signal?: string): void;
	pause?(): void;
	resume?(): void;
}

export interface AgentTerminalPtyOptions {
	readonly name: string;
	readonly cols: number;
	readonly rows: number;
	readonly cwd: string;
	readonly env: Record<string, string | undefined>;
}

export interface AgentTerminalPtyFactory {
	spawn(shell: string, args: string[], options: AgentTerminalPtyOptions): AgentTerminalPty;
}

export interface AgentTerminalServiceOptions {
	readonly appRoot: string;
	/** Injection seam for isolated tests; production loads Code-OSS's node-pty. */
	readonly ptyFactory?: AgentTerminalPtyFactory;
	readonly now?: () => Date;
}

interface AgentTerminalSender {
	readonly send: (channel: string, event: unknown) => void;
	isDestroyed?: () => boolean;
	once?: (channel: string, listener: () => void) => void;
}

interface AgentTerminalIpcEvent {
	readonly sender: AgentTerminalSender;
}

interface TerminalSession {
	readonly senderState: SenderState;
	readonly key: string;
	readonly threadId: string;
	readonly terminalId: string;
	readonly cwd: string;
	readonly pty: AgentTerminalPty;
	readonly disposables: Array<{ dispose(): void }>;
	streamOutput: boolean;
	status: "starting" | "running" | "exited" | "error";
	history: string;
	exitCode: number | null;
	exitSignal: number | null;
	updatedAt: string;
	unacknowledgedOutputBytes: number;
	closing: boolean;
}

interface SenderState {
	readonly sender: AgentTerminalSender;
	readonly sessions: Map<string, TerminalSession>;
}

function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Invalid terminal request");
	}
	return value as Record<string, unknown>;
}

function text(value: unknown, field: string, maxLength = 16_384): string {
	if (typeof value !== "string" || value.length === 0 || value.length > maxLength || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
		throw new Error(`Invalid terminal ${field}`);
	}
	return value;
}

function id(value: unknown, field: string, optionalDefault?: string): string {
	if (value === undefined && optionalDefault !== undefined) return optionalDefault;
	const result = text(value, field, 128);
	if (result.length === 0) throw new Error(`Invalid terminal ${field}`);
	return result;
}

function dimensions(cols: unknown, rows: unknown): { cols: number; rows: number } {
	const normalizedCols = cols === undefined ? DEFAULT_TERMINAL_COLS : cols;
	const normalizedRows = rows === undefined ? DEFAULT_TERMINAL_ROWS : rows;
	if (
		typeof normalizedCols !== "number" || !Number.isInteger(normalizedCols) ||
		typeof normalizedRows !== "number" || !Number.isInteger(normalizedRows) ||
		normalizedCols < TERMINAL_MIN_COLS || normalizedCols > TERMINAL_MAX_COLS ||
		normalizedRows < TERMINAL_MIN_ROWS || normalizedRows > TERMINAL_MAX_ROWS
	) {
		throw new Error("Invalid terminal dimensions");
	}
	return { cols: normalizedCols, rows: normalizedRows };
}

function validateCwd(value: unknown): string {
	const cwd = text(value, "cwd");
	if (!isAbsolute(cwd) || cwd.includes("\\")) throw new Error("Terminal cwd must be an absolute directory");
	const resolved = resolve(cwd);
	try {
		if (!statSync(resolved).isDirectory()) throw new Error("not a directory");
	} catch {
		throw new Error("Terminal cwd must be an existing directory");
	}
	return resolved;
}

function validateEnvironment(value: unknown): Record<string, string> | undefined {
	if (value === undefined) return undefined;
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid terminal environment");
	const entries = Object.entries(value);
	if (entries.length > 128) throw new Error("Invalid terminal environment");
	const result: Record<string, string> = {};
	for (const [key, item] of entries) {
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || key.length > 128 || typeof item !== "string" || item.length > 8_192) {
			throw new Error("Invalid terminal environment");
		}
		result[key] = item;
	}
	return result;
}

function inputData(value: unknown): string {
	if (typeof value !== "string" || value.length === 0 || Buffer.byteLength(value, "utf8") > MAX_TERMINAL_INPUT_BYTES) {
		throw new Error("Terminal input is too large");
	}
	return value;
}

function sessionKey(threadId: string, terminalId: string): string {
	return `${threadId}\u0000${terminalId}`;
}

function appendHistory(history: string, data: string): string {
	const bytes = Buffer.concat([Buffer.from(history, "utf8"), Buffer.from(data, "utf8")]);
	if (bytes.length <= MAX_TERMINAL_HISTORY_BYTES) return bytes.toString("utf8");
	return bytes.subarray(bytes.length - MAX_TERMINAL_HISTORY_BYTES).toString("utf8");
}

function outputChunks(data: string): string[] {
	const chunks: string[] = [];
	let offset = 0;
	while (offset < data.length) {
		let end = Math.min(data.length, offset + MAX_TERMINAL_OUTPUT_CHUNK_BYTES);
		let chunk = data.slice(offset, end);
		let size = Buffer.byteLength(chunk, "utf8");
		if (size > MAX_TERMINAL_OUTPUT_CHUNK_BYTES) {
			end = offset + Math.max(1, Math.floor((end - offset) * MAX_TERMINAL_OUTPUT_CHUNK_BYTES / size));
			chunk = data.slice(offset, end);
			while (chunk.length > 1 && Buffer.byteLength(chunk, "utf8") > MAX_TERMINAL_OUTPUT_CHUNK_BYTES) {
				chunk = chunk.slice(0, -1);
			}
			end = offset + chunk.length;
		}
		if (end < data.length && chunk.length > 0 && /[\uD800-\uDBFF]/.test(chunk.at(-1) ?? "")) {
			chunk = chunk.slice(0, -1);
			end -= 1;
		}
		if (end <= offset || chunk.length === 0) {
			chunk = data.slice(offset, offset + 1);
			end = offset + chunk.length;
		}
		chunks.push(chunk);
		offset = end;
	}
	return chunks;
}

function loadNodePty(appRoot: string): AgentTerminalPtyFactory {
	const nodeRequire = createRequire(join(appRoot, "package.json"));
	const module = nodeRequire("node-pty") as Partial<AgentTerminalPtyFactory>;
	if (typeof module.spawn !== "function") throw new Error("Code-OSS node-pty is unavailable");
	return module as AgentTerminalPtyFactory;
}

function shellCommand(): { shell: string; args: string[] } {
	if (process.platform === "win32") return { shell: process.env.ComSpec ?? "powershell.exe", args: [] };
	return { shell: process.env.SHELL ?? "/bin/zsh", args: ["-l"] };
}

export function createAgentTerminalService(options: AgentTerminalServiceOptions): {
	handle(event: unknown, method: string, input: unknown): Promise<unknown>;
	dispose(): void;
} {
	const now = options.now ?? (() => new Date());
	let ptyFactory = options.ptyFactory;
	const senders = new Map<AgentTerminalSender, SenderState>();

	const timestamp = () => now().toISOString();

	function senderFromEvent(event: unknown): AgentTerminalSender {
		const value = record(event);
		const sender = value.sender;
		if (!sender || typeof sender !== "object") throw new Error("Invalid Agent Window sender");
		const candidate = sender as AgentTerminalSender;
		if (typeof candidate.send !== "function") throw new Error("Invalid Agent Window sender");
		if (candidate.isDestroyed?.()) throw new Error("Agent Window sender is destroyed");
		return candidate;
	}

	function senderStateFor(sender: AgentTerminalSender): SenderState {
		const existing = senders.get(sender);
		if (existing) return existing;
		const state: SenderState = { sender, sessions: new Map() };
		senders.set(sender, state);
		sender.once?.("destroyed", () => disposeSender(sender));
		return state;
	}

	function disposeSession(session: TerminalSession): void {
		if (session.closing) return;
		session.closing = true;
		for (const disposable of session.disposables) {
			try { disposable.dispose(); } catch { /* disposed PTYs may already be gone */ }
		}
		session.disposables.length = 0;
		try { session.pty.kill(); } catch { /* best effort */ }
	}

	function disposeSender(sender: AgentTerminalSender): void {
		const state = senders.get(sender);
		if (!state) return;
		senders.delete(sender);
		for (const session of state.sessions.values()) disposeSession(session);
		state.sessions.clear();
	}

	function emit(state: SenderState, event: TerminalEvent): void {
		if (state.sender.isDestroyed?.()) {
			disposeSender(state.sender);
			return;
		}
		try {
			state.sender.send(CEDIA_AGENT_TERMINAL_CHANNEL, event);
		} catch {
			disposeSender(state.sender);
		}
	}

	function snapshot(session: TerminalSession): TerminalSessionSnapshot {
		return {
			threadId: session.threadId,
			terminalId: session.terminalId,
			cwd: session.cwd,
			status: session.status,
			pid: session.status === "error" ? null : session.pty.pid,
			history: session.history,
			exitCode: session.exitCode,
			exitSignal: session.exitSignal,
			updatedAt: session.updatedAt,
		};
	}

	function findSession(state: SenderState, value: Record<string, unknown>): TerminalSession {
		const threadId = id(value.threadId, "thread id");
		const terminalId = id(value.terminalId, "terminal id", "default");
		const session = state.sessions.get(sessionKey(threadId, terminalId));
		if (!session) throw new Error("Terminal session not found");
		return session;
	}

	function spawnSession(state: SenderState, input: {
		threadId: string;
		terminalId: string;
		cwd: string;
		cols: number;
		rows: number;
		env?: Record<string, string>;
		streamOutput: boolean;
	}): TerminalSession {
		ptyFactory ??= loadNodePty(options.appRoot);
		const command = shellCommand();
		const env: Record<string, string | undefined> = { ...process.env, ...(input.env ?? {}) };
		env.TERM ??= "xterm-256color";
		let pty: AgentTerminalPty;
		try {
			pty = ptyFactory.spawn(command.shell, command.args, {
				name: "xterm-256color",
				cols: input.cols,
				rows: input.rows,
				cwd: input.cwd,
				env,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unable to start terminal";
			emit(state, {
				type: "error",
				threadId: input.threadId,
				terminalId: input.terminalId,
				createdAt: timestamp(),
				message,
			});
			throw new Error(message);
		}

		const session: TerminalSession = {
			senderState: state,
			key: sessionKey(input.threadId, input.terminalId),
			threadId: input.threadId,
			terminalId: input.terminalId,
			cwd: input.cwd,
			pty,
			disposables: [],
			streamOutput: input.streamOutput,
			status: "running",
			history: "",
			exitCode: null,
			exitSignal: null,
			updatedAt: timestamp(),
			unacknowledgedOutputBytes: 0,
			closing: false,
		};
		state.sessions.set(session.key, session);

		const dataDisposable = pty.onData(data => {
			if (session.closing || session.status === "exited" || session.status === "error") return;
			session.updatedAt = timestamp();
			session.history = appendHistory(session.history, data);
			if (!session.streamOutput) return;
			for (const chunk of outputChunks(data)) {
				const byteLength = Buffer.byteLength(chunk, "utf8");
				session.unacknowledgedOutputBytes += byteLength;
				if (session.unacknowledgedOutputBytes > MAX_UNACKNOWLEDGED_OUTPUT_BYTES) session.pty.pause?.();
				emit(state, {
					type: "output",
					threadId: session.threadId,
					terminalId: session.terminalId,
					createdAt: timestamp(),
					data: chunk,
					byteLength,
				});
			}
		});
		if (dataDisposable) session.disposables.push(dataDisposable);
		const exitDisposable = pty.onExit(exit => {
			if (session.closing) return;
			session.status = "exited";
			session.exitCode = Number.isInteger(exit.exitCode) ? exit.exitCode : null;
			session.exitSignal = exit.signal === undefined ? null : exit.signal;
			session.updatedAt = timestamp();
			emit(state, {
				type: "exited",
				threadId: session.threadId,
				terminalId: session.terminalId,
				createdAt: timestamp(),
				exitCode: session.exitCode,
				exitSignal: session.exitSignal,
			});
		});
		if (exitDisposable) session.disposables.push(exitDisposable);
		emit(state, {
			type: "started",
			threadId: session.threadId,
			terminalId: session.terminalId,
			createdAt: timestamp(),
			snapshot: snapshot(session),
		});
		return session;
	}

	function restartSession(state: SenderState, value: Record<string, unknown>): TerminalSessionSnapshot {
		const threadId = id(value.threadId, "thread id");
		const terminalId = id(value.terminalId, "terminal id", "default");
		const cwd = validateCwd(value.cwd);
		const { cols, rows } = dimensions(value.cols, value.rows);
		const env = validateEnvironment(value.env);
		const key = sessionKey(threadId, terminalId);
		const previous = state.sessions.get(key);
		if (previous) {
			state.sessions.delete(key);
			disposeSession(previous);
		}
		const session = spawnSession(state, { threadId, terminalId, cwd, cols, rows, ...(env ? { env } : {}), streamOutput: previous?.streamOutput ?? true });
		emit(state, {
			type: "restarted",
			threadId,
			terminalId,
			createdAt: timestamp(),
			snapshot: snapshot(session),
		});
		return snapshot(session);
	}

	async function handle(event: unknown, method: string, input: unknown): Promise<unknown> {
		const sender = senderFromEvent(event);
		const state = senderStateFor(sender);
		const value = record(input);
		switch (method) {
			case "open": {
				const threadId = id(value.threadId, "thread id");
				const terminalId = id(value.terminalId, "terminal id", "default");
				const cwd = validateCwd(value.cwd);
				const { cols, rows } = dimensions(value.cols, value.rows);
				const env = validateEnvironment(value.env);
				const key = sessionKey(threadId, terminalId);
				const existing = state.sessions.get(key);
				if (existing) {
					if (existing.cwd !== cwd) throw new Error("Terminal cwd cannot change while the session exists");
					if (existing.status === "running" || existing.status === "starting") {
						existing.pty.resize(cols, rows);
						if (value.streamOutput !== undefined) existing.streamOutput = value.streamOutput === true;
					}
					return snapshot(existing);
				}
				return snapshot(spawnSession(state, { threadId, terminalId, cwd, cols, rows, ...(env ? { env } : {}), streamOutput: value.streamOutput !== false }));
			}
			case "write": {
				const session = findSession(state, value);
				if (session.status !== "running" && session.status !== "starting") throw new Error("Terminal session is not running");
				session.pty.write(inputData(value.data));
				return undefined;
			}
			case "ackOutput": {
				const session = findSession(state, value);
				const ack = value.bytes;
				if (typeof ack !== "number" || !Number.isInteger(ack) || ack <= 0 || ack > 8_388_608) throw new Error("Invalid terminal acknowledgement");
				session.unacknowledgedOutputBytes = Math.max(0, session.unacknowledgedOutputBytes - ack);
				if (session.unacknowledgedOutputBytes <= MAX_UNACKNOWLEDGED_OUTPUT_BYTES / 2) session.pty.resume?.();
				return undefined;
			}
			case "resize": {
				const session = findSession(state, value);
				const { cols, rows } = dimensions(value.cols, value.rows);
				session.pty.resize(cols, rows);
				return undefined;
			}
			case "clear": {
				const session = findSession(state, value);
				session.history = "";
				session.unacknowledgedOutputBytes = 0;
				session.pty.resume?.();
				session.pty.clear?.();
				session.updatedAt = timestamp();
				emit(state, { type: "cleared", threadId: session.threadId, terminalId: session.terminalId, createdAt: timestamp() });
				return undefined;
			}
			case "restart":
				return restartSession(state, value);
			case "close": {
				const threadId = id(value.threadId, "thread id");
				const terminalId = value.terminalId === undefined ? undefined : id(value.terminalId, "terminal id");
				for (const [key, session] of state.sessions) {
					if (session.threadId !== threadId || (terminalId !== undefined && session.terminalId !== terminalId)) continue;
					state.sessions.delete(key);
					disposeSession(session);
				}
				return undefined;
			}
			default:
				throw new Error(`Unsupported terminal method: ${method}`);
		}
	}

	return {
		handle,
		dispose: () => {
			for (const sender of [...senders.keys()]) disposeSender(sender);
		},
	};
}
