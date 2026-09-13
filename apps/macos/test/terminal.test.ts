import { describe, expect, it, mock } from "bun:test";
import type { SessionEvent } from "../../../packages/protocol/src/index.ts";

type PseudoTerminal = {
	onDidWrite: (listener: (value: string) => void) => { dispose(): void };
	onDidClose: (listener: (value: number | void) => void) => { dispose(): void };
	open(dimensions: { columns: number; rows: number } | undefined): void;
	close(): void;
	handleInput?(data: string): void;
	setDimensions?(dimensions: { columns: number; rows: number }): void;
};

class FakeEventEmitter<T> {
	readonly #listeners = new Set<(value: T) => void>();
	readonly event = (listener: (value: T) => void): { dispose(): void } => {
		this.#listeners.add(listener);
		return { dispose: () => this.#listeners.delete(listener) };
	};
	fire(value: T): void {
		for (const listener of [...this.#listeners]) listener(value);
	}
	dispose(): void { this.#listeners.clear(); }
}

class FakeTerminal {
	readonly options: { name: string; pty: PseudoTerminal };
	showCount = 0;
	disposed = false;
	constructor(options: { name: string; pty: PseudoTerminal }) { this.options = options; }
	show(): void { this.showCount += 1; }
	open(): void { this.options.pty.open({ columns: 80, rows: 24 }); }
	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.options.pty.close();
	}
}

const createdTerminals: FakeTerminal[] = [];
mock.module("vscode", () => ({
	EventEmitter: FakeEventEmitter,
	window: {
		createTerminal: (options: { name: string; pty: PseudoTerminal }) => {
			const terminal = new FakeTerminal(options);
			createdTerminals.push(terminal);
			return terminal;
		},
	},
}));

const { CARET_TERMINAL_HISTORY_TRUNCATED_MARKER, OmpTerminalViews } = await import("../src/terminal.ts");

function event(frame: Record<string, unknown>, sequence: number): SessionEvent {
	return { sessionId: "session-1", incarnation: "incarnation-1", sequence, timestamp: new Date(sequence).toISOString(), frame: frame as SessionEvent["frame"] };
}

function openFrame(): Record<string, unknown> {
	return { type: "caret_terminal_open", terminalId: "terminal-1", title: "OMP" };
}

describe("Caret OMP terminal views", () => {
	it("preserves output when OMP ends before the view opens, including reopening ended history", () => {
		createdTerminals.length = 0;
		const sent: string[] = [];
		const views = new OmpTerminalViews(async (_s, _i, command) => { sent.push(command); });
		views.ingest(event(openFrame(), 1));
		views.ingest(event({ type: "caret_terminal_output", terminalId: "terminal-1", sequence: 1, data: "final output" }, 2));
		views.ingest(event({ type: "caret_terminal_close", terminalId: "terminal-1" }, 3));
		const first = createdTerminals[0]!;
		const output: string[] = [];
		first.options.pty.onDidWrite(value => output.push(value));
		first.open();
		expect(first.disposed).toBe(false);
		expect(output.join("")).toContain("final output");
		first.dispose();
		expect(views.show("session-1", "incarnation-1")).toBe(true);
		const reopened = createdTerminals[1]!;
		const replay: string[] = [];
		reopened.options.pty.onDidWrite(value => replay.push(value));
		reopened.open();
		reopened.options.pty.handleInput?.("ignored");
		expect(reopened.disposed).toBe(false);
		expect(replay.join("")).toContain("final output");
		expect(replay.join("")).toContain("interaction ended");
		expect(sent).toEqual([]);
		views.dispose();
	});
	it("reopens a closed view, replays retained output, and rejects stale input/close callbacks", async () => {
		createdTerminals.length = 0;
		const sent: Array<{ command: string; payload: Record<string, string | number> }> = [];
		const views = new OmpTerminalViews(async (_sessionId, _incarnation, command, payload) => { sent.push({ command, payload }); });
		views.ingest(event(openFrame(), 1));
		const first = createdTerminals[0];
		expect(first).toBeDefined();
		if (!first) return;
		const firstOutput: string[] = [];
		first.options.pty.onDidWrite(value => firstOutput.push(value));
		first.open();
		views.ingest(event({ type: "caret_terminal_output", terminalId: "terminal-1", sequence: 1, data: "before\r\n" }, 2));
		// Same OMP sequence is a duplicate and must not be rendered twice.
		views.ingest(event({ type: "caret_terminal_output", terminalId: "terminal-1", sequence: 1, data: "duplicate\r\n" }, 3));
		first.options.pty.handleInput?.("old-input");
		first.options.pty.close();
		views.ingest(event({ type: "caret_terminal_output", terminalId: "terminal-1", sequence: 2, data: "while-closed\r\n" }, 4));
		await Promise.resolve();
		const inputCountBeforeReopen = sent.filter(item => item.command === "caret_terminal_input").length;
		const reopened = views.reopen("session-1", "incarnation-1");
		expect(reopened).toBe(true);
		const second = createdTerminals[1];
		expect(second).toBeDefined();
		if (!second) return;
		const secondOutput: string[] = [];
		second.options.pty.onDidWrite(value => secondOutput.push(value));
		second.open();
		await Promise.resolve();
		expect(secondOutput.join("")).toContain("before\r\nwhile-closed\r\n");
		expect(secondOutput.join("")).not.toContain("duplicate\r\n");
		expect(sent.filter(item => item.command === "caret_terminal_resize")).toHaveLength(2);
		// The old PTY's callbacks are stale after replacement and cannot close or
		// send input through the active replacement.
		first.options.pty.handleInput?.("stale-input");
		first.options.pty.close();
		second.options.pty.handleInput?.("live-input");
		await Promise.resolve();
		expect(sent.filter(item => item.command === "caret_terminal_input")).toHaveLength(inputCountBeforeReopen + 1);
		expect(sent.at(-1)?.payload).toMatchObject({ terminalId: "terminal-1", data: "live-input" });

		// OMP end keeps read-only history visible. Input after the end is rejected,
		// including input delivered by the replacement's stale callbacks.
		views.ingest(event({ type: "caret_terminal_close", terminalId: "terminal-1" }, 5));
		second.options.pty.handleInput?.("after-end");
		await Promise.resolve();
		expect(sent.filter(item => item.command === "caret_terminal_input")).toHaveLength(inputCountBeforeReopen + 1);
		views.dispose();
		expect(firstOutput.join("")).toContain("before\r\n");
	});

	it("marks bounded history explicitly when the retained tail is truncated", () => {
		createdTerminals.length = 0;
		const views = new OmpTerminalViews(async () => {});
		views.ingest(event(openFrame(), 10));
		const first = createdTerminals[0];
		expect(first).toBeDefined();
		if (!first) return;
		first.options.pty.close();
		const oversized = "x".repeat(4 * 1024 * 1024 + 32);
		views.ingest(event({ type: "caret_terminal_output", terminalId: "terminal-1", sequence: 10, data: oversized }, 11));
		expect(views.reopen("session-1", "incarnation-1")).toBe(true);
		const second = createdTerminals[1];
		expect(second).toBeDefined();
		if (!second) return;
		const output: string[] = [];
		second.options.pty.onDidWrite(value => output.push(value));
		second.open();
		const rendered = output.join("");
		expect(rendered).toContain(CARET_TERMINAL_HISTORY_TRUNCATED_MARKER);
		expect(Buffer.byteLength(rendered, "utf8")).toBeGreaterThan(Buffer.byteLength(CARET_TERMINAL_HISTORY_TRUNCATED_MARKER, "utf8"));
		views.dispose();
	});

	it("forwards modified F3 and strips emulator queries from written output", async () => {
		createdTerminals.length = 0;
		const sent: Array<{ command: string; payload: Record<string, string | number> }> = [];
		const views = new OmpTerminalViews(async (_sessionId, _incarnation, command, payload) => { sent.push({ command, payload }); });
		views.ingest(event(openFrame(), 1));
		const first = createdTerminals[0];
		expect(first).toBeDefined();
		if (!first) return;
		const output: string[] = [];
		first.options.pty.onDidWrite(value => output.push(value));
		first.open();
		views.ingest(event({ type: "caret_terminal_output", terminalId: "terminal-1", sequence: 1, data: "visible\x1b[6n\x1b]10;?;?\x07\x1b]4;0;?\x07more" }, 2));
		expect(output.join("")).toContain("visible");
		expect(output.join("")).toContain("more");
		expect(output.join("")).not.toContain("\x1b[6n");
		expect(output.join("")).not.toContain("];?");
		first.options.pty.handleInput?.("\x1b[1;2R");
		first.options.pty.handleInput?.("\x1b[24;80R");
		first.options.pty.handleInput?.("\x1b[0c");
		await Promise.resolve();
		const inputs = sent.filter(item => item.command === "caret_terminal_input");
		expect(inputs.map(item => item.payload.data)).toEqual(["\x1b[1;2R"]);
		views.ingest(event({ type: "caret_terminal_output", terminalId: "terminal-1", sequence: 2, data: "\x1b[" }, 3));
		views.ingest(event({ type: "caret_terminal_output", terminalId: "terminal-1", sequence: 3, data: "6nkept" }, 4));
		expect(output.join("")).toContain("kept");
		expect(output.join("")).not.toContain("\x1b[6n");
		expect(output.join("")).not.toContain("\x1b[");
		views.dispose();
	});
});
