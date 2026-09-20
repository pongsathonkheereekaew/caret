/** D18 / CU-13 model parameters. Only advertised OMP thinking levels — never invent Fast/High. */

export const THINKING_NOT_ADVERTISED = "OMP has not advertised thinking levels for this model.";

export interface ThinkingOption {
	readonly id: string;
	readonly label: string;
	readonly enabled: boolean;
}

export interface ThinkingParams {
	readonly advertised: boolean;
	readonly current?: string;
	readonly options: readonly ThinkingOption[];
	readonly reason: string;
}

export function emptyThinkingParams(reason = THINKING_NOT_ADVERTISED): ThinkingParams {
	return { advertised: false, options: [], reason };
}

export function projectThinkingParams(input: {
	readonly advertisedLevels?: readonly string[];
	readonly current?: string;
}): ThinkingParams {
	const levels = uniqueLevels(input.advertisedLevels);
	const current = clean(input.current);
	if (!levels.length) return emptyThinkingParams();
	const options = levels.map((id): ThinkingOption => ({
		id,
		label: id,
		enabled: true,
	}));
	return {
		advertised: true,
		...(current ? { current } : {}),
		options,
		reason: "",
	};
}

export function thinkingFromOmpState(data: Record<string, unknown> | undefined): ThinkingParams {
	if (!data) return emptyThinkingParams();
	const levels = asStringList(data.thinkingLevels)
		?? asStringList(data.thinking_levels)
		?? asStringList(data.availableThinkingLevels)
		?? asStringList(data.available_thinking_levels);
	const current = firstString(data.thinkingLevel, data.thinking_level, data.thinking);
	return projectThinkingParams({ advertisedLevels: levels, current });
}

export function parentSessionFromOmpState(data: Record<string, unknown> | undefined): string | undefined {
	if (!data) return undefined;
	return firstString(data.parentSession, data.parent_session, data.parentSessionId, data.parent_session_id, data.parentId);
}

export function messagesPageFromOmp(data: unknown): { readonly messages: readonly unknown[]; readonly nextCursor?: string; readonly advertised: boolean } {
	if (!data || typeof data !== "object" || Array.isArray(data)) return { messages: [], advertised: false };
	const record = data as Record<string, unknown>;
	const list = Array.isArray(record.messages) ? record.messages : Array.isArray(data) ? data : [];
	const nextCursor = firstString(record.nextCursor, record.next_cursor, record.cursor);
	return {
		messages: list,
		...(nextCursor ? { nextCursor } : {}),
		advertised: true,
	};
}

export function ompCommandData(command: { readonly result?: unknown; readonly ack?: unknown }): Record<string, unknown> {
	const raw = unwrap(command.result) ?? unwrap(command.ack);
	return raw ?? {};
}

function unwrap(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	const record = value as Record<string, unknown>;
	if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) return record.data as Record<string, unknown>;
	return record;
}

function uniqueLevels(values: readonly string[] | undefined): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const value of values ?? []) {
		const id = clean(value);
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	return out;
}

function asStringList(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const items = value.map(item => typeof item === "string" ? item : "").filter(Boolean);
	return items.length ? items : undefined;
}

function firstString(...values: unknown[]): string | undefined {
	for (const value of values) {
		const text = clean(typeof value === "string" ? value : undefined);
		if (text) return text;
	}
	return undefined;
}

function clean(value: string | undefined): string | undefined {
	const text = value?.trim();
	return text ? text : undefined;
}
