/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Shell-switch state contract (roadmap Phase B): the 12 preserved fields that
// must survive IDE ⇄ Agents shell switches. Serializable (JSON-safe) and
// DOM-free by design — no workbench test harness exists, so callers pass
// plain values in and apply plain values out; every rule lives in the pure
// keepers below and is exercised by a bun one-shot, never by hand.

/** 6. Cursor position inside the active file (1-based, editor convention). */
export interface IShellCursorPosition {
	readonly lineNumber: number;
	readonly column: number;
}

/** 11. Panel visibility. Booleans only — no geometry lives here. */
export interface IShellPanelVisibility {
	readonly sidebarVisible: boolean;
	readonly panelVisible: boolean;
}

/** 12. Observed shell widths, null when unknown. The reference atlas does
 * not exist yet (roadmap Phase C), so there are no measured defaults:
 * callers pass through observed values, never fillers. */
export interface IShellWidths {
	readonly sidebarWidth: number | null;
	readonly panelWidth: number | null;
}

export interface IShellState {
	/** 1. Session the switch preserves. Null when no session is open. */
	readonly activeSessionId: string | null;
	/** 2. Timeline scroll offset. Null when the timeline is not rendered. */
	readonly scrollTop: number | null;
	/** 3. Unsent composer text. Verbatim — never trimmed. */
	readonly draft: string;
	/** 4. Queued prompts, oldest first. */
	readonly queue: string[];
	/** 5. Active editor file (absolute path). */
	readonly activeFile: string | null;
	/** 6. Cursor inside the active file. Null without an editor position. */
	readonly cursor: IShellCursorPosition | null;
	/** 7. Open editor tabs (absolute paths), visible order. */
	readonly openTabs: string[];
	/** 8. Active terminal id (opaque — the terminal service owns it). */
	readonly activeTerminalId: string | null;
	/** 9. Browser-preview URL. Null when the preview is closed. */
	readonly browserUrl: string | null;
	/** 10. File under review. Null outside a review session. */
	readonly reviewFile: string | null;
	/** 11. Which shell panels stay visible across the switch. */
	readonly panelVisibility: IShellPanelVisibility;
	/** 12. Observed shell widths. */
	readonly widths: IShellWidths;
}

/** Nothing captured: the corrupt-storage sentinel and the capture({}) baseline.
// Future applicators must diff against live state, never apply EMPTY blindly —
// until the reference atlas lands there are no true appearance defaults. */
export const EMPTY_SHELL_STATE: IShellState = {
	activeSessionId: null,
	scrollTop: null,
	draft: '',
	queue: [],
	activeFile: null,
	cursor: null,
	openTabs: [],
	activeTerminalId: null,
	browserUrl: null,
	reviewFile: null,
	panelVisibility: { sidebarVisible: false, panelVisible: false },
	widths: { sidebarWidth: null, panelWidth: null },
};

function asNullableString(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function asStringList(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function asScrollTop(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function asWidth(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function asCursor(value: unknown): IShellCursorPosition | null {
	if (typeof value !== 'object' || value === null) {
		return null;
	}
	const cursor = value as Record<string, unknown>;
	if (!Number.isInteger(cursor['lineNumber']) || !Number.isInteger(cursor['column'])) {
		return null;
	}
	const lineNumber = cursor['lineNumber'] as number;
	const column = cursor['column'] as number;
	return lineNumber >= 1 && column >= 1 ? { lineNumber, column } : null;
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/** Structural guard: true when a parsed value has every field with the right
 * shape. Semantic repair (negatives, NaN, empties) is capture's job. */
export function isShellState(value: unknown): value is IShellState {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const state = value as Record<string, unknown>;
	const visibility = state['panelVisibility'] as Record<string, unknown> | null;
	const widths = state['widths'] as Record<string, unknown> | null;
	return (
		(state['activeSessionId'] === null || typeof state['activeSessionId'] === 'string') &&
		(state['scrollTop'] === null || typeof state['scrollTop'] === 'number') &&
		typeof state['draft'] === 'string' &&
		isStringArray(state['queue']) &&
		(state['activeFile'] === null || typeof state['activeFile'] === 'string') &&
		(state['cursor'] === null || typeof state['cursor'] === 'object') &&
		isStringArray(state['openTabs']) &&
		(state['activeTerminalId'] === null || typeof state['activeTerminalId'] === 'string') &&
		(state['browserUrl'] === null || typeof state['browserUrl'] === 'string') &&
		(state['reviewFile'] === null || typeof state['reviewFile'] === 'string') &&
		typeof visibility === 'object' && visibility !== null &&
		typeof visibility['sidebarVisible'] === 'boolean' &&
		typeof visibility['panelVisible'] === 'boolean' &&
		typeof widths === 'object' && widths !== null &&
		(widths['sidebarWidth'] === null || typeof widths['sidebarWidth'] === 'number') &&
		(widths['panelWidth'] === null || typeof widths['panelWidth'] === 'number')
	);
}

/** Build the preservable snapshot from caller-supplied plain values. Tolerant
 * by design — service values cross trust boundaries, so wrong runtime types
 * fall back to EMPTY defaults instead of throwing. Arrays are copied. */
export function captureShellState(input: Partial<IShellState>): IShellState {
	const visibility = input.panelVisibility;
	const widths = input.widths;
	return {
		activeSessionId: asNullableString(input.activeSessionId),
		scrollTop: asScrollTop(input.scrollTop),
		draft: typeof input.draft === 'string' ? input.draft : '',
		queue: asStringList(input.queue),
		activeFile: asNullableString(input.activeFile),
		cursor: asCursor(input.cursor),
		openTabs: asStringList(input.openTabs),
		activeTerminalId: asNullableString(input.activeTerminalId),
		browserUrl: asNullableString(input.browserUrl),
		reviewFile: asNullableString(input.reviewFile),
		panelVisibility: {
			sidebarVisible: visibility?.sidebarVisible === true,
			panelVisible: visibility?.panelVisible === true,
		},
		widths: {
			sidebarWidth: asWidth(widths?.sidebarWidth),
			panelWidth: asWidth(widths?.panelWidth),
		},
	};
}

/** Validate stored state back into a safe snapshot. Corrupt storage degrades
 * to EMPTY — this must never throw into shell startup. Always returns fresh
 * objects, never the EMPTY singleton or the caller's arrays. */
export function restoreShellState(stored: unknown): IShellState {
	return captureShellState(isShellState(stored) ? stored : EMPTY_SHELL_STATE);
}

/** Preserve-then-update: normalize `update` over `base` (explicit nulls
 * clear a field). The bun-exercised merge behind shell switches. */
export function mergeShellState(base: IShellState, update: Partial<IShellState>): IShellState {
	return captureShellState({ ...base, ...update });
}
