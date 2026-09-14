/** Sidebar search palette (S01 / CU-08/09). Enter on no-match does not create a task. */

export const SEARCH_SCOPES = ["all", "tasks", "files", "actions", "settings"] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];

export type SearchHitAction = "select_session" | "open_file" | "run_action" | "open_settings" | "create_draft";

export interface SearchHit {
	readonly id: string;
	readonly scope: Exclude<SearchScope, "all">;
	readonly label: string;
	readonly detail?: string;
	readonly action: SearchHitAction;
}

export interface SearchPaletteState {
	readonly query: string;
	readonly scope: SearchScope;
	readonly hits: readonly SearchHit[];
	readonly noMatch: boolean;
	readonly updating?: boolean;
	readonly queryId?: number;
	readonly lastIndexedNote?: string;
}

export const SEARCH_INDEX_FAILED_NOTE = "Last indexed: workspace file search failed. Caret will not invent a file index.";

export const SEARCH_ACTIONS: readonly SearchHit[] = [
	{ id: "new_task", scope: "actions", label: "New task", action: "run_action" },
	{ id: "settings", scope: "actions", label: "Open Settings", action: "open_settings" },
	{ id: "pair", scope: "actions", label: "Pair iPhone", action: "run_action" },
	{ id: "ide", scope: "actions", label: "Show IDE", action: "run_action" },
	{ id: "agents", scope: "actions", label: "Show Agents", action: "run_action" },
	{ id: "find_in_transcript", scope: "actions", label: "Find in transcript", action: "run_action" },
];

export function emptySearchPalette(): SearchPaletteState {
	return { query: "", scope: "all", hits: [], noMatch: false };
}

export function normalizeSearchScope(value: unknown): SearchScope {
	return typeof value === "string" && (SEARCH_SCOPES as readonly string[]).includes(value) ? value as SearchScope : "all";
}

export function buildSearchHits(input: {
	readonly query: string;
	readonly scope?: SearchScope;
	readonly sessions?: readonly { readonly id: string; readonly title?: string }[];
	readonly files?: readonly { readonly path: string }[];
	readonly settings?: readonly string[];
	readonly settingRows?: readonly { readonly id: string; readonly section: string; readonly label: string }[];
	readonly actions?: readonly SearchHit[];
	readonly transcripts?: readonly { readonly sessionId: string; readonly title?: string; readonly text?: string }[];
	readonly queryId?: number;
}): SearchPaletteState {
	const query = input.query.trim();
	const scope = input.scope ?? "all";
	const queryId = input.queryId;
	if (!query) return { query: "", scope, hits: [], noMatch: false, ...(queryId === undefined ? {} : { queryId }) };
	const needle = query.toLowerCase();
	const hits: SearchHit[] = [];
	if (scope === "all" || scope === "tasks") {
		const seen = new Set<string>();
		for (const session of input.sessions ?? []) {
			const label = session.title || session.id;
			if (!`${label} ${session.id}`.toLowerCase().includes(needle)) continue;
			seen.add(session.id);
			hits.push({ id: session.id, scope: "tasks", label, detail: session.id, action: "select_session" });
		}
		for (const row of input.transcripts ?? []) {
			const text = row.text ?? "";
			if (!text.toLowerCase().includes(needle) || seen.has(row.sessionId)) continue;
			seen.add(row.sessionId);
			const at = text.toLowerCase().indexOf(needle);
			const start = Math.max(0, at - 24);
			const snippet = text.slice(start, start + 80).trim();
			hits.push({
				id: row.sessionId,
				scope: "tasks",
				label: row.title || row.sessionId,
				detail: snippet,
				action: "select_session",
			});
		}
	}
	if (scope === "all" || scope === "files") {
		for (const file of input.files ?? []) {
			if (!file.path.toLowerCase().includes(needle)) continue;
			hits.push({ id: file.path, scope: "files", label: file.path, action: "open_file" });
		}
	}
	if (scope === "all" || scope === "actions") {
		for (const action of input.actions ?? SEARCH_ACTIONS) {
			if (!action.label.toLowerCase().includes(needle) && !action.id.toLowerCase().includes(needle)) continue;
			hits.push(action);
		}
	}
	if (scope === "all" || scope === "settings") {
		const seen = new Set<string>();
		for (const name of input.settings ?? []) {
			if (!name.toLowerCase().includes(needle)) continue;
			seen.add(name);
			hits.push({ id: name, scope: "settings", label: name, action: "open_settings" });
		}
		for (const row of input.settingRows ?? []) {
			if (![row.label, row.section, row.id].join(" ").toLowerCase().includes(needle)) continue;
			if (seen.has(row.section) && row.label === row.section) continue;
			hits.push({
				id: row.section || row.id,
				scope: "settings",
				label: row.label || row.id,
				detail: row.section,
				action: "open_settings",
			});
		}
	}
	return { query, scope, hits, noMatch: hits.length === 0, ...(queryId === undefined ? {} : { queryId }) };
}
