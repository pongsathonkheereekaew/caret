import { describe, expect, it } from "bun:test";
import { installVscodeStub, stubState } from "./helpers/vscode-stub.ts";import {
	abortRequest,
	CARET_CHAT_PARTICIPANT_ID,
	CARET_CHAT_SESSION_SCHEME,
	CARET_CHAT_SESSION_TYPE,
	CARET_OMP_MODEL_VENDOR,
	currentModelIdFromOmpState,
	getAvailableModelsRequest,
	getLoginProvidersRequest,
	getOmpStateRequest,
	getModelRolesRequest,
	modelPickerGroupFromSnapshot,
	modelRoleLabel,
	rolesByModelSelector,
	normalizeOmpLoginProviders,
	normalizeOmpModelRoles,
	normalizeOmpModels,
	ompModelIdFromPickId,
	ompModelPickId,
	projectNameFor,
	projectOmpModelSnapshot,
	promptRequest,
	resolveOmpModelPickProvider,
	sessionIdFromUri,
	sessionItemShape,
	sessionState,
	sessionUriString,
	setModelRoleRequest,
	setOmpModelRequest,
	turnPlansFromTranscript,
} from "../src/chat-sessions-map.ts";
import type { Project, Session } from "../../../packages/protocol/src/index.ts";
import type { OmpAdvertisedModel } from "../src/chat-sessions-map.ts";
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

	it("carries the host's archived flag, which is what moves a row to Done", () => {
		expect(sessionItemShape(session()).archived).toBe(false);
		expect(sessionItemShape(session({ archived: true })).archived).toBe(true);
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

installVscodeStub();
const vscodeInputStates: any[] = stubState.chatInputStates;
function vscodeController(): any {
	return stubState.chatSessionControllers.at(-1);
}

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
	it("starts the session when the catalog read is refused, then reads with the new incarnation", async () => {
		const seen: string[] = [];
		const incarnations: string[] = [];
		const client: any = {
			async sendCommand(_sessionId: string, request: any) {
				seen.push(request.command);
				incarnations.push(request.incarnation);
				if (request.command === "get_available_models") {
					// Refused while no OMP process owns this session, like the host's own guard.
					if (request.incarnation === "inc-idle") {
						return baseCommand({ status: "not_dispatched", error: "Start or reconcile the OMP session before sending commands" });
					}
					return baseCommand({ result: { data: { models: [{ id: "live-model", provider: "probe" }] } } });
				}
				if (request.command === "get_state") {
					return baseCommand({ result: { data: { model: { id: "live-model" } } } });
				}
				if (request.command === "get_login_providers") {
					return baseCommand({ result: { data: { providers: [{ id: "probe", authenticated: true }] } } });
				}
				throw new Error(`unexpected command ${request.command}`);
			},
			async startSession(sessionId: string) {
				seen.push("start");
				return session({ id: sessionId, incarnation: "inc-live" });
			},
			async listSessions() {
				return [session({ incarnation: "inc-idle" })];
			},
		};
		const snapshot = await chatSessions.fetchGlobalOmpModelSnapshot(async () => client, () => {});
		expect(seen).toContain("start");
		// The retry carries the incarnation the start returned, not the refused one.
		expect(incarnations).toContain("inc-live");
		expect(snapshot.hasModels).toBe(true);
		expect(snapshot.models[0]?.id).toBe("live-model");
		expect(snapshot.selectedModelId).toBe("live-model");
	});

	it("does not start a session when the catalog read already dispatched", async () => {
		const seen: string[] = [];
		const client: any = {
			async sendCommand(_sessionId: string, request: any) {
				seen.push(request.command);
				if (request.command === "get_available_models") {
					return baseCommand({ result: { data: { models: [{ id: "warm-model", provider: "probe" }] } } });
				}
				if (request.command === "get_state") {
					return baseCommand({ result: { data: { model: { id: "warm-model" } } } });
				}
				if (request.command === "get_login_providers") {
					return baseCommand({ result: { data: { providers: [] } } });
				}
				throw new Error(`unexpected command ${request.command}`);
			},
			async startSession() {
				throw new Error("start must not be called for a warm session");
			},
			async listSessions() {
				return [session()];
			},
		};
		const snapshot = await chatSessions.fetchGlobalOmpModelSnapshot(async () => client, () => {});
		expect(seen).not.toContain("start");
		// The answer the probe already has is reused: one catalog command, not two.
		expect(seen.filter(command => command === "get_available_models").length).toBe(1);
		expect(snapshot.models[0]?.id).toBe("warm-model");
	});

	it("stays honestly empty when the host cannot be asked at all", async () => {
		let started = false;
		const client: any = {
			async sendCommand() {
				throw new Error("host down");
			},
			async startSession() {
				started = true;
				return session();
			},
			async listSessions() {
				return [session()];
			},
		};
		const snapshot = await chatSessions.fetchGlobalOmpModelSnapshot(async () => client, () => {});
		expect(started).toBe(false);
		expect(snapshot).toEqual({ models: [], hasModels: false });
	});

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

describe("Caret language models (fixtures only, the model a Caret request resolves)", () => {
	function catalogClient(): any {
		return {
			async listSessions() {
				return [session()];
			},
			async startSession() {
				return session();
			},
			async sendCommand(_sessionId: string, request: any) {
				if (request.command === "get_available_models") {
					return baseCommand({
						result: { data: { models: [{ id: "deepseek-v4.1-flash", provider: "commandcode", label: "DeepSeek V4.1 Flash" }] } },
					});
				}
				if (request.command === "get_state") {
					return baseCommand({ result: { data: { model: { id: "deepseek-v4.1-flash", provider: "commandcode" } } } });
				}
				if (request.command === "get_login_providers") {
					return baseCommand({ result: { data: { providers: [] } } });
				}
				throw new Error(`unexpected command ${request.command}`);
			},
		};
	}

	/** A catalogue whose models carry roles, for the role-detail path. */
	function roleCatalogClient(): any {
		return {
			async listSessions() {
				return [session({ status: "running" })];
			},
			async startSession() {
				return session({ status: "running" });
			},
			async sendCommand(_sessionId: string, request: any) {
				if (request.command === "get_available_models") {
					return baseCommand({ result: { data: { models: [
						{ id: "gpt-5.6-luna", provider: "openai-codex", label: "GPT-5.6-Luna" },
						{ id: "gpt-6-astra", provider: "openai-codex", label: "GPT-6-Astra" },
						{ id: "grok-4.6", provider: "cursor", label: "Grok 4.6" },
					] } } });
				}
				if (request.command === "caret_get_model_roles") {
					return baseCommand({ result: { data: {
						cycleOrder: ["smol", "slow"],
						roles: [
							{ role: "smol", modelId: "openai-codex/gpt-5.6-luna", source: "global" },
							{ role: "slow", modelId: "openai-codex/gpt-6-astra", source: "global" },
						],
						storage: "global",
					} } });
				}
				if (request.command === "get_state") {
					return baseCommand({ result: { data: { model: { id: "gpt-5.6-luna", provider: "openai-codex" } } } });
				}
				if (request.command === "get_login_providers") {
					return baseCommand({ result: { data: { providers: [] } } });
				}
				throw new Error(`unexpected command ${request.command}`);
			},
		};
	}

	it("takes a picker identifier apart without touching a bare OMP id", () => {
		expect(ompModelPickId("deepseek-v4.1-flash")).toBe("caret-omp/deepseek-v4.1-flash");
		expect(ompModelIdFromPickId(`${CARET_OMP_MODEL_VENDOR}/deepseek-v4.1-flash`)).toBe("deepseek-v4.1-flash");
		// Option-group items and older picks carry no vendor: they must pass through.
		expect(ompModelIdFromPickId("deepseek-v4.1-flash")).toBe("deepseek-v4.1-flash");
	});

	it("registers the OMP catalogue under the vendor the pickers prefix with", async () => {
		stubState.languageModelProviders.length = 0;
		chatSessions.registerCaretChatSessions({ getClient: async () => catalogClient(), log: () => {} });
		const registered = stubState.languageModelProviders.at(-1);
		expect(registered?.vendor).toBe(CARET_OMP_MODEL_VENDOR);

		const models = await registered!.provider.provideLanguageModelChatInformation({}, { isCancellationRequested: false });
		expect(models).toEqual([{
			id: "deepseek-v4.1-flash",
			name: "DeepSeek V4.1 Flash",
			family: "deepseek-v4.1-flash",
			version: "1.0",
			// A model the catalogue carries without a provider cannot be matched to a
			// role selector keyed `provider/id`, so its detail stays absent.
			detail: undefined,
			maxInputTokens: 0,
			maxOutputTokens: 0,
			tooltip: undefined,
			isUserSelectable: true,
			capabilities: { imageInput: false, toolCalling: true },
		}]);
		// The extension host derives `<vendor>/<id>` from exactly these pieces, which
		// is the string the pickers hand back.
		expect(`${registered!.vendor}/${models[0].id}`).toBe(ompModelPickId("deepseek-v4.1-flash"));
	});

	it("carries each model's configured roles as the row detail the picker draws", async () => {
		stubState.languageModelProviders.length = 0;
		chatSessions.registerCaretChatSessions({
			getClient: async () => roleCatalogClient(),
			log: () => {},
		});
		const provider = stubState.languageModelProviders.at(-1)!.provider;
		const models = await provider.provideLanguageModelChatInformation({}, { isCancellationRequested: false }) as Array<{ id: string; detail?: string }>;
		const byId = new Map(models.map(model => [model.id, model]));
		// `detail` is the field the workbench renders beside the model name; an
		// option item's `description` is tooltip-only, so this is the visible path.
		expect(byId.get("gpt-5.6-luna")?.detail).toBe("Fast");
		expect(byId.get("gpt-6-astra")?.detail).toBe("Thinking");
		expect(byId.get("grok-4.6")?.detail).toBeUndefined();
	});

	it("stays honestly empty, and says why, when the host cannot be read", async () => {
		stubState.languageModelProviders.length = 0;
		const logs: string[] = [];
		chatSessions.registerCaretChatSessions({
			getClient: async () => { throw new Error("host down"); },
			log: (message: string) => logs.push(message),
		});
		const provider = stubState.languageModelProviders.at(-1)!.provider;
		expect(await provider.provideLanguageModelChatInformation({}, { isCancellationRequested: false })).toEqual([]);
		expect(logs.some(message => message.includes("could not list OMP models"))).toBe(true);
	});

	it("refuses to generate instead of becoming a second model path", async () => {
		stubState.languageModelProviders.length = 0;
		chatSessions.registerCaretChatSessions({ getClient: async () => catalogClient(), log: () => {} });
		const provider = stubState.languageModelProviders.at(-1)!.provider;
		await expect(provider.provideLanguageModelChatResponse()).rejects.toThrow(/does not proxy model generation/);
	});
});

describe("participant handler (fixtures only, one live path per prompt)", () => {
	/** A host client whose turn ends the way an idle host ends one: no events. */
	function turnClient(seen: any[]): any {
		return {
			async getSession() {
				return session({ status: "idle" });
			},
			async startSession(id: string) {
				seen.push({ call: "startSession", id });
				return session();
			},
			async sendCommand(_sessionId: string, request: any) {
				seen.push({ call: "sendCommand", command: request.command, payload: request.payload });
				return baseCommand({});
			},
			async getEvents() {
				return { events: [], cursor: 0, hasMore: false };
			},
		};
	}

	function lastParticipant(): { id: string; handler: (...args: any[]) => any } {
		const participant = stubState.chatParticipants.at(-1);
		if (!participant) throw new Error("Caret registered no chat participant");
		return participant;
	}

	it("runs the submitted prompt on the session the request names", async () => {
		stubState.chatParticipants.length = 0;
		const seen: any[] = [];
		const markdown: string[] = [];
		chatSessions.registerCaretChatSessions({ getClient: async () => turnClient(seen), log: () => {} });

		await lastParticipant().handler(
			{ prompt: "do the thing" },
			{
				chatSessionContext: {
					chatSessionItem: { resource: { scheme: "caret", authority: "session", path: "/s1" } },
				},
			},
			{ markdown: (text: string) => void markdown.push(text), progress: () => {} },
			{ isCancellationRequested: false },
		);

		expect(lastParticipant().id).toBe(CARET_CHAT_PARTICIPANT_ID);
		expect(seen.some(entry => entry.command === "prompt" && entry.payload?.message === "do the thing")).toBe(true);
		expect(seen.some(entry => entry.call === "startSession" && entry.id === "s1")).toBe(true);
	});

	it("sends nothing and says so when the request is not one of Caret's sessions", async () => {
		stubState.chatParticipants.length = 0;
		const seen: any[] = [];
		const logs: string[] = [];
		chatSessions.registerCaretChatSessions({ getClient: async () => turnClient(seen), log: (message: string) => logs.push(message) });

		await lastParticipant().handler(
			{ prompt: "do the thing" },
			{ chatSessionContext: { chatSessionItem: { resource: { scheme: "vscode-chat", authority: "", path: "/x" } } } },
			{ markdown: () => {}, progress: () => {} },
			{ isCancellationRequested: false },
		);

		expect(seen).toEqual([]);
		expect(logs.some(message => message.includes("outside one of its sessions"))).toBe(true);
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
		await vscodeController().getChatSessionInputState(resource, {}, token);
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
		await vscodeController().getChatSessionInputState(resource, {}, { isCancellationRequested: false });
		const inputState = vscodeInputStates.at(-1);
		inputState.groups.find((group: any) => group.id === "models").selected = { id: "ghost-model", name: "Ghost" };
		inputState.fire();
		await tick(50);
		expect(setModelCalls).toEqual([]);
		expect(logs.some(message => message.includes("ghost-model") && message.includes("unknown"))).toBe(true);
	});

	it("strips the picker's vendor prefix before writing set_model", async () => {
		// The composer pick is a `<vendor>/<id>` identifier (that is what the
		// extension host resolves); the host's set_model wants the bare OMP id, and
		// a pick that slips through unresolved would leave the host on the old model.
		const setModelCalls: any[] = [];
		const logs: string[] = [];
		chatSessions.registerCaretChatSessions({ getClient: async () => pickerClient(setModelCalls), log: (message: string) => logs.push(message) });
		const provider = stubState.chatContentProviders.at(-1)?.provider;
		const resource: any = { scheme: "caret", authority: "session", path: "/s1" };
		provider.provideHandleOptionsChange(resource, [{ optionId: "models", value: `${CARET_OMP_MODEL_VENDOR}/second-model` }], { isCancellationRequested: false });
		await tick(50);
		expect(setModelCalls.map(call => call.payload)).toEqual([{ provider: "probe", modelId: "second-model" }]);
	});
});

describe("draft input state lists the global OMP catalog (fixtures only)", () => {
	function draftClient(sessions: any[]): any {
		return {
			async listSessions() {
				return sessions;
			},
			async sendCommand(_sessionId: string, request: any) {
				if (request.command === "get_available_models") {
					return baseCommand({
						result: { data: { models: [{ id: "probe-model", provider: "probe", label: "Probe" }] } },
					});
				}
				if (request.command === "get_state") {
					return baseCommand({ result: { data: {} } });
				}
				if (request.command === "get_login_providers") {
					return baseCommand({ result: { data: { providers: [] } } });
				}
				throw new Error(`unexpected command ${request.command}`);
			},
		};
	}

	it("lists the catalog through any available session when there is no session yet", async () => {
		vscodeInputStates.length = 0;
		const logs: string[] = [];
		const client = draftClient([session(), session({ id: "s2", archived: true })]);
		chatSessions.registerCaretChatSessions({ getClient: async () => client, log: (message: string) => logs.push(message) });
		await vscodeController().getChatSessionInputState(undefined, {}, { isCancellationRequested: false });
		const inputState = vscodeInputStates.at(-1);
		expect(inputState.groups.find((group: any) => group.id === "models")?.items.map((item: any) => item.id)).toEqual([
			"probe-model",
		]);
	});

	it("stays honestly empty when no sessions exist at all", async () => {
		vscodeInputStates.length = 0;
		const logs: string[] = [];
		const client = draftClient([]);
		chatSessions.registerCaretChatSessions({ getClient: async () => client, log: (message: string) => logs.push(message) });
		await vscodeController().getChatSessionInputState(undefined, {}, { isCancellationRequested: false });
		const inputState = vscodeInputStates.at(-1);
		expect(inputState.groups.find((group: any) => group.id === "models")?.items).toEqual([]);
	});
});

describe("global OMP catalog probe (fixtures only)", () => {
	function probeClient(sessions: any[]): any {
		return {
			async listSessions() {
				return sessions;
			},
			async sendCommand(_sessionId: string, request: any) {
				if (request.command === "get_available_models") {
					return baseCommand({
						result: { data: { models: [{ id: "probe-model", provider: "probe", label: "Probe" }] } },
					});
				}
				if (request.command === "get_state") {
					return baseCommand({ result: { data: {} } });
				}
				if (request.command === "get_login_providers") {
					return baseCommand({ result: { data: { providers: [] } } });
				}
				throw new Error(`unexpected command ${request.command}`);
			},
		};
	}

	it("lists through the first non-archived session", async () => {
		const logs: string[] = [];
		const client = probeClient([session({ id: "archived", archived: true }), session({ id: "live" })]);
		const snapshot = await chatSessions.fetchGlobalOmpModelSnapshot(async () => client, (message: string) => logs.push(message));
		expect(snapshot.models.map(model => model.id)).toEqual(["probe-model"]);
		expect(logs).toEqual([]);
	});

	it("stays empty when no sessions exist", async () => {
		const logs: string[] = [];
		const client = probeClient([]);
		const snapshot = await chatSessions.fetchGlobalOmpModelSnapshot(async () => client, (message: string) => logs.push(message));
		expect(snapshot).toEqual({ models: [], hasModels: false });
	});
});

describe("workbench pick write-through via provideHandleOptionsChange (fixtures only)", () => {
	function optionsClient(setModelCalls: any[]): any {
		return {
			async getSession() {
				return session();
			},
			async sendCommand(_sessionId: string, request: any) {
				if (request.command === "get_available_models") {
					return baseCommand({
						result: { data: { models: [{ id: "probe-model", provider: "probe", label: "Probe" }] } },
					});
				}
				if (request.command === "get_state") {
					return baseCommand({ result: { data: {} } });
				}
				if (request.command === "get_login_providers") {
					return baseCommand({ result: { data: { providers: [] } } });
				}
				if (request.command === "set_model") {
					setModelCalls.push(request);
					return baseCommand({ status: "completed" });
				}
				throw new Error(`unexpected command ${request.command}`);
			},
		};
	}

	it("writes a workbench pick to the host with set_model", async () => {
		stubState.chatContentProviders.length = 0;
		const setModelCalls: any[] = [];
		const logs: string[] = [];
		const client = optionsClient(setModelCalls);
		chatSessions.registerCaretChatSessions({ getClient: async () => client, log: (message: string) => logs.push(message) });
		const entry = stubState.chatContentProviders.at(-1);
		if (!entry) throw new Error("content provider was not registered");
		expect(entry.scheme).toBe("caret");
		await entry.provider.provideHandleOptionsChange(
			{ scheme: "caret", authority: "session", path: "/s1" },
			[{ optionId: "models", value: "probe-model" }],
			{ isCancellationRequested: false },
		);
		await tick(50);
		expect(setModelCalls.map(call => call.payload)).toEqual([{ provider: "probe", modelId: "probe-model" }]);
		expect(logs).toEqual([]);
	});

	it("logs honestly and sends nothing for an unknown model id", async () => {
		stubState.chatContentProviders.length = 0;
		const setModelCalls: any[] = [];
		const logs: string[] = [];
		const client = optionsClient(setModelCalls);
		chatSessions.registerCaretChatSessions({ getClient: async () => client, log: (message: string) => logs.push(message) });
		const entry = stubState.chatContentProviders.at(-1);
		if (!entry) throw new Error("content provider was not registered");
		await entry.provider.provideHandleOptionsChange(
			{ scheme: "caret", authority: "session", path: "/s1" },
			[{ optionId: "models", value: "ghost-model" }],
			{ isCancellationRequested: false },
		);
		await tick(50);
		expect(setModelCalls).toEqual([]);
		expect(logs.some(message => message.includes("ghost-model") && message.includes("unknown"))).toBe(true);
	});
});

describe("model roles", () => {
	it("keeps every role OMP reported, in cycle order, with its provenance", () => {
		const roles = normalizeOmpModelRoles({
			data: {
				cycleOrder: ["smol", "default", "slow"],
				roles: [
					{ role: "smol", modelId: "openai-codex/gpt-5.6-luna", source: "global" },
					{ role: "default", modelId: "commandcode/deepseek-v4.1-flash", source: "global" },
					{ role: "slow", modelId: "openai-codex/gpt-6-astra", source: "project" },
					{ role: "plan", modelId: "opencode-go/muse-spark-1.3-contributor", source: "global" },
				],
				storage: "global",
			},
		});
		expect(roles.cycleOrder).toEqual(["smol", "default", "slow"]);
		expect(roles.roles.map(role => role.role)).toEqual(["smol", "default", "slow", "plan"]);
		expect(roles.storage).toBe("global");
		// Provenance survives, so the UI can say where an assignment came from.
		expect(roles.roles.find(role => role.role === "slow")?.source).toBe("project");
	});

	it("drops a cycle entry that resolved to no role, so the switcher cannot step onto an empty slot", () => {
		const roles = normalizeOmpModelRoles({
			data: {
				cycleOrder: ["smol", "ghost", "default"],
				roles: [{ role: "default", modelId: "openai/gpt-4.1" }],
			},
		});
		expect(roles.cycleOrder).toEqual(["default"]);
		expect(roles.roles).toEqual([{ role: "default", modelId: "openai/gpt-4.1", source: "default" }]);
	});

	it("accepts a bare roles payload and reports no storage rather than inventing one", () => {
		const roles = normalizeOmpModelRoles({ roles: [{ role: "advisor", modelId: "@slow" }] });
		expect(roles.roles).toEqual([{ role: "advisor", modelId: "@slow", source: "default" }]);
		expect(roles.storage).toBeUndefined();
		expect(roles.cycleOrder).toEqual([]);
	});

	it("returns an honest empty projection when OMP never answered", () => {
		expect(normalizeOmpModelRoles(undefined)).toEqual({ cycleOrder: [], roles: [] });
	});

	it("clears a role assignment by sending null, which is how a role falls back to its default", () => {
		expect(setModelRoleRequest(session(), "smol", null, "c1").payload).toEqual({ role: "smol", modelId: null });
		expect(setModelRoleRequest(session(), "smol", "openai/gpt-4.1", "c2").payload).toEqual({ role: "smol", modelId: "openai/gpt-4.1" });
	});

	it("labels roles with OMP's own carousel vocabulary and a custom role with its own id", () => {
		expect(modelRoleLabel("smol")).toBe("Fast");
		expect(modelRoleLabel("slow")).toBe("Thinking");
		expect(modelRoleLabel("my-custom-role")).toBe("my-custom-role");
	});

	it("carries the session incarnation on role commands so a stale write is refused", () => {
		const target = session({ incarnation: "inc-7" });
		expect(getModelRolesRequest(target, "c1")).toMatchObject({ command: "caret_get_model_roles", incarnation: "inc-7" });
		expect(setModelRoleRequest(target, "default", "openai/gpt-4.1", "c2").incarnation).toBe("inc-7");
	});
});

describe("model role labels for the picker rows", () => {
	const models: readonly OmpAdvertisedModel[] = [
		{ id: "gpt-5.6-luna", provider: "openai-codex", label: "GPT-5.6 Luna", available: true },
		{ id: "deepseek-v4.1-flash", provider: "commandcode", label: "DeepSeek V4.1 Flash", available: true },
		{ id: "muse-spark-1.3-contributor", provider: "opencode-go", label: "Muse Spark", available: true },
	];

	it("names the roles a model holds, keyed by provider/id so a short id cannot match the wrong row", () => {
		const roles = normalizeOmpModelRoles({ data: { roles: [
			{ role: "smol", modelId: "openai-codex/gpt-5.6-luna" },
			{ role: "default", modelId: "commandcode/deepseek-v4.1-flash" },
		] } });
		const bySelector = rolesByModelSelector(roles);
		expect(bySelector.get("openai-codex/gpt-5.6-luna")).toEqual(["Fast"]);
		expect(bySelector.get("commandcode/deepseek-v4.1-flash")).toEqual(["Default"]);
		// A model nobody assigned gets no label at all, so its row keeps its own text.
		expect(bySelector.get("opencode-go/muse-spark-1.3-contributor")).toBeUndefined();
	});

	it("resolves an @role alias so an aliased role is still shown", () => {
		const roles = normalizeOmpModelRoles({ data: { roles: [
			{ role: "slow", modelId: "openai-codex/gpt-5.6-luna" },
			{ role: "advisor", modelId: "@slow" },
		] } });
		expect(rolesByModelSelector(roles).get("openai-codex/gpt-5.6-luna")).toEqual(["Thinking", "Advisor"]);
	});

	it("does not resolve a bare id, so an ambiguous short id never labels the wrong provider's row", () => {
		const roles = normalizeOmpModelRoles({ data: { roles: [{ role: "smol", modelId: "gpt-5.6-luna" }] } });
		expect(rolesByModelSelector(roles).get("openai-codex/gpt-5.6-luna")).toBeUndefined();
		expect(rolesByModelSelector(roles).get("gpt-5.6-luna")).toEqual(["Fast"]);
	});

	it("drops a role whose alias chain cannot resolve instead of labelling it against nothing", () => {
		const roles = normalizeOmpModelRoles({ data: { roles: [{ role: "plan", modelId: "@missing" }] } });
		expect(rolesByModelSelector(roles).size).toBe(0);
	});

it("groups roles by selector, following aliases and dropping unresolvable ones", () => {
		const roles = normalizeOmpModelRoles({ data: { roles: [
			{ role: "smol", modelId: "a/one" },
			{ role: "slow", modelId: "a/one" },
			{ role: "plan", modelId: "@missing" },
		] } });
		expect(rolesByModelSelector(roles).get("a/one")).toEqual(["Fast", "Thinking"]);
		expect(rolesByModelSelector(roles).has("@missing")).toBe(false);
	});
});
