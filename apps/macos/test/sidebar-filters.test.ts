import { describe, expect, it } from "bun:test";
import {
	DEFAULT_SIDEBAR_FILTERS,
	applySessionFilters,
	filterChips,
	filterEmptyCopy,
	markAllAsReadScope,
	normalizeSidebarFilters,
	type SidebarFilters,
	type SidebarSession,
} from "../src/sidebar-filters.ts";

function filters(patch: Partial<SidebarFilters> = {}): SidebarFilters {
	return normalizeSidebarFilters({ ...DEFAULT_SIDEBAR_FILTERS, ...patch });
}

function session(patch: Partial<SidebarSession> & Pick<SidebarSession, "id">): SidebarSession {
	return patch;
}

describe("DEFAULT_SIDEBAR_FILTERS", () => {
	it("groups by project, orders by last activity, shows active+draft, and hides archived", () => {
		expect(DEFAULT_SIDEBAR_FILTERS).toEqual({
			groupBy: "project",
			order: "last_activity",
			show: ["active", "draft"],
			archived: false,
		});
		expect(DEFAULT_SIDEBAR_FILTERS).not.toHaveProperty("pr");
		expect(DEFAULT_SIDEBAR_FILTERS).not.toHaveProperty("status");
		expect(JSON.stringify(DEFAULT_SIDEBAR_FILTERS)).not.toContain("no");
		expect(JSON.stringify(DEFAULT_SIDEBAR_FILTERS)).not.toContain("cloud");
	});
});

describe("normalizeSidebarFilters", () => {
	it("returns defaults for missing or invalid objects", () => {
		expect(normalizeSidebarFilters(undefined)).toEqual(DEFAULT_SIDEBAR_FILTERS);
		expect(normalizeSidebarFilters(null)).toEqual(DEFAULT_SIDEBAR_FILTERS);
		expect(normalizeSidebarFilters("archived")).toEqual(DEFAULT_SIDEBAR_FILTERS);
		expect(normalizeSidebarFilters([])).toEqual(DEFAULT_SIDEBAR_FILTERS);
	});

	it("rejects unknown groupBy, order, show, and status values", () => {
		const normalized = normalizeSidebarFilters({
			groupBy: "date",
			order: "created",
			show: ["archived", "completed", "all"],
			status: "idle",
			archived: "yes",
		});
		expect(normalized.groupBy).toBe("project");
		expect(normalized.order).toBe("last_activity");
		expect(normalized.show).toEqual(["active", "draft"]);
		expect(normalized.status).toBeUndefined();
		expect(normalized.archived).toBe(false);
	});

	it("keeps known show values and does not invent extras", () => {
		expect(normalizeSidebarFilters({ show: ["draft", "active", "cloud"] }).show).toEqual(["active", "draft"]);
		expect(normalizeSidebarFilters({ show: ["draft"] }).show).toEqual(["draft"]);
		expect(normalizeSidebarFilters({ status: "waiting" }).status).toBe("waiting");
		expect(normalizeSidebarFilters({ environment: "This Mac", source: "omp" })).toMatchObject({
			environment: "This Mac",
			source: "omp",
		});
		expect(normalizeSidebarFilters({ environment: { kind: "cloud" } }).environment).toBeUndefined();
	});

	it("never invents PR=open, PR=closed, or PR=no", () => {
		expect(normalizeSidebarFilters({ pr: "unknown" }).pr).toBe("unknown");
		expect(normalizeSidebarFilters({ pr: "" }).pr).toBe("");
		expect(normalizeSidebarFilters({ pr: "open" }).pr).toBeUndefined();
		expect(normalizeSidebarFilters({ pr: "closed" }).pr).toBeUndefined();
		expect(normalizeSidebarFilters({ pr: "no" }).pr).toBeUndefined();
		expect(normalizeSidebarFilters({ pr: "none" }).pr).toBeUndefined();
		expect(JSON.stringify(normalizeSidebarFilters({ pr: "open" }))).not.toContain("open");
		expect(JSON.stringify(normalizeSidebarFilters({ pr: "closed" }))).not.toContain("closed");
	});
});

describe("applySessionFilters", () => {
	const untitled = session({ id: "draft-1", title: "", status: "idle", updatedAt: "2026-09-13T10:00:00.000Z" });
	const newTask = session({ id: "draft-2", title: "New task", status: "idle", updatedAt: "2026-09-13T11:00:00.000Z" });
	const titledIdle = session({ id: "active-1", title: "Polish sidebar", status: "idle", updatedAt: "2026-09-13T12:00:00.000Z" });
	const completed = session({ id: "active-2", title: "Ship review", status: "completed", updatedAt: "2026-09-13T09:00:00.000Z" });
	const running = session({ id: "run-1", title: "", status: "running", updatedAt: "2026-09-13T08:00:00.000Z" });
	const waiting = session({ id: "wait-1", title: "New task", status: "waiting", updatedAt: "2026-09-13T07:00:00.000Z" });
	const unknown = session({ id: "unk-1", title: "", status: "unknown", updatedAt: "2026-09-13T06:00:00.000Z" });
	const recovery = session({ id: "rec-1", title: "New task", status: "recovery_required", updatedAt: "2026-09-13T05:00:00.000Z" });
	const archivedActive = session({
		id: "arch-1",
		title: "Old work",
		status: "idle",
		archived: true,
		updatedAt: "2026-09-13T04:00:00.000Z",
	});

	it("keeps active and draft rows under the default filters and hides archived", () => {
		const visible = applySessionFilters(
			[untitled, titledIdle, archivedActive, running],
			DEFAULT_SIDEBAR_FILTERS,
		);
		expect(visible.map((item) => item.id)).toEqual(["active-1", "draft-1", "run-1"]);
	});

	it("treats empty or New task idle rows as drafts, and completed/idle titled rows as active", () => {
		const draftsOnly = applySessionFilters([untitled, newTask, titledIdle, completed], filters({ show: ["draft"] }));
		expect(draftsOnly.map((item) => item.id)).toEqual(["draft-2", "draft-1"]);
		const activeOnly = applySessionFilters([untitled, newTask, titledIdle, completed], filters({ show: ["active"] }));
		expect(activeOnly.map((item) => item.id)).toEqual(["active-1", "active-2"]);
	});

	it("treats extras.drafts keys as drafts when the row is idle and untitled", () => {
		const local = session({ id: "local-1", projectId: "p1", status: "idle", updatedAt: "2026-09-13T13:00:00.000Z" });
		const visible = applySessionFilters([local, titledIdle], filters({ show: ["draft"] }), {
			drafts: { "p1/local-1": "typed locally" },
		});
		expect(visible.map((item) => item.id)).toEqual(["local-1"]);
	});

	it("does not turn a titled idle/completed row into a draft just because extras.drafts has a key", () => {
		const visible = applySessionFilters([titledIdle], filters({ show: ["draft"] }), {
			drafts: { "active-1": "leftover composer text" },
		});
		expect(visible).toEqual([]);
		expect(applySessionFilters([titledIdle], filters({ show: ["active"] }), {
			drafts: { "active-1": "leftover composer text" },
		}).map((item) => item.id)).toEqual(["active-1"]);
	});

	it("treats running, waiting, unknown, and recovery_required as active even when untitled", () => {
		const visible = applySessionFilters(
			[running, waiting, unknown, recovery, untitled],
			filters({ show: ["active"] }),
		);
		expect(visible.map((item) => item.id)).toEqual(["run-1", "wait-1", "unk-1", "rec-1"]);
	});

	it("applies status, environment, source, and PR=unknown without inventing open/closed", () => {
		const mac = session({
			id: "env-1",
			title: "Host path",
			status: "running",
			environment: "This Mac",
			source: "omp",
			updatedAt: "2026-09-13T14:00:00.000Z",
		});
		const missingPr = session({
			id: "pr-1",
			title: "Missing PR",
			status: "idle",
			updatedAt: "2026-09-13T15:00:00.000Z",
		});
		const unknownPr = session({
			id: "pr-2",
			title: "Unknown PR",
			status: "idle",
			pr: "unknown",
			updatedAt: "2026-09-13T16:00:00.000Z",
		});
		const claimedOpen = session({
			id: "pr-3",
			title: "Claimed open",
			status: "idle",
			pr: "open",
			updatedAt: "2026-09-13T17:00:00.000Z",
		});
		expect(applySessionFilters([mac, running], filters({ status: "running", environment: "This Mac", source: "omp" })).map((item) => item.id)).toEqual(["env-1"]);
		expect(applySessionFilters([missingPr, unknownPr, claimedOpen], filters({ pr: "unknown" })).map((item) => item.id)).toEqual(["pr-2", "pr-1"]);
		expect(applySessionFilters([claimedOpen], filters({ pr: "unknown" }))).toEqual([]);
	});

	it("keeps the selected session even when it would otherwise be hidden", () => {
		const hiddenArchived = applySessionFilters(
			[untitled, archivedActive],
			DEFAULT_SIDEBAR_FILTERS,
			{ selectedSessionId: "arch-1" },
		);
		expect(hiddenArchived.map((item) => item.id)).toContain("arch-1");
		expect(hiddenArchived.map((item) => item.id)).toContain("draft-1");
		const flagged = session({ ...archivedActive, selected: true });
		expect(applySessionFilters([flagged], filters({ show: ["draft"] })).map((item) => item.id)).toEqual(["arch-1"]);
	});

	it("orders by last activity descending and does not invent a Cloud destination", () => {
		const older = session({ id: "old", title: "Older", status: "idle", updatedAt: "2026-09-01T00:00:00.000Z" });
		const newer = session({ id: "new", title: "Newer", status: "idle", lastActivityAt: "2026-09-13T18:00:00.000Z" });
		const visible = applySessionFilters([older, newer], DEFAULT_SIDEBAR_FILTERS);
		expect(visible.map((item) => item.id)).toEqual(["new", "old"]);
		expect(visible.every((item) => item.environment !== "cloud")).toBe(true);
	});
});

describe("filterChips", () => {
	it("returns no chips for the default filters", () => {
		expect(filterChips(DEFAULT_SIDEBAR_FILTERS)).toEqual([]);
		expect(filterChips(normalizeSidebarFilters({ show: ["draft", "active"] }))).toEqual([]);
	});

	it("returns chips only for non-default values and never a PR=no chip", () => {
		expect(filterChips(filters({ show: ["active"], archived: true, status: "waiting", environment: "This Mac", source: "omp", pr: "unknown" }))).toEqual([
			{ id: "show", label: "Active" },
			{ id: "status", label: "Waiting" },
			{ id: "pr", label: "PR unknown" },
			{ id: "environment", label: "This Mac" },
			{ id: "source", label: "omp" },
			{ id: "archived", label: "Archived" },
		]);
		expect(filterChips(filters({ show: ["draft"] }))).toEqual([{ id: "show", label: "Draft" }]);
		expect(filterChips(filters({ status: "recovery_required" }))).toEqual([{ id: "status", label: "Needs review" }]);
		expect(filterChips(normalizeSidebarFilters({ pr: "no" }))).toEqual([]);
		expect(filterChips(normalizeSidebarFilters({ pr: "open" })).some((chip) => /open|closed|no pr/i.test(chip.label))).toBe(false);
	});
});

describe("filterEmptyCopy", () => {
	it("uses filter-empty copy when sessions exist but none are visible", () => {
		const copy = filterEmptyCopy(true, 0);
		expect(copy.th).toBe("ไม่มีงานที่ตรงตัวกรอง");
		expect(copy.en).toBe("No tasks match these filters");
		expect(copy.th).not.toBe("ยังไม่มีงาน");
	});

	it("uses a different empty-library copy when there are no sessions at all", () => {
		const copy = filterEmptyCopy(false, 0);
		expect(copy.th).toBe("ยังไม่มีงาน");
		expect(copy.en).toBe("No tasks yet");
		expect(copy.th).not.toBe("ไม่มีงานที่ตรงตัวกรอง");
	});
});

describe("markAllAsReadScope", () => {
	it("describes selected results only and never says all projects", () => {
		expect(markAllAsReadScope(3)).toEqual({ count: 3, label: "3 selected results" });
		expect(markAllAsReadScope(1)).toEqual({ count: 1, label: "1 selected result" });
		expect(markAllAsReadScope(0).label.toLowerCase()).not.toContain("all projects");
		expect(markAllAsReadScope(8).label.toLowerCase()).not.toContain("all projects");
	});
});
