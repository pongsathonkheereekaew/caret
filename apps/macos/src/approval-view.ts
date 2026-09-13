import type { ApprovalStatus } from "./approval-runtime.ts";

export type { ApprovalStatus };

export interface ApprovalViewInput {
	readonly token: string;
	readonly requestId?: string;
	readonly sessionId?: string;
	readonly incarnation?: string;
	readonly method: string;
	readonly cwd?: string;
	readonly tool?: string;
	readonly target?: string;
	readonly timeout?: number;
	readonly receivedAt?: number;
	readonly status?: ApprovalStatus;
}

export interface ApprovalBindingView {
	readonly sessionId?: string;
	readonly incarnation?: string;
	readonly connection?: string;
}

export function approvalDisplayStatus(request: ApprovalViewInput, current: ApprovalBindingView, now = Date.now()): ApprovalStatus {
	if (request.status && request.status !== "pending") return request.status;
	if (request.sessionId && current.sessionId && request.sessionId !== current.sessionId) return "stale";
	if (request.incarnation && current.incarnation && request.incarnation !== current.incarnation) return "stale";
	if (typeof request.timeout === "number" && request.timeout > 0 && typeof request.receivedAt === "number" && now >= request.receivedAt + request.timeout) {
		return "timeout";
	}
	return "pending";
}

export function approvalCanSubmit(status: ApprovalStatus, connection?: string): boolean {
	if (status !== "pending") return false;
	return connection === "connected" || connection === "running";
}

export type ApprovalFieldKind =
	| "confirm"
	| "select"
	| "multi_select"
	| "password"
	| "input"
	| "editor"
	| "schemaform"
	| "unsupported";

export function approvalFieldKind(method: string, hints?: { readonly secret?: boolean; readonly multiple?: boolean }): ApprovalFieldKind {
	if (method === "confirm") return "confirm";
	if (method === "multi_select" || (method === "select" && hints?.multiple === true)) return "multi_select";
	if (method === "select") return "select";
	if (method === "password" || (method === "input" && hints?.secret === true)) return "password";
	if (method === "input") return "input";
	if (method === "editor") return "editor";
	if (method === "schemaform") return "schemaform";
	return "unsupported";
}

export function approvalDefaultFocus(dangerous?: boolean): "cancel" | "submit" {
	return dangerous === true ? "cancel" : "submit";
}

export function approvalNeedsExpand(value: string | undefined, limit = 80): boolean {
	return typeof value === "string" && value.length > limit;
}

export function approvalIdentityLines(request: ApprovalViewInput): readonly string[] {
	const lines = [
		`Request ${request.requestId || request.token}`,
		request.method ? `Method ${request.method}` : "",
		request.tool ? `Tool ${request.tool}` : "",
		request.target ? `Target ${request.target}` : "",
		request.cwd ? `cwd ${request.cwd}` : "",
		request.sessionId ? `Session ${request.sessionId}` : "",
		request.incarnation ? `Incarnation ${request.incarnation}` : "",
	];
	return lines.filter((line) => line.length > 0);
}

export const APPROVAL_OFFLINE_LINE = "Waiting for host";
export const APPROVAL_REQUIRED_REASON = "This field is required.";
export const APPROVAL_MULTISELECT_REASON = "Select at least one option.";

export interface ApprovalOptionRow {
	readonly value: string;
	readonly label: string;
	readonly description?: string;
}

export function approvalOptionRows(
	options: readonly string[] | undefined,
	details?: readonly { readonly value?: string; readonly label?: string; readonly description?: string }[],
): readonly ApprovalOptionRow[] {
	if (!options) return [];
	const rows: ApprovalOptionRow[] = [];
	for (let index = 0; index < options.length; index++) {
		const detail = details?.[index];
		const value = typeof detail?.value === "string" && detail.value.length > 0 ? detail.value : options[index]!;
		if (value.length === 0) continue;
		rows.push({
			value,
			label: detail?.label || value,
			...(typeof detail?.description === "string" ? { description: detail.description } : {}),
		});
	}
	return rows;
}

export function approvalTimeoutRemaining(timeout?: number, receivedAt?: number, now?: number): number | undefined {
	if (typeof timeout !== "number" || timeout <= 0 || typeof receivedAt !== "number") return undefined;
	return Math.max(0, receivedAt + timeout - (now ?? Date.now()));
}

export function approvalTimeoutLine(remainingMs: number | undefined): string {
	if (remainingMs === undefined) return "";
	if (remainingMs <= 0) return "Expired";
	return `Expires in ${Math.ceil(remainingMs / 1000)}s`;
}

export function approvalOfflineLine(connection?: string): string | undefined {
	if (connection === "connected" || connection === "running" || connection === "online") return undefined;
	return APPROVAL_OFFLINE_LINE;
}

export function approvalSubmitBlockedReason(input: {
	readonly method: string;
	readonly required?: boolean;
	readonly multiple?: boolean;
	readonly value?: string | readonly string[] | boolean;
}): string | undefined {
	if (input.method === "confirm" || input.value === true) return undefined;
	if (input.required !== true) return undefined;
	const kind = approvalFieldKind(input.method, { multiple: input.multiple === true });
	if (kind === "input" || kind === "password" || kind === "editor") {
		return typeof input.value === "string" && input.value.trim().length > 0 ? undefined : APPROVAL_REQUIRED_REASON;
	}
	if (kind === "select" || kind === "multi_select") {
		if (Array.isArray(input.value) ? input.value.length > 0 : typeof input.value === "string" && input.value.length > 0) {
			return undefined;
		}
		return kind === "multi_select" ? APPROVAL_MULTISELECT_REASON : APPROVAL_REQUIRED_REASON;
	}
	return undefined;
}

export function approvalFocusTarget(input: { readonly dangerous?: boolean; readonly invalid?: boolean }): "cancel" | "submit" | "control" {
	return input.invalid === true ? "control" : approvalDefaultFocus(input.dangerous);
}
