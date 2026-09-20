import { describe, expect, it } from "bun:test";
import { freezeEnvelope, shouldDispatch, type DispatchSource } from "../src/dispatch-guard.ts";

function source(partial: Partial<DispatchSource> = {}): DispatchSource {
	return {
		draftRevision: 1,
		attachmentRefs: [],
		targetSession: "session-1",
		intent: "send_prompt",
		draft: "hello",
		...partial,
	};
}

describe("dispatch guard", () => {
	it("freezes a stable envelope for the same revision, attachments, session, and intent", () => {
		const first = freezeEnvelope(source({ attachmentRefs: ["att-1"] }));
		const second = freezeEnvelope(source({ attachmentRefs: ["att-1"] }));
		expect(first.commandId).toBe(second.commandId);
		expect(first.draftRevision).toBe(1);
		expect(first.targetSession).toBe("session-1");
		expect(first.intent).toBe("send_prompt");
		expect(first.attachmentRefs).toEqual(["att-1"]);
	});

	it("treats the same commandId/envelope as a duplicate click while in flight", () => {
		const next = source();
		const lastFrozen = freezeEnvelope(next);
		const decision = shouldDispatch({
			lastFrozen,
			next,
			inFlightCommandId: lastFrozen.commandId,
		});
		expect(decision).toEqual({ dispatch: false, reason: "duplicate_click" });
	});

	it("lets new typing after send dispatch a new revision without clearing the in-flight command", () => {
		const sent = source({ draftRevision: 1, draft: "hello" });
		const lastFrozen = freezeEnvelope(sent);
		const typed = source({ draftRevision: 2, draft: "hello world" });
		const decision = shouldDispatch({
			lastFrozen,
			next: typed,
			inFlightCommandId: lastFrozen.commandId,
		});
		expect(decision.dispatch).toBe(true);
		if (decision.dispatch) {
			expect(decision.envelope.draftRevision).toBe(2);
			expect(decision.envelope.commandId).not.toBe(lastFrozen.commandId);
		}
	});

	it("rejects an empty draft with no attachments", () => {
		expect(shouldDispatch({ lastFrozen: null, next: source({ draft: "   ", attachmentRefs: [] }) })).toEqual({
			dispatch: false,
			reason: "empty",
		});
	});

	it("rejects sending an older revision after a newer freeze", () => {
		const lastFrozen = freezeEnvelope(source({ draftRevision: 3, draft: "newer" }));
		const decision = shouldDispatch({
			lastFrozen,
			next: source({ draftRevision: 2, draft: "older" }),
			inFlightCommandId: null,
		});
		expect(decision).toEqual({ dispatch: false, reason: "revision_mismatch" });
	});

	it("allows dispatch after the in-flight command is acknowledged", () => {
		const next = source({ draftRevision: 1 });
		const lastFrozen = freezeEnvelope(next);
		const decision = shouldDispatch({ lastFrozen, next, inFlightCommandId: null });
		expect(decision.dispatch).toBe(true);
		if (decision.dispatch) {
			expect(decision.envelope.commandId).toBe(lastFrozen.commandId);
		}
	});
});
