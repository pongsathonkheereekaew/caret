import { describe, expect, it } from "bun:test";
import {
	NEED_MORE_SPACE_REASON,
	PANE_MIN_HORIZONTAL_PX,
	PANE_MIN_VERTICAL_PX,
	activeLeaf,
	assignActive,
	canSplit,
	openSessionInSplit,
	closeActive,
	createLayoutTree,
	focusView,
	layoutLeaves,
	maximizeActive,
	moveActive,
	paneDraftKey,
	parseLayout,
	restoreLayout,
	serializeLayout,
	splitActive,
	visibleLeaves,
	type LayoutLeaf,
	type LayoutSplit,
} from "../src/layout-tree.ts";
import { draftViewKey } from "../src/workbench-mode.ts";

const ids = (viewId: string, draftViewId: string) => () => ({ viewId, draftViewId });

function asLeaf(node: { readonly type: string }): LayoutLeaf {
	expect(node.type).toBe("leaf");
	return node as LayoutLeaf;
}

function asSplit(node: { readonly type: string }): LayoutSplit {
	expect(node.type).toBe("split");
	return node as LayoutSplit;
}

describe("Agents pane layout tree", () => {
	it("create starts one leaf; empty sessionId is New task (null), no fake sess-", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "", viewId: "view-1" });
		const leaf = asLeaf(tree.root);
		expect(layoutLeaves(tree)).toHaveLength(1);
		expect(leaf.viewId).toBe("view-1");
		expect(leaf.projectId).toBe("proj-1");
		expect(leaf.sessionId).toBeNull();
		expect(JSON.stringify(serializeLayout(tree))).not.toContain("sess-");
		expect(tree.activeViewId).toBe("view-1");
		expect(activeLeaf(tree)).toEqual(leaf);
		expect(createLayoutTree().root.type).toBe("leaf");
		expect(asLeaf(createLayoutTree({ sessionId: null }).root).sessionId).toBeNull();
	});

	it("split right at 800px ok; two leaves same sessionId; different viewId/draftViewId; paneDraftKeys differ", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		expect(canSplit({ direction: "right", availablePx: 800 })).toEqual({ ok: true });
		const next = splitActive(tree, "right", 800, ids("view-2", "draft-2"));
		const leaves = layoutLeaves(next);
		expect(leaves).toHaveLength(2);
		expect(asSplit(next.root).orientation).toBe("row");
		expect(asSplit(next.root).ratio).toBe(0.5);
		expect(leaves[0]?.sessionId).toBe("task-1");
		expect(leaves[1]?.sessionId).toBe("task-1");
		expect(leaves[0]?.projectId).toBe("proj-1");
		expect(leaves[1]?.projectId).toBe("proj-1");
		expect(leaves[0]?.viewId).not.toBe(leaves[1]?.viewId);
		expect(leaves[0]?.draftViewId).not.toBe(leaves[1]?.draftViewId);
		expect(paneDraftKey(leaves[0]!)).not.toBe(paneDraftKey(leaves[1]!));
		expect(paneDraftKey(leaves[1]!)).toBe(`${draftViewKey("proj-1", "task-1")}/draft-2`);
		expect(next.activeViewId).toBe("view-2");
	});

	it("split right at 700px unchanged + canSplit reason NEED_MORE_SPACE_REASON (700 < 720)", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		expect(PANE_MIN_HORIZONTAL_PX * 2).toBe(720);
		expect(canSplit({ direction: "right", availablePx: 700 })).toEqual({
			ok: false,
			reason: NEED_MORE_SPACE_REASON,
		});
		expect(splitActive(tree, "right", 700, ids("view-2", "draft-2"))).toBe(tree);
		expect(layoutLeaves(tree)).toHaveLength(1);
	});

	it("split down at 480 ok; at 400 unchanged", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		expect(PANE_MIN_VERTICAL_PX * 2).toBe(480);
		expect(canSplit({ direction: "down", availablePx: 480 })).toEqual({ ok: true });
		const split = splitActive(tree, "down", 480, ids("view-2", "draft-2"));
		expect(asSplit(split.root).orientation).toBe("column");
		expect(layoutLeaves(split)).toHaveLength(2);
		expect(canSplit({ direction: "down", availablePx: 400 })).toEqual({
			ok: false,
			reason: NEED_MORE_SPACE_REASON,
		});
		expect(splitActive(tree, "down", 400, ids("view-2", "draft-2"))).toBe(tree);
	});

	it("close one of two returns single remaining leaf, active is neighbor", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const two = splitActive(tree, "right", 800, ids("view-2", "draft-2"));
		expect(two.activeViewId).toBe("view-2");
		const closed = closeActive(two);
		const leaf = asLeaf(closed.root);
		expect(layoutLeaves(closed)).toHaveLength(1);
		expect(leaf.viewId).toBe("view-1");
		expect(leaf.sessionId).toBe("task-1");
		expect(closed.activeViewId).toBe("view-1");
	});

	it("close last leaf → sessionId null, same projectId", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const closed = closeActive(tree);
		const leaf = asLeaf(closed.root);
		expect(leaf.sessionId).toBeNull();
		expect(leaf.projectId).toBe("proj-1");
		expect(leaf.viewId).not.toBe("view-1");
		expect(closed.activeViewId).toBe(leaf.viewId);
	});

	it("maximize then visibleLeaves is one; restore shows both", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const two = splitActive(tree, "right", 800, ids("view-2", "draft-2"));
		const maximized = maximizeActive(two);
		expect(visibleLeaves(maximized)).toHaveLength(1);
		expect(visibleLeaves(maximized)[0]?.viewId).toBe("view-2");
		expect(layoutLeaves(maximized)).toHaveLength(2);
		const restored = restoreLayout(maximized);
		expect(visibleLeaves(restored)).toHaveLength(2);
		expect(restored.maximizedViewId).toBeUndefined();
	});

	it("parseLayout rejects { sessionId: \"invented\" } garbage / missing type", () => {
		expect(parseLayout({ sessionId: "invented" })).toBeUndefined();
		expect(parseLayout({ type: "leaf" })).toBeUndefined();
		expect(parseLayout({ root: { sessionId: "invented" }, activeViewId: "view-1" })).toBeUndefined();
		expect(parseLayout({ root: { type: "cloud", viewId: "v" }, activeViewId: "v" })).toBeUndefined();
		expect(parseLayout(null)).toBeUndefined();
	});

	it("serialize/parse roundtrip", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const two = splitActive(tree, "right", 800, ids("view-2", "draft-2"));
		const maximized = maximizeActive(two);
		expect(parseLayout(serializeLayout(maximized))).toEqual(maximized);
		expect(parseLayout(serializeLayout(tree))).toEqual(tree);
	});

	it("moveActive left/right swaps row children; up on a row is unchanged", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const two = splitActive(tree, "right", 800, ids("view-2", "draft-2"));
		expect(asLeaf(asSplit(two.root).children[0]).viewId).toBe("view-1");
		expect(asLeaf(asSplit(two.root).children[1]).viewId).toBe("view-2");
		const left = moveActive(two, "left");
		expect(asLeaf(asSplit(left.root).children[0]).viewId).toBe("view-2");
		expect(asLeaf(asSplit(left.root).children[1]).viewId).toBe("view-1");
		expect(left.activeViewId).toBe("view-2");
		const right = moveActive(left, "right");
		expect(asLeaf(asSplit(right.root).children[0]).viewId).toBe("view-1");
		expect(asLeaf(asSplit(right.root).children[1]).viewId).toBe("view-2");
		expect(moveActive(two, "up")).toBe(two);
		expect(moveActive(two, "down")).toBe(two);
		expect(focusView(two, "missing")).toBe(two);
		expect(focusView(two, "view-1").activeViewId).toBe("view-1");
	});

	it("assignActive clears sessionId on the focused leaf only and does not invent one", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const two = splitActive(tree, "right", 800, ids("view-2", "draft-2"));
		const next = assignActive(two, { sessionId: null });
		expect(activeLeaf(next)?.sessionId).toBeNull();
		expect(asLeaf(asSplit(next.root).children[0]).sessionId).toBe("task-1");
		expect(JSON.stringify(next)).not.toMatch(/sess-/);
	});

	it("open in split assigns the focused leaf to that session without minting an owner", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const next = openSessionInSplit(tree, { sessionId: "task-2", availablePx: 800, projectId: "proj-1" }, ids("view-2", "draft-2"));
		expect(next.ok).toBe(true);
		if (!next.ok) throw new Error(next.reason);
		const leaves = layoutLeaves(next.tree);
		expect(leaves).toHaveLength(2);
		expect(leaves[0]?.sessionId).toBe("task-1");
		expect(leaves[1]?.sessionId).toBe("task-2");
		expect(next.tree.activeViewId).toBe("view-2");
		expect(JSON.stringify(next.tree)).not.toMatch(/sess-/);
		expect(openSessionInSplit(tree, { sessionId: "task-2", availablePx: 700 })).toEqual({
			ok: false,
			reason: NEED_MORE_SPACE_REASON,
		});
		const two = openSessionInSplit(tree, { sessionId: "task-2", availablePx: 800 }, ids("view-2", "draft-2"));
		expect(two.ok).toBe(true);
		if (!two.ok) throw new Error(two.reason);
		expect(openSessionInSplit(two.tree, { sessionId: "task-3", availablePx: 800 })).toEqual({
			ok: false,
			reason: NEED_MORE_SPACE_REASON,
		});
		const third = openSessionInSplit(two.tree, { sessionId: "task-3", availablePx: 1080 }, ids("view-3", "draft-3"));
		expect(third.ok).toBe(true);
		if (!third.ok) throw new Error(third.reason);
		expect(layoutLeaves(third.tree)).toHaveLength(3);
		expect(activeLeaf(third.tree)?.sessionId).toBe("task-3");
	});
});
