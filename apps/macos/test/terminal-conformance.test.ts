import { describe, expect, it } from "bun:test";
import { TERMINAL_CONFORMANCE_CASES, runTerminalConformance } from "../src/terminal-conformance.ts";
import { createXtermEngine } from "../../../scripts/lib/terminal-engines.ts";

describe("terminal conformance", () => {
	it("holds every required case against the engine the workbench ships", async () => {
		// xterm.js is what the pinned Code-OSS base renders terminals with, so these
		// expectations are the product's baseline: any future engine swap (the Ghostty
		// VT core, for example) has to pass the same cases before it can replace it.
		const engine = await createXtermEngine();
		const results = await runTerminalConformance(engine);
		const failures = results.filter(result => result.required && !result.pass).map(result => `${result.id}: ${result.detail}`);
		expect(failures).toEqual([]);
	});

	it("keeps the cases Cedia's own surfaces depend on", () => {
		// Shell integration (OSC 633/133), link text (OSC 8), atomic frames (?2026),
		// Thai combining marks and wide-character width are not decorative: the
		// workbench and the mobile transcript both depend on them.
		const ids = TERMINAL_CONFORMANCE_CASES.map(testCase => testCase.id);
		for (const required of [
			"osc633-shell-integration",
			"osc133-prompt-marks",
			"osc8-hyperlink",
			"synchronized-output",
			"thai-combining-marks",
			"cjk-width",
			"cursor-save-restore",
			"alt-screen-round-trip",
		]) {
			expect(ids).toContain(required);
		}
	});
});
