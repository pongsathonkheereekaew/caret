import { describe, expect, it } from "bun:test";
import { SETTINGS_SECTIONS } from "../src/capability-catalog.ts";
import { buildSearchHits, emptySearchPalette, SEARCH_ACTIONS, SEARCH_INDEX_FAILED_NOTE } from "../src/search-palette.ts";

describe("buildSearchHits", () => {
	it("labels New task without inventing a file index note on empty search", () => {
		expect(SEARCH_ACTIONS.some(hit => hit.id === "new_task" && hit.label === "New task")).toBe(true);
		expect(SEARCH_INDEX_FAILED_NOTE).toBe("Last indexed: workspace file search failed. Caret will not invent a file index.");
		expect(emptySearchPalette()).toEqual({ query: "", scope: "all", hits: [], noMatch: false });
	});

	it("stays empty until there is a query and does not invent a hit", () => {
		expect(buildSearchHits({ query: "  " })).toEqual(emptySearchPalette());
	});

	it("scopes tasks, files, actions, and settings without creating a task on no-match", () => {
		const hits = buildSearchHits({
			query: "omp",
			scope: "all",
			sessions: [{ id: "s1", title: "OMP polish" }],
			files: [{ path: "apps/macos/src/webview.ts" }],
			settings: [...SETTINGS_SECTIONS],
			actions: SEARCH_ACTIONS,
		});
		expect(hits.noMatch).toBe(false);
		expect(hits.hits.some(hit => hit.action === "select_session" && hit.id === "s1")).toBe(true);
		expect(hits.hits.some(hit => hit.action === "open_settings" && hit.label === "Agents/OMP")).toBe(true);
		expect(hits.hits.some(hit => hit.scope === "actions")).toBe(false);
		expect(buildSearchHits({ query: "caret-ui-no-match-137", sessions: [{ id: "s1", title: "Hello" }] })).toMatchObject({
			noMatch: true,
			hits: [],
		});
	});

	it("limits a scoped search to that tab", () => {
		const files = buildSearchHits({
			query: "webview",
			scope: "files",
			sessions: [{ id: "s1", title: "webview work" }],
			files: [{ path: "apps/macos/src/webview.ts" }],
		});
		expect(files.hits).toEqual([{ id: "apps/macos/src/webview.ts", scope: "files", label: "apps/macos/src/webview.ts", action: "open_file" }]);
	});

	it("matches advertised settings row labels without inventing a marketplace", () => {
		const hits = buildSearchHits({
			query: "mcp servers",
			scope: "settings",
			settings: [...SETTINGS_SECTIONS],
			settingRows: [{ id: "mcp:none", section: "Tools/MCP", label: "MCP servers" }],
		});
		expect(hits.hits.some(hit => hit.action === "open_settings" && hit.label === "MCP servers" && hit.id === "Tools/MCP")).toBe(true);
		expect(hits.hits.some(hit => /cloud|marketplace/i.test(hit.label))).toBe(false);
	});

	it("finds a task from a transcript snippet without creating a new task", () => {
		const hits = buildSearchHits({
			query: "immutable receipt",
			sessions: [{ id: "s1", title: "Other title" }],
			transcripts: [{ sessionId: "s1", title: "Other title", text: "Keep the immutable receipt on this device." }],
		});
		expect(hits.hits).toEqual([{
			id: "s1",
			scope: "tasks",
			label: "Other title",
			detail: "Keep the immutable receipt on this device.",
			action: "select_session",
		}]);
		expect(hits.noMatch).toBe(false);
	});
});
