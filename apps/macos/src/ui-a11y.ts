/** Pure tokens/motion/a11y helpers for UI-S5. No vscode, no network. */

/** WCAG-oriented contrast floors for Cedia themes: text 4.5:1, UI 3:1. */
export const CONTRAST_RATIOS = {
	text: 4.5,
	ui: 3,
} as const;

export function contrastRoles(): {
	readonly text: { readonly minRatio: 4.5; readonly role: "normal text" };
	readonly ui: { readonly minRatio: 3; readonly role: "UI boundary / large text" };
} {
	return {
		text: { minRatio: 4.5, role: "normal text" },
		ui: { minRatio: 3, role: "UI boundary / large text" },
	};
}

export type MotionName = "modeSwitch" | "drawer" | "menu" | "toolExpand";

export interface MotionDuration {
	readonly enterMs: number;
	readonly exitMs: number;
}

export function motionDuration(name: MotionName, reducedMotion: boolean): MotionDuration {
	if (name === "modeSwitch" || reducedMotion) {
		return { enterMs: 0, exitMs: 0 };
	}
	// Drawer enter/exit take two steps of the reference's duration scale
	// (slow in, normal out); see MOTION_CURVE for why these values are these.
	if (name === "drawer") return { enterMs: 200, exitMs: 150 };
	if (name === "menu") return { enterMs: 150, exitMs: 100 };
	return { enterMs: 150, exitMs: 150 };
}

/** The reference product publishes its own motion scale in the shipped
 * workbench bundle as `--cursor-duration-*` and `--cursor-easing-*`. Cedia's
 * tokens are mapped onto that scale so the shell animates like the reference
 * rather than with a Cedia-invented curve:
 *
 *   instant 50  = --cursor-duration-instant
 *   fast    100 = --cursor-duration-fast
 *   normal  150 = --cursor-duration-normal
 *   slow    200 = --cursor-duration-slow
 *   curve       = --cursor-easing-out-cubic
 *
 * OS reduce or the user's Reduce Motion zeroes every duration. */
export const MOTION_CURVE = "cubic-bezier(0.215, 0.61, 0.355, 1)";

/** `--cursor-easing-out-quint`, kept for the emphasis transitions the reference
 * reserves it for. Unused by the shell today; exposed so a future surface does
 * not reintroduce an invented curve. */
export const MOTION_CURVE_STRONG = "cubic-bezier(0.16, 1, 0.3, 1)";

export interface MotionTokens {
	readonly instant: number;
	readonly feedback: number;
	readonly surfaceIn: number;
	readonly surfaceOut: number;
	readonly drawerIn: number;
	readonly drawerOut: number;
	readonly curve: string;
}

export const DEFAULT_MOTION_TOKENS: MotionTokens = {
	instant: 50,
	feedback: 100,
	surfaceIn: 150,
	surfaceOut: 100,
	drawerIn: 200,
	drawerOut: 150,
	curve: MOTION_CURVE,
};

export function motionTokens(reducedMotion: boolean): MotionTokens {
	if (reducedMotion) {
		return {
			instant: 0,
			feedback: 0,
			surfaceIn: 0,
			surfaceOut: 0,
			drawerIn: 0,
			drawerOut: 0,
			curve: MOTION_CURVE,
		};
	}
	return DEFAULT_MOTION_TOKENS;
}

/** Desktop controls ≥32px; touch targets should use 44pt. */
export const hitAreaCss = {
	desktopMinPx: 32,
	touchMinPt: 44,
	css: "min-width:32px;min-height:32px;/* touch ≥44pt */",
} as const;

export interface AnnounceState {
	readonly connection: "online" | "offline" | "reconnecting";
	readonly run: "idle" | "running" | "stopping" | "waiting" | "unknown";
	readonly tokenText?: string;
}

export function announceSummary(state: AnnounceState): string {
	const connection =
		state.connection === "online"
			? "Host connected"
			: state.connection === "reconnecting"
				? "Reconnecting to Mac"
				: "Host offline";
	const run =
		state.run === "idle"
			? "idle"
			: state.run === "running"
				? "run in progress"
				: state.run === "stopping"
					? "stopping"
					: state.run === "waiting"
						? "waiting for input"
						: "command result unconfirmed";
	return `${connection}. ${run}.`;
}
