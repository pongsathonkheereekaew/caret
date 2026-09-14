import { describe, expect, it } from "bun:test";
import {
	ROUTE_ERROR_REASONS,
	ROUTE_KINDS,
	availabilityFromLists,
	routeErrorPage,
	validateRoute,
	type RouteAvailability,
	type RouteCatalogSession,
	type RouteKind,
} from "../src/route-error.ts";

function available(partial: Partial<RouteAvailability> = {}): RouteAvailability {
	return {
		projects: [{ id: "proj-1" }, { id: "proj-2" }],
		sessions: [
			{ id: "task-1", projectId: "proj-1" },
			{ id: "task-2", projectId: "proj-1" },
			{ id: "task-other", projectId: "proj-2" },
		],
		resources: [
			{ id: "res-1", projectId: "proj-1", sessionId: "task-1" },
			{ id: "res-2", projectId: "proj-1", sessionId: "task-2" },
		],
		...partial,
	};
}

describe("D01 route error pages", () => {
	it("exports the D01 route kinds and error reasons", () => {
		expect(ROUTE_KINDS).toEqual(["projects", "task", "resource", "ide", "settings", "devices"]);
		expect(ROUTE_ERROR_REASONS).toEqual(["missing", "deleted", "revoked", "unknown"]);
	});

	it("uses a gone title, Projects, and no substitute for a missing or deleted task", () => {
		for (const reason of ["missing", "deleted"] as const) {
			const page = routeErrorPage({ kind: "task", reason, id: "task-gone" });
			expect(page.title).toBe("This task is gone");
			expect(page.primary).toBe("projects");
			expect(page.primaryLabel).toBe("Projects");
			expect(page.body).toContain("Caret will not open a different task");
			expect(page.body).toContain("task-gone");
			expect(page.body.toLowerCase()).not.toMatch(/nearby task|open task-2|instead of/);
		}
	});

	it("keeps revoked devices on Back and does not auto-pair", () => {
		const page = routeErrorPage({ kind: "devices", reason: "revoked", id: "phone-1" });
		expect(page.primary).toBe("back");
		expect(page.primaryLabel).toBe("Back");
		expect(page.title.toLowerCase()).toContain("revoked");
		expect(page.body.toLowerCase()).toContain("will not auto-pair");
		expect(page.primaryLabel.toLowerCase()).not.toContain("pair");
		expect(page.primary).not.toBe("projects");
	});

	it("is honest about an unknown route and offers Back", () => {
		const page = routeErrorPage({ kind: "task", reason: "unknown", id: "task-??" });
		expect(page.title.toLowerCase()).toContain("unknown");
		expect(page.body.toLowerCase()).toContain("does not know");
		expect(page.body.toLowerCase()).toContain("will not guess");
		expect(page.primary).toBe("back");
		expect(page.primaryLabel).toBe("Back");
	});

	it("never picks a nearby task as a substitute for any kind or reason", () => {
		for (const kind of ROUTE_KINDS) {
			for (const reason of ROUTE_ERROR_REASONS) {
				const page = routeErrorPage({ kind, reason, id: "wanted-id" });
				expect(page).toEqual({
					title: page.title,
					body: page.body,
					primary: page.primary,
					primaryLabel: page.primaryLabel,
				});
				expect(page).not.toHaveProperty("sessionId");
				expect(page).not.toHaveProperty("substitute");
				expect(page.body.toLowerCase()).not.toContain("opening task-2");
				expect(page.primary === "back" || page.primary === "projects").toBe(true);
			}
		}
	});
});

describe("D01 validateRoute", () => {
	it("accepts a task whose session belongs to the requested project", () => {
		expect(validateRoute({ kind: "task", projectId: "proj-1", sessionId: "task-1" }, available())).toEqual({ ok: true });
	});

	it("rejects a missing task even when another session exists in the same project", () => {
		const result = validateRoute({ kind: "task", projectId: "proj-1", sessionId: "task-gone" }, available());
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.title).toBe("This task is gone");
		expect(result.error.primary).toBe("projects");
		expect(result.error.body).toContain("Caret will not open a different task");
		expect(result.error.body).toContain("task-gone");
	});

	it("rejects a session that does not belong to the requested project", () => {
		const result = validateRoute({ kind: "task", projectId: "proj-1", sessionId: "task-other" }, available());
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.title).toBe("This task is gone");
		expect(result.error.primary).toBe("projects");
		expect(result.error.body).toContain("Caret will not open a different task");
	});

	it("rejects a missing project without falling back to another project", () => {
		const result = validateRoute({ kind: "projects", projectId: "proj-missing" }, available());
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.title).toBe("This project is gone");
		expect(result.error.primary).toBe("back");
		expect(result.error.body).toContain("proj-missing");
	});

	it("rejects a missing resource and does not open a sibling resource", () => {
		const result = validateRoute(
			{ kind: "resource", projectId: "proj-1", sessionId: "task-1", resourceId: "res-gone" },
			available(),
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.title).toBe("This resource is gone");
		expect(result.error.primary).toBe("back");
		expect(result.error.body).not.toContain("res-2");
	});

	it("rejects a resource that belongs to a different session", () => {
		const result = validateRoute(
			{ kind: "resource", projectId: "proj-1", sessionId: "task-1", resourceId: "res-2" },
			available(),
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.title).toBe("This resource is gone");
	});

	it("surfaces catalog tombstones as deleted or revoked without substituting", () => {
		const sessions: RouteCatalogSession[] = [
			{ id: "task-1", projectId: "proj-1" },
			{ id: "task-dead", projectId: "proj-1", reason: "deleted" },
			{ id: "task-revoked", projectId: "proj-1", reason: "revoked" },
		];
		const catalog = available({ sessions });
		const deleted = validateRoute({ kind: "task", projectId: "proj-1", sessionId: "task-dead" }, catalog);
		expect(deleted.ok).toBe(false);
		if (!deleted.ok) {
			expect(deleted.error.title).toBe("This task is gone");
			expect(deleted.error.body).toContain("was deleted");
			expect(deleted.error.primary).toBe("projects");
		}
		const revoked = validateRoute({ kind: "task", projectId: "proj-1", sessionId: "task-revoked" }, catalog);
		expect(revoked.ok).toBe(false);
		if (!revoked.ok) {
			expect(revoked.error.title).toBe("This task is gone");
			expect(revoked.error.body).toContain("revoked");
			expect(revoked.error.primary).toBe("projects");
		}
	});

	it("accepts ide and settings routes that do not require a missing id", () => {
		expect(validateRoute({ kind: "ide", projectId: "proj-1", sessionId: "task-1" }, available())).toEqual({ ok: true });
		expect(validateRoute({ kind: "settings" }, available())).toEqual({ ok: true });
		expect(validateRoute({ kind: "devices" }, available())).toEqual({ ok: true });
		expect(validateRoute({ kind: "projects" }, available())).toEqual({ ok: true });
	});

	it("rejects a missing IDE workspace without opening another project", () => {
		const result = validateRoute({ kind: "ide", projectId: "proj-missing" }, available());
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.title).toBe("This IDE workspace is gone");
		expect(result.error.primary).toBe("back");
	});

	it("builds availability without treating archived as deleted", () => {
		const catalog = availabilityFromLists({
			projects: [{ id: "proj-1" }],
			sessions: [
				{ id: "open", projectId: "proj-1" },
				{ id: "archived", projectId: "proj-1", archived: true },
				{ id: "revoked", projectId: "proj-1", revoked: true },
			],
		});
		expect(catalog.sessions.find((item) => item.id === "archived")?.reason).toBeUndefined();
		expect(catalog.sessions.find((item) => item.id === "revoked")?.reason).toBe("revoked");
		expect(validateRoute({ kind: "task", sessionId: "archived" }, catalog)).toEqual({ ok: true });
		const revoked = validateRoute({ kind: "task", sessionId: "revoked" }, catalog);
		expect(revoked.ok).toBe(false);
		if (!revoked.ok) expect(revoked.error.primary).toBe("projects");
	});

	it("treats blank ids as absent and does not invent a session", () => {
		expect(validateRoute({ kind: "task", projectId: "proj-1", sessionId: "  " }, available())).toEqual({ ok: true });
	});

	it("keeps every failed validation on Back or Projects", () => {
		const kinds: RouteKind[] = ["projects", "task", "resource", "ide"];
		for (const kind of kinds) {
			const result = validateRoute({ kind, projectId: "nope", sessionId: "nope", resourceId: "nope" }, available());
			expect(result.ok).toBe(false);
			if (result.ok) continue;
			expect(["back", "projects"]).toContain(result.error.primary);
			expect(result.error).not.toHaveProperty("substitute");
		}
	});
});
