/** D18: New worktree receipts. Cancel before submit creates nothing. Cancel in flight reconciles; Cedia does not delete a folder that may have user files. */

export type WorktreeReceiptStatus = "idle" | "creating" | "cancelled" | "ready" | "failed";

export interface WorktreeReceipt {
	readonly status: WorktreeReceiptStatus;
	readonly path?: string;
	readonly sessionId?: string;
	readonly reason?: string;
}

export const WORKTREE_CREATING_COPY = "Creating worktree…";
export const WORKTREE_CANCEL_BEFORE_COPY = "Cancelled. No worktree was created.";
export const WORKTREE_CANCEL_IN_FLIGHT_COPY =
	"Cancel asked the host to stop. Cedia will not delete a folder that may already have user files.";
export const WORKTREE_READY_COPY = "Worktree ready.";

export function worktreeFailedCopy(reason: string): string {
	return `Worktree failed. ${reason}`;
}

export function idleWorktreeReceipt(): WorktreeReceipt {
	return { status: "idle" };
}

export function beginWorktreeReceipt(): WorktreeReceipt {
	return { status: "creating" };
}

export function cancelWorktreeReceipt(current?: WorktreeReceipt): WorktreeReceipt {
	if (!current || current.status === "idle") {
		return { status: "cancelled", reason: WORKTREE_CANCEL_BEFORE_COPY };
	}
	if (current.status === "creating") {
		return {
			status: "cancelled",
			reason: WORKTREE_CANCEL_IN_FLIGHT_COPY,
			...(current.path ? { path: current.path } : {}),
			...(current.sessionId ? { sessionId: current.sessionId } : {}),
		};
	}
	return current;
}

export function readyWorktreeReceipt(input: {
	readonly path?: string;
	readonly sessionId?: string;
}): WorktreeReceipt {
	return {
		status: "ready",
		...(input.path ? { path: input.path } : {}),
		...(input.sessionId ? { sessionId: input.sessionId } : {}),
	};
}

export function failedWorktreeReceipt(reason: string): WorktreeReceipt {
	return { status: "failed", reason };
}

export function worktreeReceiptCopy(receipt: WorktreeReceipt): string {
	if (receipt.status === "creating") return WORKTREE_CREATING_COPY;
	if (receipt.status === "ready") return WORKTREE_READY_COPY;
	if (receipt.status === "failed") return worktreeFailedCopy(receipt.reason ?? "");
	if (receipt.status === "cancelled") {
		return receipt.reason ?? WORKTREE_CANCEL_BEFORE_COPY;
	}
	return "";
}
