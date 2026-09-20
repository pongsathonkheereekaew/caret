/** S01 / D18 sidebar filter helpers. Presentation only — OMP stays the session owner. */

import { NEW_TASK_LABEL } from "./task-chrome.ts";
import { draftViewKey } from "./workbench-mode.ts";

export const SIDEBAR_SHOW_VALUES = ["active", "draft"] as const;
export type SidebarShow = (typeof SIDEBAR_SHOW_VALUES)[number];

export const SIDEBAR_STATUS_VALUES = ["running", "waiting", "unknown", "recovery_required", ""] as const;
export type SidebarStatusFilter = (typeof SIDEBAR_STATUS_VALUES)[number];

export const ALWAYS_ACTIVE_STATUSES = ["running", "waiting", "unknown", "recovery_required"] as const;
export type AlwaysActiveStatus = (typeof ALWAYS_ACTIVE_STATUSES)[number];

export type SidebarPrFilter = "unknown" | "";

export interface SidebarFilters {
	readonly groupBy: "project";
	readonly order: "last_activity";
	readonly show: readonly SidebarShow[];
	readonly archived: boolean;
	readonly status?: SidebarStatusFilter;
	readonly environment?: string;
	readonly source?: string;
	readonly pr?: SidebarPrFilter;
}

export interface SidebarSession {
	readonly id: string;
	readonly projectId?: string;
	readonly title?: string;
	readonly status?: string;
	readonly archived?: boolean;
	readonly selected?: boolean;
	readonly environment?: string;
	readonly source?: string;
	readonly pr?: string | null;
	readonly updatedAt?: string;
	readonly createdAt?: string;
	readonly lastActivityAt?: string;
}

export interface SidebarFilterExtras {
	readonly drafts?: Readonly<Record<string, string>>;
	readonly selectedSessionId?: string;
}

export interface FilterChip {
	readonly id: string;
	readonly label: string;
}

export interface FilterEmptyCopy {
	readonly th: string;
	readonly en: string;
}

export interface MarkAllAsReadScope {
	readonly count: number;
	readonly label: string;
}

export const DEFAULT_SIDEBAR_FILTERS: SidebarFilters = {
	groupBy: "project",
	order: "last_activity",
	show: ["active", "draft"],
	archived: false,
};

const FILTERED_EMPTY_TH = "ไม่มีงานที่ตรงตัวกรอง";
const FILTERED_EMPTY_EN = "No tasks match these filters";
const NO_TASKS_TH = "ยังไม่มีงาน";
const NO_TASKS_EN = "No tasks yet";

const STATUS_CHIP_LABELS: Record<Exclude<SidebarStatusFilter, "">, string> = {
	running: "Running",
	waiting: "Waiting",
	unknown: "Unknown",
	recovery_required: "Needs review",
};

export function normalizeSidebarFilters(value: unknown): SidebarFilters {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return copyDefaults();
	}
	const record = value as Record<string, unknown>;
	const filters: {
		groupBy: "project";
		order: "last_activity";
		show: readonly SidebarShow[];
		archived: boolean;
		status?: SidebarStatusFilter;
		environment?: string;
		source?: string;
		pr?: SidebarPrFilter;
	} = {
		groupBy: "project",
		order: "last_activity",
		show: normalizeShow(record.show),
		archived: record.archived === true,
	};
	const status = normalizeStatus(record.status);
	if (status !== undefined) filters.status = status;
	if (typeof record.environment === "string" && record.environment.length > 0) {
		filters.environment = record.environment;
	}
	if (typeof record.source === "string" && record.source.length > 0) {
		filters.source = record.source;
	}
	const pr = normalizePr(record.pr);
	if (pr !== undefined) filters.pr = pr;
	return filters;
}

export function applySessionFilters(
	sessions: readonly SidebarSession[],
	filters: SidebarFilters,
	extras?: SidebarFilterExtras,
): readonly SidebarSession[] {
	const resolved = normalizeSidebarFilters(filters);
	const visible = sessions.filter((session) => matchesSession(session, resolved, extras) || isSelectedSession(session, extras));
	return [...visible].sort((left, right) => activityTime(right) - activityTime(left));
}

export function filterChips(filters: SidebarFilters): readonly FilterChip[] {
	const resolved = normalizeSidebarFilters(filters);
	const chips: FilterChip[] = [];
	const show = resolved.show;
	const showsActive = show.includes("active");
	const showsDraft = show.includes("draft");
	if (showsActive !== showsDraft) {
		chips.push({ id: "show", label: showsActive ? "Active" : "Draft" });
	}
	if (resolved.status) {
		chips.push({ id: "status", label: STATUS_CHIP_LABELS[resolved.status] });
	}
	if (resolved.pr === "unknown") {
		chips.push({ id: "pr", label: "PR unknown" });
	}
	if (resolved.environment) {
		chips.push({ id: "environment", label: resolved.environment });
	}
	if (resolved.source) {
		chips.push({ id: "source", label: resolved.source });
	}
	if (resolved.archived) {
		chips.push({ id: "archived", label: "Archived" });
	}
	return chips;
}

export function filterEmptyCopy(hasAnySessions: boolean, visibleCount: number): FilterEmptyCopy {
	if (!hasAnySessions) {
		return { th: NO_TASKS_TH, en: NO_TASKS_EN };
	}
	if (visibleCount === 0) {
		return { th: FILTERED_EMPTY_TH, en: FILTERED_EMPTY_EN };
	}
	return { th: "", en: "" };
}

export function markAllAsReadScope(visibleCount: number): MarkAllAsReadScope {
	const count = Number.isFinite(visibleCount) ? Math.max(0, Math.trunc(visibleCount)) : 0;
	const noun = count === 1 ? "selected result" : "selected results";
	return { count, label: `${count} ${noun}` };
}

function copyDefaults(): SidebarFilters {
	return {
		groupBy: DEFAULT_SIDEBAR_FILTERS.groupBy,
		order: DEFAULT_SIDEBAR_FILTERS.order,
		show: DEFAULT_SIDEBAR_FILTERS.show,
		archived: DEFAULT_SIDEBAR_FILTERS.archived,
	};
}

function normalizeShow(value: unknown): readonly SidebarShow[] {
	if (!Array.isArray(value)) return DEFAULT_SIDEBAR_FILTERS.show;
	const seen = new Set<SidebarShow>();
	for (const item of value) {
		if (item === "active" || item === "draft") seen.add(item);
	}
	if (seen.size === 0) return DEFAULT_SIDEBAR_FILTERS.show;
	return SIDEBAR_SHOW_VALUES.filter((item) => seen.has(item));
}

function normalizeStatus(value: unknown): SidebarStatusFilter | undefined {
	if (value === "running" || value === "waiting" || value === "unknown" || value === "recovery_required" || value === "") {
		return value;
	}
	return undefined;
}

function normalizePr(value: unknown): SidebarPrFilter | undefined {
	if (value === "unknown" || value === "") return value;
	return undefined;
}

function matchesSession(session: SidebarSession, filters: SidebarFilters, extras?: SidebarFilterExtras): boolean {
	if (Boolean(session.archived) !== filters.archived) return false;
	const kind = classifySession(session, extras);
	if (kind === "active" && !filters.show.includes("active")) return false;
	if (kind === "draft" && !filters.show.includes("draft")) return false;
	if (filters.status && sessionStatus(session) !== filters.status) return false;
	if (filters.environment && session.environment !== filters.environment) return false;
	if (filters.source && session.source !== filters.source) return false;
	if (filters.pr === "unknown" && !isUnknownPr(session.pr)) return false;
	return true;
}

function classifySession(session: SidebarSession, extras?: SidebarFilterExtras): "active" | "draft" {
	return isDraftSession(session, extras) ? "draft" : "active";
}

function isDraftSession(session: SidebarSession, extras?: SidebarFilterExtras): boolean {
	if (isAlwaysActiveStatus(session.status)) return false;
	if (hasRealTitle(session.title)) return false;
	return isDraftTitle(session.title) || hasDraftMarker(session, extras?.drafts);
}

function isAlwaysActiveStatus(status: string | undefined): status is AlwaysActiveStatus {
	return status === "running" || status === "waiting" || status === "unknown" || status === "recovery_required";
}

function isDraftTitle(title: string | undefined): boolean {
	const trimmed = title?.trim() ?? "";
	return trimmed === "" || trimmed === NEW_TASK_LABEL;
}

function hasRealTitle(title: string | undefined): boolean {
	return !isDraftTitle(title);
}

function hasDraftMarker(session: SidebarSession, drafts: Readonly<Record<string, string>> | undefined): boolean {
	if (!drafts) return false;
	if (Object.hasOwn(drafts, session.id)) return true;
	return Object.hasOwn(drafts, draftViewKey(session.projectId, session.id));
}

function sessionStatus(session: SidebarSession): string {
	return session.status ?? "";
}

function isUnknownPr(value: string | null | undefined): boolean {
	return value === undefined || value === null || value === "" || value === "unknown";
}

function isSelectedSession(session: SidebarSession, extras?: SidebarFilterExtras): boolean {
	if (session.selected === true) return true;
	return Boolean(extras?.selectedSessionId && extras.selectedSessionId === session.id);
}

function activityTime(session: SidebarSession): number {
	const raw = session.lastActivityAt ?? session.updatedAt ?? session.createdAt;
	if (typeof raw !== "string" || raw.length === 0) return Number.NEGATIVE_INFINITY;
	const time = Date.parse(raw);
	return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}
