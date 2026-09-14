/** Cursor-class one-shot actions on an editor selection.
 *
 * Cursor puts Explain and Fix on the selection next to the edit action. Caret
 * can serve the same affordance honestly: each action cites the real range and
 * sends one instruction through the normal guarded turn, so OMP stays the only
 * execution owner and nothing is applied behind the user's back. The
 * instruction text and the prompt shape live here, free of a `vscode` import,
 * so the wording and the citation format can be tested directly.
 */

export type SelectionActionId = "explain" | "fix";

export interface SelectionActionSpec {
	readonly id: SelectionActionId;
	/** Command id, declared in the manifest and registered by activate(). */
	readonly command: string;
	readonly title: string;
	/** The instruction the agent receives, in front of the cited selection. */
	readonly instruction: string;
}

export const SELECTION_ACTIONS: readonly SelectionActionSpec[] = [
	{
		id: "explain",
		command: "caret.explainSelection",
		title: "Caret: Explain Selection",
		instruction: "Explain what this selected code does, and call out anything surprising or risky.",
	},
	{
		id: "fix",
		command: "caret.fixSelection",
		title: "Caret: Fix Selection",
		instruction: "Find the defect in this selected code and fix it. If there is no defect, say so instead of changing the code.",
	},
];

export function selectionAction(id: SelectionActionId): SelectionActionSpec {
	const found = SELECTION_ACTIONS.find(action => action.id === id);
	if (!found) throw new Error(`unknown Caret selection action: ${id}`);
	return found;
}

export interface SelectionPromptInput {
	/** The instruction line, from {@link SelectionActionSpec.instruction}. */
	readonly instruction: string;
	/** Real path with line range, e.g. `src/app.ts#L4-L9`. */
	readonly citation: string;
	/** The document's language id, used as the code fence. */
	readonly languageId: string;
	/** The selected text, already clipped to the budget by the caller. */
	readonly body: string;
	/** Present when the caller had to clip the selection. */
	readonly truncated?: { readonly limit: number; readonly original: number };
}

/** The exact turn text for a one-shot selection action. */
export function selectionPrompt(input: SelectionPromptInput): string {
	return [
		`${input.instruction} (${input.citation})`,
		"",
		"```" + input.languageId,
		input.body,
		"```",
		...(input.truncated ? [`(truncated at ${input.truncated.limit} characters of ${input.truncated.original})`] : []),
	].join("\n");
}
