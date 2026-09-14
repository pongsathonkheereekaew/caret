import { describe, expect, it } from "bun:test";
import { layoutBoxes, layoutSashes, setSplitRatio, type PaneBox } from "../src/layout-geometry.ts";
import {
	createLayoutTree,
	maximizeActive,
	splitActive,
	type LayoutSplit,
} from "../src/layout-tree.ts";

const ids = (viewId: string, draftViewId: string) => () => ({ viewId, draftViewId });

function asSplit(node: { readonly type: string }): LayoutSplit {
	expect(node.type).toBe("split");
	return node as LayoutSplit;
}

function area(box: PaneBox): number {
	return box.width * box.height;
}

function overlapArea(a: PaneBox, b: PaneBox): number {
	const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
	const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
	return x * y;
}

describe("D01 layout geometry", () => {
	it("one leaf 800x600 is one box at 0,0,800,600 and no sashes", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		expect(layoutBoxes(tree, 800, 600)).toEqual([{ viewId: "view-1", x: 0, y: 0, width: 800, height: 600 }]);
		expect(layoutSashes(tree, 800, 600)).toEqual([]);
	});

	it("split right 800x600 ratio 0.5 yields two ~400-wide boxes and one row sash", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const split = splitActive(tree, "right", 800, ids("view-2", "draft-2"));
		expect(asSplit(split.root).ratio).toBe(0.5);
		const boxes = layoutBoxes(split, 800, 600);
		expect(boxes).toHaveLength(2);
		expect(boxes[0]).toEqual({ viewId: "view-1", x: 0, y: 0, width: 400, height: 600 });
		expect(boxes[1]).toEqual({ viewId: "view-2", x: 400, y: 0, width: 400, height: 600 });
		const sashes = layoutSashes(split, 800, 600);
		expect(sashes).toHaveLength(1);
		expect(sashes[0]).toEqual({
			orientation: "row",
			x: 400,
			y: 0,
			length: 600,
			thickness: 2,
			firstViewId: "view-1",
		});
	});

	it("split down 800x500 stacks heights and emits one column sash", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const split = splitActive(tree, "down", 500, ids("view-2", "draft-2"));
		const boxes = layoutBoxes(split, 800, 500);
		expect(boxes).toHaveLength(2);
		expect(boxes[0]).toEqual({ viewId: "view-1", x: 0, y: 0, width: 800, height: 250 });
		expect(boxes[1]).toEqual({ viewId: "view-2", x: 0, y: 250, width: 800, height: 250 });
		expect(layoutSashes(split, 800, 500)).toEqual([
			{
				orientation: "column",
				x: 0,
				y: 250,
				length: 800,
				thickness: 2,
				firstViewId: "view-1",
			},
		]);
	});

	it("boxes cover the rectangle without overlap except sash thickness", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const split = splitActive(tree, "right", 800, ids("view-2", "draft-2"));
		const boxes = layoutBoxes(split, 800, 600);
		const sashes = layoutSashes(split, 800, 600);
		expect(boxes.reduce((sum, box) => sum + area(box), 0)).toBe(800 * 600);
		expect(overlapArea(boxes[0]!, boxes[1]!)).toBe(0);
		expect(sashes[0]?.thickness).toBe(2);
		expect(sashes[0]?.x).toBe(boxes[0]!.x + boxes[0]!.width);
	});

	it("maximized tree is one full-size box and zero sashes", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const split = splitActive(tree, "right", 800, ids("view-2", "draft-2"));
		const maximized = maximizeActive(split);
		expect(layoutBoxes(maximized, 800, 600)).toEqual([
			{ viewId: "view-2", x: 0, y: 0, width: 800, height: 600 },
		]);
		expect(layoutSashes(maximized, 800, 600)).toEqual([]);
	});

	it("setSplitRatio 0.7 then boxes reflect it", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const split = splitActive(tree, "right", 800, ids("view-2", "draft-2"));
		const next = setSplitRatio(split, "view-1", 0.7);
		expect(asSplit(next.root).ratio).toBe(0.7);
		const boxes = layoutBoxes(next, 800, 600);
		expect(boxes[0]?.width).toBe(440);
		expect(boxes[1]?.width).toBe(360);
		expect(boxes[0]?.height).toBe(600);
		expect(boxes[1]?.height).toBe(600);
		expect(layoutSashes(next, 800, 600)[0]?.x).toBe(440);
	});

	it("setSplitRatio unknown id leaves the tree unchanged", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const split = splitActive(tree, "right", 800, ids("view-2", "draft-2"));
		expect(setSplitRatio(split, "missing", 0.7)).toBe(split);
	});

	it("does not invent Cloud types or session ids", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const split = splitActive(tree, "right", 800, ids("view-2", "draft-2"));
		const next = setSplitRatio(split, "view-1", 0.7);
		const payload = JSON.stringify({
			tree: next,
			boxes: layoutBoxes(next, 800, 600),
			sashes: layoutSashes(next, 800, 600),
		});
		expect(payload.toLowerCase()).not.toContain("cloud");
		expect(payload).not.toContain("sess-");
		expect(asSplit(next.root).children[0]).toMatchObject({ sessionId: "task-1" });
		expect(asSplit(next.root).children[1]).toMatchObject({ sessionId: "task-1" });
	});

	it("non-finite or non-positive viewport yields empty arrays", () => {
		const tree = createLayoutTree({ viewId: "view-1" });
		expect(layoutBoxes(tree, 0, 600)).toEqual([]);
		expect(layoutSashes(tree, 800, Number.NaN)).toEqual([]);
		expect(layoutBoxes(tree, Number.POSITIVE_INFINITY, 600)).toEqual([]);
	});
});
