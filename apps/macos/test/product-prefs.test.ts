import { describe, expect, it } from "bun:test";
import { applyProductPref, DEFAULT_PRODUCT_PREFS, normalizeProductPrefs } from "../src/product-prefs.ts";

describe("product prefs", () => {
	it("defaults to comfortable density, an Agents-first startup, and a right work panel", () => {
		expect(DEFAULT_PRODUCT_PREFS).toEqual({
			density: "comfortable",
			panelPosition: "right",
			submitEnter: true,
			reduceMotion: false,
			highContrast: false,
			sidebarWidth: 180,
			// UI interaction spec section 2: Cedia opens the Agents page by
			// default, with the IDE reachable from an easily found switch.
			startupView: "agents",
			windowRestore: true,
			autoHideEmptyIde: false,
		});
		expect(normalizeProductPrefs(undefined)).toEqual(DEFAULT_PRODUCT_PREFS);
		expect(applyProductPref(DEFAULT_PRODUCT_PREFS, { panelPosition: "bottom", reduceMotion: true })).toEqual({
			density: "comfortable",
			panelPosition: "bottom",
			submitEnter: true,
			reduceMotion: true,
			highContrast: false,
			sidebarWidth: 180,
			startupView: "agents",
			windowRestore: true,
			autoHideEmptyIde: false,
		});
	});

	it("rejects unknown density instead of inventing a theme", () => {
		expect(normalizeProductPrefs({ density: "compact", submitEnter: false }).density).toBe("comfortable");
		expect(normalizeProductPrefs({ submitEnter: false }).submitEnter).toBe(false);
		expect(normalizeProductPrefs({ sidebarWidth: 120 }).sidebarWidth).toBe(160);
		expect(normalizeProductPrefs({ sidebarWidth: 900 }).sidebarWidth).toBe(360);
	});

	it("normalizes garbage to defaults and keeps startup and window prefs", () => {
		expect(normalizeProductPrefs(null)).toEqual(DEFAULT_PRODUCT_PREFS);
		expect(normalizeProductPrefs([])).toEqual(DEFAULT_PRODUCT_PREFS);
		expect(normalizeProductPrefs("cloud")).toEqual(DEFAULT_PRODUCT_PREFS);
		expect(normalizeProductPrefs({
			startupView: "cloud",
			windowRestore: "yes",
			autoHideEmptyIde: 1,
		})).toEqual(DEFAULT_PRODUCT_PREFS);
		// A pre-existing profile that stored only the two original options keeps
		// working; an unknown value falls back to the Agents-first default.
		expect(normalizeProductPrefs({ startupView: "agents" }).startupView).toBe("agents");
		expect(normalizeProductPrefs({ startupView: "ide" }).startupView).toBe("ide");
		expect(normalizeProductPrefs({ startupView: "last_task" }).startupView).toBe("last_task");
		expect(normalizeProductPrefs({ startupView: "nonsense" }).startupView).toBe("agents");
		expect(applyProductPref(DEFAULT_PRODUCT_PREFS, {
			startupView: "last_task",
			windowRestore: false,
			autoHideEmptyIde: true,
		})).toEqual({
			...DEFAULT_PRODUCT_PREFS,
			startupView: "last_task",
			windowRestore: false,
			autoHideEmptyIde: true,
		});
	});
});
