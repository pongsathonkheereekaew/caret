/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Engine event names flowing daemon -> shell. Only EMITTED events (see
// daemon session-state.ts EMITTED_EVENTS) arrive today; the rest are the
// reserved vocabulary for later tracks. Unknown names render as info rows,
// never crash.
export const enum AgentEngineEvent {
	DaemonReady = 'daemon.ready',
	RemoteReady = 'remote.ready',
	ApprovalRequested = 'approval.requested',
	RunIsolated = 'caret.run.isolated',
	RunSetup = 'caret.run.setup',
	TurnSteered = 'turn.steered'
}

export type AgentTimelineKind = 'start' | 'done' | 'failed' | 'info';

export function engineRowKind(type: string): AgentTimelineKind {
	if (/fail|error/i.test(type)) {
		return 'failed';
	}
	if (/complet|done|resolved|restored/i.test(type)) {
		return 'done';
	}
	if (/start|opened|created|running|progress/i.test(type)) {
		return 'start';
	}
	return 'info';
}

/** Deltas flood — states inform. Mirrors shouldForwardEngineEvent. */
export function shouldForwardEngineEvent(type: unknown): boolean {
	if (typeof type !== 'string' || type.length === 0) {
		return false;
	}
	if (type === 'request.opened') {
		return false;
	}
	return !type.toLowerCase().includes('delta');
}
