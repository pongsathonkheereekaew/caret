/*
 * Pure projection from Caret host state to the shapes the native chat UI
 * expects. Kept free of the `vscode` module so it can be unit-tested with
 * fixtures; the registration layer lives in chat-sessions.ts.
 */

import type { CommandRequest, Project, Session } from "../../../packages/protocol/src/index.ts";
import type { TranscriptEntry } from "./state.ts";

export const CARET_CHAT_SESSION_SCHEME = "caret";
/**
 * One id for the whole surface: the chat session type, the contributed
 * `chatSessions` entry and the default chat participant all use it, because the
 * workbench resolves the participant against the session contribution
 * (`getAllChatSessionContributions().find(c => c.type === id)`).
 */
export const CARET_CHAT_SESSION_TYPE = "caret.omp";
export const CARET_CHAT_PARTICIPANT_ID = "caret.omp";

/** Semantic session state; the registration layer maps it to `vscode.ChatSessionStatus`. */
export type SessionState = "in-progress" | "completed" | "failed";

export interface SessionItemShape {
	readonly id: string;
	readonly label: string;
	readonly description: string | undefined;
	readonly state: SessionState;
	readonly timing: { readonly created: number; readonly lastRequestStarted?: number; readonly lastRequestEnded?: number };
}

/** Provider-independent description of one transcript turn. */
export interface TurnPlan {
	readonly kind: "request" | "response";
	readonly text: string;
	readonly toolNames: readonly string[];
}

export function sessionUriString(sessionId: string): string {
	return `${CARET_CHAT_SESSION_SCHEME}://session/${encodeURIComponent(sessionId)}`;
}

export function sessionIdFromUri(uri: { readonly scheme: string; readonly authority?: string; readonly path: string }): string | undefined {
	if (uri.scheme !== CARET_CHAT_SESSION_SCHEME || uri.authority !== "session") return undefined;
	const id = decodeURIComponent(uri.path.replace(/^\//, ""));
	return id.length > 0 ? id : undefined;
}

/**
 * Host status -> UI state. `idle` and `stopped` are both "the host is not
 * working on this", which the UI shows as completed; only a host that demands
 * reconciliation is reported as failed, because that is the state that needs
 * the user's attention.
 */
export function sessionState(status: Session["status"]): SessionState {
	switch (status) {
		case "running": return "in-progress";
		case "recovery_required": return "failed";
		default: return "completed";
	}
}

function millis(value: string | undefined): number {
	if (!value) return 0;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

export function sessionItemShape(session: Session, projectName?: string): SessionItemShape {
	const updated = millis(session.updatedAt) || undefined;
	return {
		id: session.id,
		label: session.title,
		description: projectName,
		state: sessionState(session.status),
		timing: {
			created: millis(session.createdAt),
			lastRequestStarted: updated,
			lastRequestEnded: session.status === "running" ? undefined : updated,
		},
	};
}

export function projectNameFor(projects: readonly Project[], session: Session): string | undefined {
	return projects.find(project => project.id === session.projectId)?.name;
}

/**
 * Group a reduced transcript into user requests and the assistant/tool work that
 * answered them. Anything the host did not record is left out, never invented.
 */
export function turnPlansFromTranscript(transcript: readonly TranscriptEntry[]): readonly TurnPlan[] {
	const plans: TurnPlan[] = [];
	for (const entry of transcript) {
		if (entry.role === "user") {
			plans.push({ kind: "request", text: entry.text, toolNames: [] });
			continue;
		}
		if (entry.role === "system") continue;
		// A tool row contributes its name only. Its output is not prose and must
		// not be spliced into the assistant's markdown, and the row's text is the
		// label itself, so appending both would duplicate it.
		const isTool = entry.kind === "tool";
		const toolName = isTool ? (entry.toolName ?? entry.text) : undefined;
		const last = plans.at(-1);
		if (last?.kind === "response") {
			plans[plans.length - 1] = {
				kind: "response",
				text: [last.text, isTool ? "" : entry.text].filter(Boolean).join("\n\n"),
				toolNames: toolName ? [...last.toolNames, toolName] : last.toolNames,
			};
			continue;
		}
		plans.push({ kind: "response", text: isTool ? "" : entry.text, toolNames: toolName ? [toolName] : [] });
	}
	return plans;
}

/**
 * S2 is text-only: the composer forwards a plain string and OMP receives
 * `{message: prompt}`. Images, attachments and streamingBehavior are not
 * threaded here yet; a later slice should extend this payload (and `runTurn`
 * in chat-sessions.ts) to carry them instead of dropping them silently.
 */
export function promptRequest(session: Session, prompt: string, commandId: string): CommandRequest {
	return { commandId, incarnation: session.incarnation, command: "prompt", payload: { message: prompt } };
}

export function abortRequest(session: Session, commandId: string): CommandRequest {
	return { commandId, incarnation: session.incarnation, command: "abort" };
}

/** One OMP model as advertised by `get_available_models` (pure, no provider calls). */
export interface OmpAdvertisedModel {
	readonly id: string;
	readonly provider?: string;
	readonly label: string;
	readonly available: boolean;
	readonly reason?: string;
}

/** Minimal login-provider shape needed to mark `needs_auth` honestly. */
export interface OmpLoginProvider {
	readonly id: string;
	readonly authenticated?: boolean;
}

/** Honest projection of the OMP catalog: never invents a fallback model. */
export interface OmpModelSnapshot {
	readonly models: readonly OmpAdvertisedModel[];
	readonly selectedModelId?: string;
	readonly hasModels: boolean;
}

/** Picker-safe projection of one advertised model (no OMP internals leak). */
export interface OmpModelPickerItem {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly tooltip?: string;
}

/** Minimal `models` option group shared by the native and webview pickers. */
export interface OmpModelPickerGroup {
	readonly id: "models";
	readonly name: "Models";
	readonly items: readonly OmpModelPickerItem[];
	readonly selected?: OmpModelPickerItem;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function nonEmpty(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function unwrapData(value: unknown): unknown {
	const record = asRecord(value);
	if (record && "data" in record) return unwrapData(record.data);
	return value;
}

function modelArrayFrom(value: unknown): readonly unknown[] {
	const unwrapped = unwrapData(value);
	if (Array.isArray(unwrapped)) return unwrapped;
	const record = asRecord(unwrapped);
	const models = record?.models;
	return Array.isArray(models) ? models : [];
}

/**
 * Normalize an OMP `get_available_models` ack/result into picker-ready models.
 * Accepts the raw `result ?? ack` value (which may be `{data:{models:[...]}}`,
 * `{models:[...]}` or a bare array) and drops rows without an id rather than
 * inventing one. `label` prefers OMP's `label`, then `name`, then
 * `provider/id`. `available` defaults to true; OMP only opts out explicitly.
 */
export function normalizeOmpModels(value: unknown): OmpAdvertisedModel[] {
	return modelArrayFrom(value).flatMap((entry): OmpAdvertisedModel[] => {
		const item = asRecord(entry);
		if (!item) return [];
		const id = nonEmpty(item.id) ?? nonEmpty(item.modelId);
		if (!id) return [];
		const provider = nonEmpty(item.provider);
		const label = nonEmpty(item.label) ?? nonEmpty(item.name) ?? (provider ? `${provider} / ${id}` : id);
		const reason = nonEmpty(item.reason);
		return [{
			id,
			...(provider ? { provider } : {}),
			label,
			available: item.available !== false,
			...(reason ? { reason } : {}),
		}];
	});
}

/**
 * Read OMP's current model from a `get_state` ack/result. OMP v18 puts it under
 * `data.model` (`{id, provider, ...}`); older shapes used a top-level string.
 * Returns undefined when nothing usable was advertised rather than guessing.
 */
export function currentModelIdFromOmpState(value: unknown): string | undefined {
	const unwrapped = unwrapData(value);
	const root = asRecord(unwrapped);
	if (!root) return typeof unwrapped === "string" ? (nonEmpty(unwrapped) ?? undefined) : undefined;
	const model = root.model;
	if (typeof model === "string") {
		const id = nonEmpty(model);
		if (id) return id;
	}
	const record = asRecord(model);
	if (record) {
		const id = nonEmpty(record.id) ?? nonEmpty(record.modelId);
		if (id) return id;
	}
	for (const key of ["modelId", "currentModel", "current_model", "selectedModel", "selected_model", "model_id"] as const) {
		const id = nonEmpty(root[key]);
		if (id) return id;
	}
	return undefined;
}

/**
 * Project normalized OMP models plus the `get_state` current id into an honest
 * snapshot. The current id is kept only when it is still advertised; otherwise
 * it is dropped (no billed fallback). `loginProviders` marks
 * provider-unauthenticated rows with a needs-auth reason, mirroring
 * `capability-catalog.ts#modelEntry`, without changing membership.
 */
export function projectOmpModelSnapshot(
	models: readonly OmpAdvertisedModel[],
	currentModelId?: string,
	loginProviders?: readonly OmpLoginProvider[],
): OmpModelSnapshot {
	const auth = new Map((loginProviders ?? []).map(provider => [provider.id, provider.authenticated]));
	const annotated = models.map((model): OmpAdvertisedModel => {
		const unauthenticated = model.provider !== undefined && auth.get(model.provider) === false;
		if (unauthenticated && model.reason === undefined) {
			return { ...model, reason: "Provider is not authenticated" };
		}
		return model;
	});
	const selected = currentModelId && annotated.some(model => model.id === currentModelId) ? currentModelId : undefined;
	return {
		models: annotated,
		...(selected ? { selectedModelId: selected } : {}),
		hasModels: annotated.length > 0,
	};
}

/**
 * Build the minimal `models` option group from a snapshot. Empty catalogs
 * produce an empty group (honest-disabled downstream); nothing is invented.
 */
export function modelPickerGroupFromSnapshot(snapshot: OmpModelSnapshot): OmpModelPickerGroup {
	const items: OmpModelPickerItem[] = snapshot.models.map(model => ({
		id: model.id,
		name: model.label,
		...(model.provider ? { description: model.provider } : {}),
		...(model.reason ? { tooltip: model.reason } : {}),
	}));
	const selected = snapshot.selectedModelId ? items.find(item => item.id === snapshot.selectedModelId) : undefined;
	return {
		id: "models",
		name: "Models",
		items,
		...(selected ? { selected } : {}),
	};
}

export function getAvailableModelsRequest(session: Session, commandId: string): CommandRequest {
	return { commandId, incarnation: session.incarnation, command: "get_available_models", payload: {} };
}

export function getOmpStateRequest(session: Session, commandId: string): CommandRequest {
	return { commandId, incarnation: session.incarnation, command: "get_state", payload: {} };
}

export function setOmpModelRequest(session: Session, provider: string, modelId: string, commandId: string): CommandRequest {
	return { commandId, incarnation: session.incarnation, command: "set_model", payload: { provider, modelId } };
}

export function getLoginProvidersRequest(session: Session, commandId: string): CommandRequest {
	return { commandId, incarnation: session.incarnation, command: "get_login_providers", payload: {} };
}

function providerArrayFrom(value: unknown): readonly unknown[] {
	const unwrapped = unwrapData(value);
	if (Array.isArray(unwrapped)) return unwrapped;
	const record = asRecord(unwrapped);
	const providers = record?.providers;
	return Array.isArray(providers) ? providers : [];
}

/**
 * Normalize a `get_login_providers` ack/result into `{id, authenticated}` rows.
 * Accepts `{data:{providers:[...]}}`, `{providers:[...]}`, `{data:[...]}` or a
 * bare array; drops rows without an id. `authenticated` is kept only when OMP
 * sent a boolean — a missing flag stays undefined so the snapshot does not
 * invent a needs-auth annotation.
 */
export function normalizeOmpLoginProviders(value: unknown): OmpLoginProvider[] {
	return providerArrayFrom(value).flatMap((entry): OmpLoginProvider[] => {
		const item = asRecord(entry);
		if (!item) return [];
		const id = nonEmpty(item.id);
		if (!id) return [];
		return [{
			id,
			...(typeof item.authenticated === "boolean" ? { authenticated: item.authenticated } : {}),
		}];
	});
}

/**
 * Resolve the OMP provider for a picker selection against a snapshot.
 * Prefers the advertised catalog row; falls back to the picker's own
 * description (which carries the provider for known rows). Returns undefined
 * when neither knows the provider so the caller can fail honestly instead of
 * guessing `set_model:{provider,...}`.
 */
export function resolveOmpModelPickProvider(
	snapshot: OmpModelSnapshot,
	pickedId: string,
	pickedDescription?: unknown,
): string | undefined {
	const advertised = snapshot.models.find(model => model.id === pickedId);
	if (advertised?.provider) return advertised.provider;
	return typeof pickedDescription === "string" && pickedDescription.trim().length > 0
		? pickedDescription.trim()
		: undefined;
}
