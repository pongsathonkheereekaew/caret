import { describe, expect, it } from "bun:test";
import {
	CLOUD_DESTINATION_REASON,
	destinationOptions,
	RELAY_UNKNOWN_REASON,
	WORKTREE_NO_GIT_REASON,
} from "../src/destination-picker.ts";

describe("destinationOptions", () => {
	it("keeps Run on / Connect via / Workspace separate and does not invent Cloud", () => {
		const rows = destinationOptions({ hasGit: false, hostReachable: true, relayStatus: "unknown", projectName: "caret" });
		expect(rows.map((row) => row.group)).toEqual(["run_on", "run_on", "connect_via", "connect_via", "workspace", "workspace"]);
		expect(rows.find((row) => row.id === "run-mac")).toMatchObject({ current: true, enabled: true, label: "This Mac" });
		expect(rows.find((row) => row.id === "run-cloud")).toMatchObject({ enabled: false, reason: CLOUD_DESTINATION_REASON });
		expect(rows.find((row) => row.id === "via-relay")).toMatchObject({ enabled: false, reason: RELAY_UNKNOWN_REASON });
		expect(rows.find((row) => row.id === "ws-worktree")).toMatchObject({ enabled: false, reason: WORKTREE_NO_GIT_REASON });
		expect(rows.find((row) => row.id === "ws-current")?.label).toBe("caret");
	});

	it("enables a new worktree only when Git is present", () => {
		const rows = destinationOptions({ hasGit: true, projectName: "repo" });
		expect(rows.find((row) => row.id === "ws-worktree")?.enabled).toBe(true);
		expect(rows.find((row) => row.id === "ws-worktree")?.reason).toBeUndefined();
		expect(rows.find((row) => row.id === "ws-worktree")?.action).toBe("open_worktree");
		expect(rows.find((row) => row.id === "run-cloud")?.action).toBe("unavailable");
	});
});
