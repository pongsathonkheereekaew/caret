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

const asRecord = (payload: unknown): Record<string, unknown> =>
  payload !== null && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};

const explicitDone = (value: unknown): boolean | undefined => {
  if (value === true || value === false) return value;
  if (value === "completed" || value === "done") return true;
  if (value === "pending" || value === "in_progress" || value === "todo") return false;
  return undefined;
};

const taskFromUnknown = (item: unknown): { title: string; done: boolean } | null => {
  if (typeof item === "string") {
    const title = item.trim();
    return title.length > 0 ? { title, done: false } : null;
  }
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const title = String(o.title ?? o.text ?? o.content ?? "").trim();
  if (!title) return null;
  return { title, done: explicitDone(o.done) ?? explicitDone(o.status) ?? explicitDone(o.state) ?? false };
};

/**
 * Fold an engine event into the plan. Completion is taken only from
 * explicit task fields — never inferred from turn.completed / errors.
 */
const itemTitle = (payload: unknown): string => {
  if (typeof payload === "string") return payload.trim();
  const o = asRecord(payload);
  const raw = o.title ?? o.text ?? o.content ?? o.item ?? o.name;
  return typeof raw === "string" ? raw.trim() : "";
};

const upsertByTitle = (plan: PlanDocument, title: string, done: boolean): PlanDocument => {
  const existing = plan.tasks.find((t) => t.title === title);
  if (existing) {
    if (existing.done === done) return plan;
    return setTaskDone(plan, existing.id, done);
  }
  return revisePlan(plan, {
    tasks: [...plan.tasks.map((t) => ({ title: t.title, done: t.done })), { title, done }],
  });
};

export const applyPlanEvent = (plan: PlanDocument, type: string, payload: unknown): PlanDocument => {
  if (typeof type !== "string" || type.length === 0) return plan;
  if (/turn\.(completed|failed)|request\.(opened|resolved)/i.test(type)) return plan;
  const item = /^item\.(started|completed|completed|failed)$/i.exec(type);
  if (item) {
    const title = itemTitle(payload);
    if (!title || title.startsWith("{") || title.length > 80) return plan;
    if (item[1]?.toLowerCase() === "failed") return plan;
    const done = /complet/i.test(item[1] ?? "");
    return upsertByTitle(plan, title, done);
  }
  if (!/todo|plan\.task|plan\.updated|item_todo/i.test(type)) return plan;
  const body = asRecord(payload);
  const list = body.tasks ?? body.items ?? body.todos;
  if (Array.isArray(list)) {
    const tasks = list.map(taskFromUnknown).filter((t): t is { title: string; done: boolean } => t !== null);
    return revisePlan(plan, { tasks });
  }
  const taskId = typeof body.taskId === "string" ? body.taskId : typeof body.id === "string" ? body.id : "";
  const done = explicitDone(body.done) ?? explicitDone(body.status);
  if (taskId && done !== undefined) {
    try {
      return setTaskDone(plan, taskId, done);
    } catch {
      return plan;
    }
  }
  const added = taskFromUnknown(payload);
  if (added) {
    return revisePlan(plan, { tasks: [...plan.tasks.map((t) => ({ title: t.title, done: t.done })), added] });
  }
  return plan;
};
