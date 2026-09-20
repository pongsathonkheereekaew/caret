/** Which Cedia actions the native Code-OSS Code Action (lightbulb / Quick Fix)
 * surface should offer - and, just as importantly, when it should offer none.
 *
 * A provider that always answers puts a lightbulb on every file and offers
 * actions that cannot run. With no task surface there is no draft to append to
 * and no review to open, so the honest answer is an empty list. Pure so the
 * provider's rule can be tested without a `vscode` import.
 */

export interface CediaCodeActionInput {
	/** A real task surface exists: an open project, a connected client, or a session. */
	readonly taskAvailable: boolean;
	/** The user highlighted real text in the editor. */
	readonly hasSelection: boolean;
}

export interface CediaCodeActionSpec {
	readonly command: string;
	readonly title: string;
	/** Lower sorts first inside the Cedia group. */
	readonly order: number;
}

export function cediaCodeActions(input: CediaCodeActionInput): readonly CediaCodeActionSpec[] {
	if (!input.taskAvailable) return [];
	const actions: CediaCodeActionSpec[] = [];
	if (input.hasSelection) {
		// Selection actions first: they read what the user highlighted, which is
		// the reason the lightbulb is on the selection at all. Explain and Fix
		// come first, the order a Cursor user reaches for them in.
		actions.push({ command: "cedia.explainSelection", title: "Cedia: Explain Selection", order: 1 });
		actions.push({ command: "cedia.fixSelection", title: "Cedia: Fix Selection", order: 2 });
		actions.push({ command: "cedia.inlineEdit", title: "Cedia: Edit Selection", order: 3 });
		actions.push({ command: "cedia.addSelectionToTask", title: "Cedia: Add Selection to Task", order: 4 });
	}
	actions.push({ command: "cedia.reviewInDiff", title: "Cedia: Review File in Diff", order: 5 });
	return actions;
}
