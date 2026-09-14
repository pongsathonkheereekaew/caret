/** D01 Agents pane geometry. Pure view boxes — OMP stays the session owner. */

import {
	PANE_MIN_HORIZONTAL_PX,
	PANE_MIN_VERTICAL_PX,
	visibleLeaves,
	type LayoutNode,
	type LayoutTree,
} from "./layout-tree.ts";

const RATIO_MIN = 0.05;
const RATIO_MAX = 0.95;
const SASH_THICKNESS = 2 as const;

export interface PaneBox {
	readonly viewId: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

export interface SplitSash {
	readonly orientation: "row" | "column";
	readonly x: number;
	readonly y: number;
	readonly length: number;
	readonly thickness: 2;
	readonly firstViewId: string;
}

export function layoutBoxes(tree: LayoutTree, width: number, height: number): readonly PaneBox[] {
	if (!usableViewport(width, height)) return [];
	if (tree.maximizedViewId !== undefined) {
		return visibleLeaves(tree).map((leaf) => ({
			viewId: leaf.viewId,
			x: 0,
			y: 0,
			width,
			height,
		}));
	}
	const boxes: PaneBox[] = [];
	collectBoxes(tree.root, 0, 0, width, height, boxes);
	return boxes;
}

export function layoutSashes(tree: LayoutTree, width: number, height: number): readonly SplitSash[] {
	if (!usableViewport(width, height)) return [];
	if (tree.maximizedViewId !== undefined) return [];
	const sashes: SplitSash[] = [];
	collectSashes(tree.root, 0, 0, width, height, sashes);
	return sashes;
}

export function setSplitRatio(tree: LayoutTree, splitFirstViewId: string, ratio: number): LayoutTree {
	if (!Number.isFinite(ratio)) return tree;
	const nextRatio = Math.min(RATIO_MAX, Math.max(RATIO_MIN, ratio));
	const nextRoot = applySplitRatio(tree.root, splitFirstViewId, nextRatio);
	if (!nextRoot) return tree;
	return {
		root: nextRoot,
		activeViewId: tree.activeViewId,
		...(tree.maximizedViewId !== undefined ? { maximizedViewId: tree.maximizedViewId } : {}),
	};
}

function usableViewport(width: number, height: number): boolean {
	return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

function firstLeafViewId(node: LayoutNode): string {
	return node.type === "leaf" ? node.viewId : firstLeafViewId(node.children[0]);
}

function splitAxis(size: number, ratio: number, min: number): readonly [number, number] {
	const rounded = Math.round(size * ratio);
	const first = size >= min * 2
		? Math.max(min, Math.min(size - min, rounded))
		: Math.max(1, Math.min(size - 1, rounded));
	return [first, size - first];
}

function collectBoxes(
	node: LayoutNode,
	x: number,
	y: number,
	width: number,
	height: number,
	into: PaneBox[],
): void {
	if (node.type === "leaf") {
		into.push({ viewId: node.viewId, x, y, width, height });
		return;
	}
	if (node.orientation === "row") {
		const [firstWidth, secondWidth] = splitAxis(width, node.ratio, PANE_MIN_HORIZONTAL_PX);
		collectBoxes(node.children[0], x, y, firstWidth, height, into);
		collectBoxes(node.children[1], x + firstWidth, y, secondWidth, height, into);
		return;
	}
	const [firstHeight, secondHeight] = splitAxis(height, node.ratio, PANE_MIN_VERTICAL_PX);
	collectBoxes(node.children[0], x, y, width, firstHeight, into);
	collectBoxes(node.children[1], x, y + firstHeight, width, secondHeight, into);
}

function collectSashes(
	node: LayoutNode,
	x: number,
	y: number,
	width: number,
	height: number,
	into: SplitSash[],
): void {
	if (node.type === "leaf") return;
	if (node.orientation === "row") {
		const [firstWidth, secondWidth] = splitAxis(width, node.ratio, PANE_MIN_HORIZONTAL_PX);
		into.push({
			orientation: "row",
			x: x + firstWidth,
			y,
			length: height,
			thickness: SASH_THICKNESS,
			firstViewId: firstLeafViewId(node.children[0]),
		});
		collectSashes(node.children[0], x, y, firstWidth, height, into);
		collectSashes(node.children[1], x + firstWidth, y, secondWidth, height, into);
		return;
	}
	const [firstHeight, secondHeight] = splitAxis(height, node.ratio, PANE_MIN_VERTICAL_PX);
	into.push({
		orientation: "column",
		x,
		y: y + firstHeight,
		length: width,
		thickness: SASH_THICKNESS,
		firstViewId: firstLeafViewId(node.children[0]),
	});
	collectSashes(node.children[0], x, y, width, firstHeight, into);
	collectSashes(node.children[1], x, y + firstHeight, width, secondHeight, into);
}

function applySplitRatio(node: LayoutNode, splitFirstViewId: string, ratio: number): LayoutNode | undefined {
	if (node.type === "leaf") return undefined;
	if (firstLeafViewId(node.children[0]) === splitFirstViewId) {
		if (node.ratio === ratio) return node;
		return {
			type: "split",
			orientation: node.orientation,
			ratio,
			children: node.children,
		};
	}
	const left = applySplitRatio(node.children[0], splitFirstViewId, ratio);
	if (left) {
		return {
			type: "split",
			orientation: node.orientation,
			ratio: node.ratio,
			children: [left, node.children[1]],
		};
	}
	const right = applySplitRatio(node.children[1], splitFirstViewId, ratio);
	if (right) {
		return {
			type: "split",
			orientation: node.orientation,
			ratio: node.ratio,
			children: [node.children[0], right],
		};
	}
	return undefined;
}
