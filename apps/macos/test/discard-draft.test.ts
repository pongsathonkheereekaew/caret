import { describe, expect, it } from "bun:test";
import { applyDiscardDraft, DISCARD_DRAFT_CONFIRM, DISCARD_DRAFT_LABEL, discardDraftPlan } from "../src/discard-draft.ts";
import { draftViewKey } from "../src/workbench-mode.ts";

describe("discardDraftPlan", () => {
	it("does not confirm or claim a delete when the draft is empty", () => {
		const plan = discardDraftPlan({ draft: "   ", projectId: "proj-1", sessionId: "task-1" });
		expect(plan).toEqual({
			key: draftViewKey("proj-1", "task-1"),
			hasText: false,
			needsConfirm: false,
			deletesSession: false,
			stopsOmp: false,
		});
		expect(DISCARD_DRAFT_LABEL).toBe("Discard draft");
		expect(DISCARD_DRAFT_CONFIRM).toBe("Discard this draft? The task session stays. Cedia will not delete the session or stop OMP.");
	});

	it("confirms text discard without deleting the session or stopping OMP", () => {
		const plan = discardDraftPlan({ draft: "keep working", projectId: "proj-1", sessionId: "task-1" });
		expect(plan.hasText).toBe(true);
		expect(plan.needsConfirm).toBe(true);
		expect(plan.deletesSession).toBe(false);
		expect(plan.stopsOmp).toBe(false);
		expect(plan.key).toBe(draftViewKey("proj-1", "task-1"));
	});
});

describe("applyDiscardDraft", () => {
	it("clears the target key and leaves other drafts in place", () => {
		const drafts = {
			[draftViewKey("proj-1", "task-a")]: "keep me",
			[draftViewKey("proj-1", "task-b")]: "throw away",
		};
		const key = draftViewKey("proj-1", "task-b");
		const next = applyDiscardDraft(drafts, key);
		expect(next[key]).toBe("");
		expect(next[draftViewKey("proj-1", "task-a")]).toBe("keep me");
		expect(Object.keys(next)).toEqual(Object.keys(drafts));
		expect(drafts[key]).toBe("throw away");
	});
});
