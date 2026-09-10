// Caret plan store (parity §6 data half): revisioned plan documents with
// task checklist + Build linkage to the exact plan revision (never
// pasted text). Pure — no I/O, no model. Research/questions UI and the
// Build executor ride later tracks; the revision binding is the contract.
export type PlanState =
  | "researching"
  | "askingQuestions"
  | "drafting"
  | "readyForReview"
  | "editing"
  | "building"
  | "superseded"
  | "failed";

export interface PlanTask {
  readonly id: string;
  readonly title: string;
  readonly done: boolean;
}

export interface PlanDocument {
  readonly id: string;
  readonly revision: number;
  readonly title: string;
  readonly state: PlanState;
  readonly body: string;
  readonly tasks: ReadonlyArray<PlanTask>;
  /** runId this revision was handed to (set once at Build). */
  readonly builtRunId: string | null;
}

const PLAN_TRANSITIONS: Record<PlanState, ReadonlyArray<PlanState>> = {
  researching: ["askingQuestions", "drafting", "failed"],
  askingQuestions: ["askingQuestions", "drafting", "failed"],
  drafting: ["readyForReview", "failed"],
  readyForReview: ["editing", "building", "failed"],
  editing: ["readyForReview", "building", "failed"],
  building: ["superseded", "failed"],
  superseded: [],
  failed: ["drafting"],
};

export const canPlanTransition = (from: PlanState, to: PlanState): boolean =>
  PLAN_TRANSITIONS[from]?.includes(to) ?? false;

let taskSerial = 0;

export const createPlan = (id: string, title: string): PlanDocument => ({
  id,
  revision: 1,
  title,
  state: "researching",
  body: "",
  tasks: [],
  builtRunId: null,
});

/** Edit body/tasks: bumps revision (history = prior revisions, kept by caller). */
export const revisePlan = (
  plan: PlanDocument,
  edit: { title?: string; body?: string; tasks?: ReadonlyArray<{ title: string; done?: boolean }> },
): PlanDocument => ({
  ...plan,
  revision: plan.revision + 1,
  title: edit.title ?? plan.title,
  body: edit.body ?? plan.body,
  tasks: edit.tasks
    ? edit.tasks.map((task) => {
        taskSerial += 1;
        return { id: `task-${taskSerial}`, title: task.title, done: task.done ?? false };
      })
    : plan.tasks,
  builtRunId: null,
});

export const setPlanState = (plan: PlanDocument, state: PlanState): PlanDocument => {
  if (!canPlanTransition(plan.state, state)) {
    throw new Error(`plan cannot go ${plan.state} → ${state}`);
  }
  return { ...plan, state };
};

export const setTaskDone = (plan: PlanDocument, taskId: string, done: boolean): PlanDocument => {
  let seen = false;
  const tasks = plan.tasks.map((task) => {
    if (task.id !== taskId) return task;
    seen = true;
    return { ...task, done };
  });
  if (!seen) throw new Error(`unknown task ${taskId}`);
  return { ...plan, tasks };
};

/** Bind this exact revision to a run. One-way: a built plan supersedes on next edit. */
export const markPlanBuilt = (plan: PlanDocument, runId: string): PlanDocument => {
  if (!runId) throw new Error("build needs a runId");
  const building = setPlanState(plan, "building");
  return { ...building, builtRunId: runId };
};
