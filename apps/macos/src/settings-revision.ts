/** Settings Apply/Reset helpers (S13 / D13). Presentation only — no OMP start/stop, no invented Cloud. */

export const SETTINGS_SCOPES = ["global", "project", "session"] as const;
export type SettingsScope = (typeof SETTINGS_SCOPES)[number];

export const SETTINGS_APPLY_SCOPE_REASON = "Project and session writes are not advertised.";
export const SETTINGS_APPLY_STALE_REASON = "Config changed — reload before Apply.";

const GLOBAL_SOURCE = "this Mac · product prefs";
const PROJECT_SOURCE = "OMP project config (read-only until a scoped write contract exists)";
const SESSION_SOURCE = "OMP session config (read-only until a scoped write contract exists)";

export interface SettingsSectionDraft {
	readonly section: string;
	readonly revision: number;
	readonly values: Record<string, unknown>;
	readonly scope: SettingsScope;
}

export type ApplySettingsResult =
	| { readonly ok: false; readonly reason: string }
	| { readonly ok: true; readonly revision: number; readonly values: Record<string, unknown> };

export interface ResetOverridePreview {
	readonly key: string;
	readonly current: unknown;
	readonly inherited: unknown;
	readonly removes: string;
}

export function settingsSourcePath(scope: SettingsScope): string {
	switch (scope) {
		case "global":
			return GLOBAL_SOURCE;
		case "project":
			return PROJECT_SOURCE;
		case "session":
			return SESSION_SOURCE;
	}
}

/** Project and session scopes are never writable from this helper. */
export function settingsScopeWritable(scope: SettingsScope): boolean {
	return scope === "global";
}

export function beginSettingsDraft(
	section: string,
	revision: number,
	values: Record<string, unknown>,
	scope: SettingsScope = "global",
): SettingsSectionDraft {
	return {
		section,
		revision,
		values: { ...values },
		scope,
	};
}

export function applySettingsSection(activeRevision: number, draft: SettingsSectionDraft): ApplySettingsResult {
	if (draft.scope !== "global") {
		return { ok: false, reason: SETTINGS_APPLY_SCOPE_REASON };
	}
	if (draft.revision !== activeRevision) {
		return { ok: false, reason: SETTINGS_APPLY_STALE_REASON };
	}
	return { ok: true, revision: activeRevision + 1, values: draft.values };
}

export function previewResetOverride(key: string, current: unknown, inherited: unknown): ResetOverridePreview {
	return { key, current, inherited, removes: key };
}

export function nextSettingsRevision(n: number): number {
	if (!Number.isFinite(n)) {
		return 0;
	}
	const next = Math.trunc(n) + 1;
	if (next < 0) {
		return 0;
	}
	if (next > Number.MAX_SAFE_INTEGER) {
		return Number.MAX_SAFE_INTEGER;
	}
	return next;
}
