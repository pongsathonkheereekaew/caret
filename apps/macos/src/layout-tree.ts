/** D01 Agents pane layout tree. View geometry only — OMP stays the session owner. */

import { draftViewKey } from "./workbench-mode.ts";

export const PANE_MIN_HORIZONTAL_PX = 360;
export const PANE_MIN_VERTICAL_PX = 240;
export const NEED_MORE_SPACE_REASON = "Need more space. Maximize area or Open another window. Cedia will not squeeze this pane.";

export type SplitDirection = "right" | "down";
export type MoveDirection = "left" | "right" | "up" | "down";

export interface LayoutLeaf {
	readonly type: "leaf";
	readonly viewId: string;
	readonly projectId: string | null;
	readonly sessionId: string | null;
	readonly draftViewId: string;
}

export interface LayoutSplit {
	readonly type: "split";
	readonly orientation: "row" | "column";
	readonly ratio: number;
	readonly children: readonly [LayoutNode, LayoutNode];
}

export type LayoutNode = LayoutLeaf | LayoutSplit;

export interface LayoutTree {
	readonly root: LayoutNode;
	readonly activeViewId: string;
	readonly maximizedViewId?: string;
}

export type LayoutIdFactory = () => { readonly viewId: string; readonly draftViewId: string };

const RATIO_MIN = 0.05;
const RATIO_MAX = 0.95;
const DEFAULT_SPLIT_RATIO = 0.5;

let fallbackIdCounter = 0;

function newId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	fallbackIdCounter += 1;
	return `view-${Date.now()}-${fallbackIdCounter}`;
}

function newIds(): { viewId: string; draftViewId: string } {
	return { viewId: newId(), draftViewId: newId() };
}

function normalizeNullableId(value: string | null | undefined): string | null {
	if (value == null) return null;
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

function collectLeaves(node: LayoutNode, into: LayoutLeaf[]): void {
	if (node.type === "leaf") {
		into.push(node);
		return;
	}
	collectLeaves(node.children[0], into);
	collectLeaves(node.children[1], into);
}

function findLeaf(node: LayoutNode, viewId: string): LayoutLeaf | undefined {
	if (node.type === "leaf") {
		return node.viewId === viewId ? node : undefined;
	}
	return findLeaf(node.children[0], viewId) ?? findLeaf(node.children[1], viewId);
}

function firstLeaf(node: LayoutNode): LayoutLeaf {
	return node.type === "leaf" ? node : firstLeaf(node.children[0]);
}

function replaceActiveLeaf(node: LayoutNode, viewId: string, next: LayoutNode): LayoutNode {
	if (node.type === "leaf") {
		return node.viewId === viewId ? next : node;
	}
	return {
		type: "split",
		orientation: node.orientation,
		ratio: node.ratio,
		children: [
			replaceActiveLeaf(node.children[0], viewId, next),
			replaceActiveLeaf(node.children[1], viewId, next),
		],
	};
}

function removeActiveLeaf(node: LayoutNode, viewId: string): { readonly node: LayoutNode; readonly neighborViewId: string } | undefined {
	if (node.type === "leaf") return undefined;
	const [first, second] = node.children;
	if (first.type === "leaf" && first.viewId === viewId) {
		return { node: second, neighborViewId: firstLeaf(second).viewId };
	}
	if (second.type === "leaf" && second.viewId === viewId) {
		return { node: first, neighborViewId: firstLeaf(first).viewId };
	}
	const left = removeActiveLeaf(first, viewId);
	if (left) {
		return {
			node: { type: "split", orientation: node.orientation, ratio: node.ratio, children: [left.node, second] },
			neighborViewId: left.neighborViewId,
		};
	}
	const right = removeActiveLeaf(second, viewId);
	if (right) {
		return {
			node: { type: "split", orientation: node.orientation, ratio: node.ratio, children: [first, right.node] },
			neighborViewId: right.neighborViewId,
		};
	}
	return undefined;
}

function orientationForMove(direction: MoveDirection): LayoutSplit["orientation"] | undefined {
	if (direction === "left" || direction === "right") return "row";
	if (direction === "up" || direction === "down") return "column";
	return undefined;
}

function swapTowardSibling(node: LayoutNode, viewId: string, direction: MoveDirection): LayoutNode | undefined {
	if (node.type === "leaf") return undefined;
	const expected = orientationForMove(direction);
	const [first, second] = node.children;
	if (first.type === "leaf" && first.viewId === viewId) {
		if (node.orientation !== expected) return undefined;
		if (direction === "right" || direction === "down") {
			return { type: "split", orientation: node.orientation, ratio: node.ratio, children: [second, first] };
		}
		return undefined;
	}
	if (second.type === "leaf" && second.viewId === viewId) {
		if (node.orientation !== expected) return undefined;
		if (direction === "left" || direction === "up") {
			return { type: "split", orientation: node.orientation, ratio: node.ratio, children: [second, first] };
		}
		return undefined;
	}
	const left = swapTowardSibling(first, viewId, direction);
	if (left) {
		return { type: "split", orientation: node.orientation, ratio: node.ratio, children: [left, second] };
	}
	const right = swapTowardSibling(second, viewId, direction);
	if (right) {
		return { type: "split", orientation: node.orientation, ratio: node.ratio, children: [first, right] };
	}
	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNullableId(value: unknown): string | null | undefined {
	if (value === null) return null;
	if (typeof value !== "string") return undefined;
	return normalizeNullableId(value);
}

function parseNode(value: unknown): LayoutNode | undefined {
	if (!isRecord(value) || typeof value.type !== "string") return undefined;
	if (value.type === "leaf") {
		if (typeof value.viewId !== "string" || value.viewId.length === 0) return undefined;
		if (typeof value.draftViewId !== "string" || value.draftViewId.length === 0) return undefined;
		if (!("projectId" in value) || !("sessionId" in value)) return undefined;
		const projectId = parseNullableId(value.projectId);
		const sessionId = parseNullableId(value.sessionId);
		if (projectId === undefined || sessionId === undefined) return undefined;
		return {
			type: "leaf",
			viewId: value.viewId,
			projectId,
			sessionId,
			draftViewId: value.draftViewId,
		};
	}
	if (value.type === "split") {
		if (value.orientation !== "row" && value.orientation !== "column") return undefined;
		if (typeof value.ratio !== "number" || !Number.isFinite(value.ratio) || value.ratio < RATIO_MIN || value.ratio > RATIO_MAX) {
			return undefined;
		}
		if (!Array.isArray(value.children) || value.children.length !== 2) return undefined;
		const first = parseNode(value.children[0]);
		const second = parseNode(value.children[1]);
		if (!first || !second) return undefined;
		return {
			type: "split",
			orientation: value.orientation,
			ratio: value.ratio,
			children: [first, second],
		};
	}
	return undefined;
}

function serializeNode(node: LayoutNode): unknown {
	if (node.type === "leaf") {
		return {
			type: "leaf",
			viewId: node.viewId,
			projectId: node.projectId,
			sessionId: node.sessionId,
			draftViewId: node.draftViewId,
		};
	}
	return {
		type: "split",
		orientation: node.orientation,
		ratio: node.ratio,
		children: [serializeNode(node.children[0]), serializeNode(node.children[1])],
	};
}

export function createLayoutTree(input?: {
	readonly projectId?: string | null;
	readonly sessionId?: string | null;
	readonly viewId?: string;
}): LayoutTree {
	const ids = newIds();
	const viewId = input?.viewId ?? ids.viewId;
	const leaf: LayoutLeaf = {
		type: "leaf",
		viewId,
		projectId: normalizeNullableId(input?.projectId),
		sessionId: normalizeNullableId(input?.sessionId),
		draftViewId: ids.draftViewId,
	};
	return { root: leaf, activeViewId: viewId };
}

export function layoutLeaves(tree: LayoutTree): readonly LayoutLeaf[] {
	const leaves: LayoutLeaf[] = [];
	collectLeaves(tree.root, leaves);
	return leaves;
}

export function activeLeaf(tree: LayoutTree): LayoutLeaf | undefined {
	return findLeaf(tree.root, tree.activeViewId);
}

export function canSplit(input: {
	readonly direction: SplitDirection;
	readonly availablePx: number;
	readonly paneCount?: number;
}): { readonly ok: true } | { readonly ok: false; readonly reason: typeof NEED_MORE_SPACE_REASON } {
	const min = input.direction === "right" ? PANE_MIN_HORIZONTAL_PX : PANE_MIN_VERTICAL_PX;
	const paneCount = input.paneCount ?? 1;
	if (Number.isFinite(input.availablePx) && input.availablePx >= min * (paneCount + 1)) {
		return { ok: true };
	}
	return { ok: false, reason: NEED_MORE_SPACE_REASON };
}

export function splitActive(
	tree: LayoutTree,
	direction: SplitDirection,
	availablePx: number,
	createIds?: LayoutIdFactory,
): LayoutTree {
	if (!canSplit({ direction, availablePx, paneCount: layoutLeaves(tree).length }).ok) return tree;
	const current = activeLeaf(tree);
	if (!current) return tree;
	const ids = createIds?.() ?? newIds();
	const nextLeaf: LayoutLeaf = {
		type: "leaf",
		viewId: ids.viewId,
		projectId: current.projectId,
		sessionId: current.sessionId,
		draftViewId: ids.draftViewId,
	};
	const split: LayoutSplit = {
		type: "split",
		orientation: direction === "right" ? "row" : "column",
		ratio: DEFAULT_SPLIT_RATIO,
		children: [current, nextLeaf],
	};
	return {
		root: replaceActiveLeaf(tree.root, current.viewId, split),
		activeViewId: nextLeaf.viewId,
		...(tree.maximizedViewId !== undefined ? { maximizedViewId: tree.maximizedViewId } : {}),
	};
}

export function closeActive(tree: LayoutTree): LayoutTree {
	const current = activeLeaf(tree);
	if (!current) return tree;
	if (tree.root.type === "leaf") {
		return createLayoutTree({ projectId: current.projectId, sessionId: null });
	}
	const removed = removeActiveLeaf(tree.root, current.viewId);
	if (!removed) return tree;
	return {
		root: removed.node,
		activeViewId: removed.neighborViewId,
		...(tree.maximizedViewId !== undefined && tree.maximizedViewId !== current.viewId
			? { maximizedViewId: tree.maximizedViewId }
			: {}),
	};
}

export function focusView(tree: LayoutTree, viewId: string): LayoutTree {
	if (!findLeaf(tree.root, viewId)) return tree;
	if (tree.activeViewId === viewId) return tree;
	return {
		root: tree.root,
		activeViewId: viewId,
		...(tree.maximizedViewId !== undefined ? { maximizedViewId: tree.maximizedViewId } : {}),
	};
}

export function moveActive(tree: LayoutTree, direction: MoveDirection): LayoutTree {
	const swapped = swapTowardSibling(tree.root, tree.activeViewId, direction);
	if (!swapped) return tree;
	return {
		root: swapped,
		activeViewId: tree.activeViewId,
		...(tree.maximizedViewId !== undefined ? { maximizedViewId: tree.maximizedViewId } : {}),
	};
}

export function assignActive(tree: LayoutTree, patch: {
	readonly projectId?: string | null;
	readonly sessionId?: string | null;
}): LayoutTree {
	const current = activeLeaf(tree);
	if (!current) return tree;
	const projectId = patch.projectId !== undefined ? normalizeNullableId(patch.projectId) : current.projectId;
	const sessionId = patch.sessionId !== undefined ? normalizeNullableId(patch.sessionId) : current.sessionId;
	if (projectId === current.projectId && sessionId === current.sessionId) return tree;
	const next: LayoutLeaf = { ...current, projectId, sessionId };
	return {
		root: replaceActiveLeaf(tree.root, current.viewId, next),
		activeViewId: tree.activeViewId,
		...(tree.maximizedViewId !== undefined ? { maximizedViewId: tree.maximizedViewId } : {}),
	};
}

export function maximizeActive(tree: LayoutTree): LayoutTree {
	if (!activeLeaf(tree)) return tree;
	if (tree.maximizedViewId === tree.activeViewId) return tree;
	return { root: tree.root, activeViewId: tree.activeViewId, maximizedViewId: tree.activeViewId };
}

export function restoreLayout(tree: LayoutTree): LayoutTree {
	if (tree.maximizedViewId === undefined) return tree;
	return { root: tree.root, activeViewId: tree.activeViewId };
}

export function paneDraftKey(leaf: LayoutLeaf): string {
	return `${draftViewKey(leaf.projectId, leaf.sessionId)}/${leaf.draftViewId}`;
}

export type OpenSplitResult =
	| { readonly ok: true; readonly tree: LayoutTree }
	| { readonly ok: false; readonly reason: typeof NEED_MORE_SPACE_REASON };

/** Open a session in a new leaf. Same OMP sessionId is allowed; this does not mint an owner. */
export function openSessionInSplit(
	tree: LayoutTree,
	input: {
		readonly sessionId: string;
		readonly availablePx: number;
		readonly projectId?: string | null;
	},
	createIds?: LayoutIdFactory,
): OpenSplitResult {
	const room = canSplit({
		direction: "right",
		availablePx: input.availablePx,
		paneCount: layoutLeaves(tree).length,
	});
	if (!room.ok) return room;
	const split = splitActive(tree, "right", input.availablePx, createIds);
	return {
		ok: true,
		tree: assignActive(split, {
			sessionId: input.sessionId,
			...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
		}),
	};
}

export function serializeLayout(tree: LayoutTree): unknown {
	return {
		root: serializeNode(tree.root),
		activeViewId: tree.activeViewId,
		...(tree.maximizedViewId !== undefined ? { maximizedViewId: tree.maximizedViewId } : {}),
	};
}

export function parseLayout(value: unknown): LayoutTree | undefined {
	if (!isRecord(value) || typeof value.activeViewId !== "string" || value.activeViewId.length === 0) {
		return undefined;
	}
	const root = parseNode(value.root);
	if (!root) return undefined;
	if (!findLeaf(root, value.activeViewId)) return undefined;
	if (value.maximizedViewId !== undefined) {
		if (typeof value.maximizedViewId !== "string" || value.maximizedViewId.length === 0) return undefined;
		return { root, activeViewId: value.activeViewId, maximizedViewId: value.maximizedViewId };
	}
	return { root, activeViewId: value.activeViewId };
}

export function visibleLeaves(tree: LayoutTree): readonly LayoutLeaf[] {
	if (tree.maximizedViewId !== undefined) {
		const leaf = findLeaf(tree.root, tree.maximizedViewId);
		if (leaf) return [leaf];
	}
	return layoutLeaves(tree);
}
