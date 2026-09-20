import { describe, expect, it } from "bun:test";
import { buildSubagentTree, emptyPlan, PLAN_CANCEL_REASON, PLAN_RETRY_REASON, planFromOmpState, projectPlan } from "../src/plan-projection.ts";

describe("projectPlan", () => {
	it("stays empty until OMP advertises work", () => {
		expect(projectPlan({})).toEqual(emptyPlan());
		expect(projectPlan({ pendingCommands: {}, tools: [] }).advertised).toBe(false);
	});

	it("projects queued commands and running tools without treating idle as complete", () => {
		const plan = projectPlan({
			pendingCommands: {
				a: { commandId: "a", command: "follow_up", status: "queued" },
			},
			tools: [{ id: "t1", toolName: "edit", toolStatus: "running" }],
			goals: [{ id: "g1", label: "Ship settings", status: "active" }],
		});
		expect(plan.advertised).toBe(true);
		expect(plan.steps).toEqual([
			{ id: "a", label: "follow_up", status: "pending" },
			{ id: "t1", label: "edit", status: "in_progress" },
		]);
		expect(plan.goals).toEqual([{ id: "g1", label: "Ship settings", status: "active" }]);
	});
});

describe("planFromOmpState", () => {
	it("stays hidden until OMP advertises goals or steps", () => {
		expect(planFromOmpState(undefined)).toEqual(emptyPlan());
		expect(planFromOmpState({}).advertised).toBe(false);
	});

	it("projects advertised goals without inventing a plan owner", () => {
		const plan = planFromOmpState({
			goals: [{ id: "g1", label: "Ship settings", status: "active" }],
			steps: [{ id: "s1", label: "Review", status: "pending" }],
		});
		expect(plan.advertised).toBe(true);
		expect(plan.goals).toEqual([{ id: "g1", label: "Ship settings", status: "active" }]);
		expect(plan.steps).toEqual([{ id: "s1", label: "Review", status: "pending" }]);
	});
});

describe("buildSubagentTree", () => {
	it("nests children under an advertised parent and does not invent a root", () => {
		const tree = buildSubagentTree([
			{ id: "child", label: "Explore", status: "running", parentId: "root" },
			{ id: "root", label: "Parent", status: "running" },
			{ id: "orphan", label: "Missing parent", status: "unknown", parentId: "gone" },
		]);
		expect(tree.map(node => node.id)).toEqual(["root", "orphan"]);
		expect(tree[0]?.children).toEqual([{
			id: "child",
			label: "Explore",
			status: "running",
			parentId: "root",
			depth: 1,
			children: [],
		}]);
		expect(tree[1]?.depth).toBe(0);
	});
});

describe("plan action honesty", () => {
	it("keeps retry and cancel unavailable until OMP advertises them", () => {
		expect(PLAN_RETRY_REASON).toContain("will not invent a retry owner");
		expect(PLAN_CANCEL_REASON).toContain("will not stop a child run");
		expect(emptyPlan().advertised).toBe(false);
	});
});
