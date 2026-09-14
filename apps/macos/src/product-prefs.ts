/** Product presentation prefs (S16 / D13). These do not start or stop OMP. */

export const PRODUCT_DENSITIES = ["comfortable", "detailed"] as const;
export type ProductDensity = (typeof PRODUCT_DENSITIES)[number];
export type WorkPanelPosition = "right" | "bottom";

/** `agents` opens the full-window Caret shell with an IDE switch in its
 * header, which is the product default (UI spec section 2: "Caret opens the
 * Agents page by default with an easy-to-find IDE button"); `ide` keeps the
 * native Code-OSS chrome and shows the agent in the docked side bar;
 * `last_task` restores whichever of the two was last used. */
export type StartupView = "ide" | "agents" | "last_task";
export const STARTUP_VIEWS: readonly StartupView[] = ["ide", "agents", "last_task"];

export interface ProductPrefs {
	readonly density: ProductDensity;
	readonly panelPosition: WorkPanelPosition;
	readonly submitEnter: boolean;
	readonly reduceMotion: boolean;
	readonly highContrast: boolean;
	readonly sidebarWidth: number;
	readonly startupView: StartupView;
	readonly windowRestore: boolean;
	readonly autoHideEmptyIde: boolean;
}

export const SIDEBAR_MIN_WIDTH = 160;
export const SIDEBAR_MAX_WIDTH = 360;
export const SIDEBAR_PREFERRED_WIDTH = 180;

export function clampSidebarWidth(preferred: number): number {
	if (!Number.isFinite(preferred)) return SIDEBAR_PREFERRED_WIDTH;
	return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(preferred)));
}

export const DEFAULT_PRODUCT_PREFS: ProductPrefs = {
	density: "comfortable",
	panelPosition: "right",
	submitEnter: true,
	reduceMotion: false,
	highContrast: false,
	sidebarWidth: SIDEBAR_PREFERRED_WIDTH,
	startupView: "agents",
	windowRestore: true,
	autoHideEmptyIde: false,
};

export function normalizeProductPrefs(value: unknown): ProductPrefs {
	if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_PRODUCT_PREFS;
	const record = value as Record<string, unknown>;
	return {
		density: record.density === "detailed" ? "detailed" : "comfortable",
		panelPosition: record.panelPosition === "bottom" ? "bottom" : "right",
		submitEnter: record.submitEnter !== false,
		reduceMotion: record.reduceMotion === true,
		highContrast: record.highContrast === true,
		sidebarWidth: clampSidebarWidth(typeof record.sidebarWidth === "number" ? record.sidebarWidth : SIDEBAR_PREFERRED_WIDTH),
		startupView: record.startupView === "last_task" || record.startupView === "ide" ? record.startupView : "agents",
		windowRestore: record.windowRestore !== false,
		autoHideEmptyIde: record.autoHideEmptyIde === true,
	};
}

export const PRODUCT_PREF_SETTING_KEYS = [
	"density",
	"panelPosition",
	"submitEnter",
	"reduceMotion",
	"highContrast",
	"startupView",
	"windowRestore",
	"autoHideEmptyIde",
] as const;

export type ProductPrefSettingKey = (typeof PRODUCT_PREF_SETTING_KEYS)[number];

export function isProductPrefSettingKey(key: string): key is ProductPrefSettingKey {
	return (PRODUCT_PREF_SETTING_KEYS as readonly string[]).includes(key);
}

export function applyProductPref(prefs: ProductPrefs, patch: Partial<ProductPrefs>): ProductPrefs {
	return normalizeProductPrefs({ ...prefs, ...patch });
}
