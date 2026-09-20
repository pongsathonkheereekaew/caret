/** D04 / D16: Discard draft clears composer text only. It is not Delete session and does not stop OMP. */

import { draftViewKey } from "./workbench-mode.ts";

export const DISCARD_DRAFT_LABEL = "Discard draft";
export const DISCARD_DRAFT_CONFIRM = "Discard this draft? The task session stays. Cedia will not delete the session or stop OMP.";

export function discardDraftPlan(input: {
	readonly draft: string;
	readonly projectId?: string | null;
	readonly sessionId?: string | null;
}): {
	readonly key: string;
	readonly hasText: boolean;
	readonly needsConfirm: boolean;
	readonly deletesSession: false;
	readonly stopsOmp: false;
} {
	const hasText = input.draft.trim().length > 0;
	return {
		key: draftViewKey(input.projectId, input.sessionId),
		hasText,
		needsConfirm: hasText,
		deletesSession: false,
		stopsOmp: false,
	};
}

export function applyDiscardDraft(
	drafts: Readonly<Record<string, string>>,
	key: string,
): Record<string, string> {
	return { ...drafts, [key]: "" };
}
