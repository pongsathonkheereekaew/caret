import { describe, expect, it, mock } from "bun:test";
import {
	abortRequest,
	CARET_CHAT_PARTICIPANT_ID,
	CARET_CHAT_SESSION_SCHEME,
	CARET_CHAT_SESSION_TYPE,
	currentModelIdFromOmpState,
	getAvailableModelsRequest,
	getLoginProvidersRequest,
	getOmpStateRequest,
	modelPickerGroupFromSnapshot,
	normalizeOmpLoginProviders,
	normalizeOmpModels,
	projectNameFor,
	projectOmpModelSnapshot,
	promptRequest,
	resolveOmpModelPickProvider,
	sessionIdFromUri,
	sessionItemShape,
	sessionState,
	sessionUriString,
	setOmpModelRequest,
	turnPlansFromTranscript,
} from "../src/chat-sessions-map.ts";
import type { Project, Session } from "../../../packages/protocol/src/index.ts";
import type { TranscriptEntry } from "../src/state.ts";

function session(patch: Partial<Session> = {}): Session {
	return {
		id: "s1",
		projectId: "p1",
		title: "Fix the sidebar",
		cwd: "/Users/pond/caret",
		sessionFile: "/tmp/session.json",
		incarnation: "inc-1",
		status: "idle",
		archived: false,
		createdAt: "2026-09-14T07:00:00.000Z",
		updatedAt: "2026-09-14T07:30:00.000Z",
		...patch,
	};
}

function project(patch: Partial<Project> = {}): Project {
	return { id: "p1", name: "caret", path: "/Users/pond/caret", archived: false, ...patch } as Project;
}

function entry(patch: Partial<TranscriptEntry> & Pick<TranscriptEntry, "role">): TranscriptEntry {
	return {
		id: "e1",
		kind: "message",
		text: "",
		status: "completed",
		rawFrames: [],
		...patch,
	} as TranscriptEntry;
}

describe("session resource identity", () => {
	it("round-trips a session id through its resource uri", () => {
		expect(sessionIdFromUri({ scheme: CARET_CHAT_SESSION_SCHEME, authority: "session", path: "/abc-123" })).toBe("abc-123");
		expect(CARET_CHAT_SESSION_TYPE).toBe(CARET_CHAT_PARTICIPANT_ID);
	});

	it("does not claim resources owned by another provider", () => {
		expect(sessionIdFromUri({ scheme: "vscode-chat", authority: "session", path: "/abc" })).toBeUndefined();
		expect(sessionIdFromUri({ scheme: CARET_CHAT_SESSION_SCHEME, authority: "other", path: "/abc" })).toBeUndefined();
		expect(sessionIdFromUri({ scheme: CARET_CHAT_SESSION_SCHEME, authority: "session", path: "/" })).toBeUndefined();
	});

	it("keeps ids that need escaping reversible", () => {
		const id = "session/with space+plus";
		const parsed = new URL(sessionUriString(id));
		expect(sessionIdFromUri({ scheme: parsed.protocol.replace(":", ""), authority: parsed.host, path: parsed.pathname })).toBe(id);
	});
});

describe("sessionState", () => {
	it("maps the four host statuses without inventing a fifth", () => {
		expect(sessionState("running")).toBe("in-progress");
		expect(sessionState("recovery_required")).toBe("failed");
		expect(sessionState("idle")).toBe("completed");
		expect(sessionState("stopped")).toBe("completed");
	});
});

describe("sessionItemShape", () => {
	it("carries title, project name and timings from the host record", () => {
		const shape = sessionItemShape(session({ status: "running" }), "caret");
		expect(shape).toMatchObject({ id: "s1", label: "Fix the sidebar", description: "caret", state: "in-progress" });
		expect(shape.timing.created).toBe(Date.parse("2026-09-14T07:00:00.000Z"));
		expect(shape.timing.lastRequestStarted).toBe(Date.parse("2026-09-14T07:30:00.000Z"));
	});

	it("leaves lastRequestEnded unset while a turn is still running", () => {
		expect(sessionItemShape(session({ status: "running" })).timing.lastRequestEnded).toBeUndefined();
		expect(sessionItemShape(session({ status: "idle" })).timing.lastRequestEnded).toBe(Date.parse("2026-09-14T07:30:00.000Z"));
	});

	it("leaves description undefined rather than inventing a project label", () => {
		expect(sessionItemShape(session()).description).toBeUndefined();
	});

	it("resolves the project name from the host list", () => {
		expect(projectNameFor([project(), project({ id: "p2", name: "caret-ios" })], session())).toBe("caret");
		expect(projectNameFor([project({ id: "p2" })], session())).toBeUndefined();
	});
});

describe("turnPlansFromTranscript", () => {
	it("pairs each user request with the assistant and tool work that answered it", () => {
		const plans = turnPlansFromTranscript([
			entry({ id: "u1", role: "user", text: "Fix the sidebar" }),
			entry({ id: "a1", role: "assistant", text: "Looking at the filters." }),
			entry({ id: "t1", role: "tool", kind: "tool", text: "read_file", toolName: "read_file" }),
			entry({ id: "a2", role: "assistant", text: "Fixed." }),
			entry({ id: "u2", role: "user", text: "Thanks" }),
		]);

		expect(plans).toEqual([
			{ kind: "request", text: "Fix the sidebar", toolNames: [] },
			{ kind: "response", text: "Looking at the filters.\n\nFixed.", toolNames: ["read_file"] },
			{ kind: "request", text: "Thanks", toolNames: [] },
		]);
	});

	it("drops system entries instead of showing them as assistant text", () => {
		const plans = turnPlansFromTranscript([
			entry({ id: "s1", role: "system", text: "compaction" }),
			entry({ id: "a1", role: "assistant", text: "Ready." }),
		]);
		expect(plans).toEqual([{ kind: "response", text: "Ready.", toolNames: [] }]);
	});

	it("names a tool run even when the frame carried no label", () => {
		const plans = turnPlansFromTranscript([entry({ id: "t1", role: "tool", kind: "tool", text: "bash" })]);
		expect(plans).toEqual([{ kind: "response", text: "", toolNames: ["bash"] }]);
	});
});

describe("command requests", () => {
	it("sends a prompt as the OMP prompt command with a {message} payload", () => {
		expect(promptRequest(session(), "do the thing", "cmd-1")).toEqual({
			commandId: "cmd-1",
			incarnation: "inc-1",
			command: "prompt",
			payload: { message: "do the thing" },
		});
	});

	it("stops a turn with the abort command, never a second prompt", () => {
		expect(abortRequest(session(), "cmd-2")).toEqual({ commandId: "cmd-2", incarnation: "inc-1", command: "abort" });
	});

	it("keeps the participant id extension-owned", () => {
		expect(CARET_CHAT_PARTICIPANT_ID.startsWith("caret.")).toBe(true);
	});

	it("builds OMP model commands through the host envelope only", () => {
		expect(getAvailableModelsRequest(session(), "cmd-models")).toEqual({
			commandId: "cmd-models",
			incarnation: "inc-1",
			command: "get_available_models",
			payload: {},
		});
		expect(getOmpStateRequest(session(), "cmd-state")).toEqual({
			commandId: "cmd-state",
			incarnation: "inc-1",
			command: "get_state",
			payload: {},
		});
		expect(setOmpModelRequest(session(), "probe", "probe-model", "cmd-set")).toEqual({
			commandId: "cmd-set",
			incarnation: "inc-1",
			command: "set_model",
			payload: { provider: "probe", modelId: "probe-model" },
		});
	});
});

describe("OMP model catalog projection (fixtures only)", () => {
	const probeModels = {
		data: {
			models: [
				{ id: "probe-model", name: "Caret OMP probe model", provider: "probe" },
				{ modelId: "second-model", provider: "probe", label: "Second", available: false, reason: "disabled for test" },
				{ provider: "probe" },
			],
		},
	};

	it("normalizes get_available_models ack/result shapes without inventing rows", () => {
		expect(normalizeOmpModels(probeModels)).toEqual([
			{ id: "probe-model", provider: "probe", label: "Caret OMP probe model", available: true },
			{ id: "second-model", provider: "probe", label: "Second", available: false, reason: "disabled for test" },
		]);
		expect(normalizeOmpModels({ models: [] })).toEqual([]);
		expect(normalizeOmpModels(undefined)).toEqual([]);
	});

	it("reads the get_state current model id without guessing", () => {
		expect(currentModelIdFromOmpState({ data: { model: { id: "probe-model", provider: "probe" } } })).toBe("probe-model");
		expect(currentModelIdFromOmpState({ model: { modelId: "second-model" } })).toBe("second-model");
		expect(currentModelIdFromOmpState({ data: {} })).toBeUndefined();
		expect(currentModelIdFromOmpState(undefined)).toBeUndefined();
	});

	it("keeps the current selection only when still advertised (no fallback)", () => {
		const models = normalizeOmpModels(probeModels);
		expect(projectOmpModelSnapshot(models, "probe-model")).toMatchObject({
			selectedModelId: "probe-model",
			hasModels: true,
		});
		const dropped = projectOmpModelSnapshot(models, "gone-model");
		expect(dropped.selectedModelId).toBeUndefined();
		expect(dropped.hasModels).toBe(true);
		expect(dropped.models).toHaveLength(2);
		expect(projectOmpModelSnapshot([], "probe-model")).toEqual({ models: [], hasModels: false });
	});

	it("marks provider-unauthenticated rows with a needs-auth reason", () => {
		const models = normalizeOmpModels(probeModels);
		const snapshot = projectOmpModelSnapshot(models, "probe-model", [{ id: "probe", authenticated: false }]);
		expect(snapshot.models[0]?.reason).toBe("Provider is not authenticated");
		expect(snapshot.selectedModelId).toBe("probe-model");
	});

	it("projects an honest picker group (empty catalog stays empty)", () => {
		const advertised = projectOmpModelSnapshot(normalizeOmpModels(probeModels), "probe-model");
		const group = modelPickerGroupFromSnapshot(advertised);
		expect(group).toMatchObject({ id: "models", name: "Models" });
		expect(group.items.map(item => item.id)).toEqual(["probe-model", "second-model"]);
		expect(group.selected?.id).toBe("probe-model");
		expect(modelPickerGroupFromSnapshot(projectOmpModelSnapshot([], undefined)).items).toEqual([]);
	});

	it("unwraps a bare {data:'<id>'} current model id (m3)", () => {
		expect(currentModelIdFromOmpState({ data: "probe-model" })).toBe("probe-model");
		expect(currentModelIdFromOmpState({ data: { data: "probe-model" } })).toBe("probe-model");
		expect(currentModelIdFromOmpState("probe-model")).toBe("probe-model");
		expect(currentModelIdFromOmpState({ data: "" })).toBeUndefined();
	});

	it("builds the get_login_providers command through the host envelope only", () => {
		expect(getLoginProvidersRequest(session(), "cmd-login")).toEqual({
			commandId: "cmd-login",
			incarnation: "inc-1",
			command: "get_login_providers",
			payload: {},
		});
	});
});

describe("OMP login providers fetch shape (fixtures only, M1)", () => {
	it("normalizes get_login_providers ack/result shapes without inventing rows", () => {
		const nested = { data: { providers: [{ id: "probe", authenticated: false }, { id: "other", authenticated: true }] } };
		expect(normalizeOmpLoginProviders(nested)).toEqual([
			{ id: "probe", authenticated: false },
			{ id: "other", authenticated: true },
		]);
		expect(normalizeOmpLoginProviders({ providers: [{ id: "probe" }] })).toEqual([{ id: "probe" }]);
		expect(normalizeOmpLoginProviders({ data: [{ id: "probe", authenticated: true }] })).toEqual([
			{ id: "probe", authenticated: true },
		]);
		expect(normalizeOmpLoginProviders([{ id: "probe", authenticated: false }, { provider: "no-id" }])).toEqual([
			{ id: "probe", authenticated: false },
		]);
		expect(normalizeOmpLoginProviders(undefined)).toEqual([]);
		expect(normalizeOmpLoginProviders({ data: {} })).toEqual([]);
	});

	it("leaves unauthenticated flags absent instead of inventing false", () => {
		expect(normalizeOmpLoginProviders({ providers: [{ id: "probe" }] })[0]).not.toHaveProperty("authenticated");
	});

	it("annotates needs-auth only for explicit false, never for missing flags", () => {
		const models = normalizeOmpModels({ data: { models: [{ id: "m1", provider: "probe" }] } });
		const annotated = projectOmpModelSnapshot(models, "m1", [{ id: "probe", authenticated: false }]);
		expect(annotated.models[0]?.reason).toBe("Provider is not authenticated");
		const silent = projectOmpModelSnapshot(models, "m1", [{ id: "probe" }]);
		expect(silent.models[0]?.reason).toBeUndefined();
		const emptyProviders = projectOmpModelSnapshot(models, "m1", []);
		expect(emptyProviders.models[0]?.reason).toBeUndefined();
		expect(emptyProviders.selectedModelId).toBe("m1");
	});
});

describe("OMP model pick resolution (fixtures only, m4)", () => {
	const models = normalizeOmpModels({ data: { models: [{ id: "probe-model", provider: "probe" }] } });
	const snapshot = projectOmpModelSnapshot(models, "probe-model");

	it("prefers the advertised catalog row for the provider", () => {
		expect(resolveOmpModelPickProvider(snapshot, "probe-model", "stale-desc")).toBe("probe");
	});

	it("falls back to the picker description when the catalog row is stale", () => {
		expect(resolveOmpModelPickProvider(snapshot, "new-model", "probe")).toBe("probe");
	});

	it("returns undefined for an unknown provider so the caller fails honestly", () => {
		expect(resolveOmpModelPickProvider(snapshot, "ghost-model", undefined)).toBeUndefined();
		expect(resolveOmpModelPickProvider(snapshot, "ghost-model", "")).toBeUndefined();
		expect(resolveOmpModelPickProvider(snapshot, "ghost-model", 42)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// chat-sessions.ts fixture tests (mocked host + mocked vscode, no providers).
// ---------------------------------------------------------------------------

const vscodeInputStates: any[] = [];
let vscodeController: any = null;
mock.module("vscode", () => ({
	ChatSessionStatus: { Completed: 0, Failed: 1, InProgress: 2 },
	CancellationError: class extends Error {
		override name = "CancellationError";
	},
	Disposable: { from: (..._disposables: any[]) => ({ dispose() {} }) },
	Uri: {
		parse: (value: string) => {
			const url = new URL(value);
			return { scheme: url.protocol.replace(":", ""), authority: url.host, path: url.pathname, toString: () => value };
		},
	},
	ChatRequestTurn2: class {},
	ChatResponseTurn2: class {},
	ChatResponseMarkdownPart: class {},
	chat: {
		createChatParticipant: () => ({ dispose() {} }),
		createChatSessionItemController: () => {
			vscodeController = {
				items: { replace() {}, add() {} },
				createChatSessionItem: (uri: any, label: string) => ({ uri, label }),
				createChatSessionInputState: (groups: any[]) => {
					const state: any = {
						groups,
						_cb: null as ((...args: any[]) => void) | null,
						onDidChange(cb: (...args: any[]) => void) {
							state._cb = cb;
							return { dispose() {} };
						},
						fire() {
							state._cb?.();
						},
					};
					vscodeInputStates.push(state);
					return state;
				},
			};
			return vscodeController;
		},
		registerChatSessionContentProvider: () => ({ dispose() {} }),
	},
}));

const chatSessions: typeof import("../src/chat-sessions.ts") = await import("../src/chat-sessions.ts");

function baseCommand(over: Record<string, unknown> = {}): any {
	return {
		sessionId: "s1",
		commandId: "cmd-1",
		deviceId: "dev-1",
		incarnation: "inc-1",
		kind: "command",
		payload: {},
		payloadHash: "",
		status: "completed",
		createdAt: "2026-09-14T07:00:00.000Z",
		updatedAt: "2026-09-14T07:00:00.000Z",
		...over,
	};
}

function tick(ms = 20): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

describe("fetchOmpModelSnapshot failure modes (fixtures only, M5)", () => {
	it("never throws and yields an empty catalog when the host is down", async () => {
		const logs: string[] = [];
		const client: any = {
			async sendCommand() {
				throw new Error("host down");
			},
		};
		const snapshot = await chatSessions.fetchOmpModelSnapshot(client, session(), { log: (message: string) => logs.push(message) });
		expect(snapshot).toEqual({ models: [], hasModels: false });
		expect(logs.length).toBeGreaterThan(0);
	});

	it("threads get_login_providers needs_auth in prod path without an injected list", async () => {
		const seen: string[] = [];
		const client: any = {
			async sendCommand(_sessionId: string, request: any) {
				seen.push(request.command);
				if (request.command === "get_available_models") {
					return baseCommand({ result: { data: { models: [{ id: "probe-model", provider: "probe" }] } } });
				}
				if (request.command === "get_state") {
					return baseCommand({ result: { data: { model: { id: "probe-model" } } } });
				}
				if (request.command === "get_login_providers") {
					return baseCommand({ result: { data: { providers: [{ id: "probe", authenticated: false }] } } });
				}
				throw new Error(`unexpected command ${request.command}`);
			},
		};
		const snapshot = await chatSessions.fetchOmpModelSnapshot(client, session(), { log: () => {} });
		expect(seen).toContain("get_login_providers");
		expect(snapshot.selectedModelId).toBe("probe-model");
		expect(snapshot.models[0]?.reason).toBe("Provider is not authenticated");
	});

	it("an injected loginProviders list wins and skips the provider fetch", async () => {
		const seen: string[] = [];
		const client: any = {
			async sendCommand(_sessionId: string, request: any) {
				seen.push(request.command);
				if (request.command === "get_available_models") {
					return baseCommand({ result: { data: { models: [{ id: "probe-model", provider: "probe" }] } } });
				}
				if (request.command === "get_state") {
					return baseCommand({ result: { data: { model: { id: "probe-model" } } } });
				}
				throw new Error(`unexpected command ${request.command}`);
			},
		};
		const snapshot = await chatSessions.fetchOmpModelSnapshot(client, session(), {
			loginProviders: [{ id: "probe", authenticated: true }],
			log: () => {},
		});
		expect(seen).not.toContain("get_login_providers");
		expect(snapshot.models[0]?.reason).toBeUndefined();
	});
});

describe("setOmpModel error branches (fixtures only, M5)", () => {
	it("throws for failed/outcome_unknown/not_dispatched and validates input", async () => {
		for (const status of ["failed", "outcome_unknown", "not_dispatched"] as const) {
			const client: any = {
				async sendCommand() {
					return baseCommand({ status, error: `${status} for test` });
				},
			};
			await expect(chatSessions.setOmpModel(client, session(), "probe", "probe-model")).rejects.toThrow();
		}
		const ok: any = {
			async sendCommand(_sessionId: string, request: any) {
				expect(request.command).toBe("set_model");
				expect(request.payload).toMatchObject({ provider: "probe", modelId: "probe-model" });
				return baseCommand({ status: "completed" });
			},
		};
		await expect(chatSessions.setOmpModel(ok, session(), "probe", "probe-model")).resolves.toBeUndefined();
		const never: any = {
			async sendCommand() {
				throw new Error("must not be called");
			},
		};
		await expect(chatSessions.setOmpModel(never, session(), "", "probe-model")).rejects.toThrow();
		await expect(chatSessions.setOmpModel(never, session(), "probe", "  ")).rejects.toThrow();
	});
});

describe("runTurn abort and idle-exit (fixtures only, M5)", () => {
	it("sends abort and exits when the token is already cancelled", async () => {
		const sent: string[] = [];
		const markdown: string[] = [];
		const client: any = {
			async getEvents() {
				return { events: [], cursor: 0, hasMore: false };
			},
			async startSession() {
				return session();
			},
			async sendCommand(_sessionId: string, request: any) {
				sent.push(request.command);
				return baseCommand({});
			},
			async getSession() {
				return session();
			},
		};
		const stream: any = { markdown: (text: string) => void markdown.push(text), progress: () => {} };
		await chatSessions.runTurn(client, session(), "hello", stream, { isCancellationRequested: true } as any, () => {});
		expect(sent).toContain("prompt");
		expect(sent).toContain("abort");
	});

	it("exits idle when the host goes quiet and the session is not running", async () => {
		const client: any = {
			async getEvents() {
				return { events: [], cursor: 0, hasMore: false };
			},
			async startSession() {
				return session();
			},
			async sendCommand() {
				return baseCommand({});
			},
			async getSession() {
				return session({ status: "idle" });
			},
		};
		const stream: any = { markdown: () => {}, progress: () => {} };
		await chatSessions.runTurn(client, session(), "hello", stream, { isCancellationRequested: false } as any, () => {});
	});
});

describe("model picker pick -> set_model (fixtures only, B1 + unknown-provider)", () => {
	function pickerClient(setModelCalls: any[]): any {
		return {
			async getSession() {
				return session();
			},
			async sendCommand(_sessionId: string, request: any) {
				if (request.command === "get_available_models") {
					return baseCommand({
						result: {
							data: {
								models: [
									{ id: "probe-model", provider: "probe", label: "Probe" },
									{ id: "second-model", provider: "probe", label: "Second" },
								],
							},
						},
					});
				}
				if (request.command === "get_state") {
					return baseCommand({ result: { data: { model: { id: "probe-model" } } } });
				}
				if (request.command === "get_login_providers") {
					return baseCommand({ result: { data: { providers: [{ id: "probe", authenticated: true }] } } });
				}
				if (request.command === "set_model") {
					setModelCalls.push(request);
					return baseCommand({ status: "completed" });
				}
				throw new Error(`unexpected command ${request.command}`);
			},
		};
	}

	it("fires set_model even after the outer input-state token is cancelled (B1)", async () => {
		vscodeInputStates.length = 0;
		const setModelCalls: any[] = [];
		const logs: string[] = [];
		const client = pickerClient(setModelCalls);
		chatSessions.registerCaretChatSessions({ getClient: async () => client, log: (message: string) => logs.push(message) });
		const token: any = { isCancellationRequested: false };
		const resource: any = { scheme: "caret", authority: "session", path: "/s1" };
		await vscodeController.getChatSessionInputState(resource, {}, token);
		const inputState = vscodeInputStates.at(-1);
		expect(inputState.groups.find((group: any) => group.id === "models")?.selected?.id).toBe("probe-model");
		// The fetch token is normally cancelled by the time the user picks.
		token.isCancellationRequested = true;
		inputState.groups.find((group: any) => group.id === "models").selected = {
			id: "second-model",
			name: "Second",
			description: "probe",
		};
		inputState.fire();
		await tick(50);
		expect(setModelCalls.map(call => call.payload)).toEqual([{ provider: "probe", modelId: "second-model" }]);
	});

	it("logs honestly and sends nothing when the provider is unknown", async () => {
		vscodeInputStates.length = 0;
		const setModelCalls: any[] = [];
		const logs: string[] = [];
		const client = pickerClient(setModelCalls);
		chatSessions.registerCaretChatSessions({ getClient: async () => client, log: (message: string) => logs.push(message) });
		const resource: any = { scheme: "caret", authority: "session", path: "/s1" };
		await vscodeController.getChatSessionInputState(resource, {}, { isCancellationRequested: false });
		const inputState = vscodeInputStates.at(-1);
		inputState.groups.find((group: any) => group.id === "models").selected = { id: "ghost-model", name: "Ghost" };
		inputState.fire();
		await tick(50);
		expect(setModelCalls).toEqual([]);
		expect(logs.some(message => message.includes("ghost-model") && message.includes("unknown"))).toBe(true);
	});
});
