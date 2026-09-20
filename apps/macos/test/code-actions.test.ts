import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { cediaCodeActions } from "../src/code-actions.ts";

/*
 * The Code Action provider is the lightbulb half of arriving at Cedia from the
 * keyboard. The rule that matters is the refusal: with no task surface the
 * provider must offer nothing, because neither a draft to append to nor a
 * review to open exists yet.
 */

describe("cedia code actions", () => {
	it("offers nothing when there is no real task surface", () => {
		expect(cediaCodeActions({ taskAvailable: false, hasSelection: true })).toEqual([]);
		expect(cediaCodeActions({ taskAvailable: false, hasSelection: false })).toEqual([]);
	});

	it("offers the selection actions plus review when text is highlighted", () => {
		const actions = cediaCodeActions({ taskAvailable: true, hasSelection: true });
		expect(actions.map(action => action.command)).toEqual([
			"cedia.explainSelection",
			"cedia.fixSelection",
			"cedia.inlineEdit",
			"cedia.addSelectionToTask",
			"cedia.reviewInDiff",
		]);
		// Order is stable so the lightbulb does not reshuffle between invocations.
		expect(actions.map(action => action.order)).toEqual([1, 2, 3, 4, 5]);
	});

	it("offers only review when nothing is highlighted", () => {
		const actions = cediaCodeActions({ taskAvailable: true, hasSelection: false });
		expect(actions.map(action => action.command)).toEqual(["cedia.reviewInDiff"]);
	});

	it("only names commands the manifest declares", () => {
		const declared = new Set(
			(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
				contributes: { commands: { command: string }[] };
			}).contributes.commands.map(entry => entry.command),
		);
		for (const action of cediaCodeActions({ taskAvailable: true, hasSelection: true })) {
			expect(declared.has(action.command)).toBe(true);
		}
	});
});
