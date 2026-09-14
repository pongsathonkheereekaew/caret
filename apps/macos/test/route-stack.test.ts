import { describe, expect, it } from "bun:test";
import {
	canRouteBack,
	canRouteForward,
	emptyRouteHistory,
	rememberRoute,
	routeBack,
	routeForward,
	sameRoute,
} from "../src/route-stack.ts";

describe("route stack", () => {
	it("remembers task then projects and back restores the task without inventing a session", () => {
		const task = { kind: "task" as const, projectId: "p1", sessionId: "s1", scrollKey: "p1/s1/v", offset: 80 };
		const projects = { kind: "projects" as const };
		let history = rememberRoute(emptyRouteHistory(), task);
		history = rememberRoute(history, projects);
		expect(canRouteBack(history)).toBe(true);
		expect(canRouteForward(history)).toBe(false);
		const back = routeBack(history);
		expect(back.frame).toEqual(task);
		expect(sameRoute(back.frame, { kind: "task", projectId: "p1", sessionId: "s1" })).toBe(true);
		expect(JSON.stringify(back.frame)).not.toMatch(/sess-/);
		const again = routeBack(back.history);
		expect(again.frame).toBeUndefined();
		const forward = routeForward(back.history);
		expect(forward.frame).toEqual(projects);
	});

	it("does not push a duplicate consecutive route", () => {
		const task = { kind: "task" as const, sessionId: "s1" };
		const once = rememberRoute(emptyRouteHistory(), task);
		expect(rememberRoute(once, { kind: "task", sessionId: "s1" })).toBe(once);
	});
});
