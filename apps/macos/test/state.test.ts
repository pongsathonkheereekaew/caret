import { describe, expect, it } from "bun:test";
import { applyEvent, applyEventPage, applyFrame, createInitialTaskState, normalizeSlashCommands, parseCaretUiRequest, reduceTaskState } from "../src/state.ts";
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
	it("prepends advertised OMP history without duplicating live rows", () => {
		let state = reduceTaskState(createInitialTaskState(), {
			type: "history_page",
			entries: [{ id: "omp-hist:m1", kind: "message", role: "user", text: "hello", status: "completed", rawFrames: [] }],
		});
		state = reduceTaskState(state, {
			type: "history_page",
			entries: [{ id: "omp-hist:m1", kind: "message", role: "user", text: "hello", status: "completed", rawFrames: [] }],
		});
		expect(state.transcript.map(entry => entry.id)).toEqual(["omp-hist:m1"]);
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

	it("binds interactive requests to the current session incarnation", () => {
		const session = { id: "session-1", projectId: "project-1", title: "Task", cwd: "/tmp", sessionFile: "/tmp/task.jsonl", incarnation: "incarnation-1", status: "running" as const, archived: false, createdAt: "now", updatedAt: "now" };
		let state = reduceTaskState(createInitialTaskState(), { type: "session", session });
		state = reduceTaskState(state, { type: "ui_request", event: { kind: "interactive", token: "tok-1", request: { method: "confirm", id: "r1", title: "Allow?", message: "run" } } });
		expect(state.uiRequests[0]).toMatchObject({ token: "tok-1", sessionId: "session-1", incarnation: "incarnation-1" });
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
		expect(parseCaretUiRequest({ kind: "interactive", token: "tok-p", request: { method: "password", id: "p1", title: "Secret" } })?.request.method).toBe("password");
		expect(parseCaretUiRequest({ kind: "interactive", token: "tok-m", request: { method: "multi_select", id: "m1", title: "Pick", options: ["a", "b"] } })?.request.method).toBe("multi_select");
		expect(parseCaretUiRequest({ kind: "interactive", token: "tok-s", request: { method: "schemaform", id: "s1", title: "Form" } })?.request.method).toBe("schemaform");
		expect(parseCaretUiRequest({ kind: "interactive", token: "tok-c", request: { method: "confirm", id: "c1", title: "Allow?", message: "run", scopes: ["cwd"], dangerous: true } })?.request).toMatchObject({ scopes: ["cwd"], dangerous: true });
		expect(parseCaretUiRequest({
			kind: "interactive",
			token: "tok-r",
			request: {
				method: "select",
				id: "s1",
				title: "Pick",
				options: ["a", "b"],
				required: true,
				optionDetails: [{ value: "a", label: "Alpha", description: "first" }, { description: "second" }],
			},
		})?.request).toMatchObject({
			required: true,
			optionDetails: [{ value: "a", label: "Alpha", description: "first" }, { description: "second" }],
		});
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
		expect(parseWebviewMessage({ type: "ui_answer", token: "t", answer: ["a", "b"] })).toEqual({ type: "ui_answer", token: "t", answer: ["a", "b"] });
		expect(parseWebviewMessage({ type: "export_diagnostics" })).toEqual({ type: "export_diagnostics" });
		expect(parseWebviewMessage({ type: "restore_sent_draft" })).toEqual({ type: "restore_sent_draft" });
		expect(parseWebviewMessage({ type: "set_sidebar_filters", filters: { archived: true } })).toMatchObject({ type: "set_sidebar_filters" });
		expect(parseWebviewMessage({ type: "ui_answer", token: "t", answer: { cancelled: true, command: "approve" } })).toBeUndefined();
		expect(parseWebviewMessage({ type: "get_login_providers" })).toEqual({ type: "get_login_providers" });
		expect(parseWebviewMessage({ type: "get_slash_commands" })).toEqual({ type: "get_slash_commands" });
		expect(parseWebviewMessage({ type: "run_slash", name: "compact" })).toEqual({ type: "run_slash", name: "compact" });
		expect(parseWebviewMessage({ type: "compact" })).toEqual({ type: "compact" });
		expect(parseWebviewMessage({ type: "start_login", providerId: "openai" })).toEqual({ type: "start_login", providerId: "openai" });
		expect(parseWebviewMessage({ type: "open_login_url", url: "https://example.test/oauth" })).toEqual({ type: "open_login_url", url: "https://example.test/oauth" });
		expect(parseWebviewMessage({ type: "open_login_url", url: "javascript:alert(1)" })).toBeUndefined();
		expect(parseWebviewMessage({ type: "native_action", action: "browser" })).toEqual({ type: "native_action", action: "browser" });
		expect(parseWebviewMessage({ type: "native_action", action: "pair" })).toEqual({ type: "native_action", action: "pair" });
		expect(parseWebviewMessage({ type: "native_action", action: "devices" })).toEqual({ type: "native_action", action: "devices" });
		expect(parseWebviewMessage({ type: "native_action", action: "host_settings" })).toEqual({ type: "native_action", action: "host_settings" });
		expect(parseWebviewMessage({ type: "search", query: "webview", scope: "files" })).toEqual({ type: "search", query: "webview", scope: "files" });
		expect(parseWebviewMessage({ type: "review_file", path: "apps/macos/src/webview.ts" })).toEqual({ type: "review_file", path: "apps/macos/src/webview.ts" });
		expect(parseWebviewMessage({ type: "pick_attachments" })).toEqual({ type: "pick_attachments" });
		expect(parseWebviewMessage({ type: "remove_attachment", id: "att-1" })).toEqual({ type: "remove_attachment", id: "att-1" });
		expect(parseWebviewMessage({ type: "open_workspace_file", path: "../secret" })).toEqual({ type: "open_workspace_file", path: "../secret" });
		expect(parseWebviewMessage({ type: "work_panel", tab: "changes" })).toEqual({ type: "work_panel", tab: "changes" });
		expect(parseWebviewMessage({ type: "inspect_outcome" })).toEqual({ type: "inspect_outcome" });
		expect(parseWebviewMessage({ type: "set_pref", key: "density", value: "detailed" })).toEqual({ type: "set_pref", key: "density", value: "detailed" });
		expect(parseWebviewMessage({ type: "set_pref", key: "submitEnter", value: false })).toEqual({ type: "set_pref", key: "submitEnter", value: false });
		expect(parseWebviewMessage({ type: "work_panel_layout", preferredWidth: 400, position: "bottom" })).toEqual({ type: "work_panel_layout", preferredWidth: 400, position: "bottom" });
		expect(parseWebviewMessage({ type: "apply_settings", section: "Appearance", revision: 2, scope: "global", values: { density: "detailed" } })).toEqual({
			type: "apply_settings",
			section: "Appearance",
			revision: 2,
			scope: "global",
			values: { density: "detailed" },
		});
		expect(parseWebviewMessage({ type: "apply_settings", section: "Appearance", revision: 1, scope: "project", values: { density: "detailed" } })).toMatchObject({ scope: "project" });
		expect(parseWebviewMessage({ type: "reset_settings", key: "density", revision: 2 })).toEqual({ type: "reset_settings", key: "density", revision: 2 });
		expect(parseWebviewMessage({ type: "route_error_action", action: "projects" })).toEqual({ type: "route_error_action", action: "projects" });
		expect(parseWebviewMessage({ type: "route_error_action", action: "nearby" })).toBeUndefined();
		expect(parseWebviewMessage({ type: "more_action", id: "rename" })).toEqual({ type: "more_action", id: "rename" });
		expect(parseWebviewMessage({ type: "viewport", width: 1280, height: 800 })).toEqual({ type: "viewport", width: 1280, height: 800 });
		expect(parseWebviewMessage({ type: "viewport", width: "wide", height: 800 })).toBeUndefined();
		expect(parseWebviewMessage({ type: "copy_queue_draft", commandId: "cmd-1" })).toEqual({ type: "copy_queue_draft", commandId: "cmd-1" });
		expect(parseWebviewMessage({ type: "revoke_device", deviceId: "dev-1" })).toEqual({ type: "revoke_device", deviceId: "dev-1" });
		expect(parseWebviewMessage({ type: "mark_all_read" })).toEqual({ type: "mark_all_read" });
		expect(parseWebviewMessage({ type: "download_artifact", sha256: "a".repeat(64) })).toEqual({ type: "download_artifact", sha256: "a".repeat(64) });
		expect(parseWebviewMessage({ type: "download_artifact", sha256: "not-a-hash" })).toBeUndefined();
		expect(parseWebviewMessage({ type: "select_destination", id: "ws-worktree" })).toEqual({ type: "select_destination", id: "ws-worktree" });
		expect(parseWebviewMessage({ type: "mention_pick", kind: "file", id: "src/a.ts" })).toEqual({ type: "mention_pick", kind: "file", id: "src/a.ts" });
		expect(parseWebviewMessage({ type: "mention_pick", kind: "folder", id: "apps/macos" })).toEqual({ type: "mention_pick", kind: "folder", id: "apps/macos" });
		expect(parseWebviewMessage({ type: "mention_pick", kind: "cloud", id: "x" })).toBeUndefined();
		expect(parseWebviewMessage({ type: "refresh_branch" })).toEqual({ type: "refresh_branch" });
		expect(parseWebviewMessage({ type: "select_thinking_level", level: "off" })).toEqual({ type: "select_thinking_level", level: "off" });
		expect(parseWebviewMessage({ type: "retry_attachment", id: "att-1" })).toEqual({ type: "retry_attachment", id: "att-1" });
		expect(parseWebviewMessage({ type: "create_worktree" })).toEqual({ type: "create_worktree" });
		expect(parseWebviewMessage({ type: "cancel_worktree" })).toEqual({ type: "cancel_worktree" });
		expect(parseWebviewMessage({ type: "restart_resource", tab: "terminal" })).toEqual({ type: "restart_resource", tab: "terminal" });
		expect(parseWebviewMessage({ type: "restart_resource", tab: "cloud" })).toBeUndefined();
		expect(parseWebviewMessage({ type: "set_pref", key: "highContrast", value: true })).toEqual({ type: "set_pref", key: "highContrast", value: true });
		expect(parseWebviewMessage({ type: "set_queue_collapsed", collapsed: true })).toEqual({ type: "set_queue_collapsed", collapsed: true });
		expect(parseWebviewMessage({ type: "open_folder" })).toEqual({ type: "open_folder" });
		expect(parseWebviewMessage({ type: "rename_session", title: "Hi", sessionId: "s1" })).toEqual({ type: "rename_session", title: "Hi", sessionId: "s1" });
		expect(parseWebviewMessage({ type: "archive_session", sessionId: "s1" })).toEqual({ type: "archive_session", sessionId: "s1" });
		expect(parseWebviewMessage({ type: "pin_session", pinned: true, sessionId: "s1" })).toEqual({ type: "pin_session", pinned: true, sessionId: "s1" });
		expect(parseWebviewMessage({ type: "rename_session", sessionId: "s1" })).toEqual({ type: "rename_session", sessionId: "s1" });
		expect(parseWebviewMessage({ type: "archive_session" })).toEqual({ type: "archive_session" });
		expect(parseWebviewMessage({ type: "select_branch_ref", ref: "feat/s18" })).toEqual({ type: "select_branch_ref", ref: "feat/s18" });
		expect(parseWebviewMessage({ type: "select_branch_ref", ref: "" })).toBeUndefined();
		expect(parseWebviewMessage({ type: "split_pane", direction: "right" })).toEqual({ type: "split_pane", direction: "right" });
		expect(parseWebviewMessage({ type: "split_pane", direction: "cloud" })).toBeUndefined();
		expect(parseWebviewMessage({ type: "close_pane" })).toEqual({ type: "close_pane" });
		expect(parseWebviewMessage({ type: "focus_pane", viewId: "view-1" })).toEqual({ type: "focus_pane", viewId: "view-1" });
		expect(parseWebviewMessage({ type: "open_recent", path: "/Users/pond/caret" })).toEqual({ type: "open_recent", path: "/Users/pond/caret" });
		expect(parseWebviewMessage({ type: "focus_user_pty", id: "pty-1" })).toEqual({ type: "focus_user_pty", id: "pty-1" });
		expect(parseWebviewMessage({ type: "persist_pane_draft", viewId: "view-1", draft: "hello" })).toEqual({ type: "persist_pane_draft", viewId: "view-1", draft: "hello" });
		expect(parseWebviewMessage({ type: "send_prompt", text: "go", viewId: "view-2" })).toEqual({ type: "send_prompt", text: "go", viewId: "view-2" });
		expect(parseWebviewMessage({ type: "pop_to_ide", tab: "changes" })).toEqual({ type: "pop_to_ide", tab: "changes" });
		expect(parseWebviewMessage({ type: "set_layout_ratio", firstViewId: "view-1", ratio: 0.7 })).toEqual({ type: "set_layout_ratio", firstViewId: "view-1", ratio: 0.7 });
		expect(parseWebviewMessage({ type: "set_pref", key: "startupView", value: "last_task" })).toEqual({ type: "set_pref", key: "startupView", value: "last_task" });
		expect(parseWebviewMessage({ type: "set_pref", key: "windowRestore", value: false })).toEqual({ type: "set_pref", key: "windowRestore", value: false });
		expect(parseWebviewMessage({ type: "set_pref", key: "autoHideEmptyIde", value: true })).toEqual({ type: "set_pref", key: "autoHideEmptyIde", value: true });
		expect(parseWebviewMessage({ type: "open_in_split", sessionId: "s1" })).toEqual({ type: "open_in_split", sessionId: "s1" });
		expect(parseWebviewMessage({ type: "open_in_split" })).toBeUndefined();
		expect(parseWebviewMessage({ type: "select_theme" })).toEqual({ type: "select_theme" });
		expect(parseWebviewMessage({ type: "open_keybindings" })).toEqual({ type: "open_keybindings" });
		expect(parseWebviewMessage({ type: "open_merge_editor", path: "src/a.ts" })).toEqual({ type: "open_merge_editor", path: "src/a.ts" });
		expect(parseWebviewMessage({ type: "navigate_projects" })).toEqual({ type: "navigate_projects" });
		expect(parseWebviewMessage({ type: "route_back" })).toEqual({ type: "route_back" });
		expect(parseWebviewMessage({ type: "route_forward" })).toEqual({ type: "route_forward" });
		expect(parseWebviewMessage({ type: "persist_scroll", offset: 40, followLatest: false, viewId: "view-2" })).toEqual({
			type: "persist_scroll",
			offset: 40,
			followLatest: false,
			viewId: "view-2",
		});
	});
	it("projects OMP login open_url presentations without treating them as interactive prompts", () => {
		const state = applyFrame(createInitialTaskState(), {
			type: "caret_ui",
			event: { kind: "presentation", request: { id: "url-1", method: "open_url", url: "https://example.test/login", instructions: "Open manually" } },
		} as Json);
		expect(state.uiRequests).toEqual([]);
		expect(state.presentations).toEqual([{ id: "url-1", method: "open_url", url: "https://example.test/login", instructions: "Open manually" }]);
	});
	it("projects OMP slash commands from the commands list and live updates", () => {
		expect(normalizeSlashCommands({ commands: [{ name: "review", description: "Review the diff" }] })).toEqual([{ name: "review", description: "Review the diff" }]);
		const state = applyFrame(createInitialTaskState(), { type: "available_commands_update", commands: [{ name: "plan" }] } as Json);
		expect(state.slashCommands).toEqual([{ name: "plan" }]);
	});
});
