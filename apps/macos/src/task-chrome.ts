/** S02 / D01 / D04 task chrome. Presentation only — OMP stays the execution owner. */

export type TaskChromeMode = "agents" | "ide";

export interface CediaWindowTitleInput {
	readonly mode: TaskChromeMode;
	readonly taskTitle?: string;
	readonly projectName?: string;
	readonly fileName?: string;
}

export interface TaskHeaderMetaInput {
	readonly projectName?: string;
	readonly path?: string;
	readonly branch?: string;
	readonly worktree?: string;
	readonly cwd?: string;
	readonly parentSession?: string;
}

export type TaskHeaderLocationKind = "branch" | "folder";

export interface TaskHeaderMeta {
	readonly projectName?: string;
	readonly locationKind: TaskHeaderLocationKind;
	readonly locationLabel: "Branch" | "Folder";
	readonly branch?: string;
	readonly worktree?: string;
	readonly path?: string;
	readonly cwd?: string;
	readonly parentSession?: string;
	readonly summary: string;
}

export interface MoreMenuActionsInput {
	readonly hasSession: boolean;
	readonly pinned?: boolean;
	readonly archived?: boolean;
	readonly recoveryRequired?: boolean;
	readonly hasParent?: boolean;
	readonly hasDraft?: boolean;
	readonly canSplitRight?: boolean;
	readonly canSplitDown?: boolean;
	readonly paneCount?: number;
	readonly paneMaximized?: boolean;
	readonly canMoveLeft?: boolean;
	readonly canMoveRight?: boolean;
	readonly canMoveUp?: boolean;
	readonly canMoveDown?: boolean;
}

export type MoreMenuActionId =
	| "rename"
	| "pin"
	| "unpin"
	| "mark_unread"
	| "fork"
	| "archive"
	| "restore"
	| "details"
	| "discard_draft"
	| "split_right"
	| "split_down"
	| "move_left"
	| "move_right"
	| "move_up"
	| "move_down"
	| "close_pane"
	| "maximize_pane"
	| "restore_layout"
	| "reconcile"
	| "open_ide_new_window";

export type MoreMenuActionKind = "omp" | "local" | "secondary";

export interface MoreMenuAction {
	readonly id: MoreMenuActionId;
	readonly label: string;
	readonly enabled: boolean;
	readonly kind: MoreMenuActionKind;
	readonly reason?: string;
}

export const CEDIA_BRAND = "Cedia";
export const NEW_TASK_LABEL = "New task";
export const FOLDER_LABEL = "Folder";
export const BRANCH_LABEL = "Branch";
export const JUMP_TO_LATEST = "Jump to latest";
export const OPEN_IDE_NEW_WINDOW_LABEL = "Open IDE in new window";
export const SPLIT_RIGHT_LABEL = "Split right";
export const SPLIT_DOWN_LABEL = "Split down";
export const MOVE_LEFT_LABEL = "Move left";
export const MOVE_RIGHT_LABEL = "Move right";
export const MOVE_UP_LABEL = "Move up";
export const MOVE_DOWN_LABEL = "Move down";
export const MOVE_PANE_REASON = "This pane cannot move that way.";
export const CLOSE_PANE_LABEL = "Close pane";
export const MAXIMIZE_PANE_LABEL = "Maximize pane";
export const RESTORE_LAYOUT_LABEL = "Restore layout";
export const OTHER_PANE_DRAFT_NOTE = "Draft in another pane";
export const NEED_MORE_SPACE_REASON = "Need more space. Maximize area or Open another window. Cedia will not squeeze this pane.";
export const FORK_NO_PARENT_REASON = "OMP has not advertised a parent session to fork.";
export const NO_SESSION_REASON = "Open a task first.";

const TITLE_SEP = " — ";
const META_SEP = " · ";

export function cediaWindowTitle(input: CediaWindowTitleInput): string {
	const projectName = clean(input.projectName);
	if (input.mode === "ide") {
		const fileName = clean(input.fileName);
		if (fileName && projectName) return joinTitle(fileName, projectName, CEDIA_BRAND);
		if (fileName) return joinTitle(fileName, CEDIA_BRAND);
		if (projectName) return joinTitle(projectName, CEDIA_BRAND);
		return CEDIA_BRAND;
	}
	const taskTitle = clean(input.taskTitle);
	if (!taskTitle) return joinTitle(NEW_TASK_LABEL, CEDIA_BRAND);
	if (projectName) return joinTitle(taskTitle, projectName, CEDIA_BRAND);
	return joinTitle(taskTitle, CEDIA_BRAND);
}

export function taskHeaderMeta(input: TaskHeaderMetaInput): TaskHeaderMeta {
	const projectName = clean(input.projectName);
	const path = clean(input.path);
	const branch = clean(input.branch);
	const worktree = clean(input.worktree);
	const cwd = clean(input.cwd);
	const parentSession = clean(input.parentSession);
	const locationKind: TaskHeaderLocationKind = branch ? "branch" : "folder";
	const locationLabel = branch ? BRANCH_LABEL : FOLDER_LABEL;
	const summary = uniqueParts([
		projectName,
		branch || FOLDER_LABEL,
		worktree,
		path,
		cwd,
		parentSession ? `parent ${parentSession}` : "",
	]).join(META_SEP);
	return {
		...(projectName ? { projectName } : {}),
		locationKind,
		locationLabel,
		...(branch ? { branch } : {}),
		...(worktree ? { worktree } : {}),
		...(path ? { path } : {}),
		...(cwd ? { cwd } : {}),
		...(parentSession ? { parentSession } : {}),
		summary,
	};
}

export function moreMenuActions(input: MoreMenuActionsInput): readonly MoreMenuAction[] {
	const hasSession = input.hasSession;
	const pinned = input.pinned === true;
	const archived = input.archived === true;
	const hasParent = input.hasParent === true;
	const actions: MoreMenuAction[] = [
		item("rename", "Rename", "omp", hasSession, hasSession ? undefined : NO_SESSION_REASON),
		item(pinned ? "unpin" : "pin", pinned ? "Unpin" : "Pin", "omp", hasSession, hasSession ? undefined : NO_SESSION_REASON),
		item("mark_unread", "Mark unread", "local", true),
		item("fork", "Fork", "omp", hasParent, hasParent ? undefined : FORK_NO_PARENT_REASON),
		item(archived ? "restore" : "archive", archived ? "Restore" : "Archive", "omp", hasSession, hasSession ? undefined : NO_SESSION_REASON),
		item("discard_draft", "Discard draft", "local", input.hasDraft === true, input.hasDraft === true ? undefined : "No draft on this view. Discard draft does not delete a session."),
		item("details", "Details", "omp", true),
		item("split_right", SPLIT_RIGHT_LABEL, "local", input.canSplitRight !== false, input.canSplitRight === false ? NEED_MORE_SPACE_REASON : undefined),
		item("split_down", SPLIT_DOWN_LABEL, "local", input.canSplitDown !== false, input.canSplitDown === false ? NEED_MORE_SPACE_REASON : undefined),
	];
	if ((input.paneCount ?? 1) > 1) {
		actions.push(
			item("move_left", MOVE_LEFT_LABEL, "local", input.canMoveLeft === true, input.canMoveLeft === true ? undefined : MOVE_PANE_REASON),
			item("move_right", MOVE_RIGHT_LABEL, "local", input.canMoveRight === true, input.canMoveRight === true ? undefined : MOVE_PANE_REASON),
			item("move_up", MOVE_UP_LABEL, "local", input.canMoveUp === true, input.canMoveUp === true ? undefined : MOVE_PANE_REASON),
			item("move_down", MOVE_DOWN_LABEL, "local", input.canMoveDown === true, input.canMoveDown === true ? undefined : MOVE_PANE_REASON),
		);
	}
	actions.push(item("close_pane", CLOSE_PANE_LABEL, "local", true));
	if ((input.paneCount ?? 1) > 1) {
		if (input.paneMaximized === true) {
			actions.push(item("restore_layout", RESTORE_LAYOUT_LABEL, "local", true));
		} else {
			actions.push(item("maximize_pane", MAXIMIZE_PANE_LABEL, "local", true));
		}
	}
	if (input.recoveryRequired) {
		actions.push(item("reconcile", "Reconcile", "omp", true));
	}
	actions.push(item("open_ide_new_window", OPEN_IDE_NEW_WINDOW_LABEL, "secondary", true));
	return actions;
}

export function unreadJumpLabel(unread: number): string {
	const count = Number.isFinite(unread) ? Math.max(0, Math.trunc(unread)) : 0;
	return count > 0 ? `${JUMP_TO_LATEST}${META_SEP}${count}` : JUMP_TO_LATEST;
}

function clean(value?: string): string {
	return value?.trim() ?? "";
}

function joinTitle(...parts: string[]): string {
	return parts.join(TITLE_SEP);
}

function uniqueParts(values: readonly string[]): string[] {
	const parts: string[] = [];
	for (const value of values) {
		if (!value || parts.includes(value)) continue;
		parts.push(value);
	}
	return parts;
}

function item(
	id: MoreMenuActionId,
	label: string,
	kind: MoreMenuActionKind,
	enabled: boolean,
	reason?: string,
): MoreMenuAction {
	return reason === undefined ? { id, label, enabled, kind } : { id, label, enabled, kind, reason };
}
