/*
 * Pure projection from Caret host state to the shapes the native chat UI
 * expects. Kept free of the `vscode` module so it can be unit-tested with
 * fixtures; the registration layer lives in chat-sessions.ts.
 */

import type { CommandRequest, Project, Session } from "../../../packages/protocol/src/index.ts";
import type { TranscriptEntry } from "./state.ts";

/**
 * Item URI scheme. It intentionally differs from {@link CARET_CHAT_SESSION_TYPE}
 * (`caret` vs `caret.omp`, matching upstream's scheme/type split): the scheme
 * keys item resources and the content provider, while the controller type keys
 * the option-group store. Patch 0011 bridges the two (dual-index on publish)
 * so the picker reads the OMP catalog under either key. Window-local only;
 * the host store is keyed by session id.
 */
export const CARET_CHAT_SESSION_SCHEME = "caret";
/**
 * One id for the whole surface: the chat session type, the contributed
 * `chatSessions` entry and the default chat participant all use it, because the
 * workbench resolves the participant against the session contribution
 * (`getAllChatSessionContributions().find(c => c.type === id)`).
 */
export const CARET_CHAT_SESSION_TYPE = "caret.omp";
export const CARET_CHAT_PARTICIPANT_ID = "caret.omp";
/**
 * Vendor Caret registers its language models under (`lm.registerLanguageModelChatProvider`).
 *
 * The extension host builds a model identifier as `<vendor>/<model id>` and
 * resolves a request's model by that exact string, so the workbench pickers that
 * project the same OMP catalogue have to hand back the same string: patch 0010
 * (sessions bridge) and patch 0011 (chat-widget picker) both prefix with this
 * vendor, and {@link ompModelIdFromPickId} turns a pick back into the OMP id the
 * host's `set_model` expects. The value must never drift from those patches.
 */
export const CARET_OMP_MODEL_VENDOR = "caret-omp";

/** Picker/LM identifier for one OMP model: `<vendor>/<model id>`. */
export function ompModelPickId(modelId: string): string {
	return `${CARET_OMP_MODEL_VENDOR}/${modelId}`;
}

/**
 * The OMP model id behind a pick, or the value unchanged when it carries no
 * vendor prefix (option-group items and older picks are bare ids).
 */
export function ompModelIdFromPickId(value: string): string {
	const prefix = `${CARET_OMP_MODEL_VENDOR}/`;
	return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

/** Semantic session state; the registration layer maps it to `vscode.ChatSessionStatus`. */
export type SessionState = "in-progress" | "completed" | "failed";

export interface SessionItemShape {
	readonly id: string;
	readonly label: string;
	readonly description: string | undefined;
	readonly state: SessionState;
	/**
	 * The host's archived flag, carried so the native list can keep the row out of
	 * its workspace group: the section a row lands in is the list's decision, and
	 * the host's own flag is the only thing that can tell it.
	 */
	readonly archived: boolean;
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
		archived: session.archived === true,
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
	/** OMP's advertised input window, when it reports one (tokens). */
	readonly contextWindow?: number;
	/** OMP's advertised output budget, when it reports one (tokens). */
	readonly maxOutputTokens?: number;
}

/** The session's context occupancy as OMP reports it in `get_state.contextUsage`. */
export interface OmpContextUsage {
	readonly tokens: number;
	readonly contextWindow?: number;
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
		// Size numbers are advertised, never derived: a model that does not report a
		// window stays unknown (0 = neutral unknown downstream) instead of guessing.
		const contextWindow = positiveNumber(item.contextWindow);
		const maxOutputTokens = positiveNumber(item.maxTokens) ?? positiveNumber(item.maxOutputTokens);
		return [{
			id,
			...(provider ? { provider } : {}),
			label,
			available: item.available !== false,
			...(reason ? { reason } : {}),
			...(contextWindow !== undefined ? { contextWindow } : {}),
			...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
		}];
	});
}

/** A positive finite number, or undefined for anything else (never NaN/Infinity/0). */
function positiveNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Read OMP's current context occupancy from a `get_state` ack/result
 * (`data.contextUsage = { tokens, contextWindow, percent }`). Returns undefined
 * when OMP does not report it rather than inventing a size.
 */
export function contextUsageFromOmpState(value: unknown): OmpContextUsage | undefined {
	const data = asRecord(unwrapData(value));
	const usage = asRecord(data?.contextUsage);
	if (!usage) return undefined;
	const tokens = typeof usage.tokens === "number" && Number.isFinite(usage.tokens) && usage.tokens >= 0 ? usage.tokens : undefined;
	if (tokens === undefined) return undefined;
	const contextWindow = positiveNumber(usage.contextWindow);
	return { tokens, ...(contextWindow !== undefined ? { contextWindow } : {}) };
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

export function getModelRolesRequest(session: Session, commandId: string): CommandRequest {
	return { commandId, incarnation: session.incarnation, command: "caret_get_model_roles", payload: {} };
}

export function setModelRoleRequest(session: Session, role: string, modelId: string | null, commandId: string): CommandRequest {
	return { commandId, incarnation: session.incarnation, command: "caret_set_model_role", payload: { role, modelId } };
}

/** One configured model role as OMP reports it: which model does which job. */
export interface OmpModelRole {
	readonly role: string;
	/** `provider/model` selector, or `@otherRole` when the role aliases another. */
	readonly modelId: string;
	/** Layer the effective value came from, for an honest provenance display. */
	readonly source: string;
}

/** Roles plus the order the model switcher steps through, as OMP resolves them. */
export interface OmpModelRoles {
	readonly cycleOrder: readonly string[];
	readonly roles: readonly OmpModelRole[];
	readonly storage?: string;
}

/**
 * Normalize a `caret_get_model_roles` ack/result. Roles without an id are
 * dropped rather than invented, and `cycleOrder` keeps only entries that also
 * resolved to a role so the picker cannot step onto an empty slot.
 */
export function normalizeOmpModelRoles(value: unknown): OmpModelRoles {
	const data = asRecord(unwrapData(value));
	const rawRoles = Array.isArray(data?.roles) ? data.roles : [];
	const roles = rawRoles.flatMap((entry): OmpModelRole[] => {
		const item = asRecord(entry);
		const role = nonEmpty(item?.role);
		const modelId = nonEmpty(item?.modelId);
		if (!role || !modelId) return [];
		return [{ role, modelId, source: nonEmpty(item?.source) ?? "default" }];
	});
	const known = new Set(roles.map(role => role.role));
	const rawOrder = Array.isArray(data?.cycleOrder) ? data.cycleOrder : [];
	const cycleOrder = rawOrder.flatMap(entry => {
		const role = nonEmpty(entry);
		return role && known.has(role) ? [role] : [];
	});
	const storage = nonEmpty(data?.storage);
	return { cycleOrder, roles, ...(storage ? { storage } : {}) };
}

/**
 * The display label for a role, matching the vocabulary OMP's own carousel uses
 * (`MODEL_ROLES` in the OMP source: smol is "Fast", slow is "Thinking", plan is
 * "Architect"). An unknown custom role shows its own id rather than a guess.
 */
const MODEL_ROLE_LABELS: Record<string, string> = {
	default: "Default",
	smol: "Fast",
	slow: "Thinking",
	vision: "Vision",
	plan: "Architect",
	commit: "Commit",
	tiny: "Tiny",
	task: "Subtask",
	advisor: "Advisor",
};

export function modelRoleLabel(role: string): string {
	return MODEL_ROLE_LABELS[role] ?? role;
}

/**
 * Name the roles each catalog model holds, keyed by `provider/modelId`.
 *
 * A role selector may be another role (`@slow`) rather than a concrete model, so
 * an alias is resolved through the same map before grouping — otherwise the
 * aliased role would silently vanish and the user would see a role that exists in
 * OMP but nowhere in Caret. A role that resolves to nothing is dropped instead of
 * listed against a model it does not own.
 *
 * The key is provider-qualified because a bare id is ambiguous: OMP's catalog can
 * carry the same short id under two providers, and matching on the id alone would
 * annotate the wrong row.
 */
export function rolesByModelSelector(roles: OmpModelRoles): ReadonlyMap<string, readonly string[]> {
	const byRole = new Map(roles.roles.map(role => [role.role, role.modelId]));
	const grouped = new Map<string, string[]>();
	for (const role of roles.roles) {
		let selector = role.modelId;
		// Follow `@role` aliases, bounded by the alias count so a cycle terminates.
		for (let hop = 0; selector.startsWith("@") && hop < roles.roles.length; hop++) {
			selector = byRole.get(selector.slice(1)) ?? "";
		}
		if (!selector || selector.startsWith("@")) continue;
		const labels = grouped.get(selector);
		if (labels) labels.push(modelRoleLabel(role.role));
		else grouped.set(selector, [modelRoleLabel(role.role)]);
	}
	return grouped;
}

/**
 * Build one picker group per configured role, so a role's model can be chosen
 * where models are chosen.
 *
 * Each item's id is `role\u0000modelSelector`, because the write-back handler
 * receives only the group id and the picked value: encoding both lets a single
 * handler assign any role without guessing which group produced the value. The
 * leading "clear" item is what makes an assignment removable, which is how a role
 * returns to OMP's own default resolution instead of being pinned forever.
 */
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
