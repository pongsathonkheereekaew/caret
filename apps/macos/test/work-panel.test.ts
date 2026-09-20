import { describe, expect, it } from "bun:test";
import {
	PANEL_MAX_WIDTH,
	PANEL_MIN_HEIGHT,
	PANEL_MIN_WIDTH,
	PANEL_PREFERRED_WIDTH,
	WORK_PANEL_TABS,
	clampPanelHeight,
	clampPanelWidth,
	clampSidebarWidth,
	EXPIRED_NO_AUTORESTART,
	createWorkPanelState,
	expiredResourceCopy,
	expiredRestartLabel,
	reduceWorkPanel,
	resolveShellLayout,
	useFullResourceRoute,
	visibleWorkResources,
	workResourceId,
	workTabBadge,
	type WorkResource,
} from "../src/work-panel.ts";

const live = (partial: Partial<WorkResource> & Pick<WorkResource, "id" | "tab" | "taskKey">): WorkResource => ({
	status: "live",
	label: partial.tab,
	...partial,
});

describe("work panel tabs", () => {
	it("exposes Changes, Terminal, Browser, Preview, Artifacts, Files plus native browser/preview/artifacts actions", () => {
		expect([...WORK_PANEL_TABS]).toEqual(["changes", "terminal", "browser", "preview", "artifacts", "files"]);
		let state = createWorkPanelState();
		for (const tab of WORK_PANEL_TABS) {
			state = reduceWorkPanel(state, { type: "open_tab", tab, taskKey: "task-a" });
		}
		const actions = visibleWorkResources(state).map((resource) => resource.nativeAction);
		expect(actions).toEqual(["diff", "terminal", "browser", "preview", "artifacts", "files"]);
	});
});

describe("createWorkPanelState", () => {
	it("starts closed on the right with D01 preferred width and no resources", () => {
		const state = createWorkPanelState();
		expect(state.open).toBe(false);
		expect(state.activeTab).toBe("changes");
		expect(state.position).toBe("right");
		expect(state.preferredWidth).toBe(PANEL_PREFERRED_WIDTH);
		expect(state.resources).toEqual([]);
		expect(state.taskKey).toBe("");
	});
});

describe("reduceWorkPanel", () => {
	it("opens a tab without killing identity when the panel is later hidden", () => {
		let state = reduceWorkPanel(createWorkPanelState(), { type: "open_tab", tab: "terminal", taskKey: "task-a" });
		expect(state.open).toBe(true);
		expect(state.activeTab).toBe("terminal");
		expect(state.resources).toHaveLength(1);
		expect(state.resources[0]).toMatchObject({ tab: "terminal", taskKey: "task-a", status: "unopened", nativeAction: "terminal" });
		state = reduceWorkPanel(state, { type: "set_resource", resource: live({ id: state.resources[0].id, tab: "terminal", taskKey: "task-a", label: "zsh" }) });
		state = reduceWorkPanel(state, { type: "close_panel" });
		expect(state.open).toBe(false);
		expect(state.resources[0].status).toBe("live");
		expect(state.resources[0].label).toBe("zsh");
	});

	it("sets position and remembers preferred size separately from clamps", () => {
		let state = reduceWorkPanel(createWorkPanelState(), { type: "set_position", position: "bottom" });
		state = reduceWorkPanel(state, { type: "set_size", preferredWidth: 500, preferredHeight: 220 });
		expect(state.position).toBe("bottom");
		expect(state.preferredWidth).toBe(500);
		expect(state.preferredHeight).toBe(220);
	});

	it("keeps per-task resource identity across switch_task without showing the other task", () => {
		let state = reduceWorkPanel(createWorkPanelState(), { type: "open_tab", tab: "browser", taskKey: "task-a" });
		const aId = state.resources[0].id;
		state = reduceWorkPanel(state, {
			type: "set_resource",
			resource: live({ id: aId, tab: "browser", taskKey: "task-a", label: "localhost:3000" }),
		});
		state = reduceWorkPanel(state, { type: "switch_task", taskKey: "task-b" });
		expect(state.taskKey).toBe("task-b");
		expect(state.resources).toHaveLength(1);
		expect(visibleWorkResources(state)).toEqual([]);
		state = reduceWorkPanel(state, { type: "open_tab", tab: "browser", taskKey: "task-b" });
		expect(visibleWorkResources(state).map((r) => r.id)).toEqual(["task-b:browser"]);
		expect(state.resources.some((r) => r.id === aId && r.taskKey === "task-a" && r.status === "live")).toBe(true);
		state = reduceWorkPanel(state, { type: "switch_task", taskKey: "task-a" });
		expect(visibleWorkResources(state).map((r) => r.id)).toEqual([aId]);
	});

	it("marks expired resources expired and never silently respawns them", () => {
		let state = reduceWorkPanel(createWorkPanelState(), { type: "open_tab", tab: "preview", taskKey: "task-a" });
		const id = state.resources[0].id;
		state = reduceWorkPanel(state, { type: "set_resource", resource: live({ id, tab: "preview", taskKey: "task-a" }) });
		state = reduceWorkPanel(state, { type: "expire_resource", id });
		expect(state.resources[0].status).toBe("expired");
		state = reduceWorkPanel(state, { type: "open_tab", tab: "preview", taskKey: "task-a" });
		expect(state.resources.filter((r) => r.tab === "preview" && r.taskKey === "task-a")).toHaveLength(1);
		expect(state.resources[0].status).toBe("expired");
		state = reduceWorkPanel(state, {
			type: "set_resource",
			resource: live({ id, tab: "preview", taskKey: "task-a", label: "build-b" }),
		});
		expect(state.resources[0].status).toBe("expired");
		expect(state.resources[0].label).toBe("build-b");
	});

	it("restarts an expired resource only through restart_resource", () => {
		let state = reduceWorkPanel(createWorkPanelState(), { type: "open_tab", tab: "terminal", taskKey: "task-a" });
		const id = state.resources[0].id;
		expect(id).toBe(workResourceId("task-a", "terminal"));
		state = reduceWorkPanel(state, { type: "set_resource", resource: live({ id, tab: "terminal", taskKey: "task-a", label: "zsh" }) });
		state = reduceWorkPanel(state, { type: "expire_resource", id });
		expect(state.resources[0].status).toBe("expired");

		state = reduceWorkPanel(state, {
			type: "restart_resource",
			resource: { id, tab: "terminal", taskKey: "task-a", status: "unopened", label: "zsh" },
		});
		expect(state.resources).toHaveLength(1);
		expect(state.resources[0].status).toBe("unopened");
		expect(state.resources[0].id).toBe(id);

		state = reduceWorkPanel(state, { type: "expire_resource", id });
		state = reduceWorkPanel(state, {
			type: "restart_resource",
			resource: live({ id, tab: "terminal", taskKey: "task-a", label: "zsh" }),
		});
		expect(state.resources).toHaveLength(1);
		expect(state.resources[0].status).toBe("live");
		expect(state.resources.filter((r) => r.tab === "terminal" && r.taskKey === "task-a")).toHaveLength(1);
	});

	it("replaces the same taskKey+tab on restart instead of appending a second resource", () => {
		let state = reduceWorkPanel(createWorkPanelState(), { type: "open_tab", tab: "browser", taskKey: "task-a" });
		const id = workResourceId("task-a", "browser");
		state = reduceWorkPanel(state, { type: "expire_resource", id });
		const restarted = live({ id: "task-a:browser:next", tab: "browser", taskKey: "task-a", label: "localhost:3000" });
		state = reduceWorkPanel(state, { type: "restart_resource", resource: restarted });
		expect(state.resources.filter((r) => r.tab === "browser" && r.taskKey === "task-a")).toHaveLength(1);
		expect(state.resources[0]).toEqual(restarted);
	});
});

describe("expired resource copy", () => {
	it("includes the no-autorestart sentence and Restart label", () => {
		expect(expiredResourceCopy("Terminal")).toBe(`Terminal expired — ${EXPIRED_NO_AUTORESTART}`);
		expect(expiredResourceCopy("Terminal")).toContain(EXPIRED_NO_AUTORESTART);
		expect(expiredRestartLabel()).toBe("Restart");
	});
});

describe("D01 geometry", () => {
	it("clamps the sidebar between 160 and 360", () => {
		expect(clampSidebarWidth(260)).toBe(260);
		expect(clampSidebarWidth(120)).toBe(160);
		expect(clampSidebarWidth(900)).toBe(360);
	});

	it("clamps the right panel between 280 and 640 while leaving min main 360 and a 2px sash", () => {
		expect(clampPanelWidth(360, 1200, 240)).toBe(360);
		expect(clampPanelWidth(900, 1200, 240)).toBe(Math.min(PANEL_MAX_WIDTH, 1200 - 240 - 360 - 2));
		expect(clampPanelWidth(100, 1200, 240)).toBe(PANEL_MIN_WIDTH);
		expect(clampPanelWidth(360, 900, 210)).toBe(Math.min(640, 900 - 210 - 360 - 2));
		expect(clampPanelWidth(360, 700, 0)).toBe(700 - 360 - 2);
		expect(clampPanelWidth(360, 620, 0)).toBe(620 - 360 - 2);
		expect(clampPanelWidth(360, 620, 0)).toBeLessThan(PANEL_MIN_WIDTH);
	});

	it("uses 40% height start, 160–60% bounds, leftover ≥240, and full route below 480", () => {
		expect(useFullResourceRoute(479)).toBe(true);
		expect(useFullResourceRoute(480)).toBe(false);
		expect(clampPanelHeight(0, 479)).toBe(479);
		expect(clampPanelHeight(0, 800)).toBe(800 * 0.4);
		expect(clampPanelHeight(100, 800)).toBe(PANEL_MIN_HEIGHT);
		expect(clampPanelHeight(900, 800)).toBe(Math.min(800 * 0.6, 800 - 240));
		expect(clampPanelHeight(300, 480)).toBe(480 - 240);
	});

	it("hides the sidebar below 900 and uses a full resource route when the panel is open", () => {
		const wide = resolveShellLayout({
			contentWidth: 1280,
			contentHeight: 800,
			preferredSidebarWidth: 260,
			preferredPanelWidth: 360,
			preferredPanelHeight: 0,
			panelOpen: true,
			panelPosition: "right",
		});
		expect(wide.sidebarHidden).toBe(false);
		expect(wide.workOpen).toBe(true);
		expect(wide.fullResourceRoute).toBe(false);
		const mid = resolveShellLayout({
			contentWidth: 800,
			contentHeight: 800,
			preferredSidebarWidth: 260,
			preferredPanelWidth: 360,
			preferredPanelHeight: 0,
			panelOpen: true,
			panelPosition: "right",
		});
		expect(mid.sidebarHidden).toBe(true);
		expect(mid.fullResourceRoute).toBe(true);
		expect(mid.workOpen).toBe(false);
		const short = resolveShellLayout({
			contentWidth: 1280,
			contentHeight: 400,
			preferredSidebarWidth: 260,
			preferredPanelWidth: 360,
			preferredPanelHeight: 240,
			panelOpen: true,
			panelPosition: "bottom",
		});
		expect(short.fullResourceRoute).toBe(true);
		expect(short.sidebarHidden).toBe(true);
	});

	it("flags need more space below 720 and not at 720", () => {
		const input = {
			contentHeight: 800,
			preferredSidebarWidth: 260,
			preferredPanelWidth: 360,
			preferredPanelHeight: 0,
			panelOpen: false,
			panelPosition: "right" as const,
		};
		expect(resolveShellLayout({ ...input, contentWidth: 719 }).needMoreSpace).toBe(true);
		expect(resolveShellLayout({ ...input, contentWidth: 720 }).needMoreSpace).toBe(false);
	});
});

describe("workTabBadge", () => {
	it("marks expired and error as error, stale as stale, and ready as empty", () => {
		expect(workTabBadge("expired")).toBe("error");
		expect(workTabBadge("error")).toBe("error");
		expect(workTabBadge("stale")).toBe("stale");
		expect(workTabBadge("ready")).toBeUndefined();
		expect(workTabBadge("live")).toBeUndefined();
	});
});
