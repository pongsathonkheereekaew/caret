/** Native terminal -> task citation.
 *
 * A Cursor-class IDE lets you send the terminal output in front of you into
 * the agent without leaving the terminal. The honest part of that is small
 * and pure: which terminal is focused, whether it really has a selection, and
 * how the selection is quoted into the draft. Keeping it out of the
 * `vscode` import lets the format and the refusal rules be tested directly.
 */

export const TERMINAL_NOT_FOCUSED_REASON =
	"Focus a terminal first. Cedia cites the selection from the active terminal, not a guessed one.";
export const TERMINAL_NO_SELECTION_REASON =
	"Select terminal output first. Cedia cites the real selection; it will not send the whole scrollback.";

/** Upper bound on quoted terminal output, matching the editor-selection budget
 * so one runaway command cannot turn a citation into the entire buffer. */
export const MAX_TERMINAL_CITATION_CHARS = 4000;

export interface TerminalCitationInput {
	/** Terminal name Code-OSS reports, e.g. "zsh" or "tasks". */
	readonly name: string;
	/** The terminal's real selected text, or "" when nothing is selected. */
	readonly selection: string;
	/** Upper bound on how many characters of output are quoted. */
	readonly maxChars?: number;
}

export type TerminalCitation =
	| {
		readonly ok: true;
		/** Short label for the status message and the draft header. */
		readonly citation: string;
		/** The fenced block appended to the composer draft. */
		readonly block: string;
		/** Lines of output actually quoted. */
		readonly lines: number;
		readonly truncated: boolean;
		readonly originalLength: number;
	}
	| { readonly ok: false; readonly reason: string };

/** Turn real terminal selection into a draft block, or refuse with a reason.
 *
 * CRLF is normalized to LF because a terminal on any platform may hand back
 * either, and a citation should look the same everywhere. A selection of only
 * whitespace is treated as empty: quoting blank scrollback is never what the
 * user meant, and silently sending the full buffer instead would be worse.
 */
export function terminalCitation(input: TerminalCitationInput): TerminalCitation {
	const selection = input.selection.replace(/\r\n/g, "\n");
	if (selection.trim().length === 0) return { ok: false, reason: TERMINAL_NO_SELECTION_REASON };
	const maxChars = input.maxChars ?? MAX_TERMINAL_CITATION_CHARS;
	const name = input.name.trim() || "terminal";
	const truncated = selection.length > maxChars;
	// Trim only the trailing newlines a selection usually carries; leading
	// indentation is part of the output the user selected.
	const body = (truncated ? selection.slice(0, maxChars) : selection).replace(/\n+$/, "");
	const citation = `terminal:${name}`;
	const lines = body.split("\n").length;
	const block = [
		citation,
		"```text",
		body,
		"```",
		...(truncated ? [`(truncated at ${maxChars} characters of ${selection.length})`] : []),
	].join("\n");
	return { ok: true, citation, block, lines, truncated, originalLength: selection.length };
}
