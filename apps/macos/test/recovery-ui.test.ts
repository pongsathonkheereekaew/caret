import { describe, expect, it } from "bun:test";
import { recoveryBanner } from "../src/recovery-ui.ts";

describe("Mac recovery banner (UI-S4)", () => {
	it("shows Thai+English offline copy when a draft persist receipt exists", () => {
		const banner = recoveryBanner({
			connection: "offline",
			draftSaved: true,
			outcomeUnknown: false,
			pendingApprovals: 0,
		});
		expect(banner.title).toBe("Can't reach the Mac — draft saved");
		expect(banner.body).toContain("Can't reach the Mac — draft saved");
		expect(banner.body).toContain("ติดต่อ Mac ไม่ได้ — เก็บฉบับร่างไว้แล้ว");
		expect(banner.primaryAction?.label).toBe("Reconnect");
		expect(banner.primaryAction?.id).toBe("reconnect");
		expect(banner.destructiveRetry).toBe(false);
	});

	it("warns when the draft is not saved yet", () => {
		const banner = recoveryBanner({
			connection: "offline",
			draftSaved: false,
			outcomeUnknown: false,
			pendingApprovals: 0,
		});
		expect(banner.title).toBe("Draft not saved");
		expect(banner.body).toContain("Draft not saved");
		expect(banner.body).toContain("ยังบันทึกฉบับร่างไม่ได้");
		expect(banner.primaryAction?.label).toBe("Reconnect");
		expect(banner.primaryAction?.id).toBe("reconnect");
		expect(banner.destructiveRetry).toBe(false);
	});

	it("blocks resend when the command outcome is unknown", () => {
		const banner = recoveryBanner({
			connection: "online",
			draftSaved: true,
			outcomeUnknown: true,
			pendingApprovals: 0,
		});
		expect(banner.title).toBe("Command result is unconfirmed. Do not resend until you inspect it.");
		expect(banner.body).toContain("ยังยืนยันผลคำสั่งไม่ได้");
		expect(banner.primaryAction?.label).toBe("Inspect result");
		expect(banner.destructiveRetry).toBe(false);
		expect(banner.primaryAction?.id).not.toBe("reconnect");
	});

	it("never offers a Retry that auto-runs a destructive command", () => {
		const cases = [
			recoveryBanner({ connection: "offline", draftSaved: true, outcomeUnknown: true, pendingApprovals: 2 }),
			recoveryBanner({ connection: "reconnecting", draftSaved: true, outcomeUnknown: true, pendingApprovals: 1 }),
			recoveryBanner({ connection: "online", draftSaved: false, outcomeUnknown: true, pendingApprovals: 0 }),
		];
		for (const banner of cases) {
			expect(banner.destructiveRetry).toBe(false);
			expect(banner.primaryAction?.label).not.toMatch(/^Retry$/i);
			expect(banner.primaryAction?.id).not.toBe("retry");
		}
	});

	it("does not auto-answer stale approvals on reconnect", () => {
		const banner = recoveryBanner({
			connection: "reconnecting",
			draftSaved: true,
			outcomeUnknown: false,
			pendingApprovals: 3,
		});
		expect(banner.primaryAction?.id).toBe("reconnect");
		expect(banner.primaryAction?.autoAnswerApprovals).toBe(false);
		expect(banner.destructiveRetry).toBe(false);
	});
});
