import { describe, expect, it } from "bun:test";
import { MAX_TERMINAL_CITATION_CHARS, TERMINAL_NO_SELECTION_REASON, terminalCitation } from "../src/terminal-context.ts";

/*
 * The terminal citation is the pure half of "send terminal output to the
 * agent". The behavior test proves the command wires it to the real active
 * terminal; these cases pin the format and the refusal rules so a citation
 * never silently grows into the whole scrollback.
 */

describe("terminal citation", () => {
	it("quotes the real selection under a terminal: label", () => {
		const result = terminalCitation({ name: "zsh", selection: "$ bun test\n12 pass\n" });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.citation).toBe("terminal:zsh");
		expect(result.block).toBe("terminal:zsh\n```text\n$ bun test\n12 pass\n```");
		expect(result.lines).toBe(2);
		expect(result.truncated).toBe(false);
		expect(result.originalLength).toBe(19);
	});

	it("refuses an empty or whitespace-only selection instead of sending scrollback", () => {
		expect(terminalCitation({ name: "zsh", selection: "" })).toEqual({ ok: false, reason: TERMINAL_NO_SELECTION_REASON });
		expect(terminalCitation({ name: "zsh", selection: "   \n\t\n" })).toEqual({ ok: false, reason: TERMINAL_NO_SELECTION_REASON });
	});

	it("normalizes CRLF so a Windows terminal reads the same as a Mac one", () => {
		const result = terminalCitation({ name: "pwsh", selection: "a\r\nb\r\n" });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.block).toContain("a\nb");
		expect(result.block).not.toContain("\r");
	});

	it("keeps leading indentation but drops the trailing newline a selection carries", () => {
		const result = terminalCitation({ name: "zsh", selection: "    indented\n\n" });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.block).toBe("terminal:zsh\n```text\n    indented\n```");
	});

	it("truncates at the budget and says so, keeping the real length", () => {
		const result = terminalCitation({ name: "zsh", selection: "x".repeat(MAX_TERMINAL_CITATION_CHARS + 25) });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.truncated).toBe(true);
		expect(result.originalLength).toBe(MAX_TERMINAL_CITATION_CHARS + 25);
		expect(result.block).toContain(`(truncated at ${MAX_TERMINAL_CITATION_CHARS} characters of ${MAX_TERMINAL_CITATION_CHARS + 25})`);
	});

	it("falls back to a plain terminal label rather than emitting an empty one", () => {
		const result = terminalCitation({ name: "   ", selection: "hello" });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.citation).toBe("terminal:terminal");
	});
});
