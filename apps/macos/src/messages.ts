/** Messages accepted from the task webview.  Keep this boundary explicit: a
 * webview can request a native action, but it cannot supply a filesystem
 * operation or execute a host command by smuggling an arbitrary action name. */

export type NativeAction = "files" | "diff" | "terminal" | "settings";
export type UiAnswer = string | boolean | { readonly cancelled: true; readonly timedOut?: boolean };

export type WebviewMessage =
	| { readonly type: "send_prompt"; readonly text: string }
	| { readonly type: "stop" }
	| { readonly type: "steer"; readonly text: string }
	| { readonly type: "follow_up"; readonly text: string }
	| { readonly type: "new_task" }
	| { readonly type: "task_actions" }
	| { readonly type: "select_project"; readonly projectId: string }
	| { readonly type: "select_session"; readonly sessionId: string }
	| { readonly type: "search"; readonly query: string }
	| { readonly type: "refresh" }
	| { readonly type: "load_more" }
	| { readonly type: "get_models" }
	| { readonly type: "get_login_providers" }
	| { readonly type: "start_login"; readonly providerId: string }
	| { readonly type: "open_login_url"; readonly url: string }
	| { readonly type: "select_model"; readonly modelId: string; readonly provider?: string }
	| { readonly type: "ui_answer"; readonly token: string; readonly answer: string | boolean | { readonly cancelled: true; readonly timedOut?: boolean } }
	| { readonly type: "ui_cancel"; readonly token: string }
	| { readonly type: "native_action"; readonly action: NativeAction }
	| { readonly type: "rename_session"; readonly title: string }
	| { readonly type: "archive_session" }
	| { readonly type: "pin_session"; readonly pinned: boolean };

const NATIVE_ACTIONS: readonly NativeAction[] = ["files", "diff", "terminal", "settings"];
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
	return isRecord(value) && value.cancelled === true && (value.timedOut === undefined || typeof value.timedOut === "boolean") && Object.keys(value).every(key => key === "cancelled" || key === "timedOut");
}

/** Parse and clone one webview message. Unknown fields are ignored after the
 * discriminant is validated; no object from the untrusted page crosses into
 * the extension or host request body. */
export function parseWebviewMessage(value: unknown): WebviewMessage | undefined {
	if (!isRecord(value) || typeof value.type !== "string") return undefined;
	switch (value.type) {
		case "send_prompt": return string(value.text, MAX_TEXT) && value.text.trim() ? { type: "send_prompt", text: value.text } : undefined;
		case "stop": return { type: "stop" };
		case "steer": return string(value.text, MAX_TEXT) && value.text.trim() ? { type: "steer", text: value.text } : undefined;
		case "follow_up": return string(value.text, MAX_TEXT) && value.text.trim() ? { type: "follow_up", text: value.text } : undefined;
		case "new_task": return { type: "new_task" };
		case "task_actions": return { type: "task_actions" };
		case "select_project": return nonEmpty(value.projectId, 512) ? { type: "select_project", projectId: value.projectId } : undefined;
		case "select_session": return nonEmpty(value.sessionId, 512) ? { type: "select_session", sessionId: value.sessionId } : undefined;
		case "search": return string(value.query, 1024) ? { type: "search", query: value.query } : undefined;
		case "refresh": return { type: "refresh" };
		case "load_more": return { type: "load_more" };
		case "get_models": return { type: "get_models" };
		case "get_login_providers": return { type: "get_login_providers" };
		case "start_login": return nonEmpty(value.providerId, 512) ? { type: "start_login", providerId: value.providerId } : undefined;
		case "open_login_url": return string(value.url, 8_192) && isSafeExternalUrl(value.url) ? { type: "open_login_url", url: value.url } : undefined;
		case "select_model": return nonEmpty(value.modelId, 512) && (value.provider === undefined || nonEmpty(value.provider, 512)) ? { type: "select_model", modelId: value.modelId, ...(typeof value.provider === "string" ? { provider: value.provider } : {}) } : undefined;
		case "ui_answer": return nonEmpty(value.token, 512) && answer(value.answer) ? { type: "ui_answer", token: value.token, answer: value.answer } : undefined;
		case "ui_cancel": return nonEmpty(value.token, 512) ? { type: "ui_cancel", token: value.token } : undefined;
		case "native_action": return typeof value.action === "string" && (NATIVE_ACTIONS as readonly string[]).includes(value.action) ? { type: "native_action", action: value.action as NativeAction } : undefined;
		case "rename_session": return nonEmpty(value.title, 512) ? { type: "rename_session", title: value.title.trim() } : undefined;
		case "archive_session": return { type: "archive_session" };
		case "pin_session": return boolean(value.pinned) ? { type: "pin_session", pinned: value.pinned } : undefined;
		default: return undefined;
	}
}
