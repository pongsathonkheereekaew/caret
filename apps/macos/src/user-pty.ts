/** D08 Terminal tab honesty. User PTY is Code-OSS createTerminal (native). Work panel lists receipts. Hide panel does not stop. */

export const USER_PTY_EMBEDDED = false;
export const USER_PTY_OPEN_REASON = "Opens a user PTY in Code-OSS. Hide panel does not stop the process. This work panel does not embed the shell.";
export const USER_PTY_FOCUS_REASON = "Focus shows the Code-OSS terminal. Cedia does not embed a second PTY renderer.";

export interface UserPtyPreview {
	readonly id: string;
	readonly title: string;
	readonly cwd: string;
	readonly ended: boolean;
}

export interface UserPtyRow {
	readonly id: string;
	readonly title: string;
	readonly cwd: string;
	readonly kind: "user";
	readonly status: "live" | "exited";
	readonly embedsInWebview: false;
	readonly canFocus: true;
}

export function userPtyRows(items: readonly UserPtyPreview[]): readonly UserPtyRow[] {
	return items.map((item) => ({
		id: item.id,
		title: item.title,
		cwd: item.cwd.trim() === "" ? "cwd unknown" : item.cwd,
		kind: "user",
		status: item.ended ? "exited" : "live",
		embedsInWebview: false,
		canFocus: true,
	}));
}

export function newUserPtyPlan(cwd?: string): {
	readonly title: "Cedia user";
	readonly cwd: string;
	readonly embedsInWebview: false;
	readonly opensNative: true;
	readonly reason: typeof USER_PTY_OPEN_REASON;
} {
	return {
		title: "Cedia user",
		cwd: cwd ?? "",
		embedsInWebview: false,
		opensNative: true,
		reason: USER_PTY_OPEN_REASON,
	};
}

export function focusUserPtyPlan(): {
	readonly opensNative: true;
	readonly embedsInWebview: false;
	readonly reason: typeof USER_PTY_FOCUS_REASON;
} {
	return {
		opensNative: true,
		embedsInWebview: false,
		reason: USER_PTY_FOCUS_REASON,
	};
}
