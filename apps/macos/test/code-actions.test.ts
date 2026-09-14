import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { caretCodeActions } from "../src/code-actions.ts";

/*
 * The Code Action provider is the lightbulb half of arriving at Caret from the
 * keyboard. The rule that matters is the refusal: with no task surface the
 * provider must offer nothing, because neither a draft to append to nor a
 * review to open exists yet.
 */

describe("caret code actions", () => {
	it("offers nothing when there is no real task surface", () => {
		expect(caretCodeActions({ taskAvailable: false, hasSelection: true })).toEqual([]);
		expect(caretCodeActions({ taskAvailable: false, hasSelection: false })).toEqual([]);
	});

	it("offers the selection actions plus review when text is highlighted", () => {
		const actions = caretCodeActions({ taskAvailable: true, hasSelection: true });
		expect(actions.map(action => action.command)).toEqual([
			"caret.explainSelection",
			"caret.fixSelection",
			"caret.inlineEdit",
			"caret.addSelectionToTask",
			"caret.reviewInDiff",
		]);
		// Order is stable so the lightbulb does not reshuffle between invocations.
		expect(actions.map(action => action.order)).toEqual([1, 2, 3, 4, 5]);
	});

	it("offers only review when nothing is highlighted", () => {
		const actions = caretCodeActions({ taskAvailable: true, hasSelection: false });
		expect(actions.map(action => action.command)).toEqual(["caret.reviewInDiff"]);
	});

	it("only names commands the manifest declares", () => {
		const declared = new Set(
			(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
				contributes: { commands: { command: string }[] };
			}).contributes.commands.map(entry => entry.command),
		);
		for (const action of caretCodeActions({ taskAvailable: true, hasSelection: true })) {
			expect(declared.has(action.command)).toBe(true);
		}
	});
});
