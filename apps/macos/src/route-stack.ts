/** D01 route history. Restores view identity only — never undoes or replays OMP effects. */

export const ROUTE_STACK_CAP = 32;

export type RouteFrameKind = "projects" | "task" | "settings" | "ide" | "resource";

export interface RouteFrame {
	readonly kind: RouteFrameKind;
	readonly projectId?: string | null;
	readonly sessionId?: string | null;
	readonly scrollKey?: string;
	readonly offset?: number;
	readonly section?: string;
}

export interface RouteHistory {
	readonly frames: readonly RouteFrame[];
	readonly index: number;
}

export function emptyRouteHistory(): RouteHistory {
	return { frames: [], index: -1 };
}

export function sameRoute(left: RouteFrame | undefined, right: RouteFrame | undefined): boolean {
	if (!left || !right) return false;
	return left.kind === right.kind
		&& (left.projectId ?? null) === (right.projectId ?? null)
		&& (left.sessionId ?? null) === (right.sessionId ?? null)
		&& (left.section ?? "") === (right.section ?? "");
}

export function rememberRoute(history: RouteHistory, frame: RouteFrame): RouteHistory {
	const current = history.frames[history.index];
	if (sameRoute(current, frame)) return history;
	const kept = history.frames.slice(0, history.index + 1);
	const frames = [...kept, frame].slice(-ROUTE_STACK_CAP);
	return { frames, index: frames.length - 1 };
}

export function routeBack(history: RouteHistory): { readonly history: RouteHistory; readonly frame?: RouteFrame } {
	if (history.index <= 0) return { history };
	const index = history.index - 1;
	return { history: { frames: history.frames, index }, frame: history.frames[index] };
}

export function routeForward(history: RouteHistory): { readonly history: RouteHistory; readonly frame?: RouteFrame } {
	if (history.index < 0 || history.index >= history.frames.length - 1) return { history };
	const index = history.index + 1;
	return { history: { frames: history.frames, index }, frame: history.frames[index] };
}

export function currentRoute(history: RouteHistory): RouteFrame | undefined {
	if (history.index < 0) return undefined;
	return history.frames[history.index];
}

export function canRouteBack(history: RouteHistory): boolean {
	return history.index > 0;
}

export function canRouteForward(history: RouteHistory): boolean {
	return history.index >= 0 && history.index < history.frames.length - 1;
}
