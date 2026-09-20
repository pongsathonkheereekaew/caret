/** Work panel resource model (UI-S3 / PE-03, D08). View state only:
 * hiding the panel does not stop PTY, browser, or build owners. */

export const WORK_PANEL_TABS = ["changes", "terminal", "browser", "preview", "artifacts", "files"] as const;
export type WorkPanelTab = (typeof WORK_PANEL_TABS)[number];

export type ResourceStatus = "unopened" | "ready" | "live" | "stale" | "expired" | "error";

export type NativeWorkAction = "files" | "diff" | "terminal" | "settings" | "browser" | "preview" | "artifacts";

export interface WorkResource {
	readonly id: string;
	readonly tab: WorkPanelTab;
	readonly taskKey: string;
	readonly status: ResourceStatus;
	readonly label: string;
	readonly detail?: string;
	readonly nativeAction?: NativeWorkAction;
}

export interface WorkPanelState {
	readonly open: boolean;
	readonly activeTab: WorkPanelTab;
	readonly position: "right" | "bottom";
	readonly preferredWidth: number;
	readonly preferredHeight: number;
	readonly resources: readonly WorkResource[];
	/** Current task; other tasks' resources stay in `resources` but are not shown. */
	readonly taskKey: string;
}

export type WorkPanelAction =
	| { readonly type: "open_tab"; readonly tab: WorkPanelTab; readonly taskKey?: string }
	| { readonly type: "close_panel" }
	| { readonly type: "set_position"; readonly position: "right" | "bottom" }
	| { readonly type: "set_size"; readonly preferredWidth?: number; readonly preferredHeight?: number }
	| { readonly type: "set_resource"; readonly resource: WorkResource }
	| { readonly type: "restart_resource"; readonly resource: WorkResource }
	| { readonly type: "expire_resource"; readonly id: string }
	| { readonly type: "switch_task"; readonly taskKey: string };

export const EXPIRED_NO_AUTORESTART = "Cedia will not restart it automatically.";

export function expiredResourceCopy(label: string): string {
	return `${label} expired — ${EXPIRED_NO_AUTORESTART}`;
}

export function expiredRestartLabel(): "Restart" {
	return "Restart";
}

export function workResourceId(taskKey: string, tab: WorkPanelTab): string {
	return `${taskKey}:${tab}`;
}

export const SIDEBAR_MIN_WIDTH = 160;
export const SIDEBAR_MAX_WIDTH = 360;
export const SIDEBAR_PREFERRED_WIDTH = 180;
export const PANEL_MIN_WIDTH = 280;
export const PANEL_MAX_WIDTH = 640;
export const PANEL_PREFERRED_WIDTH = 360;
export const MIN_MAIN_WIDTH = 360;
export const SASH_WIDTH = 2;
export const PANEL_MIN_HEIGHT = 160;
export const PANEL_HEIGHT_START_RATIO = 0.4;
export const PANEL_HEIGHT_MAX_RATIO = 0.6;
export const TRANSCRIPT_COMPOSER_MIN = 240;
export const FULL_RESOURCE_ROUTE_BELOW = 480;

const TAB_LABEL: Record<WorkPanelTab, string> = {
	changes: "Changes",
	terminal: "Terminal",
	browser: "Browser",
	preview: "Preview",
	artifacts: "Artifacts",
	files: "Files",
};

const TAB_NATIVE_ACTION: Record<WorkPanelTab, NativeWorkAction> = {
	changes: "diff",
	terminal: "terminal",
	browser: "browser",
	preview: "preview",
	artifacts: "artifacts",
	files: "files",
};

export function createWorkPanelState(): WorkPanelState {
	return {
		open: false,
		activeTab: "changes",
		position: "right",
		preferredWidth: PANEL_PREFERRED_WIDTH,
		preferredHeight: 0,
		resources: [],
		taskKey: "",
	};
}

export function workTabBadge(status: ResourceStatus): "error" | "stale" | undefined {
	if (status === "error" || status === "expired") return "error";
	if (status === "stale") return "stale";
	return undefined;
}

export function visibleWorkResources(state: WorkPanelState): readonly WorkResource[] {
	if (!state.taskKey) return [];
	return state.resources.filter((resource) => resource.taskKey === state.taskKey);
}

export function useFullResourceRoute(contentHeight: number): boolean {
	return contentHeight < FULL_RESOURCE_ROUTE_BELOW;
}

export function clampSidebarWidth(preferred: number): number {
	if (!Number.isFinite(preferred)) return SIDEBAR_PREFERRED_WIDTH;
	return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(preferred)));
}

export function clampPanelWidth(preferred: number, contentWidth: number, sidebarWidth: number): number {
	const panelMax = Math.min(PANEL_MAX_WIDTH, contentWidth - sidebarWidth - MIN_MAIN_WIDTH - SASH_WIDTH);
	if (panelMax < PANEL_MIN_WIDTH) return Math.max(0, panelMax);
	return Math.min(panelMax, Math.max(PANEL_MIN_WIDTH, preferred));
}

export function clampPanelHeight(preferred: number, contentHeight: number): number {
	if (useFullResourceRoute(contentHeight)) return contentHeight;
	const max = Math.min(contentHeight * PANEL_HEIGHT_MAX_RATIO, contentHeight - TRANSCRIPT_COMPOSER_MIN);
	const min = Math.min(PANEL_MIN_HEIGHT, max);
	const target = preferred > 0 ? preferred : contentHeight * PANEL_HEIGHT_START_RATIO;
	return Math.min(max, Math.max(min, target));
}

export interface ShellLayoutInput {
	readonly contentWidth: number;
	readonly contentHeight: number;
	readonly preferredSidebarWidth: number;
	readonly preferredPanelWidth: number;
	readonly preferredPanelHeight: number;
	readonly panelOpen: boolean;
	readonly panelPosition: "right" | "bottom";
}

export interface ShellLayout {
	readonly sidebarWidth: number;
	readonly sidebarHidden: boolean;
	readonly sidebarDrawer: boolean;
	readonly panelWidth: number;
	readonly panelHeight: number;
	readonly workOpen: boolean;
	readonly workBottom: boolean;
	readonly fullResourceRoute: boolean;
	readonly needMoreSpace: boolean;
}

/** D01 geometry resolver. Preferred sizes stay stored; this only clamps what paints. */
export function resolveShellLayout(input: ShellLayoutInput): ShellLayout {
	const width = Number.isFinite(input.contentWidth) ? input.contentWidth : 1200;
	const height = Number.isFinite(input.contentHeight) ? input.contentHeight : 800;
	const preferredSidebar = clampSidebarWidth(input.preferredSidebarWidth);
	const fullResourceRoute = input.panelOpen && (useFullResourceRoute(height) || width < 900);
	const sidebarHidden = width < 900 || fullResourceRoute;
	const sidebarDrawer = width >= 620 && width < 900 && !fullResourceRoute;
	const visibleSidebar = sidebarHidden ? 0 : preferredSidebar;
	const workOpen = input.panelOpen && !fullResourceRoute;
	const panelWidth = workOpen && input.panelPosition === "right"
		? clampPanelWidth(input.preferredPanelWidth || PANEL_PREFERRED_WIDTH, width, visibleSidebar)
		: input.preferredPanelWidth || PANEL_PREFERRED_WIDTH;
	const panelHeight = workOpen && input.panelPosition === "bottom"
		? clampPanelHeight(input.preferredPanelHeight, height)
		: input.preferredPanelHeight;
	return {
		sidebarWidth: preferredSidebar,
		sidebarHidden,
		sidebarDrawer,
		panelWidth,
		panelHeight,
		workOpen,
		workBottom: workOpen && input.panelPosition === "bottom",
		fullResourceRoute,
		needMoreSpace: width < 720,
	};
}

export function reduceWorkPanel(state: WorkPanelState, action: WorkPanelAction): WorkPanelState {
	switch (action.type) {
		case "open_tab":
			return openTab(state, action.tab, action.taskKey ?? state.taskKey);
		case "close_panel":
			return { ...state, open: false };
		case "set_position":
			return { ...state, position: action.position };
		case "set_size":
			return {
				...state,
				preferredWidth: action.preferredWidth ?? state.preferredWidth,
				preferredHeight: action.preferredHeight ?? state.preferredHeight,
			};
		case "set_resource":
			return setResource(state, action.resource);
		case "restart_resource":
			return restartWorkResource(state, action.resource);
		case "expire_resource":
			return expireResource(state, action.id);
		case "switch_task":
			return { ...state, taskKey: action.taskKey };
		default:
			return state;
	}
}

function openTab(state: WorkPanelState, tab: WorkPanelTab, taskKey: string): WorkPanelState {
	const next: WorkPanelState = { ...state, open: true, activeTab: tab, taskKey };
	const existing = next.resources.find((resource) => resource.taskKey === taskKey && resource.tab === tab);
	if (existing) return next;
	return {
		...next,
		resources: [...next.resources, placeholderResource(taskKey, tab)],
	};
}

function placeholderResource(taskKey: string, tab: WorkPanelTab): WorkResource {
	return {
		id: workResourceId(taskKey, tab),
		tab,
		taskKey,
		status: "unopened",
		label: TAB_LABEL[tab],
		nativeAction: TAB_NATIVE_ACTION[tab],
	};
}

function setResource(state: WorkPanelState, resource: WorkResource): WorkPanelState {
	const index = state.resources.findIndex((item) => item.id === resource.id);
	if (index < 0) {
		return { ...state, resources: [...state.resources, resource] };
	}
	const current = state.resources[index]!;
	if (current.status === "expired") {
		return {
			...state,
			resources: state.resources.map((item, i) =>
				i === index ? { ...resource, status: "expired" as const } : item,
			),
		};
	}
	return {
		...state,
		resources: state.resources.map((item, i) => (i === index ? resource : item)),
	};
}

function expireResource(state: WorkPanelState, id: string): WorkPanelState {
	return {
		...state,
		resources: state.resources.map((item) => (item.id === id ? { ...item, status: "expired" } : item)),
	};
}

/** Explicit Restart only. Status comes from `resource` even if the previous row was expired. */
export function restartWorkResource(state: WorkPanelState, resource: WorkResource): WorkPanelState {
	const index = state.resources.findIndex(
		(item) => item.id === resource.id || (item.taskKey === resource.taskKey && item.tab === resource.tab),
	);
	if (index < 0) {
		return { ...state, resources: [...state.resources, resource] };
	}
	return {
		...state,
		resources: state.resources.map((item, i) => (i === index ? resource : item)),
	};
}
