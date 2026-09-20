import { describe, expect, it } from "bun:test";
import {
	USER_PTY_EMBEDDED,
	USER_PTY_FOCUS_REASON,
	USER_PTY_OPEN_REASON,
	focusUserPtyPlan,
	newUserPtyPlan,
	userPtyRows,
} from "../src/user-pty.ts";

describe("userPtyRows", () => {
	it("maps live and exited receipts without embedding a shell", () => {
		const rows = userPtyRows([
			{ id: "pty-live", title: "Cedia user", cwd: "/Users/pond/cedia", ended: false },
			{ id: "pty-done", title: "Cedia user", cwd: "/tmp", ended: true },
		]);
		expect(rows).toEqual([
			{
				id: "pty-live",
				title: "Cedia user",
				cwd: "/Users/pond/cedia",
				kind: "user",
				status: "live",
				embedsInWebview: false,
				canFocus: true,
			},
			{
				id: "pty-done",
				title: "Cedia user",
				cwd: "/tmp",
				kind: "user",
				status: "exited",
				embedsInWebview: false,
				canFocus: true,
			},
		]);
		expect(JSON.stringify(rows)).not.toMatch(/embedded shell/i);
	});

	it("labels an empty cwd as unknown", () => {
		const rows = userPtyRows([{ id: "pty-empty", title: "Cedia user", cwd: "", ended: false }]);
		expect(rows[0]?.cwd).toBe("cwd unknown");
		expect(rows[0]?.status).toBe("live");
	});
});

describe("newUserPtyPlan", () => {
	it("opens a native Code-OSS PTY and does not embed in the webview", () => {
		expect(USER_PTY_EMBEDDED).toBe(false);
		const plan = newUserPtyPlan("/Users/pond/cedia");
		expect(plan).toEqual({
			title: "Cedia user",
			cwd: "/Users/pond/cedia",
			embedsInWebview: false,
			opensNative: true,
			reason: USER_PTY_OPEN_REASON,
		});
		expect(plan.embedsInWebview).toBe(false);
		expect(JSON.stringify(plan)).not.toMatch(/embedded shell/i);
		expect(newUserPtyPlan().cwd).toBe("");
	});
});

describe("focusUserPtyPlan", () => {
	it("focuses the native terminal without a second renderer", () => {
		expect(focusUserPtyPlan()).toEqual({
			opensNative: true,
			embedsInWebview: false,
			reason: USER_PTY_FOCUS_REASON,
		});
		expect(JSON.stringify(focusUserPtyPlan())).not.toMatch(/embedded shell/i);
	});
});
