import { describe, expect, it } from "bun:test";
import { HISTORY_CHANGED_NOTE, OLDER_PAGES_NOTE, olderPagesLoadNote, transcriptHistoryBanner } from "../src/history-page.ts";

describe("S04 older-history honesty", () => {
	it("does not advertise older pages when the host cursor is forward-only", () => {
		expect(olderPagesLoadNote(0)).toBe(OLDER_PAGES_NOTE);
		expect(olderPagesLoadNote(-1)).toBe(OLDER_PAGES_NOTE);
		expect(transcriptHistoryBanner({ olderPagesAdvertised: false })).toBe(OLDER_PAGES_NOTE);
	});

	it("uses History changed when an older request is possible or the scroll anchor is gone", () => {
		expect(olderPagesLoadNote(12)).toBe(HISTORY_CHANGED_NOTE);
		expect(transcriptHistoryBanner({ anchorMissing: true })).toBe(HISTORY_CHANGED_NOTE);
		expect(transcriptHistoryBanner({ historyNote: "History changed", olderPagesAdvertised: false })).toBe("History changed");
	});
});
