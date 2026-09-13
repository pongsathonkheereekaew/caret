import { describe, expect, it } from "bun:test";
import {
	beginWorktreeReceipt,
	cancelWorktreeReceipt,
	failedWorktreeReceipt,
	idleWorktreeReceipt,
	readyWorktreeReceipt,
	WORKTREE_CANCEL_BEFORE_COPY,
	WORKTREE_CANCEL_IN_FLIGHT_COPY,
	WORKTREE_CREATING_COPY,
	WORKTREE_READY_COPY,
	worktreeFailedCopy,
	worktreeReceiptCopy,
} from "../src/worktree-receipt.ts";

describe("worktree receipt lifecycle", () => {
	it("starts idle and begins as creating", () => {
		expect(idleWorktreeReceipt()).toEqual({ status: "idle" });
		expect(beginWorktreeReceipt()).toEqual({ status: "creating" });
		expect(worktreeReceiptCopy(beginWorktreeReceipt())).toBe(WORKTREE_CREATING_COPY);
	});

	it("cancel before submit does not claim a directory", () => {
		const fromIdle = cancelWorktreeReceipt(idleWorktreeReceipt());
		const fromUnset = cancelWorktreeReceipt();
		expect(fromIdle).toEqual({ status: "cancelled", reason: WORKTREE_CANCEL_BEFORE_COPY });
		expect(fromUnset).toEqual({ status: "cancelled", reason: WORKTREE_CANCEL_BEFORE_COPY });
		expect(fromIdle.path).toBeUndefined();
		expect(worktreeReceiptCopy(fromIdle)).toBe("Cancelled. No worktree was created.");
	});

	it("cancel while creating keeps path/sessionId and does not delete", () => {
		const inFlight = {
			status: "creating" as const,
			path: "/tmp/caret-worktree-a",
			sessionId: "session-1",
		};
		const cancelled = cancelWorktreeReceipt(inFlight);
		expect(cancelled).toEqual({
			status: "cancelled",
			reason: WORKTREE_CANCEL_IN_FLIGHT_COPY,
			path: "/tmp/caret-worktree-a",
			sessionId: "session-1",
		});
		expect(worktreeReceiptCopy(cancelled)).toBe(WORKTREE_CANCEL_IN_FLIGHT_COPY);
		expect(WORKTREE_CANCEL_IN_FLIGHT_COPY).toContain("will not delete");
	});

	it("does not wipe a ready or failed receipt on cancel", () => {
		const ready = readyWorktreeReceipt({ path: "/tmp/wt", sessionId: "s-ready" });
		const failed = failedWorktreeReceipt("disk full");
		expect(cancelWorktreeReceipt(ready)).toEqual(ready);
		expect(cancelWorktreeReceipt(failed)).toEqual(failed);
		expect(ready.status).toBe("ready");
		expect(failed.status).toBe("failed");
	});

	it("records success and failure receipts with copy", () => {
		const ready = readyWorktreeReceipt({ path: "/tmp/wt", sessionId: "s-1" });
		expect(ready).toEqual({ status: "ready", path: "/tmp/wt", sessionId: "s-1" });
		expect(worktreeReceiptCopy(ready)).toBe(WORKTREE_READY_COPY);
		expect(worktreeReceiptCopy(failedWorktreeReceipt("path owned by another checkout"))).toBe(
			worktreeFailedCopy("path owned by another checkout"),
		);
		expect(worktreeFailedCopy("path owned by another checkout")).toBe(
			"Worktree failed. path owned by another checkout",
		);
	});
});
