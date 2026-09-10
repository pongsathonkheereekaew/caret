/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Workbench mirror of daemon `apps/caret-daemon/src/review.ts` (the SSOT).
// States are string unions (not const enums) so the transition table below
// stays a verbatim copy — behavior changes happen daemon-side, never here;
// on any conflict the daemon wins (see docs/ARCH-CONTRACTS.md, mirrored
// vocabularies). This file carries no mutators: the shell renders review
// state, it never advances it.

export type AgentReviewState =
	| 'noChanges'
	| 'changesAvailable'
	| 'reviewQueued'
	| 'reviewRunning'
	| 'findingsAvailable'
	| 'approved'
	| 'committed'
	| 'pullRequestOpened'
	| 'merged'
	| 'failed';

export type ReviewFindingSeverity = 'info' | 'warning' | 'error';
export type ReviewFindingStatus = 'open' | 'dismissed' | 'fixed';

export interface IReviewFinding {
	readonly id: string;
	readonly file: string;
	readonly line: number | null;
	readonly severity: ReviewFindingSeverity;
	readonly message: string;
	readonly status: ReviewFindingStatus;
}

export interface IAgentReview {
	readonly id: string;
	readonly threadId: string;
	readonly state: AgentReviewState;
	readonly findings: ReadonlyArray<IReviewFinding>;
}

const REVIEW_TRANSITIONS: Record<AgentReviewState, ReadonlyArray<AgentReviewState>> = {
	noChanges: ['changesAvailable', 'failed'],
	changesAvailable: ['reviewQueued', 'approved', 'committed', 'failed'],
	reviewQueued: ['reviewRunning', 'failed'],
	reviewRunning: ['findingsAvailable', 'approved', 'failed'],
	findingsAvailable: ['approved', 'reviewQueued', 'failed'],
	approved: ['committed', 'reviewQueued'],
	committed: ['pullRequestOpened', 'changesAvailable'],
	pullRequestOpened: ['merged', 'failed'],
	merged: [],
	failed: ['reviewQueued'],
};

/** Read-only gate for rendering (e.g. which review buttons to enable). */
export const canReviewTransition = (from: AgentReviewState, to: AgentReviewState): boolean =>
	REVIEW_TRANSITIONS[from]?.includes(to) ?? false;
