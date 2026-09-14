import { describe, expect, it } from "bun:test";
import {
	CARET_BRAND,
	FORK_NO_PARENT_REASON,
	FOLDER_LABEL,
	caretWindowTitle,
	moreMenuActions,
	taskHeaderMeta,
	unreadJumpLabel,
} from "../src/task-chrome.ts";

describe("caretWindowTitle", () => {
	it("uses task — project — Caret in Agents when a task title exists", () => {
		expect(caretWindowTitle({
			mode: "agents",
			taskTitle: "Polish header",
			projectName: "caret",
		})).toBe("Polish header — caret — Caret");
	});

	it("drops the project segment when Agents has a task but no project", () => {
		expect(caretWindowTitle({ mode: "agents", taskTitle: "Polish header" })).toBe("Polish header — Caret");
	});

	it("uses New task — Caret for an Agents empty draft and never invents a session id", () => {
		expect(caretWindowTitle({ mode: "agents" })).toBe("New task — Caret");
		expect(caretWindowTitle({ mode: "agents", taskTitle: "   " })).toBe("New task — Caret");
		expect(caretWindowTitle({ mode: "agents", projectName: "caret" })).toBe("New task — Caret");
		expect(caretWindowTitle({ mode: "agents", fileName: "webview.ts" })).toBe("New task — Caret");
		expect(caretWindowTitle({ mode: "agents" })).not.toMatch(/sess(?:ion)?[-_]/i);
		expect(caretWindowTitle({ mode: "agents", projectName: "caret" })).not.toContain("sess-");
	});

	it("uses file — project — Caret in IDE when a file is open", () => {
		expect(caretWindowTitle({
			mode: "ide",
			fileName: "task-chrome.ts",
			projectName: "caret",
			taskTitle: "ignored",
		})).toBe("task-chrome.ts — caret — Caret");
	});

	it("uses file — Caret in IDE when a file is open without a project", () => {
		expect(caretWindowTitle({ mode: "ide", fileName: "task-chrome.ts" })).toBe("task-chrome.ts — Caret");
	});

	it("uses project — Caret or Caret in IDE when no file is open", () => {
		expect(caretWindowTitle({ mode: "ide", projectName: "caret", taskTitle: "ignored" })).toBe("caret — Caret");
		expect(caretWindowTitle({ mode: "ide", fileName: "  " })).toBe(CARET_BRAND);
		expect(caretWindowTitle({ mode: "ide" })).toBe("Caret");
	});
});

describe("taskHeaderMeta", () => {
	it("shows an advertised branch and never invents one", () => {
		const meta = taskHeaderMeta({
			projectName: "caret",
			branch: "feat/s02",
			worktree: "/tmp/caret-feat",
			path: "/Users/pond/caret",
			cwd: "/tmp/caret-feat",
		});
		expect(meta.locationKind).toBe("branch");
		expect(meta.locationLabel).toBe("Branch");
		expect(meta.branch).toBe("feat/s02");
		expect(meta.worktree).toBe("/tmp/caret-feat");
		expect(meta.path).toBe("/Users/pond/caret");
		expect(meta.cwd).toBe("/tmp/caret-feat");
		expect(meta.summary).toBe("caret · feat/s02 · /tmp/caret-feat · /Users/pond/caret");
		expect(meta.summary).not.toMatch(/\b(main|master)\b/);
	});

	it("labels a no-git folder as Folder, not Branch, and includes path or cwd", () => {
		const byPath = taskHeaderMeta({ projectName: "notes", path: "/tmp/notes" });
		expect(byPath.locationKind).toBe("folder");
		expect(byPath.locationLabel).toBe(FOLDER_LABEL);
		expect(byPath.branch).toBeUndefined();
		expect(byPath.summary).toBe("notes · Folder · /tmp/notes");

		const byCwd = taskHeaderMeta({ projectName: "notes", cwd: "/tmp/notes-cwd" });
		expect(byCwd.locationLabel).toBe("Folder");
		expect(byCwd.branch).toBeUndefined();
		expect(byCwd.summary).toBe("notes · Folder · /tmp/notes-cwd");

		const whitespaceBranch = taskHeaderMeta({ projectName: "notes", branch: "  ", path: "/tmp/notes" });
		expect(whitespaceBranch.locationKind).toBe("folder");
		expect(whitespaceBranch.locationLabel).toBe("Folder");
		expect(whitespaceBranch.branch).toBeUndefined();
	});

	it("does not invent main/master when git metadata is absent", () => {
		const meta = taskHeaderMeta({});
		expect(meta.locationLabel).toBe("Folder");
		expect(meta.branch).toBeUndefined();
		expect(meta.summary).toBe("Folder");
		expect(JSON.stringify(meta)).not.toMatch(/main|master|Branch/);
	});

	it("shows an advertised parent session and never invents one", () => {
		const withParent = taskHeaderMeta({ projectName: "caret", parentSession: "sess-parent" });
		expect(withParent.parentSession).toBe("sess-parent");
		expect(withParent.summary).toContain("parent sess-parent");
		expect(taskHeaderMeta({ projectName: "caret" }).parentSession).toBeUndefined();
	});
});

describe("moreMenuActions", () => {
	it("returns D04 More labels in order and keeps Stop out of the menu", () => {
		const labels = moreMenuActions({ hasSession: true }).map((action) => action.label);
		expect(labels).toEqual([
			"Rename",
			"Pin",
			"Mark unread",
			"Fork",
			"Archive",
			"Discard draft",
			"Details",
			"Split right",
			"Split down",
			"Close pane",
			"Open IDE in new window",
		]);
		expect(labels).not.toContain("Stop");
	});

	it("toggles Pin/Unpin and Archive/Restore and adds Reconcile only when recovery is required", () => {
		const recovered = moreMenuActions({
			hasSession: true,
			pinned: true,
			archived: true,
			recoveryRequired: true,
			hasParent: true,
		});
		expect(recovered.map((action) => action.label)).toEqual([
			"Rename",
			"Unpin",
			"Mark unread",
			"Fork",
			"Restore",
			"Discard draft",
			"Details",
			"Split right",
			"Split down",
			"Close pane",
			"Reconcile",
			"Open IDE in new window",
		]);
		expect(recovered.find((action) => action.id === "fork")).toMatchObject({ enabled: true });
		expect(moreMenuActions({ hasSession: true }).some((action) => action.id === "reconcile")).toBe(false);
	});

	it("keeps Fork present but disabled when OMP has not advertised a parent", () => {
		const fork = moreMenuActions({ hasSession: true }).find((action) => action.id === "fork");
		expect(fork).toEqual({
			id: "fork",
			label: "Fork",
			enabled: false,
			kind: "omp",
			reason: FORK_NO_PARENT_REASON,
		});
		expect(fork?.reason).toBe("OMP has not advertised a parent session to fork.");
	});

	it("treats Mark unread as a local presentation action and Open IDE as secondary", () => {
		const actions = moreMenuActions({ hasSession: false });
		expect(actions.find((action) => action.id === "mark_unread")).toEqual({
			id: "mark_unread",
			label: "Mark unread",
			enabled: true,
			kind: "local",
		});
		const ide = actions.at(-1);
		expect(ide).toMatchObject({
			id: "open_ide_new_window",
			label: "Open IDE in new window",
			enabled: true,
			kind: "secondary",
		});
		expect(actions.find((action) => action.id === "rename")?.enabled).toBe(false);
		expect(actions.find((action) => action.id === "pin")?.enabled).toBe(false);
		expect(actions.find((action) => action.id === "archive")?.enabled).toBe(false);
		expect(actions.find((action) => action.id === "discard_draft")).toMatchObject({
			enabled: false,
			kind: "local",
		});
		expect(moreMenuActions({ hasSession: true, hasDraft: true }).find((action) => action.id === "discard_draft")).toMatchObject({
			enabled: true,
			label: "Discard draft",
		});
	});

	it("disables split when the active pane cannot fit another min size", () => {
		const tight = moreMenuActions({ hasSession: true, canSplitRight: false, canSplitDown: false });
		expect(tight.find((action) => action.id === "split_right")).toMatchObject({
			enabled: false,
			reason: "Need more space. Maximize area or Open another window. Caret will not squeeze this pane.",
		});
		expect(tight.find((action) => action.id === "split_down")?.enabled).toBe(false);
		expect(tight.find((action) => action.id === "close_pane")?.enabled).toBe(true);
	});

	it("adds Maximize pane only when more than one pane is visible", () => {
		expect(moreMenuActions({ hasSession: true }).some((action) => action.id === "maximize_pane")).toBe(false);
		expect(moreMenuActions({ hasSession: true, paneCount: 2 }).find((action) => action.id === "maximize_pane")?.label).toBe("Maximize pane");
		expect(moreMenuActions({ hasSession: true, paneCount: 2, paneMaximized: true }).find((action) => action.id === "restore_layout")?.label).toBe("Restore layout");
	});

	it("adds Move actions only when more than one pane is visible", () => {
		expect(moreMenuActions({ hasSession: true }).some((action) => action.id === "move_left")).toBe(false);
		const split = moreMenuActions({ hasSession: true, paneCount: 2, canMoveRight: true });
		expect(split.find((action) => action.id === "move_right")).toMatchObject({ label: "Move right", enabled: true });
		expect(split.find((action) => action.id === "move_up")).toMatchObject({ enabled: false, reason: "This pane cannot move that way." });
	});
});

describe("unreadJumpLabel", () => {
	it("says Jump to latest when there is no unread count", () => {
		expect(unreadJumpLabel(0)).toBe("Jump to latest");
		expect(unreadJumpLabel(-3)).toBe("Jump to latest");
		expect(unreadJumpLabel(Number.NaN)).toBe("Jump to latest");
	});

	it("appends the unread count when N > 0", () => {
		expect(unreadJumpLabel(1)).toBe("Jump to latest · 1");
		expect(unreadJumpLabel(12)).toBe("Jump to latest · 12");
	});
});
