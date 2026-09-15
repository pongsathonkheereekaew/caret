import { describe, expect, it } from "bun:test";
import { MAX_SUGGESTIONS, parseSuggestionPayload, searchUrlFor, SUGGEST_ENDPOINT } from "../src/browser-search.ts";

/*
 * The Apps panel's address bar shows the engine's suggestions as you type; the
 * extension host makes the request because the workbench renderer is subject to CORS.
 */

describe("browser search suggestions", () => {
	it("reads the engine's reply", () => {
		expect(parseSuggestionPayload('["cats",["cats","cats videos","cats and dogs"]]'))
			.toEqual(["cats", "cats videos", "cats and dogs"]);
	});

	it("asks the endpoint whose shape it can read", () => {
		// The Firefox client answers with JSON; the Chrome client answers with a
		// callback, which is why this one is used.
		expect(SUGGEST_ENDPOINT).toContain("client=firefox");
		expect(SUGGEST_ENDPOINT.endsWith("q=")).toBe(true);
	});

	it("returns nothing rather than inventing rows for a reply it cannot read", () => {
		for (const payload of ["", "not json", "[]", '["cats"]', '["cats","nope"]', '["cats",[1,2]]', "{}"]) {
			expect(parseSuggestionPayload(payload)).toEqual([]);
		}
	});

	it("drops blanks, duplicates and extra rows", () => {
		const many = Array.from({ length: 20 }, (_, index) => `term ${index}`);
		const payload = JSON.stringify(["term", ["  ", "cats", "cats", ...many]]);
		const suggestions = parseSuggestionPayload(payload);
		expect(suggestions[0]).toBe("cats");
		expect(new Set(suggestions).size).toBe(suggestions.length);
		expect(suggestions.length).toBe(MAX_SUGGESTIONS);
	});

	it("opens a chosen suggestion as a search", () => {
		expect(searchUrlFor("cats and dogs")).toBe("https://www.google.com/search?q=cats%20and%20dogs");
		expect(searchUrlFor("  spaced  ")).toBe("https://www.google.com/search?q=spaced");
	});
});
