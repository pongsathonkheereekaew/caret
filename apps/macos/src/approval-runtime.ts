export type ApprovalStatus =
	| "pending"
	| "submitting"
	| "approved"
	| "denied"
	| "cancelled"
	| "stale"
	| "responded_elsewhere"
	| "timeout";

export interface ApprovalRequest {
	readonly token: string;
	readonly requestId?: string;
	readonly sessionId: string;
	readonly incarnation: string;
	readonly schemaRevision?: string;
	readonly method: string;
	readonly status?: ApprovalStatus;
}

export type AnswerRejectReason = "stale_incarnation" | "wrong_session" | "already_answered" | "not_pending";

export type CanAnswerResult = { readonly ok: true } | { readonly ok: false; readonly reason: AnswerRejectReason };

export interface ApprovalBinding {
	readonly sessionId: string;
	readonly incarnation: string;
}

const TERMINAL: ReadonlySet<ApprovalStatus> = new Set([
	"approved",
	"denied",
	"cancelled",
	"stale",
	"responded_elsewhere",
	"timeout",
	"submitting",
]);

const NO_RESUBMIT: ReadonlySet<ApprovalStatus> = new Set(["timeout", "stale", "responded_elsewhere"]);

export function canAnswer(
	request: ApprovalRequest,
	current: ApprovalBinding,
	alreadyAnsweredTokens: Set<string>,
): CanAnswerResult {
	if (request.sessionId !== current.sessionId) {
		return { ok: false, reason: "wrong_session" };
	}
	if (request.incarnation !== current.incarnation) {
		return { ok: false, reason: "stale_incarnation" };
	}
	if (alreadyAnsweredTokens.has(request.token)) {
		return { ok: false, reason: "already_answered" };
	}
	const status = request.status ?? "pending";
	if (status !== "pending") {
		return { ok: false, reason: "not_pending" };
	}
	return { ok: true };
}

export function beginSubmit(status: ApprovalStatus): ApprovalStatus {
	if (NO_RESUBMIT.has(status) || status !== "pending") {
		throw new Error(`cannot_resubmit:${status}`);
	}
	return "submitting";
}

export interface ConcurrentApprovals {
	readonly requests: readonly ApprovalRequest[];
	statusOf(token: string): ApprovalStatus;
	answer(token: string, next: Extract<ApprovalStatus, "approved" | "denied" | "cancelled">): ConcurrentApprovals;
}

class ConcurrentApprovalSet implements ConcurrentApprovals {
	readonly requests: readonly ApprovalRequest[];
	private readonly statuses: ReadonlyMap<string, ApprovalStatus>;

	constructor(requests: readonly ApprovalRequest[], statuses?: ReadonlyMap<string, ApprovalStatus>) {
		this.requests = requests;
		this.statuses = statuses ?? new Map(requests.map((request) => [request.token, request.status ?? "pending"]));
	}

	statusOf(token: string): ApprovalStatus {
		const status = this.statuses.get(token);
		if (!status) throw new Error(`unknown_token:${token}`);
		return status;
	}

	answer(token: string, next: Extract<ApprovalStatus, "approved" | "denied" | "cancelled">): ConcurrentApprovals {
		if (!this.statuses.has(token)) throw new Error(`unknown_token:${token}`);
		const nextStatuses = new Map(this.statuses);
		nextStatuses.set(token, next);
		return new ConcurrentApprovalSet(this.requests, nextStatuses);
	}
}

export function twoConcurrentApprovals(requests: readonly ApprovalRequest[]): ConcurrentApprovals {
	return new ConcurrentApprovalSet(requests);
}

export function isTerminalApproval(status: ApprovalStatus): boolean {
	return TERMINAL.has(status) && status !== "submitting";
}
