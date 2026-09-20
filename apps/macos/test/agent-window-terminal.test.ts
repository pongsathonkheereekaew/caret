import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	MAX_TERMINAL_HISTORY_BYTES,
	createAgentTerminalService,
	type AgentTerminalPty,
	type AgentTerminalPtyFactory,
} from "../src/agent-window-terminal.ts";
import { createNativeTerminalApi } from "../agent-window/src/native-terminal.ts";

type DataListener = (data: string) => void;
type ExitListener = (event: { exitCode: number; signal?: number }) => void;

class FakePty implements AgentTerminalPty {
	readonly pid = 4201;
	readonly writes: string[] = [];
	readonly resizeCalls: Array<{ cols: number; rows: number }> = [];
	cleared = 0;
	killed = false;
	paused = false;
	private readonly dataListeners = new Set<DataListener>();
	private readonly exitListeners = new Set<ExitListener>();

	onData(listener: DataListener) {
		this.dataListeners.add(listener);
		return { dispose: () => this.dataListeners.delete(listener) };
	}

	onExit(listener: ExitListener) {
		this.exitListeners.add(listener);
		return { dispose: () => this.exitListeners.delete(listener) };
	}

	write(data: string) {
		this.writes.push(data);
	}

	resize(cols: number, rows: number) {
		this.resizeCalls.push({ cols, rows });
	}

	clear() {
		this.cleared += 1;
	}

	kill() {
		this.killed = true;
	}

	pause() {
		this.paused = true;
	}

	resume() {
		this.paused = false;
	}

	emitData(data: string) {
		for (const listener of this.dataListeners) listener(data);
	}

	emitExit(exitCode: number, signal?: number) {
		for (const listener of this.exitListeners) listener({ exitCode, ...(signal === undefined ? {} : { signal }) });
	}
}

function senderFixture() {
	const sent: Array<{ channel: string; event: unknown }> = [];
	let destroyed = false;
	let destroyedListener: (() => void) | undefined;
	const sender = {
		isDestroyed: () => destroyed,
		once: (channel: string, listener: () => void) => {
			if (channel === "destroyed") destroyedListener = listener;
		},
		send: (channel: string, event: unknown) => {
			sent.push({ channel, event });
		},
		destroy: () => {
			destroyed = true;
			destroyedListener?.();
		},
	};
	return { sender, sent };
}

describe("Cedia Agent terminal service", () => {
	it("owns a PTY per sender/thread/terminal and streams the full terminal lifecycle", async () => {
		const directory = await mkdtemp(join(tmpdir(), "cedia-terminal-"));
		const cwd = join(directory, "project");
		await mkdir(cwd);
		const ptys: FakePty[] = [];
		const factory: AgentTerminalPtyFactory = {
			spawn: (_shell, _args, options) => {
				expect(options.cwd).toBe(cwd);
				const pty = new FakePty();
				ptys.push(pty);
				return pty;
			},
		};
		const service = createAgentTerminalService({ appRoot: directory, ptyFactory: factory });
		const { sender, sent } = senderFixture();
		const event = { sender };
		try {
			const opened = await service.handle(event, "open", {
				threadId: "thread-1",
				terminalId: "terminal-1",
				cwd,
				cols: 80,
				rows: 24,
				streamOutput: true,
			});
			expect(opened).toMatchObject({ threadId: "thread-1", terminalId: "terminal-1", cwd, status: "running", pid: 4201, history: "" });
			expect(sent.at(-1)).toMatchObject({ channel: "vscode:cediaAgentTerminal", event: { type: "started" } });

			ptys[0]!.emitData("hello\r\n");
			expect(sent.at(-1)).toMatchObject({ event: { type: "output", data: "hello\r\n", byteLength: 7 } });
			await service.handle(event, "write", { threadId: "thread-1", terminalId: "terminal-1", data: "echo hi\n" });
			expect(ptys[0]!.writes).toEqual(["echo hi\n"]);
			await service.handle(event, "resize", { threadId: "thread-1", terminalId: "terminal-1", cols: 100, rows: 30 });
			expect(ptys[0]!.resizeCalls).toEqual([{ cols: 100, rows: 30 }]);
			await service.handle(event, "ackOutput", { threadId: "thread-1", terminalId: "terminal-1", bytes: 7 });
			await service.handle(event, "clear", { threadId: "thread-1", terminalId: "terminal-1" });
			expect(ptys[0]!.cleared).toBe(1);
			expect(sent.at(-1)).toMatchObject({ event: { type: "cleared" } });

			const restarted = await service.handle(event, "restart", {
				threadId: "thread-1",
				terminalId: "terminal-1",
				cwd,
				cols: 90,
				rows: 25,
			});
			expect(ptys[0]!.killed).toBe(true);
			expect(ptys).toHaveLength(2);
			expect(restarted).toMatchObject({ status: "running", pid: 4201, history: "" });
			expect(sent.at(-1)).toMatchObject({ event: { type: "restarted" } });

			await service.handle(event, "close", { threadId: "thread-1", terminalId: "terminal-1", deleteHistory: true });
			expect(ptys[1]!.killed).toBe(true);
		} finally {
			service.dispose();
			await rm(directory, { recursive: true, force: true });
		}
	});

	it("keeps bounded scrollback and isolates terminals by renderer sender", async () => {
		const directory = await mkdtemp(join(tmpdir(), "cedia-terminal-"));
		const cwd = join(directory, "project");
		await mkdir(cwd);
		const ptys: FakePty[] = [];
		const service = createAgentTerminalService({
			appRoot: directory,
			ptyFactory: { spawn: () => { const pty = new FakePty(); ptys.push(pty); return pty; } },
		});
		const first = senderFixture();
		const second = senderFixture();
		try {
			await service.handle({ sender: first.sender }, "open", { threadId: "thread-1", terminalId: "terminal-1", cwd });
			ptys[0]!.emitData("x".repeat(MAX_TERMINAL_HISTORY_BYTES + 100));
			const replay = await service.handle({ sender: first.sender }, "open", { threadId: "thread-1", terminalId: "terminal-1", cwd }) as { history: string };
			expect(Buffer.byteLength(replay.history)).toBeLessThanOrEqual(MAX_TERMINAL_HISTORY_BYTES);
			await expect(service.handle({ sender: second.sender }, "write", { threadId: "thread-1", terminalId: "terminal-1", data: "whoami" })).rejects.toThrow("Terminal session not found");
			first.sender.destroy();
			expect(ptys[0]!.killed).toBe(true);
		} finally {
			service.dispose();
			await rm(directory, { recursive: true, force: true });
		}
	});

	it("validates cwd, dimensions, and bounded input before spawning", async () => {
		const directory = await mkdtemp(join(tmpdir(), "cedia-terminal-"));
		const { sender } = senderFixture();
		const service = createAgentTerminalService({ appRoot: directory, ptyFactory: { spawn: () => new FakePty() } });
		try {
			await expect(service.handle({ sender }, "open", { threadId: "thread", terminalId: "terminal", cwd: directory + "/missing" })).rejects.toThrow("Terminal cwd must be an existing directory");
			await expect(service.handle({ sender }, "open", { threadId: "thread", terminalId: "terminal", cwd: directory, cols: 1, rows: 24 })).rejects.toThrow("Invalid terminal dimensions");
			await service.handle({ sender }, "open", { threadId: "thread", terminalId: "terminal", cwd: directory });
			await expect(service.handle({ sender }, "write", { threadId: "thread", terminalId: "terminal", data: "x".repeat(65_537) })).rejects.toThrow("Terminal input is too large");
		} finally {
			service.dispose();
			await rm(directory, { recursive: true, force: true });
		}
	});
});

describe("Cedia Agent native terminal renderer bridge", () => {
	it("routes terminal calls through the panel surface and forwards native events", async () => {
		const calls: unknown[] = [];
		const listeners = new Set<(event: unknown, payload: unknown) => void>();
		const bridge = {
			invoke: async (_channel: string, input: unknown) => {
				calls.push(input);
				return { threadId: "thread", terminalId: "terminal", cwd: "/tmp", status: "running", pid: 1, history: "", exitCode: null, exitSignal: null, updatedAt: new Date().toISOString() };
			},
			on: (_channel: string, listener: (event: unknown, payload: unknown) => void) => { listeners.add(listener); },
			removeListener: (_channel: string, listener: (event: unknown, payload: unknown) => void) => { listeners.delete(listener); },
		};
		const api = createNativeTerminalApi(bridge);
		const seen: unknown[] = [];
		const dispose = api.onEvent(event => seen.push(event));
		await api.open({ threadId: "thread", terminalId: "terminal", cwd: "/tmp" });
		expect(calls).toEqual([{ kind: "panel", surface: "terminal", method: "open", input: { threadId: "thread", terminalId: "terminal", cwd: "/tmp" } }]);
		for (const listener of listeners) listener({}, { type: "output", threadId: "thread", terminalId: "terminal", createdAt: "now", data: "ok" });
		expect(seen).toHaveLength(1);
		dispose();
		expect(listeners).toHaveLength(0);
	});
});
