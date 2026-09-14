import { describe, expect, it } from "bun:test";
import { redactedDiagnostics } from "../src/diagnostics.ts";

describe("redactedDiagnostics", () => {
	it("previews connection identity without secrets", () => {
		const text = redactedDiagnostics({
			connection: "running",
			sessionId: "sess-1",
			projectId: "proj-1",
			pending: 2,
			approvals: 1,
			lastHostSyncAt: "2026-09-13T07:00:00.000Z",
			relayStatus: "unknown",
		});
		expect(text).toContain("connection=running");
		expect(text).toContain("session=sess-1");
		expect(text).toContain("secrets=redacted");
		expect(text).toContain("relay=unknown");
		expect(text).toContain("relayNote=unknown until contract");
		expect(text).not.toContain("sk-");
		expect(text).not.toContain("token=");
	});
});
