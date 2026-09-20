/** D01 missing/deleted/revoked route pages. Presentation only — OMP stays the owner.
 * Deep links validate the requested project/session/resource. Cedia never opens a nearby task instead. */

export const ROUTE_KINDS = ["projects", "task", "resource", "ide", "settings", "devices"] as const;
export type RouteKind = (typeof ROUTE_KINDS)[number];

export const ROUTE_ERROR_REASONS = ["missing", "deleted", "revoked", "unknown"] as const;
export type RouteErrorReason = (typeof ROUTE_ERROR_REASONS)[number];

export const ROUTE_ERROR_PRIMARIES = ["back", "projects"] as const;
export type RouteErrorPrimary = (typeof ROUTE_ERROR_PRIMARIES)[number];

export interface RouteErrorPageInput {
	readonly kind: RouteKind;
	readonly reason: RouteErrorReason;
	readonly id?: string;
}

export interface RouteErrorPage {
	readonly title: string;
	readonly body: string;
	readonly primary: RouteErrorPrimary;
	readonly primaryLabel: string;
}

export interface RouteTarget {
	readonly kind: RouteKind;
	readonly projectId?: string;
	readonly sessionId?: string;
	readonly resourceId?: string;
}

export interface RouteCatalogProject {
	readonly id: string;
	readonly reason?: RouteErrorReason;
}

export interface RouteCatalogSession {
	readonly id: string;
	readonly projectId: string;
	readonly reason?: RouteErrorReason;
}

export interface RouteCatalogResource {
	readonly id: string;
	readonly projectId?: string;
	readonly sessionId?: string;
	readonly reason?: RouteErrorReason;
}

export interface RouteAvailability {
	readonly projects: readonly RouteCatalogProject[];
	readonly sessions: readonly RouteCatalogSession[];
	readonly resources: readonly RouteCatalogResource[];
}

export type RouteValidation =
	| { readonly ok: true }
	| { readonly ok: false; readonly error: RouteErrorPage };

const PRIMARY_LABEL: Record<RouteErrorPrimary, string> = {
	back: "Back",
	projects: "Projects",
};

const KIND_NOUN: Record<RouteKind, string> = {
	projects: "project",
	task: "task",
	resource: "resource",
	ide: "IDE workspace",
	settings: "settings page",
	devices: "device",
};

export function routeErrorPage(input: RouteErrorPageInput): RouteErrorPage {
	const primary = primaryAction(input.kind, input.reason);
	return {
		title: pageTitle(input),
		body: pageBody(input),
		primary,
		primaryLabel: PRIMARY_LABEL[primary],
	};
}

export function availabilityFromLists(input: {
	readonly projects?: readonly { readonly id: string; readonly reason?: RouteErrorReason }[];
	readonly sessions?: readonly {
		readonly id: string;
		readonly projectId: string;
		readonly archived?: boolean;
		readonly revoked?: boolean;
		readonly reason?: RouteErrorReason;
	}[];
	readonly resources?: readonly RouteCatalogResource[];
}): RouteAvailability {
	return {
		projects: (input.projects ?? []).map((project) => ({
			id: project.id,
			...(project.reason ? { reason: project.reason } : {}),
		})),
		sessions: (input.sessions ?? []).map((session) => ({
			id: session.id,
			projectId: session.projectId,
			...(session.reason
				? { reason: session.reason }
				: session.revoked
					? { reason: "revoked" as const }
					: {}),
		})),
		resources: input.resources ?? [],
	};
}

export function validateRoute(target: RouteTarget, available: RouteAvailability): RouteValidation {
	if (target.kind === "settings" || target.kind === "devices") {
		return { ok: true };
	}

	const projectId = cleanId(target.projectId);
	const sessionId = cleanId(target.sessionId);
	const resourceId = cleanId(target.resourceId);

	if (projectId) {
		const project = lookup(available.projects, projectId);
		if (!project) return fail(target.kind, "missing", projectId);
		if (project.reason) return fail(target.kind, project.reason, projectId);
	}

	if (sessionId) {
		const session = lookup(available.sessions, sessionId);
		if (!session) return fail(target.kind, "missing", sessionId);
		if (session.reason) return fail(target.kind, session.reason, sessionId);
		if (projectId && session.projectId !== projectId) {
			return fail(target.kind, "missing", sessionId);
		}
	}

	if (target.kind === "resource" && !resourceId) {
		return fail("resource", "missing");
	}

	if (resourceId) {
		const resource = lookup(available.resources, resourceId);
		if (!resource) return fail(target.kind === "resource" ? "resource" : target.kind, "missing", resourceId);
		if (resource.reason) return fail(target.kind === "resource" ? "resource" : target.kind, resource.reason, resourceId);
		if (sessionId && resource.sessionId && resource.sessionId !== sessionId) {
			return fail("resource", "missing", resourceId);
		}
		if (projectId && resource.projectId && resource.projectId !== projectId) {
			return fail("resource", "missing", resourceId);
		}
	}

	return { ok: true };
}

function primaryAction(kind: RouteKind, reason: RouteErrorReason): RouteErrorPrimary {
	if (reason === "unknown") return "back";
	if (kind === "devices") return "back";
	if (kind === "task" && (reason === "missing" || reason === "deleted" || reason === "revoked")) return "projects";
	return "back";
}

function pageTitle(input: RouteErrorPageInput): string {
	if (input.reason === "unknown") return "This route is unknown";
	if (input.kind === "task") return "This task is gone";
	if (input.kind === "devices" && input.reason === "revoked") return "This device is revoked";
	if (input.reason === "revoked") return `This ${KIND_NOUN[input.kind]} is revoked`;
	return `This ${KIND_NOUN[input.kind]} is gone`;
}

function pageBody(input: RouteErrorPageInput): string {
	const idNote = input.id ? ` (${input.id})` : "";
	if (input.reason === "unknown") {
		return `Cedia does not know why this ${KIND_NOUN[input.kind]}${idNote} cannot be opened. It will not guess a nearby destination.`;
	}
	if (input.kind === "devices" && input.reason === "revoked") {
		return `This device${idNote} is revoked. Cedia will not auto-pair.`;
	}
	if (input.kind === "task") {
		const state = input.reason === "deleted" ? "was deleted" : input.reason === "revoked" ? "is revoked" : "is missing";
		return `This task${idNote} ${state}. Cedia will not open a different task.`;
	}
	const state = input.reason === "deleted" ? "was deleted" : input.reason === "revoked" ? "is revoked" : "is missing";
	return `This ${KIND_NOUN[input.kind]}${idNote} ${state}. Cedia will not open a nearby destination instead.`;
}

function fail(kind: RouteKind, reason: RouteErrorReason, id?: string): RouteValidation {
	return { ok: false, error: routeErrorPage({ kind, reason, ...(id ? { id } : {}) }) };
}

function lookup<T extends { readonly id: string }>(items: readonly T[], id: string): T | undefined {
	return items.find((item) => item.id === id);
}

function cleanId(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}
