/** D01 split panes are live views from owned layout leaves + cached transcripts. OMP stays the session owner. */

import { paneDraftKey, visibleLeaves, type LayoutLeaf, type LayoutTree } from "./layout-tree.ts";
import type { TranscriptEntry } from "./state.ts";
import { draftViewKey } from "./workbench-mode.ts";

export interface PaneTranscriptCache {
	readonly [key: string]: readonly TranscriptEntry[] | undefined;
}

export interface PaneView {
	readonly viewId: string;
	readonly draftKey: string;
	readonly label: string;
	readonly active: boolean;
	readonly projectId: string | null;
	readonly sessionId: string | null;
	readonly draft: string;
	readonly transcript: readonly TranscriptEntry[];
}

function draftLeaf(leaf: Pick<LayoutLeaf, "projectId" | "sessionId" | "draftViewId">): LayoutLeaf {
	return {
		type: "leaf",
		viewId: leaf.draftViewId,
		projectId: leaf.projectId,
		sessionId: leaf.sessionId,
		draftViewId: leaf.draftViewId,
	};
}

export function paneCacheKey(leaf: Pick<LayoutLeaf, "projectId" | "sessionId" | "draftViewId">): string {
	if (leaf.sessionId) return draftViewKey(leaf.projectId, leaf.sessionId);
	return paneDraftKey(draftLeaf(leaf));
}

export function rememberPaneTranscript(
	cache: PaneTranscriptCache,
	leaf: Pick<LayoutLeaf, "projectId" | "sessionId" | "draftViewId">,
	transcript: readonly TranscriptEntry[],
): PaneTranscriptCache {
	return { ...cache, [paneCacheKey(leaf)]: transcript };
}

export function paneTranscript(
	cache: PaneTranscriptCache,
	leaf: Pick<LayoutLeaf, "projectId" | "sessionId" | "draftViewId">,
): readonly TranscriptEntry[] {
	return cache[paneCacheKey(leaf)] ?? [];
}

function paneLabel(
	leaf: LayoutLeaf,
	sessions: readonly { readonly id: string; readonly title?: string }[],
): string {
	if (!leaf.sessionId) return "New task";
	const title = sessions.find((session) => session.id === leaf.sessionId)?.title;
	return title || "New task";
}

export function buildPaneViews(input: {
	readonly tree: LayoutTree;
	readonly cache: PaneTranscriptCache;
	readonly drafts: Readonly<Record<string, string>>;
	readonly activeDraft?: string;
	readonly sessions: readonly { readonly id: string; readonly title?: string }[];
}): readonly PaneView[] {
	return visibleLeaves(input.tree).map((leaf) => {
		const draftKey = paneDraftKey(leaf);
		const active = leaf.viewId === input.tree.activeViewId;
		return {
			viewId: leaf.viewId,
			draftKey,
			label: paneLabel(leaf, input.sessions),
			active,
			projectId: leaf.projectId,
			sessionId: leaf.sessionId,
			draft: input.drafts[draftKey] ?? (active ? input.activeDraft : "") ?? "",
			transcript: paneTranscript(input.cache, leaf),
		};
	});
}
