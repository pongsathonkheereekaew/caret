/** Project plan/goal/subagent rows from advertised OMP state (S06).
 * Does not treat idle as goal complete and does not invent a plan owner. */

export type PlanStepStatus = "pending" | "in_progress" | "completed" | "failed" | "unknown";
export type GoalStatus = "active" | "completed" | "blocked";

export interface PlanStep {
	readonly id: string;
	readonly label: string;
	readonly status: PlanStepStatus;
}

export interface GoalRow {
	readonly id: string;
	readonly label: string;
	readonly status: GoalStatus;
	readonly budget?: string;
}

export interface SubagentRow {
	readonly id: string;
	readonly label: string;
	readonly status: string;
	readonly parentId?: string;
}

export interface SubagentNode extends SubagentRow {
	readonly children: readonly SubagentNode[];
	readonly depth: number;
}

export interface PlanProjection {
	readonly advertised: boolean;
	readonly steps: readonly PlanStep[];
	readonly goals: readonly GoalRow[];
	readonly subagents: readonly SubagentRow[];
	readonly reason: string;
}

export interface PlanSourceCommand {
	readonly commandId: string;
	readonly command: string;
	readonly status: string;
}

export interface PlanSourceTool {
	readonly id: string;
	readonly toolName?: string;
	readonly toolStatus?: string;
}

export const PLAN_NOT_ADVERTISED = "OMP has not advertised a plan for this task.";
export const PLAN_RETRY_REASON = "OMP has not advertised plan step retry. Caret will not invent a retry owner.";
export const PLAN_CANCEL_REASON = "OMP has not advertised subagent cancel. Caret will not stop a child run from this strip.";
export const PLAN_REORDER_REASON = "OMP has not advertised plan reorder.";

export function emptyPlan(reason = PLAN_NOT_ADVERTISED): PlanProjection {
	return { advertised: false, steps: [], goals: [], subagents: [], reason };
}

export function planFromOmpState(data: Record<string, unknown> | undefined): PlanProjection {
	if (!data) return emptyPlan();
	const steps = asPlanSteps(data.planSteps ?? data.plan_steps ?? data.steps ?? nested(data.plan, "steps") ?? data.plan);
	const goals = asGoalRows(data.goals ?? nested(data.plan, "goals"));
	const subagents = asSubagentRows(data.subagents ?? data.sub_agents ?? nested(data.plan, "subagents"));
	if (!steps.length && !goals.length && !subagents.length) return emptyPlan();
	return { advertised: true, steps, goals, subagents, reason: "" };
}

function nested(value: unknown, key: string): unknown {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	return (value as Record<string, unknown>)[key];
}

function asPlanSteps(value: unknown): PlanStep[] {
	if (!Array.isArray(value)) return [];
	const steps: PlanStep[] = [];
	for (const item of value) {
		if (!item || typeof item !== "object" || Array.isArray(item)) continue;
		const record = item as Record<string, unknown>;
		const id = typeof record.id === "string" ? record.id.trim() : "";
		const label = typeof record.label === "string" ? record.label.trim() : typeof record.title === "string" ? record.title.trim() : typeof record.name === "string" ? record.name.trim() : "";
		if (!id && !label) continue;
		steps.push({
			id: id || label,
			label: label || id,
			status: goalStepStatus(typeof record.status === "string" ? record.status : "unknown"),
		});
	}
	return steps;
}

function asGoalRows(value: unknown): GoalRow[] {
	if (!Array.isArray(value)) return [];
	const goals: GoalRow[] = [];
	for (const item of value) {
		if (!item || typeof item !== "object" || Array.isArray(item)) continue;
		const record = item as Record<string, unknown>;
		const id = typeof record.id === "string" ? record.id.trim() : "";
		const label = typeof record.label === "string" ? record.label.trim() : typeof record.title === "string" ? record.title.trim() : "";
		if (!id && !label) continue;
		const budget = typeof record.budget === "string" ? record.budget.trim() : "";
		goals.push({
			id: id || label,
			label: label || id,
			status: record.status === "completed" || record.status === "blocked" ? record.status : "active",
			...(budget ? { budget } : {}),
		});
	}
	return goals;
}

export function buildSubagentTree(rows: readonly SubagentRow[]): SubagentNode[] {
	const byId = new Map<string, SubagentRow>();
	for (const row of rows) byId.set(row.id, row);
	const children = new Map<string, SubagentRow[]>();
	const roots: SubagentRow[] = [];
	for (const row of rows) {
		if (row.parentId && byId.has(row.parentId) && row.parentId !== row.id) {
			const list = children.get(row.parentId) ?? [];
			list.push(row);
			children.set(row.parentId, list);
		} else {
			roots.push(row);
		}
	}
	const walk = (row: SubagentRow, depth: number): SubagentNode => ({
		...row,
		depth,
		children: (children.get(row.id) ?? []).map(child => walk(child, depth + 1)),
	});
	return roots.map(row => walk(row, 0));
}

function asSubagentRows(value: unknown): SubagentRow[] {
	if (!Array.isArray(value)) return [];
	const rows: SubagentRow[] = [];
	for (const item of value) {
		if (!item || typeof item !== "object" || Array.isArray(item)) continue;
		const record = item as Record<string, unknown>;
		const id = typeof record.id === "string" ? record.id.trim() : "";
		const label = typeof record.label === "string" ? record.label.trim() : typeof record.title === "string" ? record.title.trim() : typeof record.name === "string" ? record.name.trim() : "";
		if (!id && !label) continue;
		const parentId = typeof record.parentId === "string" ? record.parentId : typeof record.parent_id === "string" ? record.parent_id : undefined;
		rows.push({
			id: id || label,
			label: label || id,
			status: typeof record.status === "string" && record.status.trim() ? record.status.trim() : "unknown",
			...(parentId ? { parentId } : {}),
		});
	}
	return rows;
}

function goalStepStatus(status: string): PlanStepStatus {
	if (status === "pending" || status === "queued" || status === "not_dispatched") return "pending";
	if (status === "in_progress" || status === "running" || status === "sent") return "in_progress";
	if (status === "completed") return "completed";
	if (status === "failed" || status === "cancelled") return "failed";
	return "unknown";
}

export function projectPlan(input: {
	readonly pendingCommands?: Readonly<Record<string, PlanSourceCommand>>;
	readonly tools?: readonly PlanSourceTool[];
	readonly goals?: readonly GoalRow[];
	readonly subagents?: readonly SubagentRow[];
}): PlanProjection {
	const steps: PlanStep[] = [];
	for (const command of Object.values(input.pendingCommands ?? {})) {
		if (!command?.commandId) continue;
		steps.push({
			id: command.commandId,
			label: command.command || "queued",
			status: stepStatus(command.status),
		});
	}
	for (const tool of input.tools ?? []) {
		if (!tool?.id) continue;
		steps.push({
			id: tool.id,
			label: tool.toolName || "tool",
			status: tool.toolStatus === "running" ? "in_progress" : stepStatus(tool.toolStatus ?? "unknown"),
		});
	}
	const goals = [...(input.goals ?? [])];
	const subagents = [...(input.subagents ?? [])];
	if (!steps.length && !goals.length && !subagents.length) return emptyPlan();
	return {
		advertised: true,
		steps,
		goals,
		subagents,
		reason: "",
	};
}

function stepStatus(status: string): PlanStepStatus {
	if (status === "queued" || status === "not_dispatched") return "pending";
	if (status === "sent" || status === "running") return "in_progress";
	if (status === "completed") return "completed";
	if (status === "failed" || status === "cancelled") return "failed";
	return "unknown";
}
