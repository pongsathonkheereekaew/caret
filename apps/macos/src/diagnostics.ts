/** S14 / D13 redacted diagnostics. Never includes provider tokens. */

export interface DiagnosticsInput {
	readonly connection?: string;
	readonly sessionId?: string;
	readonly projectId?: string;
	readonly pending?: number;
	readonly approvals?: number;
	readonly lastHostSyncAt?: string;
	readonly relayStatus?: string;
}

export function redactedDiagnostics(input: DiagnosticsInput = {}): string {
	return [
		`connection=${input.connection || "unknown"}`,
		`session=${input.sessionId || "none"}`,
		`project=${input.projectId || "none"}`,
		`relay=${input.relayStatus || "unknown"}`,
		"relayNote=unknown until contract",
		"secrets=redacted",
		`pending=${Number.isFinite(input.pending) ? input.pending : 0}`,
		`approvals=${Number.isFinite(input.approvals) ? input.approvals : 0}`,
		`lastHostSync=${input.lastHostSyncAt || "never"}`,
	].join("\n");
}
