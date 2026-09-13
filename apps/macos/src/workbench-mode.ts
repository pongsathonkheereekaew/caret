/** Agent ↔ IDE is presentation, not an OMP session lifecycle.
 *
 * Default is the same Caret.app window: hide/restore Code-OSS chrome and keep
 * the open folder, host, and OMP owner. `caret-agents.code-workspace` is only
 * a fallback identity so Caret is not Copilot's `agent-sessions.code-workspace`.
 * Open-in-new-window is an explicit secondary command. */

export const CARET_AGENTS_WORKSPACE = "caret-agents.code-workspace";
export const COPILOT_AGENTS_WORKSPACE = "agent-sessions.code-workspace";
export const CARET_EXTENSION_ID = "caret.caret";

export const CARET_AGENTS_WINDOW_SETTINGS = {
	"workbench.activityBar.location": "hidden",
	"workbench.statusBar.visible": false,
	"workbench.editor.showTabs": "none",
	"workbench.editor.editorActionsLocation": "hidden",
	"workbench.startupEditor": "none",
	"window.commandCenter": false,
	"workbench.layoutControl.enabled": false,
	"breadcrumbs.enabled": false,
	"workbench.tips.enabled": false,
	"window.title": "Caret",
} as const;

export function workspaceFilePath(workspaceFile?: { fsPath?: string; path?: string } | string | null): string {
	if (!workspaceFile) return "";
	if (typeof workspaceFile === "string") return workspaceFile;
	return workspaceFile.fsPath || workspaceFile.path || "";
}

function posixPath(workspaceFile?: { fsPath?: string; path?: string } | string | null): string {
	return workspaceFilePath(workspaceFile).replace(/\\/g, "/");
}

export function isCaretAgentsWindow(workspaceFile?: { fsPath?: string; path?: string } | string | null): boolean {
	return posixPath(workspaceFile).endsWith(CARET_AGENTS_WORKSPACE);
}

export function isCopilotAgentsWindow(workspaceFile?: { fsPath?: string; path?: string } | string | null): boolean {
	return posixPath(workspaceFile).endsWith(COPILOT_AGENTS_WORKSPACE);
}

export function isAgentsWindow(workspaceFile?: { fsPath?: string; path?: string } | string | null): boolean {
	return isCaretAgentsWindow(workspaceFile) || isCopilotAgentsWindow(workspaceFile);
}

export function serializeCaretAgentsWorkspace(folderPath?: string): string {
	return `${JSON.stringify({
		folders: folderPath ? [{ path: folderPath }] : [],
		settings: CARET_AGENTS_WINDOW_SETTINGS,
	}, null, "\t")}\n`;
}

export function agentsWindowOpenMode(input: {
	readonly inAgentsWindow: boolean;
	readonly hasWorkspaceFolder: boolean;
	readonly explicitNewWindow?: boolean;
}): "shell" | "reuse-window" | "new-window" {
	if (input.explicitNewWindow) return "new-window";
	if (input.inAgentsWindow) return "shell";
	return "shell";
}

export type WorkbenchMode = "agents" | "ide";
export type NativeDestination = "explorer";

export function queuePendingNativeDestination(current: NativeDestination | undefined, next: NativeDestination): NativeDestination {
	return next ?? current;
}

export function consumePendingNativeDestination(mode: "agents" | "ide", pending?: NativeDestination): { pending?: NativeDestination; openExplorer: boolean } {
	if (mode === "ide" && pending === "explorer") return { openExplorer: true };
	if (mode === "agents" && pending) return { pending, openExplorer: false };
	return { openExplorer: false };
}

/** After `vscode.openFolder` this extension instance dies. Persist the destination; do not consume it here. */
export function persistDestinationAcrossReload(willReloadWindow: boolean, pending?: NativeDestination): { pending?: NativeDestination; consumeNow: boolean } {
	if (!pending) return { consumeNow: false };
	if (willReloadWindow) return { pending, consumeNow: false };
	return { pending, consumeNow: true };
}

export interface IdeLayoutSnapshot {
	readonly sidebarVisible: boolean;
	readonly auxiliaryBarVisible: boolean;
	readonly panelVisible: boolean;
	readonly activeEditorUri?: string;
	readonly showTabs?: string;
	readonly statusBarVisible?: boolean;
	readonly activityBarLocation?: string;
}

export const DEFAULT_IDE_LAYOUT: IdeLayoutSnapshot = {
	sidebarVisible: true,
	auxiliaryBarVisible: false,
	panelVisible: true,
	showTabs: "multiple",
	statusBarVisible: true,
};

export const AGENTS_EDITOR_SHOW_TABS = "none";

export function draftViewKey(projectId: string | undefined | null, sessionId: string | undefined | null): string {
	return `${projectId?.trim() || "none"}/${sessionId?.trim() || "local-new"}`;
}

export interface RetentionSnapshot {
	readonly sessionId?: string;
	readonly draft: string;
	readonly scrollEventId?: string;
	readonly attachmentRefs?: readonly string[];
	readonly mode: WorkbenchMode;
	readonly pendingDestination?: NativeDestination;
}

export interface RetentionReceipt {
	readonly sessionUnchanged: boolean;
	readonly draftRetained: boolean;
	readonly scrollRetained: boolean;
	readonly attachmentsRetained: boolean;
	readonly mode: WorkbenchMode;
	readonly pendingDestination?: NativeDestination;
}

export interface ModeSwitchProof {
	readonly capturedAt: string;
	readonly sameWindow: true;
	readonly sessionId: string;
	readonly sessionUnchanged: boolean;
	readonly draftRetained: boolean;
	readonly scrollRetained: boolean;
	readonly attachmentsRetained: boolean;
	readonly from: WorkbenchMode;
	readonly to: WorkbenchMode;
	readonly ownerUnchanged: boolean;
}

/** UI-S1 A→IDE→A / A→B→A receipt. View switch must not mint a new session owner. */
export function retentionReceipt(before: RetentionSnapshot, after: RetentionSnapshot): RetentionReceipt {
	const sessionUnchanged = (before.sessionId ?? "") === (after.sessionId ?? "");
	return {
		sessionUnchanged,
		draftRetained: sessionUnchanged && before.draft === after.draft,
		scrollRetained: sessionUnchanged && (before.scrollEventId ?? "") === (after.scrollEventId ?? ""),
		attachmentsRetained: sessionUnchanged && (before.attachmentRefs ?? []).join("\0") === (after.attachmentRefs ?? []).join("\0"),
		mode: after.mode,
		...(after.pendingDestination ? { pendingDestination: after.pendingDestination } : {}),
	};
}

export function modeSwitchProof(before: RetentionSnapshot, after: RetentionSnapshot, capturedAt = new Date().toISOString()): ModeSwitchProof {
	const receipt = retentionReceipt(before, after);
	return {
		capturedAt,
		sameWindow: true,
		sessionId: after.sessionId ?? "",
		sessionUnchanged: receipt.sessionUnchanged,
		draftRetained: receipt.draftRetained,
		scrollRetained: receipt.scrollRetained,
		attachmentsRetained: receipt.attachmentsRetained,
		from: before.mode,
		to: after.mode,
		ownerUnchanged: receipt.sessionUnchanged,
	};
}

/** Merge observed IDE chrome while the user is in IDE. Agents chrome must not overwrite this. */
export function rememberIdeChrome(layout: IdeLayoutSnapshot, change: Partial<IdeLayoutSnapshot>): IdeLayoutSnapshot {
	return normalizeIdeLayout({ ...layout, ...change }, layout);
}

export function normalizeIdeLayout(value: unknown, fallback: IdeLayoutSnapshot = DEFAULT_IDE_LAYOUT): IdeLayoutSnapshot {
	if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
	const record = value as Record<string, unknown>;
	return {
		sidebarVisible: record.sidebarVisible !== false,
		auxiliaryBarVisible: record.auxiliaryBarVisible === true,
		panelVisible: record.panelVisible !== false,
		...(typeof record.activeEditorUri === "string" ? { activeEditorUri: record.activeEditorUri } : {}),
		showTabs: typeof record.showTabs === "string" ? record.showTabs : fallback.showTabs,
		statusBarVisible: record.statusBarVisible !== false,
		activityBarLocation: typeof record.activityBarLocation === "string" ? record.activityBarLocation : fallback.activityBarLocation,
	};
}

export function agentsChromeCommands(): readonly string[] {
	return [
		"workbench.action.closeSidebar",
		"workbench.action.closeAuxiliaryBar",
		"workbench.action.closePanel",
		"workbench.action.activityBarLocation.hide",
	];
}

export function ideChromeCommands(snapshot: IdeLayoutSnapshot): readonly string[] {
	const commands: string[] = [];
	if (snapshot.sidebarVisible) commands.push("workbench.view.explorer");
	if (snapshot.auxiliaryBarVisible) commands.push("workbench.action.focusAuxiliaryBar");
	if (snapshot.panelVisible) commands.push("workbench.action.focusPanel");
	return commands;
}

export function switchWorkbenchMode(input: {
	readonly from: WorkbenchMode;
	readonly to: WorkbenchMode;
	readonly ideLayout: IdeLayoutSnapshot;
}): { readonly mode: WorkbenchMode; readonly ideLayout: IdeLayoutSnapshot; readonly commands: readonly string[] } {
	if (input.from === input.to) return { mode: input.to, ideLayout: input.ideLayout, commands: [] };
	if (input.to === "agents") {
		return { mode: "agents", ideLayout: input.ideLayout, commands: agentsChromeCommands() };
	}
	return { mode: "ide", ideLayout: input.ideLayout, commands: ideChromeCommands(input.ideLayout) };
}

export async function runWorkbenchCommands(
	executeCommand: (command: string, ...args: unknown[]) => Thenable<unknown>,
	commands: readonly string[],
): Promise<void> {
	for (const command of commands) {
		await executeCommand(command);
	}
}
