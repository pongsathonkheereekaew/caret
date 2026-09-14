import { describe, expect, it } from "bun:test";
import {
	createLayoutTree,
	maximizeActive,
	paneDraftKey,
	splitActive,
	type LayoutLeaf,
} from "../src/layout-tree.ts";
import {
	buildPaneViews,
	paneCacheKey,
	paneTranscript,
	rememberPaneTranscript,
	type PaneTranscriptCache,
} from "../src/pane-views.ts";
import type { TranscriptEntry } from "../src/state.ts";
import { draftViewKey } from "../src/workbench-mode.ts";

const ids = (viewId: string, draftViewId: string) => () => ({ viewId, draftViewId });

function row(id: string, text: string): TranscriptEntry {
	return { id, kind: "message", role: "user", text, status: "completed", rawFrames: [] };
}

describe("paneCacheKey", () => {
	it("shares one key for the same sessionId and isolates New-task panes", () => {
		const shared: Pick<LayoutLeaf, "projectId" | "sessionId" | "draftViewId"> = {
			projectId: "proj-1",
			sessionId: "task-1",
			draftViewId: "draft-a",
		};
		const sibling = { ...shared, draftViewId: "draft-b" };
		expect(paneCacheKey(shared)).toBe(draftViewKey("proj-1", "task-1"));
		expect(paneCacheKey(sibling)).toBe(paneCacheKey(shared));

		const firstNew: LayoutLeaf = {
			type: "leaf",
			viewId: "view-1",
			projectId: "proj-1",
			sessionId: null,
			draftViewId: "draft-1",
		};
		const secondNew = { ...firstNew, viewId: "view-2", draftViewId: "draft-2" };
		expect(paneCacheKey(firstNew)).toBe(paneDraftKey(firstNew));
		expect(paneCacheKey(secondNew)).toBe(paneDraftKey(secondNew));
		expect(paneCacheKey(firstNew)).not.toBe(paneCacheKey(secondNew));
		expect(paneDraftKey(firstNew)).not.toBe(paneDraftKey(secondNew));
	});
});

describe("rememberPaneTranscript", () => {
	it("replaces only the target cache key", () => {
		const other: Pick<LayoutLeaf, "projectId" | "sessionId" | "draftViewId"> = {
			projectId: "proj-1",
			sessionId: "task-other",
			draftViewId: "draft-other",
		};
		const leaf: Pick<LayoutLeaf, "projectId" | "sessionId" | "draftViewId"> = {
			projectId: "proj-1",
			sessionId: "task-1",
			draftViewId: "draft-1",
		};
		const kept = [row("kept", "stay")];
		const cache: PaneTranscriptCache = { [paneCacheKey(other)]: kept };
		const stored = [row("omp-hist:m1", "hello")];
		const next = rememberPaneTranscript(cache, leaf, stored);
		expect(next[paneCacheKey(leaf)]).toEqual(stored);
		expect(next[paneCacheKey(other)]).toEqual(kept);
		expect(cache[paneCacheKey(leaf)]).toBeUndefined();
		expect(paneTranscript({}, leaf)).toEqual([]);
	});
});

describe("buildPaneViews", () => {
	it("one leaf New task → one view, empty transcript, label New task", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: null, viewId: "view-1" });
		const leaf = tree.root as LayoutLeaf;
		const views = buildPaneViews({ tree, cache: {}, drafts: {}, sessions: [] });
		expect(views).toHaveLength(1);
		expect(views[0]).toEqual({
			viewId: "view-1",
			draftKey: paneDraftKey(leaf),
			label: "New task",
			active: true,
			projectId: "proj-1",
			sessionId: null,
			draft: "",
			transcript: [],
		});
	});

	it("two leaves same sessionId → same transcript from cache, different draftKeys/drafts", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const two = splitActive(tree, "right", 800, ids("view-2", "draft-2"));
		const first = two.root.type === "split" ? (two.root.children[0] as LayoutLeaf) : (two.root as LayoutLeaf);
		const second = two.root.type === "split" ? (two.root.children[1] as LayoutLeaf) : (two.root as LayoutLeaf);
		const stored = [row("omp-hist:m1", "shared live")];
		const cache = { [paneCacheKey(first)]: stored };
		const views = buildPaneViews({
			tree: two,
			cache,
			drafts: {
				[paneDraftKey(first)]: "left draft",
				[paneDraftKey(second)]: "right draft",
			},
			sessions: [{ id: "task-1", title: "Fix login" }],
		});
		expect(views).toHaveLength(2);
		expect(paneCacheKey(first)).toBe(paneCacheKey(second));
		expect(views[0]?.transcript).toEqual(stored);
		expect(views[1]?.transcript).toEqual(stored);
		expect(views[0]?.transcript).toBe(views[1]?.transcript);
		expect(views[0]?.draftKey).not.toBe(views[1]?.draftKey);
		expect(views[0]?.draft).toBe("left draft");
		expect(views[1]?.draft).toBe("right draft");
		expect(views[0]?.label).toBe("Fix login");
		expect(views[1]?.label).toBe("Fix login");
		expect(views[0]?.sessionId).toBe("task-1");
		expect(views[1]?.sessionId).toBe("task-1");
	});

	it("two New-task leaves → independent empty transcripts", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: null, viewId: "view-1" });
		const two = splitActive(tree, "right", 800, ids("view-2", "draft-2"));
		const first = two.root.type === "split" ? (two.root.children[0] as LayoutLeaf) : (two.root as LayoutLeaf);
		const second = two.root.type === "split" ? (two.root.children[1] as LayoutLeaf) : (two.root as LayoutLeaf);
		const views = buildPaneViews({ tree: two, cache: {}, drafts: {}, sessions: [] });
		expect(views).toHaveLength(2);
		expect(first.sessionId).toBeNull();
		expect(second.sessionId).toBeNull();
		expect(paneDraftKey(first)).not.toBe(paneDraftKey(second));
		expect(paneCacheKey(first)).not.toBe(paneCacheKey(second));
		expect(views[0]?.transcript).toEqual([]);
		expect(views[1]?.transcript).toEqual([]);
		expect(views[0]?.label).toBe("New task");
		expect(views[1]?.label).toBe("New task");
	});

	it("remember then build sees the stored rows", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const leaf = tree.root as LayoutLeaf;
		const stored = [row("omp-hist:m2", "cached")];
		const cache = rememberPaneTranscript({}, leaf, stored);
		const views = buildPaneViews({
			tree,
			cache,
			drafts: {},
			sessions: [{ id: "task-1", title: "Cached task" }],
		});
		expect(views).toHaveLength(1);
		expect(views[0]?.transcript).toEqual(stored);
		expect(paneTranscript(cache, leaf)).toEqual(stored);
	});

	it("maximized tree → only the maximized leaf", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: "task-1", viewId: "view-1" });
		const two = splitActive(tree, "right", 800, ids("view-2", "draft-2"));
		const maximized = maximizeActive(two);
		const views = buildPaneViews({
			tree: maximized,
			cache: {},
			drafts: {},
			sessions: [{ id: "task-1", title: "Only one" }],
		});
		expect(views).toHaveLength(1);
		expect(views[0]?.viewId).toBe("view-2");
		expect(views[0]?.active).toBe(true);
	});

	it("does not invent session ids or Cloud", () => {
		const tree = createLayoutTree({ projectId: "proj-1", sessionId: null, viewId: "view-1" });
		const views = buildPaneViews({
			tree,
			cache: {},
			drafts: {},
			activeDraft: "typed here",
			sessions: [{ id: "task-listed", title: "Listed" }],
		});
		const serialized = JSON.stringify(views);
		expect(views[0]?.sessionId).toBeNull();
		expect(views[0]?.label).toBe("New task");
		expect(views[0]?.draft).toBe("typed here");
		expect(serialized).not.toContain("sess-");
		expect(serialized.toLowerCase()).not.toContain("cloud");
	});
});
