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
			{ id: "pty-live", title: "Caret user", cwd: "/Users/pond/caret", ended: false },
			{ id: "pty-done", title: "Caret user", cwd: "/tmp", ended: true },
		]);
		expect(rows).toEqual([
			{
				id: "pty-live",
				title: "Caret user",
				cwd: "/Users/pond/caret",
				kind: "user",
				status: "live",
				embedsInWebview: false,
				canFocus: true,
			},
			{
				id: "pty-done",
				title: "Caret user",
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
		const rows = userPtyRows([{ id: "pty-empty", title: "Caret user", cwd: "", ended: false }]);
		expect(rows[0]?.cwd).toBe("cwd unknown");
		expect(rows[0]?.status).toBe("live");
	});
});

describe("newUserPtyPlan", () => {
	it("opens a native Code-OSS PTY and does not embed in the webview", () => {
		expect(USER_PTY_EMBEDDED).toBe(false);
		const plan = newUserPtyPlan("/Users/pond/caret");
		expect(plan).toEqual({
			title: "Caret user",
			cwd: "/Users/pond/caret",
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
