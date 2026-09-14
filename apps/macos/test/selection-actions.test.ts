import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { SELECTION_ACTIONS, selectionAction, selectionPrompt } from "../src/selection-actions.ts";

/*
 * Explain and Fix are one-shot instructions sent to the agent, so the wording
 * and the citation format are the whole feature. The behavior test proves the
 * extension dispatches them; these cases pin the text and the command ids.
 */

describe("selection actions", () => {
	it("ships Explain and Fix with stable command ids", () => {
		expect(SELECTION_ACTIONS.map(action => action.command)).toEqual(["caret.explainSelection", "caret.fixSelection"]);
		expect(selectionAction("explain").title).toBe("Caret: Explain Selection");
		expect(selectionAction("fix").title).toBe("Caret: Fix Selection");
	});

	it("tells the agent not to invent a change when Fix finds no defect", () => {
		// A Fix action that rewrites working code is worse than one that declines.
		expect(selectionAction("fix").instruction).toContain("say so instead of changing the code");
	});

	it("only names commands the manifest declares", () => {
		const declared = new Set(
			(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
				contributes: { commands: { command: string }[] };
			}).contributes.commands.map(entry => entry.command),
		);
		for (const action of SELECTION_ACTIONS) expect(declared.has(action.command)).toBe(true);
	});

	it("cites the instruction, the real range, and the fenced selection", () => {
		const prompt = selectionPrompt({
			instruction: selectionAction("explain").instruction,
			citation: "src/app.ts#L4-L9",
			languageId: "typescript",
			body: "const x = 1;",
		});
		expect(prompt).toBe([
			`${selectionAction("explain").instruction} (src/app.ts#L4-L9)`,
			"",
			"```typescript",
			"const x = 1;",
			"```",
		].join("\n"));
	});

	it("states the clip when the caller had to truncate the selection", () => {
		const prompt = selectionPrompt({
			instruction: selectionAction("fix").instruction,
			citation: "src/app.ts#L1",
			languageId: "",
			body: "abcd",
			truncated: { limit: 4, original: 40 },
		});
		expect(prompt).toContain("(truncated at 4 characters of 40)");
	});
});
