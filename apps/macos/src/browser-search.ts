/**
 * Address-bar search for the Apps panel's browser.
 *
 * The panel's address bar offers the engine's suggestions as you type, and its own
 * fetch cannot do that: the workbench renderer is subject to CORS, so
 * suggestqueries.google.com answers `Failed to fetch` there. The extension host is
 * Node, so the request is made here and the address bar asks for the list.
 */

/** The engine the address bar searches with, and the endpoint that completes terms. */
export const SUGGEST_ENDPOINT = "https://suggestqueries.google.com/complete/search?client=firefox&q=";

/** At most this many rows are offered, so the list never covers the page. */
export const MAX_SUGGESTIONS = 8;

/**
 * The engine's reply is `[term, [suggestion, ...]]`. Anything else - an empty body, a
 * different shape, a non-string entry - is not a suggestion list, and the address bar
 * is left without rows rather than shown invented ones.
 */
export function parseSuggestionPayload(payload: string): string[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(payload);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed) || parsed.length < 2 || !Array.isArray(parsed[1])) return [];
	const seen = new Set<string>();
	const suggestions: string[] = [];
	for (const entry of parsed[1]) {
		if (typeof entry !== "string") continue;
		const term = entry.trim();
		if (term.length === 0 || seen.has(term)) continue;
		seen.add(term);
		suggestions.push(term);
		if (suggestions.length >= MAX_SUGGESTIONS) break;
	}
	return suggestions;
}

/** The search URL a chosen suggestion opens. */
export function searchUrlFor(term: string): string {
	return `https://www.google.com/search?q=${encodeURIComponent(term.trim())}`;
}
