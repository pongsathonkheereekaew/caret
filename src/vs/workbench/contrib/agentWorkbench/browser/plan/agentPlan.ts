/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Workbench mirror of daemon `apps/caret-daemon/src/plan.ts` (the SSOT).
// States are string unions (not const enums) so the transition table below
// stays a verbatim copy — behavior changes happen daemon-side, never here;
// on any conflict the daemon wins (see docs/ARCH-CONTRACTS.md, mirrored
// vocabularies). This file carries no mutators: the shell renders plan
// state, it never advances it.

export type AgentPlanState =
	| 'researching'
	| 'askingQuestions'
	| 'drafting'
	| 'readyForReview'
	| 'editing'
	| 'building'
	| 'superseded'
	| 'failed';

export interface IPlanTask {
	readonly id: string;
	readonly title: string;
	readonly done: boolean;
}

export interface IPlanDocument {
	readonly id: string;
	readonly revision: number;
	readonly title: string;
	readonly state: AgentPlanState;
	readonly body: string;
	readonly tasks: ReadonlyArray<IPlanTask>;
	/** Run this exact revision was handed to. Daemon `revisePlan` resets it
	 * to null on every edit (never builds stale); `markPlanBuilt` sets it. */
	readonly builtRunId: string | null;
}

const PLAN_TRANSITIONS: Record<AgentPlanState, ReadonlyArray<AgentPlanState>> = {
	researching: ['askingQuestions', 'drafting', 'failed'],
	askingQuestions: ['askingQuestions', 'drafting', 'failed'],
	drafting: ['readyForReview', 'failed'],
	readyForReview: ['editing', 'building', 'failed'],
	editing: ['readyForReview', 'building', 'failed'],
	building: ['superseded', 'failed'],
	superseded: [],
	failed: ['drafting'],
};

/** Read-only gate for rendering (e.g. which plan buttons to enable). */
export const canPlanTransition = (from: AgentPlanState, to: AgentPlanState): boolean =>
	PLAN_TRANSITIONS[from]?.includes(to) ?? false;
