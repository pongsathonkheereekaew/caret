import { describe, expect, it } from "bun:test";
import { nextFindIndex, transcriptFindHits, transcriptFindLabel } from "../src/transcript-find.ts";

describe("transcriptFindHits", () => {
	it("finds case-insensitive matches without inventing a task", () => {
		const result = transcriptFindHits(["Hello Caret", "caret draft"], "CARET");
		expect(result.count).toBe(2);
		expect(result.hits).toEqual([
			{ entryIndex: 0, start: 6, end: 11 },
			{ entryIndex: 1, start: 0, end: 5 },
		]);
		expect(transcriptFindLabel(result.count, 0)).toBe("1 of 2");
		expect(transcriptFindLabel(0, 0)).toBe("No matches");
	});

	it("stays empty for blank queries", () => {
		expect(transcriptFindHits(["hello"], "   ")).toEqual({ query: "", count: 0, hits: [] });
		expect(nextFindIndex(3, 2, 1)).toBe(0);
		expect(nextFindIndex(3, 0, -1)).toBe(2);
	});
});
