import { describe, expect, it } from "bun:test";
import { applyEvent, applyEventPage, applyFrame, createInitialTaskState, parseCaretUiRequest, reduceTaskState } from "../src/state.ts";
import { parseWebviewMessage } from "../src/messages.ts";
import type { Json } from "../../../packages/protocol/src/index.ts";

describe("Caret task reducer", () => {
	it("keeps host connectivity while navigating an empty project and clears recovered errors", () => {
		let state = reduceTaskState(createInitialTaskState(), { type: "connection", status: "connected" });
		state = reduceTaskState(state, { type: "reset", project: null, session: null });
		expect(state.connection).toBe("connected");
		state = reduceTaskState(state, { type: "session", session: null });
		expect(state.connection).toBe("connected");
		state = reduceTaskState(state, { type: "connection", status: "offline", error: "old failure" });
		state = reduceTaskState(state, { type: "connection", status: "connected" });
		expect(state.lastError).toBeUndefined();
	});
	it("projects pinned OMP message snapshots into one stable row per incarnation", () => {
		const event = (sequence: number, frame: Record<string, unknown>) => ({
			sessionId: "session-1",
			incarnation: "incarnation-1",
			sequence,
			timestamp: new Date(sequence).toISOString(),
			frame: frame as Json,
		});
		const text = (value: string) => [{ type: "text", text: value }];
		const events = [
			event(1, { type: "message_start", message: { role: "assistant", content: [], timestamp: 1 } }),
			event(2, {
				type: "message_update",
				message: { role: "assistant", content: text("hello"), timestamp: 1 },
				assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "hello", partial: { role: "assistant", content: text("hello"), timestamp: 1 } },
			}),
			event(3, {
				type: "message_update",
				message: { role: "assistant", content: text("hello world"), timestamp: 1 },
				assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: " world", partial: { role: "assistant", content: text("hello world"), timestamp: 1 } },
			}),
			event(4, { type: "message_end", message: { role: "assistant", content: text("hello world"), stopReason: "stop", timestamp: 1 } }),
		];
		let state = applyEventPage(createInitialTaskState(), { events, cursor: 4, hasMore: false });
		expect(state.transcript).toHaveLength(1);
		expect(state.transcript[0]).toMatchObject({ id: "incarnation-1:message:1", role: "assistant", text: "hello world", status: "completed" });
		expect(state.transcript[0]?.rawFrames).toHaveLength(4);
		// The same journal page is a no-op, including for snapshots that expose a
		// response id only at message_end.
		const lateFinal = event(4, { type: "message_end", message: { role: "assistant", content: text("hello world"), responseId: "late-response-id", stopReason: "stop", timestamp: 1 } });
		state = applyEventPage(state, { events: [...events.slice(0, 3), lateFinal], cursor: 4, hasMore: false });
		expect(state.transcript).toHaveLength(1);
		expect(state.transcript[0]?.rawFrames).toHaveLength(4);
	});

	it("renders OMP tool partialResult/result content and isError on one card", () => {
		const event = (sequence: number, frame: Record<string, unknown>) => ({ sessionId: "session-1", incarnation: "incarnation-1", sequence, timestamp: new Date(sequence).toISOString(), frame: frame as Json });
		const text = (value: string) => [{ type: "text", text: value }];
		const state = applyEventPage(createInitialTaskState(), {
			events: [
				event(10, { type: "tool_execution_start", toolCallId: "call-1", toolName: "write_file", args: { path: "a.txt" } }),
				event(11, { type: "tool_execution_update", toolCallId: "call-1", toolName: "write_file", args: { path: "a.txt" }, partialResult: { content: text("writing") } }),
				event(12, { type: "tool_execution_end", toolCallId: "call-1", toolName: "write_file", result: { content: text("permission denied"), isError: true }, isError: true }),
		],
		cursor: 12,
		hasMore: false,
	});
		expect(state.transcript).toHaveLength(1);
		expect(state.transcript[0]).toMatchObject({ id: "call-1", kind: "tool", toolName: "write_file", toolStatus: "failed", status: "failed" });
		expect(state.transcript[0]?.output).toContain("writing");
		expect(state.transcript[0]?.output).toContain("permission denied");
		expect(state.transcript[0]?.rawFrames).toHaveLength(3);
	});

	it("ignores events from another session or incarnation", () => {
		const session = { id: "session-1", projectId: "project-1", title: "Task", cwd: "/tmp", sessionFile: "/tmp/task.jsonl", incarnation: "incarnation-1", status: "running" as const, archived: false, createdAt: "now", updatedAt: "now" };
		let state = reduceTaskState(createInitialTaskState(), { type: "session", session });
		state = applyEvent(state, { sessionId: "session-2", incarnation: "incarnation-1", sequence: 1, timestamp: "now", frame: { type: "message_start", message: { role: "assistant", content: [{ type: "text", text: "wrong session" }] } } });
		state = applyEvent(state, { sessionId: "session-1", incarnation: "incarnation-2", sequence: 2, timestamp: "now", frame: { type: "message_start", message: { role: "assistant", content: [{ type: "text", text: "stale incarnation" }] } } });
		state = reduceTaskState(state, { type: "frame", sessionId: "session-2", incarnation: "incarnation-1", sequence: 3, frame: { type: "message_start", message: { role: "assistant", content: [{ type: "text", text: "wrong session" }] } } });
		expect(state.transcript).toHaveLength(0);
	});

	it("keeps stable message identity while streaming and retains raw OMP frames", () => {
		const start = { sessionId: "s", incarnation: "i", sequence: 1, timestamp: "t", frame: { type: "message_start", messageId: "m-1", role: "assistant" } } as const;
		const update = { sessionId: "s", incarnation: "i", sequence: 2, timestamp: "t", frame: { type: "message_update", messageId: "m-1", delta: "hel" } } as const;
		const end = { sessionId: "s", incarnation: "i", sequence: 3, timestamp: "t", frame: { type: "message_end", messageId: "m-1", text: "lo" } } as const;
		let state = applyEventPage(createInitialTaskState(), { events: [start, update, end], cursor: 3, hasMore: false });
		expect(state.transcript).toHaveLength(1);
		expect(state.transcript[0]).toMatchObject({ id: "m-1", text: "hel", status: "completed" });
		expect(state.transcript[0]?.rawFrames).toHaveLength(3);
		// Replaying the same page is harmless after reconnect.
		state = applyEventPage(state, { events: [start, update, end], cursor: 3, hasMore: false });
		expect(state.transcript).toHaveLength(1);
		expect(state.transcript[0]?.rawFrames).toHaveLength(3);
	});

	it("projects tool execution frames into one expandable identity", () => {
		const state = applyEventPage(createInitialTaskState(), {
			events: [
				{ sessionId: "s", incarnation: "i", sequence: 5, timestamp: "t", frame: { type: "tool_execution_start", toolCallId: "call-1", toolName: "write_file", args: { path: "a" } } },
				{ sessionId: "s", incarnation: "i", sequence: 6, timestamp: "t", frame: { type: "tool_execution_update", toolCallId: "call-1", output: "checking" } },
				{ sessionId: "s", incarnation: "i", sequence: 7, timestamp: "t", frame: { type: "tool_execution_end", toolCallId: "call-1", output: "done" } },
			],
			cursor: 7,
			hasMore: false,
		});
		expect(state.transcript).toHaveLength(1);
		expect(state.transcript[0]).toMatchObject({ id: "call-1", kind: "tool", toolName: "write_file", toolStatus: "completed" });
		expect(state.transcript[0]?.output).toContain("checking");
		expect(state.transcript[0]?.output).toContain("done");
		expect(state.transcript[0]?.rawFrames).toHaveLength(3);
	});

	it("accepts exact broker interactive envelopes without auto-approving", () => {
		const envelope = { kind: "interactive", token: "tok-1", request: { method: "confirm", id: "request-1", title: "Write file?", message: "a.txt" } };
		expect(parseCaretUiRequest(envelope)).toMatchObject({ token: "tok-1", request: envelope.request });
		let state = reduceTaskState(createInitialTaskState(), { type: "ui_request", event: envelope });
		expect(state.uiRequests).toHaveLength(1);
		expect(state.uiRequests[0]?.request.method).toBe("confirm");
		state = reduceTaskState(state, { type: "ui_resolved", token: "tok-1" });
		expect(state.uiRequests).toHaveLength(0);
		expect(parseCaretUiRequest({ ...envelope, request: { ...envelope.request, message: 42 } })).toBeUndefined();
	});

	it("does not treat message fragments with no journal sequence as duplicates", () => {
		let state = createInitialTaskState();
		state = applyFrame(state, { type: "message_start", messageId: "m", role: "assistant" });
		state = applyFrame(state, { type: "message_update", messageId: "m", delta: "one" });
		state = applyFrame(state, { type: "message_update", messageId: "m", delta: " two" });
		expect(state.transcript[0]?.text).toBe("one two");
	});

	it("marks in-flight commands unknown on disconnect and never makes them replayable", () => {
		let state = createInitialTaskState();
		state = reduceTaskState(state, { type: "command_created", command: { commandId: "cmd-1", incarnation: "inc-1", command: "prompt", payload: { message: "go" } } });
		state = reduceTaskState(state, { type: "command_status", commandId: "cmd-1", status: "sent" });
		state = reduceTaskState(state, { type: "connection", status: "offline", error: "host closed" });
		expect(state.pendingCommands["cmd-1"]).toMatchObject({ status: "unknown", replayable: false });
	});
});

describe("Caret webview message boundary", () => {
	it("accepts known actions and rejects arbitrary host actions", () => {
		expect(parseWebviewMessage({ type: "native_action", action: "terminal" })).toEqual({ type: "native_action", action: "terminal" });
		expect(parseWebviewMessage({ type: "native_action", action: "run_shell" })).toBeUndefined();
		expect(parseWebviewMessage({ type: "ui_answer", token: "t", answer: { cancelled: true, timedOut: true } })).toMatchObject({ type: "ui_answer" });
		expect(parseWebviewMessage({ type: "ui_answer", token: "t", answer: { cancelled: true, command: "approve" } })).toBeUndefined();
		expect(parseWebviewMessage({ type: "get_login_providers" })).toEqual({ type: "get_login_providers" });
		expect(parseWebviewMessage({ type: "start_login", providerId: "openai" })).toEqual({ type: "start_login", providerId: "openai" });
		expect(parseWebviewMessage({ type: "open_login_url", url: "https://example.test/oauth" })).toEqual({ type: "open_login_url", url: "https://example.test/oauth" });
		expect(parseWebviewMessage({ type: "open_login_url", url: "javascript:alert(1)" })).toBeUndefined();
	});
	it("projects OMP login open_url presentations without treating them as interactive prompts", () => {
		const state = applyFrame(createInitialTaskState(), {
			type: "caret_ui",
			event: { kind: "presentation", request: { id: "url-1", method: "open_url", url: "https://example.test/login", instructions: "Open manually" } },
		} as Json);
		expect(state.uiRequests).toEqual([]);
		expect(state.presentations).toEqual([{ id: "url-1", method: "open_url", url: "https://example.test/login", instructions: "Open manually" }]);
	});
});
