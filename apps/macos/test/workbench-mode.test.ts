import { describe, expect, it } from "bun:test";
import { agentsWindowOpenMode, CARET_AGENTS_WINDOW_SETTINGS, consumePendingNativeDestination, DEFAULT_IDE_LAYOUT, draftViewKey, isAgentsWindow, isCaretAgentsWindow, isCopilotAgentsWindow, modeSwitchProof, persistDestinationAcrossReload, queuePendingNativeDestination, rememberIdeChrome, retentionReceipt, serializeCaretAgentsWorkspace, switchWorkbenchMode } from "../src/workbench-mode.ts";
import { createInitialTaskState, reduceTaskState } from "../src/state.ts";
import { parseWebviewMessage } from "../src/messages.ts";
import type { Project, Session } from "../../../packages/protocol/src/index.ts";

const project = (id: string): Project => ({ id, name: id, path: `/${id}`, archived: false, pinned: false, createdAt: "now" });
const session = (id: string, projectId: string): Session => ({
	id, projectId, title: id, cwd: "/tmp", sessionFile: `/tmp/${id}.jsonl`, incarnation: "inc-1", status: "idle", archived: false, createdAt: "now", updatedAt: "now",
});

describe("Agent ↔ IDE workbench mode", () => {
	it("owns Caret Agents via caret-agents workspace, not Copilot agent-sessions", () => {
		expect(isCaretAgentsWindow("/tmp/globalStorage/caret-agents.code-workspace")).toBe(true);
		expect(isCopilotAgentsWindow("/User/agent-sessions.code-workspace")).toBe(true);
		expect(isAgentsWindow("/Users/pond/caret")).toBe(false);
		const workspace = JSON.parse(serializeCaretAgentsWorkspace("/tmp/caret-agents")) as { folders: Array<{ path: string }>; settings: Record<string, unknown> };
		expect(workspace.folders[0]?.path).toBe("/tmp/caret-agents");
		expect(workspace.settings["workbench.editor.showTabs"]).toBe("none");
		expect(workspace.settings["workbench.activityBar.location"]).toBe(CARET_AGENTS_WINDOW_SETTINGS["workbench.activityBar.location"]);
		expect(serializeCaretAgentsWorkspace()).not.toContain("agent-sessions");
		expect(agentsWindowOpenMode({ inAgentsWindow: true, hasWorkspaceFolder: false })).toBe("shell");
		expect(agentsWindowOpenMode({ inAgentsWindow: false, hasWorkspaceFolder: false })).toBe("shell");
		expect(agentsWindowOpenMode({ inAgentsWindow: false, hasWorkspaceFolder: true })).toBe("shell");
		expect(agentsWindowOpenMode({ inAgentsWindow: false, hasWorkspaceFolder: true, explicitNewWindow: true })).toBe("new-window");
	});

	it("does not emit chrome commands when already in the requested mode", () => {
		expect(switchWorkbenchMode({ from: "agents", to: "agents", ideLayout: DEFAULT_IDE_LAYOUT }).commands).toEqual([]);
		expect(switchWorkbenchMode({ from: "ide", to: "ide", ideLayout: DEFAULT_IDE_LAYOUT }).commands).toEqual([]);
	});

	it("closes sidebar and auxiliary bar only when entering Agents", () => {
		const next = switchWorkbenchMode({ from: "ide", to: "agents", ideLayout: DEFAULT_IDE_LAYOUT });
		expect(next.mode).toBe("agents");
		expect(next.commands).toEqual([
			"workbench.action.closeSidebar",
			"workbench.action.closeAuxiliaryBar",
			"workbench.action.closePanel",
			"workbench.action.activityBarLocation.hide",
		]);
	});

	it("restores the saved IDE chrome instead of using startup defaults", () => {
		const layout = { sidebarVisible: true, auxiliaryBarVisible: true, panelVisible: false, activeEditorUri: "file:///tmp/a.ts" };
		const next = switchWorkbenchMode({ from: "agents", to: "ide", ideLayout: layout });
		expect(next.mode).toBe("ide");
		expect(next.ideLayout).toEqual(layout);
		expect(next.commands).toEqual(["workbench.view.explorer", "workbench.action.focusAuxiliaryBar"]);
		expect(next.commands).not.toContain("workbench.action.closeSidebar");
	});

	it("keeps drafts when switching A → B → A without changing session ownership fields", () => {
		const a = session("task-a", "proj-1");
		const b = session("task-b", "proj-1");
		let state = reduceTaskState(createInitialTaskState({ project: project("proj-1"), session: a }), { type: "draft", draft: "hello from A" });
		state = reduceTaskState(state, { type: "reset", project: project("proj-1"), session: b });
		expect(state.draft).toBe("");
		expect(state.session?.id).toBe("task-b");
		state = reduceTaskState(state, { type: "draft", draft: "notes on B" });
		state = reduceTaskState(state, { type: "reset", project: project("proj-1"), session: a });
		expect(state.draft).toBe("hello from A");
		expect(state.session?.id).toBe("task-a");
		expect(state.drafts[draftViewKey("proj-1", "task-b")]).toBe("notes on B");
	});

	it("treats workbench mode as view state that survives task reset", () => {
		let state = reduceTaskState(createInitialTaskState({ session: session("task-a", "proj-1"), project: project("proj-1") }), { type: "workbench_mode", mode: "ide" });
		state = reduceTaskState(state, { type: "reset", project: project("proj-1"), session: session("task-b", "proj-1") });
		expect(state.workbenchMode).toBe("ide");
	});

	it("queues the latest pending native destination", () => {
		expect(queuePendingNativeDestination(undefined, "explorer")).toBe("explorer");
		expect(queuePendingNativeDestination("explorer", "explorer")).toBe("explorer");
	});

	it("consumes pending explorer only after switching to IDE", () => {
		expect(consumePendingNativeDestination("ide", "explorer")).toEqual({ openExplorer: true });
		expect(consumePendingNativeDestination("agents", "explorer")).toEqual({ pending: "explorer", openExplorer: false });
		expect(consumePendingNativeDestination("ide")).toEqual({ openExplorer: false });
		expect(consumePendingNativeDestination("agents")).toEqual({ openExplorer: false });
		expect(consumePendingNativeDestination("ide", undefined)).toEqual({ openExplorer: false });
	});

	it("does not consume a pending Files destination on the dying instance after openFolder", () => {
		expect(persistDestinationAcrossReload(true, "explorer")).toEqual({ pending: "explorer", consumeNow: false });
		expect(persistDestinationAcrossReload(false, "explorer")).toEqual({ pending: "explorer", consumeNow: true });
		expect(persistDestinationAcrossReload(true)).toEqual({ consumeNow: false });
	});

	it("keeps the same session and draft across Agents → IDE → Agents", () => {
		const before = { sessionId: "task-a", draft: "hello", scrollEventId: "evt-1", mode: "agents" as const };
		const ide = retentionReceipt(before, { ...before, mode: "ide" });
		expect(ide.sessionUnchanged).toBe(true);
		expect(ide.draftRetained).toBe(true);
		expect(ide.scrollRetained).toBe(true);
		const back = retentionReceipt({ ...before, mode: "ide" }, before);
		expect(back.sessionUnchanged).toBe(true);
		expect(back.draftRetained).toBe(true);
		expect(back.mode).toBe("agents");
		expect(ide.attachmentsRetained).toBe(true);
		const lost = retentionReceipt(
			{ ...before, attachmentRefs: ["att-1"] },
			{ ...before, mode: "ide", attachmentRefs: [] },
		);
		expect(lost.attachmentsRetained).toBe(false);
		const proof = modeSwitchProof(before, { ...before, mode: "ide" }, "2026-09-13T07:00:00.000Z");
		expect(proof).toMatchObject({
			sameWindow: true,
			sessionId: "task-a",
			sessionUnchanged: true,
			draftRetained: true,
			from: "agents",
			to: "ide",
			ownerUnchanged: true,
		});
	});

	it("merges observed IDE chrome without dropping saved layout", () => {
		const next = rememberIdeChrome(
			{ ...DEFAULT_IDE_LAYOUT, sidebarVisible: true, activeEditorUri: "file:///a.ts" },
			{ activeEditorUri: "file:///b.ts", panelVisible: false },
		);
		expect(next.activeEditorUri).toBe("file:///b.ts");
		expect(next.sidebarVisible).toBe(true);
		expect(next.panelVisible).toBe(false);
	});

	it("accepts only agents/ide mode messages", () => {
		expect(parseWebviewMessage({ type: "set_workbench_mode", mode: "ide" })).toEqual({ type: "set_workbench_mode", mode: "ide" });
		expect(parseWebviewMessage({ type: "set_workbench_mode", mode: "cloud" })).toBeUndefined();
		expect(parseWebviewMessage({ type: "persist_draft", draft: "keep" })).toEqual({ type: "persist_draft", draft: "keep" });
		expect(parseWebviewMessage({ type: "persist_scroll", offset: 120, followLatest: false, eventId: "evt-1" })).toEqual({
			type: "persist_scroll", offset: 120, followLatest: false, eventId: "evt-1",
		});
	});
});
