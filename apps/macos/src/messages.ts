/** Messages accepted from the task webview.  Keep this boundary explicit: a
 * webview can request a native action, but it cannot supply a filesystem
 * operation or execute a host command by smuggling an arbitrary action name. */

export type NativeAction = "files" | "diff" | "terminal" | "settings" | "browser" | "preview" | "artifacts" | "pair" | "devices" | "host_settings";
export type UiAnswer = string | boolean | readonly string[] | { readonly cancelled: true; readonly timedOut?: boolean };

export type WebviewMessage =
	| { readonly type: "send_prompt"; readonly text: string; readonly viewId?: string }
	| { readonly type: "stop" }
	| { readonly type: "steer"; readonly text: string; readonly viewId?: string }
	| { readonly type: "follow_up"; readonly text: string; readonly viewId?: string }
	| { readonly type: "new_task" }
	| { readonly type: "open_folder" }
	| { readonly type: "task_actions" }
	| { readonly type: "select_project"; readonly projectId: string }
	| { readonly type: "select_session"; readonly sessionId: string }
	| { readonly type: "search"; readonly query: string; readonly scope?: "all" | "tasks" | "files" | "actions" | "settings" }
	| { readonly type: "refresh" }
	| { readonly type: "load_more" }
	| { readonly type: "get_models" }
	| { readonly type: "get_login_providers" }
	| { readonly type: "get_slash_commands" }
	| { readonly type: "run_slash"; readonly name: string }
	| { readonly type: "compact" }
	| { readonly type: "start_login"; readonly providerId: string }
	| { readonly type: "open_login_url"; readonly url: string }
	| { readonly type: "select_model"; readonly modelId: string; readonly provider?: string }
	| { readonly type: "select_thinking_level"; readonly level: string }
	| { readonly type: "ui_answer"; readonly token: string; readonly answer: string | boolean | readonly string[] | { readonly cancelled: true; readonly timedOut?: boolean } }
	| { readonly type: "ui_cancel"; readonly token: string }
	| { readonly type: "native_action"; readonly action: NativeAction }
	| { readonly type: "rename_session"; readonly title?: string; readonly sessionId?: string }
	| { readonly type: "archive_session"; readonly sessionId?: string; readonly archived?: boolean }
	| { readonly type: "pin_session"; readonly pinned: boolean; readonly sessionId?: string }
	| { readonly type: "set_workbench_mode"; readonly mode: "agents" | "ide" }
	| { readonly type: "persist_draft"; readonly draft: string }
	| { readonly type: "persist_scroll"; readonly offset: number; readonly eventId?: string; readonly followLatest: boolean; readonly viewId?: string }
	| { readonly type: "work_panel"; readonly tab: "changes" | "terminal" | "browser" | "preview" | "artifacts" | "files" }
	| { readonly type: "close_work_panel" }
	| { readonly type: "jump_latest" }
	| { readonly type: "inspect_outcome" }
	| { readonly type: "pick_attachments" }
	| { readonly type: "remove_attachment"; readonly id: string }
	| { readonly type: "retry_attachment"; readonly id: string }
	| { readonly type: "refresh_review" }
	| { readonly type: "refresh_devices" }
	| { readonly type: "open_workspace_file"; readonly path: string }
	| { readonly type: "review_file"; readonly path: string }
	| { readonly type: "native_diff"; readonly path: string }
	| { readonly type: "set_pref"; readonly key: "density" | "panelPosition" | "submitEnter" | "reduceMotion" | "highContrast" | "startupView" | "windowRestore" | "autoHideEmptyIde"; readonly value: string | boolean }
	| { readonly type: "work_panel_layout"; readonly preferredWidth?: number; readonly preferredHeight?: number; readonly preferredSidebarWidth?: number; readonly position?: "right" | "bottom" }
	| { readonly type: "set_sidebar_filters"; readonly filters: Record<string, unknown> }
	| { readonly type: "export_diagnostics" }
	| { readonly type: "restore_sent_draft" }
	| { readonly type: "apply_settings"; readonly section: string; readonly revision: number; readonly values: Record<string, unknown>; readonly scope?: "global" | "project" | "session" }
	| { readonly type: "reset_settings"; readonly key: string; readonly revision?: number }
	| { readonly type: "route_error_action"; readonly action: "back" | "projects" }
	| { readonly type: "more_action"; readonly id: string }
	| { readonly type: "viewport"; readonly width: number; readonly height: number }
	| { readonly type: "copy_queue_draft"; readonly commandId: string }
	| { readonly type: "revoke_device"; readonly deviceId: string }
	| { readonly type: "mark_all_read" }
	| { readonly type: "download_artifact"; readonly sha256: string }
	| { readonly type: "select_destination"; readonly id: string }
	| { readonly type: "mention_pick"; readonly kind: "file" | "folder" | "selection" | "logs" | "artifacts" | "session"; readonly id: string }
	| { readonly type: "refresh_branch" }
	| { readonly type: "select_branch_ref"; readonly ref: string }
	| { readonly type: "create_worktree" }
	| { readonly type: "cancel_worktree" }
	| { readonly type: "restart_resource"; readonly tab: "changes" | "terminal" | "browser" | "preview" | "artifacts" | "files" }
	| { readonly type: "set_queue_collapsed"; readonly collapsed: boolean }
	| { readonly type: "split_pane"; readonly direction: "right" | "down" }
	| { readonly type: "close_pane"; readonly viewId?: string }
	| { readonly type: "focus_pane"; readonly viewId: string }
	| { readonly type: "open_recent"; readonly path: string }
	| { readonly type: "focus_user_pty"; readonly id: string }
	| { readonly type: "persist_pane_draft"; readonly viewId: string; readonly draft: string }
	| { readonly type: "set_layout_ratio"; readonly firstViewId: string; readonly ratio: number }
	| { readonly type: "pop_to_ide"; readonly tab?: "changes" | "terminal" | "browser" | "preview" | "artifacts" | "files" }
	| { readonly type: "open_in_split"; readonly sessionId: string }
	| { readonly type: "select_theme" }
	| { readonly type: "open_keybindings" }
	| { readonly type: "open_merge_editor"; readonly path: string }
	| { readonly type: "navigate_projects" }
	| { readonly type: "route_back" }
	| { readonly type: "route_forward" };

const NATIVE_ACTIONS: readonly NativeAction[] = ["files", "diff", "terminal", "settings", "browser", "preview", "artifacts", "pair", "devices", "host_settings"];
const WORK_TABS = ["changes", "terminal", "browser", "preview", "artifacts", "files"] as const;
const SEARCH_SCOPES = ["all", "tasks", "files", "actions", "settings"] as const;
const MAX_TEXT = 100_000;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function string(value: unknown, max = 4096): value is string {
	return typeof value === "string" && value.length <= max;
}

function nonEmpty(value: unknown, max = 4096): value is string {
	return string(value, max) && value.trim().length > 0;
}

function boolean(value: unknown): value is boolean {
	return typeof value === "boolean";
}

function isSafeExternalUrl(value: string): boolean {
	try {
		const parsed = new URL(value);
		return parsed.protocol === "https:" || parsed.protocol === "http:";
	} catch {
		return false;
	}
}

function answer(value: unknown): value is UiAnswer {
	if (typeof value === "string" && value.length <= MAX_TEXT) return true;
	if (typeof value === "boolean") return true;
	if (Array.isArray(value) && value.length <= 64 && value.every((item) => typeof item === "string" && item.length <= 1024)) return true;
	return isRecord(value) && value.cancelled === true && (value.timedOut === undefined || typeof value.timedOut === "boolean") && Object.keys(value).every(key => key === "cancelled" || key === "timedOut");
}

/** Parse and clone one webview message. Unknown fields are ignored after the
 * discriminant is validated; no object from the untrusted page crosses into
 * the extension or host request body. */
export function parseWebviewMessage(value: unknown): WebviewMessage | undefined {
	if (!isRecord(value) || typeof value.type !== "string") return undefined;
	switch (value.type) {
		case "send_prompt": return string(value.text, MAX_TEXT) && value.text.trim()
			? { type: "send_prompt", text: value.text, ...(nonEmpty(value.viewId, 128) ? { viewId: value.viewId } : {}) }
			: undefined;
		case "stop": return { type: "stop" };
		case "steer": return string(value.text, MAX_TEXT) && value.text.trim()
			? { type: "steer", text: value.text, ...(nonEmpty(value.viewId, 128) ? { viewId: value.viewId } : {}) }
			: undefined;
		case "follow_up": return string(value.text, MAX_TEXT) && value.text.trim()
			? { type: "follow_up", text: value.text, ...(nonEmpty(value.viewId, 128) ? { viewId: value.viewId } : {}) }
			: undefined;
		case "new_task": return { type: "new_task" };
		case "open_folder": return { type: "open_folder" };
		case "task_actions": return { type: "task_actions" };
		case "select_project": return nonEmpty(value.projectId, 512) ? { type: "select_project", projectId: value.projectId } : undefined;
		case "select_session": return nonEmpty(value.sessionId, 512) ? { type: "select_session", sessionId: value.sessionId } : undefined;
		case "search": return string(value.query, 1024) && (value.scope === undefined || (SEARCH_SCOPES as readonly string[]).includes(value.scope as string))
			? { type: "search", query: value.query, ...(typeof value.scope === "string" ? { scope: value.scope as (typeof SEARCH_SCOPES)[number] } : {}) }
			: undefined;
		case "refresh": return { type: "refresh" };
		case "load_more": return { type: "load_more" };
		case "get_models": return { type: "get_models" };
		case "get_login_providers": return { type: "get_login_providers" };
		case "get_slash_commands": return { type: "get_slash_commands" };
		case "run_slash": return nonEmpty(value.name, 256) ? { type: "run_slash", name: value.name.trim() } : undefined;
		case "compact": return { type: "compact" };
		case "start_login": return nonEmpty(value.providerId, 512) ? { type: "start_login", providerId: value.providerId } : undefined;
		case "open_login_url": return string(value.url, 8_192) && isSafeExternalUrl(value.url) ? { type: "open_login_url", url: value.url } : undefined;
		case "select_model": return nonEmpty(value.modelId, 512) && (value.provider === undefined || nonEmpty(value.provider, 512)) ? { type: "select_model", modelId: value.modelId, ...(typeof value.provider === "string" ? { provider: value.provider } : {}) } : undefined;
		case "select_thinking_level": return nonEmpty(value.level, 64) ? { type: "select_thinking_level", level: value.level.trim() } : undefined;
		case "ui_answer": return nonEmpty(value.token, 512) && answer(value.answer) ? { type: "ui_answer", token: value.token, answer: value.answer } : undefined;
		case "ui_cancel": return nonEmpty(value.token, 512) ? { type: "ui_cancel", token: value.token } : undefined;
		case "native_action": return typeof value.action === "string" && (NATIVE_ACTIONS as readonly string[]).includes(value.action) ? { type: "native_action", action: value.action as NativeAction } : undefined;
		case "rename_session": {
			const sessionId = nonEmpty(value.sessionId, 512) ? value.sessionId.trim() : undefined;
			const title = typeof value.title === "string" && value.title.trim() && value.title.length <= 512 ? value.title.trim() : undefined;
			if (!sessionId && !title) return undefined;
			return { type: "rename_session", ...(title ? { title } : {}), ...(sessionId ? { sessionId } : {}) };
		}
		case "archive_session": {
			const sessionId = nonEmpty(value.sessionId, 512) ? value.sessionId.trim() : undefined;
			const archived = typeof value.archived === "boolean" ? value.archived : undefined;
			return { type: "archive_session", ...(sessionId ? { sessionId } : {}), ...(archived === undefined ? {} : { archived }) };
		}
		case "pin_session": {
			if (!boolean(value.pinned)) return undefined;
			const sessionId = nonEmpty(value.sessionId, 512) ? value.sessionId.trim() : undefined;
			return { type: "pin_session", pinned: value.pinned, ...(sessionId ? { sessionId } : {}) };
		}
		case "set_workbench_mode": return value.mode === "agents" || value.mode === "ide" ? { type: "set_workbench_mode", mode: value.mode } : undefined;
		case "persist_draft": return string(value.draft, MAX_TEXT) ? { type: "persist_draft", draft: value.draft } : undefined;
		case "persist_scroll": return typeof value.offset === "number" && Number.isFinite(value.offset) && boolean(value.followLatest) && (value.eventId === undefined || nonEmpty(value.eventId, 512))
			? {
				type: "persist_scroll",
				offset: value.offset,
				followLatest: value.followLatest,
				...(typeof value.eventId === "string" ? { eventId: value.eventId } : {}),
				...(nonEmpty(value.viewId, 128) ? { viewId: value.viewId } : {}),
			}
			: undefined;
		case "work_panel": return typeof value.tab === "string" && (WORK_TABS as readonly string[]).includes(value.tab) ? { type: "work_panel", tab: value.tab as (typeof WORK_TABS)[number] } : undefined;
		case "close_work_panel": return { type: "close_work_panel" };
		case "jump_latest": return { type: "jump_latest" };
		case "inspect_outcome": return { type: "inspect_outcome" };
		case "pick_attachments": return { type: "pick_attachments" };
		case "remove_attachment": return nonEmpty(value.id, 512) ? { type: "remove_attachment", id: value.id } : undefined;
		case "retry_attachment": return nonEmpty(value.id, 512) ? { type: "retry_attachment", id: value.id } : undefined;
		case "refresh_review": return { type: "refresh_review" };
		case "refresh_devices": return { type: "refresh_devices" };
		case "open_workspace_file": return nonEmpty(value.path, 1024) ? { type: "open_workspace_file", path: value.path } : undefined;
		case "review_file": return nonEmpty(value.path, 1024) ? { type: "review_file", path: value.path } : undefined;
		case "native_diff": return nonEmpty(value.path, 1024) ? { type: "native_diff", path: value.path } : undefined;
		case "set_pref": {
			if (value.key === "density" && (value.value === "comfortable" || value.value === "detailed")) return { type: "set_pref", key: "density", value: value.value };
			if (value.key === "panelPosition" && (value.value === "right" || value.value === "bottom")) return { type: "set_pref", key: "panelPosition", value: value.value };
			if ((value.key === "submitEnter" || value.key === "reduceMotion" || value.key === "highContrast" || value.key === "windowRestore" || value.key === "autoHideEmptyIde") && typeof value.value === "boolean") return { type: "set_pref", key: value.key, value: value.value };
			if (value.key === "startupView" && (value.value === "ide" || value.value === "agents" || value.value === "last_task")) return { type: "set_pref", key: "startupView", value: value.value };
			return undefined;
		}
		case "work_panel_layout": {
			const preferredWidth = typeof value.preferredWidth === "number" && Number.isFinite(value.preferredWidth) ? value.preferredWidth : undefined;
			const preferredHeight = typeof value.preferredHeight === "number" && Number.isFinite(value.preferredHeight) ? value.preferredHeight : undefined;
			const preferredSidebarWidth = typeof value.preferredSidebarWidth === "number" && Number.isFinite(value.preferredSidebarWidth) ? value.preferredSidebarWidth : undefined;
			const position = value.position === "right" || value.position === "bottom" ? value.position : undefined;
			if (preferredWidth === undefined && preferredHeight === undefined && preferredSidebarWidth === undefined && position === undefined) return undefined;
			return { type: "work_panel_layout", ...(preferredWidth === undefined ? {} : { preferredWidth }), ...(preferredHeight === undefined ? {} : { preferredHeight }), ...(preferredSidebarWidth === undefined ? {} : { preferredSidebarWidth }), ...(position ? { position } : {}) };
		}
		case "set_sidebar_filters": return isRecord(value.filters) ? { type: "set_sidebar_filters", filters: { ...value.filters } } : undefined;
		case "export_diagnostics": return { type: "export_diagnostics" };
		case "restore_sent_draft": return { type: "restore_sent_draft" };
		case "apply_settings": {
			if (!nonEmpty(value.section, 128) || typeof value.revision !== "number" || !Number.isFinite(value.revision) || !isRecord(value.values)) return undefined;
			const scope = value.scope === "project" || value.scope === "session" || value.scope === "global" ? value.scope : "global";
			const values: Record<string, unknown> = {};
			for (const [key, item] of Object.entries(value.values)) {
				if (key.length > 64) continue;
				if (typeof item === "string" && item.length <= 256) values[key] = item;
				else if (typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))) values[key] = item;
			}
			return { type: "apply_settings", section: value.section, revision: Math.trunc(value.revision), values, scope };
		}
		case "reset_settings": {
			if (!nonEmpty(value.key, 64)) return undefined;
			const revision = typeof value.revision === "number" && Number.isFinite(value.revision) ? Math.trunc(value.revision) : undefined;
			return { type: "reset_settings", key: value.key, ...(revision === undefined ? {} : { revision }) };
		}
		case "route_error_action": return value.action === "back" || value.action === "projects" ? { type: "route_error_action", action: value.action } : undefined;
		case "more_action": return nonEmpty(value.id, 64) ? { type: "more_action", id: value.id } : undefined;
		case "copy_queue_draft": return nonEmpty(value.commandId, 512) ? { type: "copy_queue_draft", commandId: value.commandId } : undefined;
		case "revoke_device": return nonEmpty(value.deviceId, 512) ? { type: "revoke_device", deviceId: value.deviceId } : undefined;
		case "mark_all_read": return { type: "mark_all_read" };
		case "download_artifact": return nonEmpty(value.sha256, 64) && /^[a-f0-9]{64}$/.test(value.sha256) ? { type: "download_artifact", sha256: value.sha256 } : undefined;
		case "select_destination": return nonEmpty(value.id, 64) ? { type: "select_destination", id: value.id } : undefined;
		case "refresh_branch": return { type: "refresh_branch" };
		case "select_branch_ref": return nonEmpty(value.ref, 256) ? { type: "select_branch_ref", ref: value.ref.trim() } : undefined;
		case "create_worktree": return { type: "create_worktree" };
		case "cancel_worktree": return { type: "cancel_worktree" };
		case "restart_resource": {
			const tab = value.tab;
			const allowed = tab === "changes" || tab === "terminal" || tab === "browser" || tab === "preview" || tab === "artifacts" || tab === "files";
			return allowed ? { type: "restart_resource", tab } : undefined;
		}
		case "set_queue_collapsed": return typeof value.collapsed === "boolean" ? { type: "set_queue_collapsed", collapsed: value.collapsed } : undefined;
		case "split_pane": return value.direction === "right" || value.direction === "down" ? { type: "split_pane", direction: value.direction } : undefined;
		case "close_pane": return {
			type: "close_pane",
			...(nonEmpty(value.viewId, 128) ? { viewId: value.viewId } : {}),
		};
		case "focus_pane": return nonEmpty(value.viewId, 128) ? { type: "focus_pane", viewId: value.viewId } : undefined;
		case "open_recent": return nonEmpty(value.path, 4096) ? { type: "open_recent", path: value.path } : undefined;
		case "focus_user_pty": return nonEmpty(value.id, 128) ? { type: "focus_user_pty", id: value.id } : undefined;
		case "persist_pane_draft": return nonEmpty(value.viewId, 128) && string(value.draft, MAX_TEXT)
			? { type: "persist_pane_draft", viewId: value.viewId, draft: value.draft }
			: undefined;
		case "set_layout_ratio": return nonEmpty(value.firstViewId, 128) && typeof value.ratio === "number" && Number.isFinite(value.ratio)
			? { type: "set_layout_ratio", firstViewId: value.firstViewId, ratio: Math.min(0.95, Math.max(0.05, value.ratio)) }
			: undefined;
		case "pop_to_ide": {
			const tab = value.tab;
			const allowed = tab === "changes" || tab === "terminal" || tab === "browser" || tab === "preview" || tab === "artifacts" || tab === "files";
			return { type: "pop_to_ide", ...(allowed ? { tab } : {}) };
		}
		case "open_in_split": return nonEmpty(value.sessionId, 512) ? { type: "open_in_split", sessionId: value.sessionId } : undefined;
		case "select_theme": return { type: "select_theme" };
		case "open_keybindings": return { type: "open_keybindings" };
		case "open_merge_editor": return nonEmpty(value.path, 1024) ? { type: "open_merge_editor", path: value.path } : undefined;
		case "navigate_projects": return { type: "navigate_projects" };
		case "route_back": return { type: "route_back" };
		case "route_forward": return { type: "route_forward" };
		case "mention_pick": {
			const kind = value.kind;
			if (kind !== "file" && kind !== "folder" && kind !== "selection" && kind !== "logs" && kind !== "artifacts" && kind !== "session") return undefined;
			return nonEmpty(value.id, 1024) ? { type: "mention_pick", kind, id: value.id } : undefined;
		}
		case "viewport": {
			if (typeof value.width !== "number" || typeof value.height !== "number" || !Number.isFinite(value.width) || !Number.isFinite(value.height)) return undefined;
			return { type: "viewport", width: Math.max(320, Math.min(8_192, value.width)), height: Math.max(240, Math.min(8_192, value.height)) };
		}
		default: return undefined;
	}
}
