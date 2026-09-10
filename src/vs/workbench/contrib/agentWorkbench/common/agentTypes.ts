/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Caret agent session vocabulary. Daemon `session-state.ts` is the source
// of truth for runtime behavior; these types mirror it for workbench code
// (single-owner rule: the daemon owns transitions, the shell renders).

export const enum AgentSessionStatus {
	Draft = 'draft',
	Queued = 'queued',
	Starting = 'starting',
	Running = 'running',
	WaitingForUser = 'waitingForUser',
	WaitingForApproval = 'waitingForApproval',
	Steering = 'steering',
	Reviewing = 'reviewing',
	Completed = 'completed',
	Failed = 'failed',
	Cancelled = 'cancelled'
}

export const enum AgentRuntimeKind {
	Local = 'local',
	Cloud = 'cloud',
	Ssh = 'ssh',
	SelfHosted = 'selfHosted'
}

/** Local-only build: cloud/ssh/selfHosted render disabled-with-reason. */
export const AVAILABLE_RUNTIME_KINDS: ReadonlyArray<AgentRuntimeKind> = [AgentRuntimeKind.Local];

export interface IAgentSession {
	readonly id: string;
	readonly projectId: string;
	readonly workspaceId: string;
	readonly worktreeId?: string;
	readonly title: string;
	readonly status: AgentSessionStatus;
	readonly runtime: AgentRuntimeKind;
	readonly modelId: string;
	readonly modeId: string;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly queuedPromptIds: string[];
}

export const enum WorkbenchShell {
	Ide = 'ide',
	Agents = 'agents'
}
