// Plan store conformance (parity §6): machine, revisioning, build
// binding. Pure sync.
import { describe, expect, it } from "vitest";

import {
  createPlan,
  revisePlan,
  setPlanState,
  setTaskDone,
  markPlanBuilt,
  canPlanTransition,
  applyPlanEvent,
} from "./plan.ts";

describe("PlanStore", () => {
  it("walks research to building and blocks jumps", () => {
    expect(canPlanTransition("researching", "askingQuestions")).toBe(true);
    expect(canPlanTransition("askingQuestions", "drafting")).toBe(true);
    expect(canPlanTransition("drafting", "readyForReview")).toBe(true);
    expect(canPlanTransition("readyForReview", "building")).toBe(true);
    expect(canPlanTransition("researching", "building")).toBe(false);
    expect(canPlanTransition("building", "editing")).toBe(false);
    expect(canPlanTransition("superseded", "drafting")).toBe(false);
    expect(() => setPlanState(createPlan("p", "t"), "building")).toThrow(/cannot go/);
  });

  it("revisions reset build binding and track tasks", () => {
    let plan = createPlan("p1", "ship it");
    expect(plan.revision).toBe(1);
    plan = revisePlan(plan, { body: "# plan", tasks: [{ title: "a" }, { title: "b", done: true }] });
    expect(plan.revision).toBe(2);
    expect(plan.tasks).toHaveLength(2);
    plan = setPlanState(plan, "drafting");
    plan = setPlanState(plan, "readyForReview");
    plan = markPlanBuilt(plan, "run-9");
    expect(plan.builtRunId).toBe("run-9");
    expect(plan.state).toBe("building");
    // Next edit supersedes the binding (never builds a stale revision).
    plan = revisePlan(plan, { body: "# plan v2" });
    expect(plan.revision).toBe(3);
    expect(plan.builtRunId).toBeNull();
    const done = setTaskDone(plan, plan.tasks[0]?.id ?? "", true);
    expect(done.tasks.filter((t) => t.done)).toHaveLength(2);
    expect(() => setTaskDone(plan, "task-999", true)).toThrow(/unknown task/);
    expect(() => markPlanBuilt(plan, "")).toThrow(/runId/);
  });

  it("applies explicit todo events and ignores turn.completed", () => {
    let plan = createPlan("p", "work");
    plan = applyPlanEvent(plan, "todo.updated", {
      tasks: [{ title: "write file", status: "pending" }, { title: "run tests", status: "completed" }],
    });
    expect(plan.tasks.map((t) => [t.title, t.done])).toEqual([
      ["write file", false],
      ["run tests", true],
    ]);
    const before = plan;
    plan = applyPlanEvent(plan, "turn.completed", { state: "completed" });
    expect(plan.tasks).toEqual(before.tasks);
    plan = applyPlanEvent(plan, "todo.updated", { id: plan.tasks[0]?.id, done: true });
    expect(plan.tasks[0]?.done).toBe(true);
  });
});
