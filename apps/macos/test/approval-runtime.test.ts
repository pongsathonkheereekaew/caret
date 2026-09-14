import { describe, expect, it } from "bun:test";
import {
	beginSubmit,
	canAnswer,
	twoConcurrentApprovals,
	type ApprovalRequest,
} from "../src/approval-runtime.ts";

const session = { sessionId: "session-1", incarnation: "inc-1" };

function request(partial: Partial<ApprovalRequest> & Pick<ApprovalRequest, "token">): ApprovalRequest {
	return {
		sessionId: session.sessionId,
		incarnation: session.incarnation,
		method: "ask.approval",
		...partial,
	};
}

describe("approval runtime", () => {
	it("keeps two concurrent approvals independently pending; answering one does not resolve the other", () => {
		const first = request({ token: "tok-a", requestId: "req-a", method: "ask.approval" });
		const second = request({ token: "tok-b", requestId: "req-b", method: "ask.confirm" });
		const set = twoConcurrentApprovals([first, second]);
		expect(set.statusOf("tok-a")).toBe("pending");
		expect(set.statusOf("tok-b")).toBe("pending");
		const after = set.answer("tok-a", "approved");
		expect(after.statusOf("tok-a")).toBe("approved");
		expect(after.statusOf("tok-b")).toBe("pending");
		expect(canAnswer(second, session, new Set(["tok-a"]))).toEqual({ ok: true });
	});

	it("rejects an answer when the incarnation is stale", () => {
		const pending = request({ token: "tok-1", incarnation: "inc-old" });
		expect(canAnswer(pending, session, new Set())).toEqual({ ok: false, reason: "stale_incarnation" });
	});

	it("rejects a double response for the same token", () => {
		const pending = request({ token: "tok-1" });
		expect(canAnswer(pending, session, new Set(["tok-1"]))).toEqual({ ok: false, reason: "already_answered" });
	});

	it("does not allow timeout or stale cards to resubmit", () => {
		expect(() => beginSubmit("timeout")).toThrow(/cannot_resubmit:timeout/);
		expect(() => beginSubmit("stale")).toThrow(/cannot_resubmit:stale/);
		expect(() => beginSubmit("responded_elsewhere")).toThrow(/cannot_resubmit:responded_elsewhere/);
		expect(canAnswer(request({ token: "tok-t", status: "timeout" }), session, new Set())).toEqual({
			ok: false,
			reason: "not_pending",
		});
		expect(canAnswer(request({ token: "tok-s", status: "stale" }), session, new Set())).toEqual({
			ok: false,
			reason: "not_pending",
		});
		expect(beginSubmit("pending")).toBe("submitting");
	});

	it("rejects answers for a different session", () => {
		const pending = request({ token: "tok-1", sessionId: "session-other" });
		expect(canAnswer(pending, session, new Set())).toEqual({ ok: false, reason: "wrong_session" });
	});
});
