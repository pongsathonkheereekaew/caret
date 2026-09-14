/** Local in-transcript find (A16 / S04). Does not query OMP or create a task. */

export interface TranscriptFindHit {
	readonly entryIndex: number;
	readonly start: number;
	readonly end: number;
}

export interface TranscriptFindResult {
	readonly query: string;
	readonly count: number;
	readonly hits: readonly TranscriptFindHit[];
}

export function normalizeFindQuery(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

export function transcriptFindHits(texts: readonly string[], query: unknown): TranscriptFindResult {
	const needle = normalizeFindQuery(query);
	if (!needle) return { query: "", count: 0, hits: [] };
	const lower = needle.toLowerCase();
	const hits: TranscriptFindHit[] = [];
	texts.forEach((text, entryIndex) => {
		const haystack = String(text ?? "").toLowerCase();
		let from = 0;
		while (from < haystack.length) {
			const start = haystack.indexOf(lower, from);
			if (start < 0) break;
			hits.push({ entryIndex, start, end: start + needle.length });
			from = start + needle.length;
		}
	});
	return { query: needle, count: hits.length, hits };
}

export function transcriptFindLabel(count: number, activeIndex: number): string {
	if (!Number.isFinite(count) || count <= 0) return "No matches";
	const safe = Math.min(Math.max(0, Math.trunc(activeIndex)), count - 1);
	return `${safe + 1} of ${count}`;
}

export function nextFindIndex(count: number, activeIndex: number, direction: 1 | -1): number {
	if (!Number.isFinite(count) || count <= 0) return 0;
	const current = Number.isFinite(activeIndex) ? Math.trunc(activeIndex) : 0;
	return (current + direction + count) % count;
}
