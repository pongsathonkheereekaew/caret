import { describe, expect, it } from "bun:test";
import { agentEditLabel, agentEditLenses, agentEditReviewDecision, AGENT_EDIT_REVIEW_STALE_REASON, appliedRanges, applyEdits, changedLineSpan, decorationHover, decorationRange, markRangesFor, mergeRanges, STALE_AGENT_EDIT_REASON, revertDecision, touchedLineCount } from "../src/agent-edit-marks.ts";

/*
 * The marks are what makes Cedia's edit legible inside the editor, and the
 * revert rule is what keeps "take it back" from eating the user's own work.
 * Both are pure, so they are pinned here; the behavior test proves the
 * decoration and the commands use them.
 */

const pos = (line: number, character: number) => ({ line, character });

describe("applied ranges", () => {
	it("ends a single-line replacement where the inserted text ends", () => {
		expect(appliedRanges([{ range: { start: pos(2, 4), end: pos(2, 9) }, text: "hello" }]))
			.toEqual([{ start: pos(2, 4), end: pos(2, 9) }]);
	});

	it("counts the lines a multi-line insertion adds", () => {
		expect(appliedRanges([{ range: { start: pos(1, 0), end: pos(1, 0) }, text: "a\nbb\nccc" }]))
			.toEqual([{ start: pos(1, 0), end: pos(3, 3) }]);
	});

	it("keeps a pure deletion as a zero-width mark at the deleted position", () => {
		expect(appliedRanges([{ range: { start: pos(5, 2), end: pos(5, 8) }, text: "" }]))
			.toEqual([{ start: pos(5, 2), end: pos(5, 2) }]);
	});

	it("returns ranges in document order regardless of input order", () => {
		const ranges = appliedRanges([
			{ range: { start: pos(9, 0), end: pos(9, 1) }, text: "x" },
			{ range: { start: pos(2, 0), end: pos(2, 1) }, text: "y" },
		]);
		expect(ranges.map(range => range.start.line)).toEqual([2, 9]);
	});
});

describe("merging and counting", () => {
	it("merges touching ranges so one decoration is not stacked twice", () => {
		expect(mergeRanges([{ start: pos(1, 0), end: pos(1, 4) }, { start: pos(1, 4), end: pos(1, 9) }]))
			.toEqual([{ start: pos(1, 0), end: pos(1, 9) }]);
	});

	it("swallows a range contained in another", () => {
		expect(mergeRanges([{ start: pos(1, 0), end: pos(3, 0) }, { start: pos(2, 0), end: pos(2, 4) }]))
			.toEqual([{ start: pos(1, 0), end: pos(3, 0) }]);
	});

	it("keeps disjoint ranges apart", () => {
		expect(mergeRanges([{ start: pos(1, 0), end: pos(1, 4) }, { start: pos(4, 0), end: pos(4, 2) }]).length).toBe(2);
	});

	it("counts distinct lines, not characters", () => {
		expect(touchedLineCount([{ start: pos(0, 0), end: pos(0, 40) }, { start: pos(0, 10), end: pos(1, 2) }])).toBe(2);
	});
});

describe("the label", () => {
	it("names the path, the regions, and the lines", () => {
		expect(agentEditLabel("src/app.ts", [{ start: pos(0, 0), end: pos(2, 0) }])).toBe("src/app.ts: 1 region, 3 lines changed by Cedia");
		expect(agentEditLabel("src/app.ts", [{ start: pos(0, 0), end: pos(0, 1) }])).toBe("src/app.ts: 1 region, 1 line changed by Cedia");
	});
});

describe("the revert rule", () => {
	const pending = { path: "src/app.ts", ranges: [{ start: pos(0, 0), end: pos(0, 1) }], version: 42, textBefore: "before\n" };

	it("restores the exact pre-edit text while the buffer still holds Cedia's version", () => {
		expect(revertDecision(pending, 42)).toEqual({ ok: true, text: "before\n" });
	});

	it("refuses once anything else has touched the buffer, and points at Undo", () => {
		expect(revertDecision(pending, 43)).toEqual({ ok: false, reason: STALE_AGENT_EDIT_REASON });
	});
});

describe("the painted range and hover", () => {
	/** A two-line document, the shape the mark code reads off a real editor. */
	const document = {
		lineCount: 2,
		lineAt: (line: number) => ({ range: { end: { line, character: [12, 7][line] ?? 0 } } }),
	};

	it("paints a replacement exactly as it landed", () => {
		expect(decorationRange(document, { start: pos(0, 4), end: pos(0, 9) })).toEqual({ start: pos(0, 4), end: pos(0, 9) });
	});

	it("widens a pure deletion to the whole line so it is visible", () => {
		expect(decorationRange(document, { start: pos(0, 5), end: pos(0, 5) })).toEqual({ start: pos(0, 5), end: pos(0, 12) });
	});

	it("clamps a deletion reported past the last line instead of throwing", () => {
		expect(decorationRange(document, { start: pos(9, 0), end: pos(9, 0) })).toEqual({ start: pos(9, 0), end: pos(1, 7) });
	});

	it("names the file and both actions in the hover", () => {
		expect(decorationHover("src/app.ts")).toContain("src/app.ts");
		expect(decorationHover("src/app.ts")).toContain("Cedia: Take Back the Cedia Edit");
	});
});

describe("agent edit review decision", () => {
	const pending = { path: "src/greet.ts", ranges: [{ start: pos(1, 9), end: pos(1, 14) }], version: 2, textBefore: "before\n" };

	it("allows a review diff while the buffer still holds Cedia's version", () => {
		expect(agentEditReviewDecision(pending, 2)).toEqual({ ok: true });
	});

	it("refuses once the buffer moved on so the diff cannot misattribute the user's change", () => {
		expect(agentEditReviewDecision(pending, 3)).toEqual({ ok: false, reason: AGENT_EDIT_REVIEW_STALE_REASON });
	});
});

describe("agent edit lens specs", () => {
	const pending = { path: "src/greet.ts", ranges: [{ start: pos(4, 2), end: pos(7, 1) }], version: 2, textBefore: "before\n" };

	it("places both decisions on the first region Cedia changed", () => {
		expect(agentEditLenses(pending)).toEqual([
			{ line: 4, title: "Keep the Cedia Edit", command: "cedia.keepAgentEdit" },
			{ line: 4, title: "Take Back the Cedia Edit", command: "cedia.revertAgentEdit" },
		]);
	});
});

describe("mark region derived from the produced text", () => {
	const edit = (start: readonly [number, number], end: readonly [number, number], text: string) => ({
		range: { start: { line: start[0], character: start[1] }, end: { line: end[0], character: end[1] } },
		text,
	});

	it("reproduces the produced text from the pre-edit text and the edits", () => {
		expect(applyEdits("one\ntwo\n", [edit([1, 0], [1, 3], "TWO")])).toBe("one\nTWO\n");
	});

	it("applies several edits back to front so earlier ones do not shift later ranges", () => {
		expect(applyEdits("a\nb\nc\n", [edit([0, 0], [0, 1], "A"), edit([2, 0], [2, 1], "C")])).toBe("A\nb\nC\n");
	});

	it("narrows a whole-file edit to the lines that actually changed", () => {
		// OMP's guarded native apply reports one whole-file edit even for a
		// two-character change; the mark must still be the changed line only.
		expect(markRangesFor("keep\nold\nkeep\n", [edit([0, 0], [3, 0], "keep\nnew\nkeep\n")]))
			.toEqual([{ start: pos(1, 0), end: pos(1, 3) }]);
	});

	it("keeps an inserted line inside the span", () => {
		expect(changedLineSpan("a\nc\n", "a\nb\nc\n")).toEqual({ start: pos(1, 0), end: pos(1, 1) });
	});

	it("has no span when the texts are equal", () => {
		expect(changedLineSpan("same\n", "same\n")).toBeUndefined();
	});

	it("falls back to the edit geometry when the produced text is unchanged", () => {
		expect(markRangesFor("same\n", [edit([0, 0], [0, 0], "")])).toEqual([{ start: pos(0, 0), end: pos(0, 0) }]);
	});
});
