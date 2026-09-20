import { describe, expect, it } from "bun:test";
import { installVscodeStub, stubState } from "./helpers/vscode-stub.ts";import {
	abortRequest,
	attachedContextLabels,
	CEDIA_CHAT_PARTICIPANT_ID,
	CEDIA_CHAT_SESSION_SCHEME,
	CEDIA_CHAT_SESSION_TYPE,
	CEDIA_OMP_MODEL_VENDOR,
	isCediaDraftUri,
	currentModelFromOmpState,
	currentModelIdFromOmpState,
	getAvailableModelsRequest,
	getLoginProvidersRequest,
	getOmpStateRequest,
	getModelRolesRequest,
	modelPickerGroupFromSnapshot,
	ompModelRowForPick,
	ompModelForPickedLanguageModel,
	ompModelPickProviders,
	ompModelRows,
	providerStatusIconId,
	thinkingPickerGroupFromParams,
	thinkingPickerGroupForModel,
	entryFailureText,
	modelRoleLabel,
	rolesByModelSelector,
	normalizeOmpLoginProviders,
	normalizeOmpModelRoles,
	normalizeOmpModels,
	ompModelIdFromPickId,
	ompModelPickId,
	projectNameFor,
	projectOmpModelSnapshot,
	promptImagesFromReferences,
	promptRequest,
	promptWithAttachedContext,
	resolveOmpModelPickProvider,
	selectedModelIdFromInputState,
	sessionIdFromUri,
	sessionItemShape,
	sessionState,
	sessionUriString,
	setModelRoleRequest,
	setOmpModelRequest,
	toolCardFromEntry,
	turnPlansFromTranscript,
	uiAnswerValue,
	uiCarouselQuestionId,
	uiQuestionFromRequest,
} from "../src/chat-sessions-map.ts";
import type { RawFrame } from "../src/state.ts";
import { emptyThinkingParams } from "../src/thinking-params.ts";
import type { Project, Session } from "../../../packages/protocol/src/index.ts";
import type { OmpAdvertisedModel } from "../src/chat-sessions-map.ts";
import { createInitialTaskState, type TranscriptEntry } from "../src/state.ts";

function session(patch: Partial<Session> = {}): Session {
	return {
		id: "s1",
		projectId: "p1",
		title: "Fix the sidebar",
		cwd: "/Users/pond/cedia",
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
	return { id: "p1", name: "cedia", path: "/Users/pond/cedia", archived: false, ...patch } as Project;
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
		expect(sessionIdFromUri({ scheme: CEDIA_CHAT_SESSION_SCHEME, authority: "session", path: "/abc-123" })).toBe("abc-123");
		expect(CEDIA_CHAT_SESSION_TYPE).toBe(CEDIA_CHAT_PARTICIPANT_ID);
	});

	it("does not claim resources owned by another provider", () => {
		expect(sessionIdFromUri({ scheme: "vscode-chat", authority: "session", path: "/abc" })).toBeUndefined();
		expect(sessionIdFromUri({ scheme: CEDIA_CHAT_SESSION_SCHEME, authority: "other", path: "/abc" })).toBeUndefined();
		expect(sessionIdFromUri({ scheme: CEDIA_CHAT_SESSION_SCHEME, authority: "session", path: "/" })).toBeUndefined();
	});

	it("keeps ids that need escaping reversible", () => {
		const id = "session/with space+plus";
		const parsed = new URL(sessionUriString(id));
		expect(sessionIdFromUri({ scheme: parsed.protocol.replace(":", ""), authority: parsed.host, path: parsed.pathname })).toBe(id);
	});

	it("recognizes a draft under either key the workbench builds it with", () => {
		// The workbench's `getNewChatSessionResource(sessionType)` gives a draft the session
		// type as its scheme, while the bridge's own drafts (and every draft that reuses one)
		// may carry the item scheme. Both are drafts: no host id, no transcript.
		expect(isCediaDraftUri({ scheme: CEDIA_CHAT_SESSION_TYPE, path: "/untitled-6f1e" })).toBe(true);
		expect(isCediaDraftUri({ scheme: CEDIA_CHAT_SESSION_SCHEME, path: "/untitled-6f1e" })).toBe(true);
		// A real session is not a draft, under either key.
		expect(isCediaDraftUri({ scheme: CEDIA_CHAT_SESSION_SCHEME, authority: "session", path: "/abc-123" })).toBe(false);
		expect(isCediaDraftUri({ scheme: CEDIA_CHAT_SESSION_TYPE, authority: "session", path: "/abc-123" })).toBe(false);
		// Another provider's resource is never Cedia's draft.
		expect(isCediaDraftUri({ scheme: "vscode-chat", path: "/untitled-6f1e" })).toBe(false);
	});

	it("reads the composer's picked model out of a session's input state", () => {
		// A draft's pick travels as the session's `models` option, in either shape the two halves of
		// the picker use (the bare OMP id the option item carries, or the vendor-prefixed identifier
		// the picker publishes). Both name the same model, and the bare id is what `set_model` wants.
		const withPick = (id: string) => ({ groups: [{ id: "models", items: [{ id, name: id }], selected: { id, name: id } }] });
		expect(selectedModelIdFromInputState(withPick("deepseek/deepseek-chat"))).toBe("deepseek/deepseek-chat");
		expect(selectedModelIdFromInputState(withPick("cedia-omp/deepseek/deepseek-chat"))).toBe("deepseek/deepseek-chat");
		// No pick at all, or a catalogue that is not Cedia's, is not a pick.
		expect(selectedModelIdFromInputState(undefined)).toBeUndefined();
		expect(selectedModelIdFromInputState({ groups: [{ id: "models", items: [] }] })).toBeUndefined();
		expect(selectedModelIdFromInputState({ groups: [{ id: "other", selected: { id: "x" } }] })).toBeUndefined();
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
		const shape = sessionItemShape(session({ status: "running" }), "cedia");
		expect(shape).toMatchObject({ id: "s1", label: "Fix the sidebar", description: "cedia", state: "in-progress" });
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
		expect(projectNameFor([project(), project({ id: "p2", name: "cedia-ios" })], session())).toBe("cedia");
		expect(projectNameFor([project({ id: "p2" })], session())).toBeUndefined();
	});
});

describe("turnPlansFromTranscript", () => {
	it("pairs each user request with the assistant and tool work that answered it", () => {
		const tool = entry({ id: "t1", role: "tool", kind: "tool", text: "read_file", toolName: "read_file" });
		const plans = turnPlansFromTranscript([
			entry({ id: "u1", role: "user", text: "Fix the sidebar" }),
			entry({ id: "a1", role: "assistant", text: "Looking at the filters." }),
			tool,
			entry({ id: "a2", role: "assistant", text: "Fixed." }),
			entry({ id: "u2", role: "user", text: "Thanks" }),
		]);

		expect(plans).toEqual([
			{ kind: "request", text: "Fix the sidebar", toolNames: [] },
			{ kind: "response", text: "Looking at the filters.\n\nFixed.", toolNames: ["read_file"], toolEntries: [{ id: "t1", entry: tool }] },
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
		const tool = entry({ id: "t1", role: "tool", kind: "tool", text: "bash" });
		const plans = turnPlansFromTranscript([tool]);
		expect(plans).toEqual([{ kind: "response", text: "", toolNames: ["bash"], toolEntries: [{ id: "t1", entry: tool }] }]);
	});
});

describe("tool cards (fixtures only)", () => {
	it("marks a running tool incomplete and carries its args as input", () => {
		const card = toolCardFromEntry(entry({ id: "t1", role: "tool", kind: "tool", text: "write_file", toolName: "write_file", toolStatus: "running", args: { path: "a.txt" } }));
		expect(card?.isComplete).toBe(false);
		expect(card?.isError).toBe(false);
		expect(card?.input).toContain("a.txt");
	});

	it("marks a completed tool complete and names the past action", () => {
		const card = toolCardFromEntry(entry({ id: "t2", role: "tool", kind: "tool", text: "done", toolName: "write_file", toolStatus: "completed", output: "done" }));
		expect(card?.isComplete).toBe(true);
		expect(card?.isError).toBe(false);
		expect(card?.past).toBe("write_file completed");
		expect(card?.output).toBe("done");
	});

	it("marks a failed tool as an error that is complete", () => {
		const card = toolCardFromEntry(entry({ id: "t3", role: "tool", kind: "tool", text: "boom", toolName: "bash", toolStatus: "failed", output: "boom" }));
		expect(card?.isError).toBe(true);
		expect(card?.isComplete).toBe(true);
	});

	it("clamps a huge output with the truncation suffix", () => {
		const card = toolCardFromEntry(entry({ id: "t4", role: "tool", kind: "tool", text: "", toolName: "bash", toolStatus: "completed", output: "x".repeat(5000) }));
		expect(card?.output.length).toBe(4000 + "\n… (truncated)".length);
		expect(card?.output.endsWith("(truncated)")).toBe(true);
	});

	it("returns undefined for a non-tool entry", () => {
		expect(toolCardFromEntry(entry({ id: "m1", role: "assistant", text: "hello" }))).toBeUndefined();
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
		expect(CEDIA_CHAT_PARTICIPANT_ID.startsWith("cedia.")).toBe(true);
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

describe("composer attachments (fixtures only)", () => {
	it("reads binary references into OMP images and skips non-binary ones", async () => {
		expect(await promptImagesFromReferences(undefined)).toEqual([]);
		expect(await promptImagesFromReferences([
			{ name: "shot", value: { mimeType: "image/png", data: async () => new Uint8Array([1, 2, 3]) } },
			{ name: "a.ts", value: { fsPath: "/repo/a.ts" } },
		])).toEqual([{ type: "image", data: "AQID", mimeType: "image/png" }]);
	});

	it("skips a reference whose data() rejects and still returns the others", async () => {
		const images = await promptImagesFromReferences([
			{ name: "broken", value: { mimeType: "image/png", data: async () => { throw new Error("unreadable"); } } },
			{ name: "ok", value: { mimeType: "image/jpeg", data: async () => new Uint8Array([4, 5]) } },
		]);
		expect(images).toEqual([{ type: "image", data: "BAU=", mimeType: "image/jpeg" }]);
	});

	it("labels non-binary references, name first, fsPath then path, without duplicates", () => {
		expect(attachedContextLabels([
			{ name: "a.ts", value: { fsPath: "/repo/a.ts" } },
			{ value: { fsPath: "/repo/b.ts" } },
			{ value: { path: "/repo/c.ts" } },
			{ name: " a.ts ", value: { fsPath: "/repo/other.ts" } },
			{ name: "shot", value: { mimeType: "image/png", data: async () => new Uint8Array([1]) } },
			{ value: 42 },
		])).toEqual(["a.ts", "/repo/b.ts", "/repo/c.ts"]);
		expect(attachedContextLabels(undefined)).toEqual([]);
	});

	it("appends labels as one block and leaves the prompt untouched without labels", () => {
		expect(promptWithAttachedContext("hello", ["a.ts", "b/c.ts"])).toBe("hello\n\nAttached context:\n- a.ts\n- b/c.ts");
		expect(promptWithAttachedContext("hello", [])).toBe("hello");
	});

	it("carries prompt images only when supplied and non-empty", () => {
		const image = { type: "image" as const, data: "AQID", mimeType: "image/png" };
		expect(promptRequest(session(), "hi", "c1")).toEqual({ commandId: "c1", incarnation: "inc-1", command: "prompt", payload: { message: "hi" } });
		expect(promptRequest(session(), "hi", "c2", [])).toEqual({ commandId: "c2", incarnation: "inc-1", command: "prompt", payload: { message: "hi" } });
		expect(promptRequest(session(), "hi", "c3", [image])).toEqual({
			commandId: "c3",
			incarnation: "inc-1",
			command: "prompt",
			payload: { message: "hi", images: [image] },
		});
	});
});

describe("native UI requests (fixtures only)", () => {
	it("maps a confirm to allow, deny and scoped options in the dock's order", () => {
		const question = uiQuestionFromRequest({
			method: "confirm",
			id: "ui-1",
			title: "Allow write?",
			message: "write_file a.txt",
			scopes: ["read this file"],
		});
		expect(question?.kind).toBe("single_select");
		expect(question?.message).toBe("write_file a.txt");
		expect(question?.options?.map(option => option.id)).toEqual(["allow", "deny", "read this file"]);
		expect(question?.options?.map(option => option.value)).toEqual([true, false, "scope:read this file"]);
		expect(question?.options?.map(option => option.label)).toEqual(["Allow", "Deny", "Allow scoped \u00B7 read this file"]);
	});

	it("maps a multiple select to multi_select, prefers optionDetails labels, and joins array answers", () => {
		const request = {
			method: "select",
			id: "ui-2",
			title: "Pick files",
			options: ["a.ts", "b.ts"],
			optionDetails: [{ label: "Alpha" }, {}],
			multiple: true,
		} as const;
		const question = uiQuestionFromRequest(request);
		expect(question?.kind).toBe("multi_select");
		expect(question?.options?.map(option => option.label)).toEqual(["Alpha", "b.ts"]);
		expect(question?.options?.map(option => option.value)).toEqual(["a.ts", "b.ts"]);
		expect(uiAnswerValue(request, ["a.ts", "b.ts"])).toBe("a.ts\nb.ts");
		expect(uiCarouselQuestionId(request)).toBe("ui-2");
	});

	it("never projects secrets or untrusted form HTML onto the native surface", () => {
		expect(uiQuestionFromRequest({ method: "password", id: "ui-3", title: "Token" })).toBeUndefined();
		expect(uiQuestionFromRequest({ method: "schemaform", id: "ui-4", title: "Form" })).toBeUndefined();
	});

	it("maps empty answers to a cancellation and accepts only shaped answers", () => {
		const confirm = { method: "confirm", id: "ui-5", title: "Allow?", message: "write_file a.txt" } as const;
		expect(uiAnswerValue(confirm, undefined)).toEqual({ cancelled: true });
		expect(uiAnswerValue(confirm, null)).toEqual({ cancelled: true });
		expect(uiAnswerValue(confirm, "")).toEqual({ cancelled: true });
		expect(uiAnswerValue(confirm, [])).toEqual({ cancelled: true });
		expect(uiAnswerValue(confirm, "yes")).toEqual({ cancelled: true });
		expect(uiAnswerValue(confirm, true)).toBe(true);
		expect(uiAnswerValue(confirm, false)).toBe(false);
		expect(uiAnswerValue(confirm, "scope:read this file")).toBe("scope:read this file");
	});

	it("carries a placeholder or prefill as the text question's message", () => {
		expect(uiQuestionFromRequest({ method: "input", id: "ui-6", title: "Name", placeholder: "type here" })).toMatchObject({
			kind: "text",
			message: "type here",
		});
		expect(uiQuestionFromRequest({ method: "editor", id: "ui-7", title: "Edit", prefill: "draft" })).toMatchObject({
			kind: "text",
			message: "draft",
		});
	});

	it("unwraps the workbench's answer objects, whose option values it stringifies", () => {
		const confirm = { method: "confirm", id: "ui-8", title: "Allow?", message: "write_file a.txt" } as const;
		expect(uiAnswerValue(confirm, { selectedValue: "true" })).toBe(true);
		expect(uiAnswerValue(confirm, { selectedValue: "false" })).toBe(false);
		expect(uiAnswerValue(confirm, { selectedValue: "scope:read this file" })).toBe("scope:read this file");
		const multi = { method: "multi_select", id: "ui-9", title: "Pick", options: ["a.ts", "b.ts"] } as const;
		expect(uiAnswerValue(multi, { selectedValues: ["a.ts", "b.ts"], freeformValue: undefined })).toBe("a.ts\nb.ts");
		expect(uiAnswerValue(multi, { selectedValues: [], freeformValue: "notes" })).toBe("notes");
	});
});

describe("OMP model catalog projection (fixtures only)", () => {
	const probeModels = {
		data: {
			models: [
				{ id: "probe-model", name: "Cedia OMP probe model", provider: "probe" },
				{ modelId: "second-model", provider: "probe", label: "Second", available: false, reason: "disabled for test" },
				{ provider: "probe" },
			],
		},
	};

	it("normalizes get_available_models ack/result shapes without inventing rows", () => {
		expect(normalizeOmpModels(probeModels)).toEqual([
			{ id: "probe-model", provider: "probe", label: "Cedia OMP probe model", available: true },
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

	it("matches a bare get_state id to the catalogue's provider-qualified row", () => {
		// Measured 2026-09-18: `get_state` answered `claude-4.6-opus-high` while
		// `get_available_models` listed `cursor/claude-4.6-opus-high`. Dropping the current id on
		// an exact-only match left the pill showing the catalogue's first row (a different model)
		// and made a draft's pick unresolvable when the session was created.
		const models = normalizeOmpModels({
			models: [
				{ id: "cursor/claude-4.6-opus-high", provider: "cursor", label: "Claude 4.6 Opus High" },
				{ id: "deepseek/deepseek-v4.1-flash", provider: "deepseek", label: "DeepSeek V4.1 Flash" },
			],
		});
		const snapshot = projectOmpModelSnapshot(models, "claude-4.6-opus-high");
		expect(snapshot.selectedModelId).toBe("cursor/claude-4.6-opus-high");
		expect(modelPickerGroupFromSnapshot(snapshot).selected?.id).toBe("cursor/claude-4.6-opus-high");
		expect(resolveOmpModelPickProvider(snapshot, "claude-4.6-opus-high")).toBe("cursor");
		// The provider-qualified spelling of the row itself still resolves exactly.
		expect(resolveOmpModelPickProvider(snapshot, "cursor/claude-4.6-opus-high")).toBe("cursor");
		// An id two providers both end with names no single model, so nothing is selected and no
		// provider is invented.
		const ambiguous = normalizeOmpModels({
			models: [
				{ id: "cursor/shared-model", provider: "cursor", label: "A" },
				{ id: "deepseek/shared-model", provider: "deepseek", label: "B" },
			],
		});
		const ambiguousSnapshot = projectOmpModelSnapshot(ambiguous, "shared-model");
		expect(ambiguousSnapshot.selectedModelId).toBeUndefined();
		expect(resolveOmpModelPickProvider(ambiguousSnapshot, "shared-model")).toBeUndefined();
		expect(ompModelRowForPick(ambiguousSnapshot, "shared-model")).toBeUndefined();
	});

	it("keeps the provider get_state names, so a shared id still names one row", () => {
		// Measured live 2026-09-19: `get_state` answered
		// `{id: 'deepseek/deepseek-v4.1-flash', provider: 'commandcode'}` while the catalogue carried
		// that same id from `openrouter` too. Keeping only the id left every row reader refusing to
		// choose, so the composer's reasoning chip - which reads the row's own `thinking.efforts` -
		// never appeared for a model that advertises a ladder.
		expect(currentModelFromOmpState({ data: { model: { id: "deepseek/deepseek-v4.1-flash", provider: "commandcode" } } }))
			.toEqual({ id: "deepseek/deepseek-v4.1-flash", provider: "commandcode" });
		expect(currentModelFromOmpState({ data: { model: { id: "probe-model" } } })).toEqual({ id: "probe-model" });
		expect(currentModelFromOmpState({ data: "probe-model" })).toEqual({ id: "probe-model" });
		expect(currentModelFromOmpState({ data: {} })).toBeUndefined();

		const models = normalizeOmpModels({
			models: [
				{ id: "deepseek/deepseek-v4.1-flash", provider: "openrouter", label: "DeepSeek V4.1 Flash" },
				{ id: "deepseek/deepseek-v4.1-flash", provider: "commandcode", label: "DeepSeek V4.1 Flash", thinking: { efforts: ["low", "high", "max"], mode: "effort" } },
			],
		});
		const snapshot = projectOmpModelSnapshot(models, "deepseek/deepseek-v4.1-flash", undefined, "commandcode");
		expect(snapshot.selectedModelId).toBe("deepseek/deepseek-v4.1-flash");
		expect(snapshot.selectedModelProvider).toBe("commandcode");
		// The picker marks that row (the second provider's row carries the selector spelling,
		// because the first one already claimed the bare id), and the ladder is read off it.
		expect(modelPickerGroupFromSnapshot(snapshot).selected?.id).toBe("commandcode/deepseek/deepseek-v4.1-flash");
		const row = ompModelRowForPick(snapshot, snapshot.selectedModelId ?? "", snapshot.selectedModelProvider);
		expect(row?.provider).toBe("commandcode");
		expect(row && thinkingPickerGroupForModel(row)?.items.map(item => item.id)).toEqual(["low", "high", "max"]);
		// A provider the catalogue does not carry for this model is never recorded as its provider.
		expect(projectOmpModelSnapshot(models, "deepseek/deepseek-v4.1-flash", undefined, "ghost").selectedModelProvider).toBeUndefined();
		// Without a provider the id stays ambiguous, exactly as before.
		expect(projectOmpModelSnapshot(models, "deepseek/deepseek-v4.1-flash").selectedModelProvider).toBeUndefined();
	});

	it("keeps every provider's row when a model id is advertised more than once", () => {
		// Live 2026-09-18: the catalogue advertises ids like `gpt-5.6-luna` from more than one
		// provider, and the workbench keeps one row per identifier, so the second provider's row was
		// dropped (`[LM] Model cedia-omp/gpt-5.6-luna is already registered. Skipping.`) and could not
		// be chosen at all. The first row keeps OMP's own id; later rows take their selector.
		const models = normalizeOmpModels({
			models: [
				{ id: "gpt-5.6-luna", provider: "openrouter", label: "GPT-5.6-Luna" },
				{ id: "gpt-5.6-luna", provider: "commandcode", label: "GPT-5.6-Luna (Command Code)" },
				{ id: "gpt-5.6-luna", provider: "cursor", label: "GPT-5.6-Luna" },
				{ id: "unique-model", provider: "cursor", label: "Unique" },
			],
		});
		const rows = ompModelRows(models);
		expect(rows.map(row => row.id)).toEqual([
			"gpt-5.6-luna",
			"commandcode/gpt-5.6-luna",
			"cursor/gpt-5.6-luna",
			"unique-model",
		]);
		// A label two providers share is disambiguated by the provider; a label that already names it
		// is left exactly as OMP wrote it.
		expect(rows.map(row => row.label)).toEqual([
			"GPT-5.6-Luna",
			"GPT-5.6-Luna (Command Code)",
			"GPT-5.6-Luna · cursor",
			"Unique",
		]);
		// The same provider and model listed twice is one row, not two; two different spellings that
		// OMP really lists (it carries both `auto` and `openrouter/auto`) are two models.
		expect(ompModelRows(normalizeOmpModels({ models: [
			{ id: "auto", provider: "openrouter", label: "Auto" },
			{ id: "auto", provider: "openrouter", label: "Auto" },
			{ id: "openrouter/auto", provider: "openrouter", label: "Auto Router" },
		] })).map(row => row.id)).toEqual(["auto", "openrouter/auto"]);

		// Both spellings still name their row, so a pick of either one resolves to its provider.
		const snapshot = projectOmpModelSnapshot(models);
		expect(resolveOmpModelPickProvider(snapshot, "commandcode/gpt-5.6-luna")).toBe("commandcode");
		expect(resolveOmpModelPickProvider(snapshot, "gpt-5.6-luna", "openrouter")).toBe("openrouter");
		// The picker group and the rows agree on every identity the group publishes.
		const groupIds = modelPickerGroupFromSnapshot(snapshot).items.map(item => item.id);
		expect(groupIds).toEqual(rows.map(row => row.id));
	});

	it("refuses a model id two providers advertise, unless one of them stands out", () => {
		// Measured live 2026-09-18: `deepseek/deepseek-v4.1-flash` is advertised by both
		// `openrouter`, which this machine has no credentials for, and `commandcode`, which it has.
		// Taking the first row sent the turn to openrouter, whose answer was `401 User not found`.
		// An id that several providers carry is a name, not a model, so the pick has to name one.
		const shared = (provider: string, extra: Record<string, unknown> = {}) => ({
			id: "deepseek/deepseek-v4.1-flash",
			provider,
			label: "DeepSeek V4.1 Flash",
			...extra,
		});

		// Nothing stands out: the pick is refused, and the providers are reported so the caller can
		// say which ones the user has to choose between.
		const tied = projectOmpModelSnapshot(normalizeOmpModels({
			models: [shared("openrouter"), shared("commandcode")],
		}));
		expect(ompModelRowForPick(tied, "deepseek/deepseek-v4.1-flash")).toBeUndefined();
		expect(resolveOmpModelPickProvider(tied, "deepseek/deepseek-v4.1-flash")).toBeUndefined();
		expect(ompModelForPickedLanguageModel(tied, { id: "deepseek/deepseek-v4.1-flash" })).toBeUndefined();
		expect(ompModelPickProviders(tied, "deepseek/deepseek-v4.1-flash")).toEqual(["openrouter", "commandcode"]);

		// The picker's own provider (what it drew for the row) singles one out.
		expect(ompModelRowForPick(tied, "deepseek/deepseek-v4.1-flash", "commandcode")?.provider).toBe("commandcode");
		expect(ompModelForPickedLanguageModel(tied, { id: "deepseek/deepseek-v4.1-flash", vendor: "commandcode" }))
			.toEqual({ provider: "commandcode", modelId: "deepseek/deepseek-v4.1-flash" });
		// A vendor that names nothing in the catalogue does not break the tie.
		expect(ompModelRowForPick(tied, "deepseek/deepseek-v4.1-flash", "cedia-omp")).toBeUndefined();

		// OMP's own answer singles one out: the other provider is unauthenticated.
		const annotated = projectOmpModelSnapshot(
			normalizeOmpModels({ models: [shared("openrouter"), shared("commandcode")] }),
			undefined,
			[{ id: "openrouter", authenticated: false }, { id: "commandcode", authenticated: true }],
		);
		expect(ompModelRowForPick(annotated, "deepseek/deepseek-v4.1-flash")?.provider).toBe("commandcode");
		expect(ompModelForPickedLanguageModel(annotated, { id: "deepseek/deepseek-v4.1-flash" }))
			.toEqual({ provider: "commandcode", modelId: "deepseek/deepseek-v4.1-flash" });
	});

	it("publishes a reasoning group only for the levels OMP advertises for that model", () => {
		// The chip is per model: OMP's get_state answers with what its current model accepts, and a
		// model that advertises none gets no control at all rather than an invented ladder.
		const group = thinkingPickerGroupFromParams({
			advertised: true,
			current: "high",
			options: [{ id: "low", label: "low", enabled: true }, { id: "high", label: "high", enabled: true }],
			reason: "",
		});
		expect(group).toMatchObject({ id: "reasoning", name: "Reasoning", selected: { id: "high" } });
		expect(group?.items.map(item => item.id)).toEqual(["low", "high"]);
		expect(thinkingPickerGroupFromParams(emptyThinkingParams())).toBeUndefined();
	});

	it("maps the composer's picked language model onto an OMP model, or nothing", () => {
		// The composer's picker is the workbench's own: it carries every provider the user installed,
		// so a pick only means something when OMP runs that model. Measured 2026-09-18: the pill read
		// DeepSeek V4.1 Flash (opencode-go) while the host ran cursor/claude-4.6-opus-high, because
		// nothing read the pick at all.
		const snapshot = projectOmpModelSnapshot(normalizeOmpModels({
			models: [
				{ id: "deepseek/deepseek-v4.1-flash", provider: "deepseek", label: "DeepSeek V4.1 Flash" },
				{ id: "cursor/claude-4.6-opus-high", provider: "cursor", label: "Claude Opus 4.6 1M" },
			],
		}), "cursor/claude-4.6-opus-high");
		expect(ompModelForPickedLanguageModel(snapshot, { id: "deepseek/deepseek-v4.1-flash", vendor: "opencode-go" }))
			.toEqual({ provider: "deepseek", modelId: "deepseek/deepseek-v4.1-flash" });
		// A model OMP does not run is refused rather than quietly substituted by the host's default.
		expect(ompModelForPickedLanguageModel(snapshot, { id: "gpt-5.6-sol", vendor: "openai" })).toBeUndefined();
		expect(ompModelForPickedLanguageModel(snapshot, undefined)).toBeUndefined();
		expect(ompModelForPickedLanguageModel(snapshot, { id: "   " })).toBeUndefined();
	});

	it("reads a failed turn's provider message out of its raw frames", () => {
		const entry = (status: "failed" | "completed", frames: readonly RawFrame[]) => ({
			id: "m1",
			kind: "message" as const,
			role: "assistant" as const,
			text: "",
			status,
			rawFrames: frames,
		});
		// The shape the host recorded for the rate-limited turn of 2026-09-18.
		expect(entryFailureText(entry("failed", [
			{ type: "message", message: { role: "assistant", content: [], stopReason: "error", errorMessage: "You're out of usage." } },
		]))).toBe("You're out of usage.");
		// The classification is the honest fallback when only it is present.
		expect(entryFailureText(entry("failed", [
			{ message: { stopReason: "error", errorClassificationMessage: "Connect error resource_exhausted: Error" } },
		]))).toBe("Connect error resource_exhausted: Error");
		// A completed turn, or a failure with nothing recorded, is not an error message.
		expect(entryFailureText(entry("completed", [{ message: { errorMessage: "stale" } }]))).toBeUndefined();
		expect(entryFailureText(entry("failed", [{ message: { stopReason: "error" } }]))).toBeUndefined();
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

const vscodeStub = installVscodeStub();
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

	it("carries get_state's provider and level onto the snapshot for a shared id", async () => {
		// The live shape, measured 2026-09-19: `get_state` names the model with its provider and the
		// level it runs, while the catalogue carries that id from `openrouter` as well. The provider is
		// what lets the row - and so the reasoning ladder - resolve at all.
		const client: any = {
			async sendCommand(_sessionId: string, request: any) {
				if (request.command === "get_available_models") {
					return baseCommand({
						result: {
							data: {
								models: [
									{ id: "deepseek/deepseek-v4.1-flash", provider: "openrouter", label: "DeepSeek V4.1 Flash" },
									{ id: "deepseek/deepseek-v4.1-flash", provider: "commandcode", label: "DeepSeek V4.1 Flash", thinking: { efforts: ["low", "high", "max"] } },
								],
							},
						},
					});
				}
				if (request.command === "get_state") {
					return baseCommand({
						result: { data: { model: { id: "deepseek/deepseek-v4.1-flash", provider: "commandcode" }, thinkingLevel: "high" } },
					});
				}
				if (request.command === "get_login_providers") {
					return baseCommand({ result: { data: { providers: [{ id: "commandcode", authenticated: true }] } } });
				}
				throw new Error(`unexpected command ${request.command}`);
			},
			async listSessions() {
				return [session()];
			},
		};
		const snapshot = await chatSessions.fetchGlobalOmpModelSnapshot(async () => client, () => {});
		expect(snapshot.selectedModelId).toBe("deepseek/deepseek-v4.1-flash");
		expect(snapshot.selectedModelProvider).toBe("commandcode");
		expect(snapshot.selectedThinkingLevel).toBe("high");
		const row = ompModelRowForPick(snapshot, snapshot.selectedModelId ?? "", snapshot.selectedModelProvider);
		expect(thinkingPickerGroupForModel(row!, snapshot.selectedThinkingLevel)).toMatchObject({
			id: "reasoning",
			selected: { id: "high" },
		});
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

	it("retries the catalogue once with the incarnation the host refreshed to", async () => {
		const incarnations: string[] = [];
		let catalogueSends = 0;
		let started = false;
		const client: any = {
			async sendCommand(_sessionId: string, request: any) {
				if (request.command === "get_available_models") {
					catalogueSends += 1;
					incarnations.push(request.incarnation);
					if (catalogueSends === 1) throw new Error("Refresh the task before submitting this command");
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
			async getSession() {
				return session({ incarnation: "inc-2" });
			},
			async startSession() {
				started = true;
				return session();
			},
			async listSessions() {
				return [session({ incarnation: "inc-1" })];
			},
		};
		const snapshot = await chatSessions.fetchGlobalOmpModelSnapshot(async () => client, () => {});
		expect(snapshot.models.map(model => model.id)).toEqual(["warm-model"]);
		expect(snapshot.selectedModelId).toBe("warm-model");
		expect(started).toBe(false);
		expect(incarnations).toEqual(["inc-1", "inc-2"]);
	});

	it("bounds the catalogue retry and degrades honestly when the re-read also fails", async () => {
		const logs: string[] = [];
		let catalogueSends = 0;
		const client: any = {
			async sendCommand(_sessionId: string, request: any) {
				if (request.command === "get_available_models") catalogueSends += 1;
				throw new Error("Refresh the task before submitting this command");
			},
			async getSession() {
				throw new Error("host down");
			},
			async startSession() {
				return session();
			},
			async listSessions() {
				return [session({ incarnation: "inc-1" })];
			},
		};
		const snapshot = await chatSessions.fetchGlobalOmpModelSnapshot(async () => client, (message: string) => logs.push(message));
		expect(snapshot).toEqual({ models: [], hasModels: false });
		expect(catalogueSends).toBe(2);
		expect(logs.some(message => message.includes("could not re-read the session"))).toBe(true);
		expect(logs.some(message => message.includes("could not list OMP models"))).toBe(true);
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

	it("forwards composer images and keeps a binary reference's label out of the prompt text", async () => {
		const requests: any[] = [];
		const client: any = {
			async getEvents() {
				return { events: [], cursor: 0, hasMore: false };
			},
			async startSession() {
				return session();
			},
			async sendCommand(_sessionId: string, request: any) {
				requests.push(request);
				return baseCommand({});
			},
			async getSession() {
				return session({ status: "idle" });
			},
		};
		const stream: any = { markdown: () => {}, progress: () => {} };
		await chatSessions.runTurn(
			client,
			session(),
			"hello",
			stream,
			{ isCancellationRequested: false } as any,
			() => {},
			[{ name: "a.ts", value: { mimeType: "image/png", data: async () => new Uint8Array([1, 2, 3]) } }],
		);
		const prompt = requests.find(request => request.command === "prompt");
		// The image travels in OMP's own field; its name must not also be appended
		// as text, or the attachment would be duplicated as context.
		expect(prompt?.payload).toEqual({
			message: "hello",
			images: [{ type: "image", data: "AQID", mimeType: "image/png" }],
		});
	});

	it("streams message updates as deltas", async () => {
		const markdown: string[] = [];
		const text = (value: string) => [{ type: "text", text: value }];
		const pages: unknown[][] = [
			[
				{ type: "message_start", message: { role: "assistant", content: [], timestamp: 1 } },
				{ type: "message_update", message: { role: "assistant", content: text("hello"), timestamp: 1 }, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "hello", partial: { role: "assistant", content: text("hello"), timestamp: 1 } } },
			],
			[
				{ type: "message_update", message: { role: "assistant", content: text("hello world"), timestamp: 1 }, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: " world", partial: { role: "assistant", content: text("hello world"), timestamp: 1 } } },
			],
		];
		let calls = 0;
		let sequence = 0;
		const client: any = {
			async getEvents() {
				const frames = calls === 0 ? [] : pages[calls - 1];
				calls += 1;
				if (!frames?.length) return { events: [], cursor: sequence, hasMore: false };
				const events = frames.map(frame => ({ sessionId: "s1", incarnation: "inc-1", sequence: ++sequence, timestamp: new Date(sequence).toISOString(), frame }));
				return { events, cursor: sequence, hasMore: false };
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
		const stream: any = { markdown: (chunk: string) => void markdown.push(chunk), progress: () => {} };
		await chatSessions.runTurn(client, session(), "hello", stream, { isCancellationRequested: false } as any, () => {});
		expect(markdown).toEqual(["hello", " world"]);
		expect(markdown.filter(chunk => chunk === "hello")).toHaveLength(1);
	});

	it("streams a notify presentation once and ignores a repeated frame", async () => {
		const warnings: string[] = [];
		const infos: string[] = [];
		const frame = { type: "cedia_ui", event: { kind: "presentation", request: { id: "p1", method: "notify", message: "Heads up", notifyType: "warning" } } };
		const pages: unknown[][] = [[frame], [frame]];
		let calls = 0;
		let sequence = 0;
		const client: any = {
			async getEvents() {
				const frames = calls === 0 ? [] : pages[calls - 1];
				calls += 1;
				if (!frames?.length) return { events: [], cursor: sequence, hasMore: false };
				const events = frames.map(item => ({ sessionId: "s1", incarnation: "inc-1", sequence: ++sequence, timestamp: new Date(sequence).toISOString(), frame: item }));
				return { events, cursor: sequence, hasMore: false };
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
		const stream: any = {
			markdown: () => {},
			progress: () => {},
			warning: (message: string) => void warnings.push(message),
			info: (message: string) => void infos.push(message),
		};
		await chatSessions.runTurn(client, session(), "hello", stream, { isCancellationRequested: false } as any, () => {});
		expect(warnings).toEqual(["Heads up"]);
		expect(infos).toEqual([]);
	});

	it("streams an open_url presentation as a markdown link", async () => {
		const markdown: string[] = [];
		const pages: unknown[][] = [[
			{ type: "cedia_ui", event: { kind: "presentation", request: { id: "u1", method: "open_url", url: "https://example.test/login", instructions: "Sign in" } } },
		]];
		let calls = 0;
		let sequence = 0;
		const client: any = {
			async getEvents() {
				const frames = calls === 0 ? [] : pages[calls - 1];
				calls += 1;
				if (!frames?.length) return { events: [], cursor: sequence, hasMore: false };
				const events = frames.map(item => ({ sessionId: "s1", incarnation: "inc-1", sequence: ++sequence, timestamp: new Date(sequence).toISOString(), frame: item }));
				return { events, cursor: sequence, hasMore: false };
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
		const stream: any = { markdown: (chunk: string) => void markdown.push(chunk), progress: () => {} };
		await chatSessions.runTurn(client, session(), "hello", stream, { isCancellationRequested: false } as any, () => {});
		expect(markdown.filter(chunk => chunk.includes("https://example.test/login"))).toHaveLength(1);
		expect(markdown.join("")).toContain("[Sign in](https://example.test/login)");
	});

	it("re-emits a tool card when its status changes", async () => {
		const pushed: any[] = [];
		const pages: unknown[][] = [
			[{ type: "tool_execution_start", toolCallId: "call-1", toolName: "write_file", args: { path: "a.txt" } }],
			[{ type: "tool_execution_end", toolCallId: "call-1", toolName: "write_file", result: { content: [{ type: "text", text: "done" }] } }],
		];
		let calls = 0;
		let sequence = 0;
		const client: any = {
			async getEvents() {
				const frames = calls === 0 ? [] : pages[calls - 1];
				calls += 1;
				if (!frames?.length) return { events: [], cursor: sequence, hasMore: false };
				const events = frames.map(frame => ({ sessionId: "s1", incarnation: "inc-1", sequence: ++sequence, timestamp: new Date(sequence).toISOString(), frame }));
				return { events, cursor: sequence, hasMore: false };
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
		const stream: any = { markdown: () => {}, progress: () => {}, push: (part: any) => void pushed.push(part) };
		await chatSessions.runTurn(client, session(), "hello", stream, { isCancellationRequested: false } as any, () => {});
		expect(pushed).toHaveLength(2);
		const [running, completed] = pushed;
		expect(running).toBeInstanceOf(vscodeStub.ChatToolInvocationPart);
		expect(running.toolCallId).toBe("call-1");
		expect(running.isComplete).toBe(false);
		expect(running.enablePartialUpdate).toBe(true);
		expect(running.toolSpecificData.input).toContain("a.txt");
		expect(completed).toBeInstanceOf(vscodeStub.ChatToolInvocationPart);
		expect(completed.toolCallId).toBe("call-1");
		expect(completed.isComplete).toBe(true);
		expect(completed.toolSpecificData.output).toContain("done");
	});

	it("answers a pending confirm from the native carousel and skips a timed-out request", async () => {
		const carouselCalls: any[][] = [];
		const uiResponses: { sessionId: string; request: any }[] = [];
		const pages: unknown[][] = [[
			{ type: "cedia_ui", event: { kind: "interactive", token: "tok-1", request: { method: "confirm", id: "ui-1", title: "Allow write?", message: "write_file a.txt" } } },
			{ type: "cedia_ui", event: { kind: "interactive", token: "tok-2", request: { method: "confirm", id: "ui-2", title: "Old?", message: "write_file b.txt", status: "timeout" } } },
		]];
		let calls = 0;
		let sequence = 0;
		const client: any = {
			async getEvents() {
				const frames = calls === 0 ? [] : pages[calls - 1];
				calls += 1;
				if (!frames?.length) return { events: [], cursor: sequence, hasMore: false };
				const events = frames.map(frame => ({ sessionId: "s1", incarnation: "inc-1", sequence: ++sequence, timestamp: new Date(sequence).toISOString(), frame }));
				return { events, cursor: sequence, hasMore: false };
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
			async sendUiResponse(sessionId: string, request: any) {
				uiResponses.push({ sessionId, request });
			},
		};
		const stream: any = {
			markdown: () => {},
			progress: () => {},
			questionCarousel: async (questions: any[]) => {
				carouselCalls.push(questions);
				return { "ui-1": true };
			},
		};
		await chatSessions.runTurn(client, session(), "hello", stream, { isCancellationRequested: false } as any, () => {});
		expect(carouselCalls).toHaveLength(1);
		expect(carouselCalls[0]?.[0]).toBeInstanceOf(vscodeStub.ChatQuestion);
		expect(carouselCalls[0]?.[0]?.id).toBe("ui-1");
		expect(uiResponses).toHaveLength(1);
		expect(uiResponses[0]?.sessionId).toBe("s1");
		expect(uiResponses[0]?.request).toMatchObject({ incarnation: "inc-1", token: "tok-1", answer: true });
		expect(typeof uiResponses[0]?.request.commandId).toBe("string");
	});
});

describe("historyFromState (fixtures only)", () => {
	it("projects a completed tool entry as a tool invocation part with its output", () => {
		const tool = entry({ id: "call-9", role: "tool", kind: "tool", text: "done", toolName: "write_file", toolStatus: "completed", output: "done", args: { path: "a.txt" } });
		const state = { ...createInitialTaskState(), transcript: [tool] };
		const turns = chatSessions.historyFromState(state, CEDIA_CHAT_PARTICIPANT_ID);
		expect(turns).toHaveLength(1);
		const [part] = (turns[0] as any).response as any[];
		expect(turns[0]).toMatchObject({ participant: CEDIA_CHAT_PARTICIPANT_ID });
		expect(part).toBeInstanceOf(vscodeStub.ChatToolInvocationPart);
		expect(part.toolCallId).toBe("call-9");
		expect(part.isComplete).toBe(true);
		expect(part.toolSpecificData.output).toBe("done");
	});
});

describe("Cedia language models (fixtures only, the model a Cedia request resolves)", () => {
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
				if (request.command === "cedia_get_model_roles") {
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
		expect(ompModelPickId("deepseek-v4.1-flash")).toBe("cedia-omp/deepseek-v4.1-flash");
		expect(ompModelIdFromPickId(`${CEDIA_OMP_MODEL_VENDOR}/deepseek-v4.1-flash`)).toBe("deepseek-v4.1-flash");
		// Option-group items and older picks carry no vendor: they must pass through.
		expect(ompModelIdFromPickId("deepseek-v4.1-flash")).toBe("deepseek-v4.1-flash");
	});

	it("registers the OMP catalogue under the vendor the pickers prefix with", async () => {
		stubState.languageModelProviders.length = 0;
		chatSessions.registerCediaChatSessions({ getClient: async () => catalogClient(), log: () => {} });
		const registered = stubState.languageModelProviders.at(-1);
		expect(registered?.vendor).toBe(CEDIA_OMP_MODEL_VENDOR);

		const models = await registered!.provider.provideLanguageModelChatInformation({}, { isCancellationRequested: false });
		expect(models).toEqual([{
			id: "deepseek-v4.1-flash",
			name: "DeepSeek V4.1 Flash",
			family: "deepseek-v4.1-flash",
			version: "1.0",
			// A model the catalogue carries without a provider cannot be matched to a role selector
			// keyed `provider/id`, so no role label appears; the provider is what `detail` names when
			// there is nothing else, because it is the field Cedia's own Agents-window picker reads to
			// group and badge a row.
			detail: "commandcode",
			maxInputTokens: 0,
			maxOutputTokens: 0,
			tooltip: undefined,
			isUserSelectable: true,
			// The provider's mark, drawn by the picker's rows and by the composer trigger: this fixture
			// row is Command Code's, which takes the terminal shape.
			statusIcon: { id: "terminal" },
			capabilities: { imageInput: false, toolCalling: true },
		}]);
		// The extension host derives `<vendor>/<id>` from exactly these pieces, which
		// is the string the pickers hand back.
		expect(`${registered!.vendor}/${models[0].id}`).toBe(ompModelPickId("deepseek-v4.1-flash"));
	});

	it("registers the model provider even when the window declares the vendor a moment later", async () => {
		const before = stubState.languageModelProviders.length;
		// Measured 2026-09-18: a run lost the startup race, `registerLanguageModelProvider` threw
		// `Chat model provider uses UNKNOWN vendor cedia-omp`, the extension gave up for the life of the
		// window, and the Agents window then had no model to attach - its composer drew nothing at all.
		// The declaration is a tick or two behind, so registration waits it out instead of dying.
		const logs: string[] = [];
		stubState.languageModelRegistrationFailures = 2;
		const disposable = chatSessions.registerCediaChatSessions({
			getClient: async () => catalogClient(),
			log: (message: string) => logs.push(message),
		});
		expect(stubState.languageModelProviders.length).toBe(before);
		await tick(2000);
		expect(stubState.languageModelProviders.length).toBe(before + 1);
		expect(stubState.languageModelProviders.at(-1)?.vendor).toBe(CEDIA_OMP_MODEL_VENDOR);
		expect(logs.some((message) => message.includes("registered on attempt 3"))).toBe(true);
		disposable.dispose();
		stubState.languageModelRegistrationFailures = 0;
	});

	it("reports honestly when the vendor never appears, instead of pretending it registered", async () => {
		const before = stubState.languageModelProviders.length;
		const logs: string[] = [];
		// Exactly the extension's retry budget, so the failure path is proven without leaking a refusal
		// into the next test's registration.
		stubState.languageModelRegistrationFailures = 6;
		const disposable = chatSessions.registerCediaChatSessions({
			getClient: async () => catalogClient(),
			log: (message: string) => logs.push(message),
		});
		// The retry budget runs out after about 3.3s, so this waits past it and reports the failure.
		await tick(4200);
		expect(stubState.languageModelProviders.length).toBe(before);
		expect(logs.some((message) => message.includes("could not register its language models") && message.includes("UNKNOWN vendor"))).toBe(true);
		disposable.dispose();
		stubState.languageModelRegistrationFailures = 0;
	}, 20000);

	it("gives every provider a mark the picker can draw beside its models", async () => {
		// The workbench picker draws `metadata.statusIcon` on its rows and on the compact composer
		// trigger, and its own heuristic only knows claude/gemini/kimi/xai/microsoft/openai - so
		// Cedia's providers (openrouter, cursor, commandcode, opencode-go, opencode-zen,
		// google-antigravity, openai-codex) had no mark at all in the Agents window until we sent one.
		expect(providerStatusIconId("openai-codex")).toBe("openai");
		expect(providerStatusIconId("anthropic")).toBe("claude");
		expect(providerStatusIconId("google-antigravity")).toBe("google-gemini");
		expect(providerStatusIconId("moonshotai")).toBe("kimi");
		expect(providerStatusIconId("x-ai")).toBe("xai");
		expect(providerStatusIconId("cursor")).toBe("cursor");
		expect(providerStatusIconId("openrouter")).toBe("globe");
		expect(providerStatusIconId("commandcode")).toBe("terminal");
		expect(providerStatusIconId("opencode-go")).toBe("plug");
		expect(providerStatusIconId("OPENCODE-ZEN")).toBe("plug");
		// A provider we have no shape for stays mark-less instead of taking someone else's brand.
		expect(providerStatusIconId("tngtech")).toBeUndefined();
		expect(providerStatusIconId(undefined)).toBeUndefined();
	});

	it("sends that mark with the catalogue it registers", async () => {
		stubState.languageModelProviders.length = 0;
		chatSessions.registerCediaChatSessions({ getClient: async () => catalogClient(), log: () => {} });
		const registered = stubState.languageModelProviders.at(-1);
		const models = await registered!.provider.provideLanguageModelChatInformation({}, { isCancellationRequested: false }) as Array<{ id: string; statusIcon?: { id: string } }>;
		expect(models[0]?.statusIcon?.id).toBe("terminal");
	});

	it("carries each model's provider, and its configured roles, as the row detail the picker draws", async () => {
		stubState.languageModelProviders.length = 0;
		chatSessions.registerCediaChatSessions({
			getClient: async () => roleCatalogClient(),
			log: () => {},
		});
		const provider = stubState.languageModelProviders.at(-1)!.provider;
		const models = await provider.provideLanguageModelChatInformation({}, { isCancellationRequested: false }) as Array<{ id: string; detail?: string }>;
		const byId = new Map(models.map(model => [model.id, model]));
		// `detail` is the field the workbench renders beside the model name and hands to every picker;
		// an option item's `description` is tooltip-only, so this is the visible path. It carries the
		// provider (the field Cedia's own Agents-window picker groups and badges by, because neither
		// `vendor` nor `modelGroup` can carry it) and the roles after it, in that order of importance.
		expect(byId.get("gpt-5.6-luna")?.detail).toBe("Fast · openai-codex");
		expect(byId.get("gpt-6-astra")?.detail).toBe("Thinking · openai-codex");
		expect(byId.get("grok-4.6")?.detail).toBe("cursor");
	});

	it("stays honestly empty, and says why, when the host cannot be read", async () => {
		stubState.languageModelProviders.length = 0;
		const logs: string[] = [];
		chatSessions.registerCediaChatSessions({
			getClient: async () => { throw new Error("host down"); },
			log: (message: string) => logs.push(message),
		});
		const provider = stubState.languageModelProviders.at(-1)!.provider;
		expect(await provider.provideLanguageModelChatInformation({}, { isCancellationRequested: false })).toEqual([]);
		expect(logs.some(message => message.includes("could not list OMP models"))).toBe(true);
	});

	it("refuses to generate instead of becoming a second model path", async () => {
		stubState.languageModelProviders.length = 0;
		chatSessions.registerCediaChatSessions({ getClient: async () => catalogClient(), log: () => {} });
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
		if (!participant) throw new Error("Cedia registered no chat participant");
		return participant;
	}

	it("runs the submitted prompt on the session the request names", async () => {
		stubState.chatParticipants.length = 0;
		const seen: any[] = [];
		const markdown: string[] = [];
		chatSessions.registerCediaChatSessions({ getClient: async () => turnClient(seen), log: () => {} });

		await lastParticipant().handler(
			{ prompt: "do the thing" },
			{
				chatSessionContext: {
					chatSessionItem: { resource: { scheme: "cedia", authority: "session", path: "/s1" } },
				},
			},
			{ markdown: (text: string) => void markdown.push(text), progress: () => {} },
			{ isCancellationRequested: false },
		);

		expect(lastParticipant().id).toBe(CEDIA_CHAT_PARTICIPANT_ID);
		expect(seen.some(entry => entry.command === "prompt" && entry.payload?.message === "do the thing")).toBe(true);
		expect(seen.some(entry => entry.call === "startSession" && entry.id === "s1")).toBe(true);
	});

	it("sends nothing and says so when the request is not one of Cedia's sessions", async () => {
		stubState.chatParticipants.length = 0;
		const seen: any[] = [];
		const logs: string[] = [];
		chatSessions.registerCediaChatSessions({ getClient: async () => turnClient(seen), log: (message: string) => logs.push(message) });

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
		chatSessions.registerCediaChatSessions({ getClient: async () => client, log: (message: string) => logs.push(message) });
		const token: any = { isCancellationRequested: false };
		const resource: any = { scheme: "cedia", authority: "session", path: "/s1" };
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
		chatSessions.registerCediaChatSessions({ getClient: async () => client, log: (message: string) => logs.push(message) });
		const resource: any = { scheme: "cedia", authority: "session", path: "/s1" };
		await vscodeController().getChatSessionInputState(resource, {}, { isCancellationRequested: false });
		const inputState = vscodeInputStates.at(-1);
		inputState.groups.find((group: any) => group.id === "models").selected = { id: "ghost-model", name: "Ghost" };
		inputState.fire();
		await tick(50);
		expect(setModelCalls).toEqual([]);
		expect(logs.some(message => message.includes("ghost-model") && message.includes("unknown"))).toBe(true);
	});

	it("says so when a remembered pick is no longer advertised by the catalogue", async () => {
		vscodeInputStates.length = 0;
		const logs: string[] = [];
		const client = pickerClient([]);
		chatSessions.registerCediaChatSessions({ getClient: async () => client, log: (message: string) => logs.push(message) });
		const resource: any = { scheme: "cedia", authority: "session", path: "/s1" };
		await vscodeController().getChatSessionInputState(
			resource,
			{ previousInputState: { groups: [{ id: "models", selected: { id: "ghost-model", name: "Ghost" } }] } },
			{ isCancellationRequested: false },
		);
		const group = vscodeInputStates.at(-1).groups.find((candidate: any) => candidate.id === "models");
		expect(group.selected?.id).toBe("probe-model");
		expect(group.description).toContain("ghost-model");
		expect(logs.some(message => message.includes("ghost-model"))).toBe(true);
	});

	it("carries a remembered pick that is still advertised without a notice", async () => {
		vscodeInputStates.length = 0;
		const logs: string[] = [];
		const client = pickerClient([]);
		chatSessions.registerCediaChatSessions({ getClient: async () => client, log: (message: string) => logs.push(message) });
		const resource: any = { scheme: "cedia", authority: "session", path: "/s1" };
		await vscodeController().getChatSessionInputState(
			resource,
			{ previousInputState: { groups: [{ id: "models", selected: { id: "probe-model", name: "Probe" } }] } },
			{ isCancellationRequested: false },
		);
		const group = vscodeInputStates.at(-1).groups.find((candidate: any) => candidate.id === "models");
		expect(group.selected?.id).toBe("probe-model");
		expect(group.description).toBeUndefined();
		expect(logs.some(message => message.includes("not carrying"))).toBe(false);
	});

	it("strips the picker's vendor prefix before writing set_model", async () => {
		// The composer pick is a `<vendor>/<id>` identifier (that is what the
		// extension host resolves); the host's set_model wants the bare OMP id, and
		// a pick that slips through unresolved would leave the host on the old model.
		const setModelCalls: any[] = [];
		const logs: string[] = [];
		chatSessions.registerCediaChatSessions({ getClient: async () => pickerClient(setModelCalls), log: (message: string) => logs.push(message) });
		const provider = stubState.chatContentProviders.at(-1)?.provider;
		const resource: any = { scheme: "cedia", authority: "session", path: "/s1" };
		provider.provideHandleOptionsChange(resource, [{ optionId: "models", value: `${CEDIA_OMP_MODEL_VENDOR}/second-model` }], { isCancellationRequested: false });
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
		chatSessions.registerCediaChatSessions({ getClient: async () => client, log: (message: string) => logs.push(message) });
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
		chatSessions.registerCediaChatSessions({ getClient: async () => client, log: (message: string) => logs.push(message) });
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
		chatSessions.registerCediaChatSessions({ getClient: async () => client, log: (message: string) => logs.push(message) });
		// Both keys are registered: the item scheme owns real sessions, and the session type owns
		// the workbench's draft resources (`<type>:/untitled-<uuid>`).
		expect(stubState.chatContentProviders.map(provider => provider.scheme)).toEqual(["cedia", "cedia.omp"]);
		const entry = stubState.chatContentProviders.find(provider => provider.scheme === "cedia");
		if (!entry) throw new Error("content provider was not registered");
		expect(entry.scheme).toBe("cedia");
		await entry.provider.provideHandleOptionsChange(
			{ scheme: "cedia", authority: "session", path: "/s1" },
			[{ optionId: "models", value: "probe-model" }],
			{ isCancellationRequested: false },
		);
		await tick(50);
		expect(setModelCalls.map(call => call.payload)).toEqual([{ provider: "probe", modelId: "probe-model" }]);
		// One line per write-through, and it is the only record of *which* resource carried the
		// option - the measurement that a draft's pick never arrives rests on it.
		expect(logs).toEqual(["Cedia session option change: cedia://session/s1 models=probe-model"]);
	});

	it("answers a draft resource with an empty session instead of reading the host", async () => {
		stubState.chatContentProviders.length = 0;
		const logs: string[] = [];
		// `optionsClient` throws on any command it does not expect, so a host read from the draft
		// path would fail this test rather than quietly pass.
		const client = optionsClient([]);
		chatSessions.registerCediaChatSessions({ getClient: async () => client, log: (message: string) => logs.push(message) });
		const entry = stubState.chatContentProviders.find(candidate => candidate.scheme === "cedia.omp");
		if (!entry) throw new Error("draft content provider was not registered");

		const session = await entry.provider.provideChatSessionContent(
			{ scheme: "cedia.omp", path: "/untitled-6f1e" },
			{ isCancellationRequested: false },
		);

		expect(session.title).toBe("New task");
		expect(session.history).toEqual([]);
		// The first Send is what creates the session, through `newChatSessionItemHandler`.
		expect(session.requestHandler).toBeUndefined();
		expect(logs).toEqual([]);
	});

	it("applies the composer's pick to the session it just created", async () => {
		const setModelCalls: any[] = [];
		const logs: string[] = [];
		const client = optionsClient(setModelCalls);
		await chatSessions.applyDraftModelChoice(
			client,
			session({ id: "fresh" }),
			{ groups: [{ id: "models", items: [{ id: "probe-model", name: "Probe" }], selected: { id: "cedia-omp/probe-model", name: "Probe" } }] },
			(message: string) => logs.push(message),
		);
		// The picker's identifier is resolved back to the pair the host's `set_model` takes.
		expect(setModelCalls.map(call => call.payload)).toEqual([{ provider: "probe", modelId: "probe-model" }]);
		expect(logs).toEqual([]);
	});

	it("keeps the host's model when the picked one is no longer advertised", async () => {
		const setModelCalls: any[] = [];
		const logs: string[] = [];
		const client = optionsClient(setModelCalls);
		await chatSessions.applyDraftModelChoice(
			client,
			session({ id: "fresh" }),
			{ groups: [{ id: "models", items: [{ id: "probe-model", name: "Probe" }], selected: { id: "gone-model", name: "Gone" } }] },
			(message: string) => logs.push(message),
		);
		// Handing OMP a name it cannot find would fail the change; saying so is the honest outcome.
		expect(setModelCalls).toEqual([]);
		expect(logs).toEqual(["Cedia kept the host's current model: the picked model 'gone-model' is not in OMP's catalogue."]);
	});

	it("logs honestly and sends nothing for an unknown model id", async () => {
		stubState.chatContentProviders.length = 0;
		const setModelCalls: any[] = [];
		const logs: string[] = [];
		const client = optionsClient(setModelCalls);
		chatSessions.registerCediaChatSessions({ getClient: async () => client, log: (message: string) => logs.push(message) });
		const entry = stubState.chatContentProviders.at(-1);
		if (!entry) throw new Error("content provider was not registered");
		await entry.provider.provideHandleOptionsChange(
			{ scheme: "cedia", authority: "session", path: "/s1" },
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
		expect(getModelRolesRequest(target, "c1")).toMatchObject({ command: "cedia_get_model_roles", incarnation: "inc-7" });
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
