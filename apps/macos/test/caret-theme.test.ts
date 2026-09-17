import { describe, expect, it } from "bun:test";
import {
	CARET_DARK_ANCHORS,
	CARET_HC_DARK_ANCHORS,
	CARET_HC_DARK_WORKBENCH_COLORS,
	CARET_LIGHT_ANCHORS,
	CARET_LIGHT_COLORBLIND_WORKBENCH_COLORS,
	CARET_LIGHT_WORKBENCH_COLORS,
	CARET_MIDNIGHT_ANCHORS,
	CARET_MIDNIGHT_WORKBENCH_COLORS,
	CARET_TOKENS,
	CARET_WORKBENCH_COLORS,
	VSCODE_COLOR_THEME_KIND,
	caretTokenCss,
	caretThemeKindFromVscode,
	caretThemeKindFor,
	caretWorkbenchColors,
	isCaretWorkbenchPalette,
} from "../src/caret-theme.ts";

/*
 * The palette is the one part of the shell a vision model has to judge, so the
 * values are pinned here instead: anchors are the measured ones from the
 * reference product's own theme file, and every key the agent webview reads
 * through its `--caret-*` token layer must be present or the dock silently
 * falls back to the engine's palette.
 */

const HEX = /#[0-9a-f]{6}(?:[0-9a-f]{2})?/i;

describe("caret workbench palette", () => {
	it("uses the measured anchor values", () => {
		expect(CARET_DARK_ANCHORS).toEqual({
			editorBackground: "#181818",
			chromeBackground: "#141414",
			foreground: "#F0F0F0",
			accent: "#81A1C1",
			accentHover: "#87A6C4",
			accentText: "#191C22",
			badge: "#88C0D0",
		});
		expect(CARET_WORKBENCH_COLORS["editor.background"]).toBe(CARET_DARK_ANCHORS.editorBackground);
		expect(CARET_WORKBENCH_COLORS["sideBar.background"]).toBe(CARET_DARK_ANCHORS.chromeBackground);
		expect(CARET_WORKBENCH_COLORS["statusBar.background"]).toBe(CARET_DARK_ANCHORS.chromeBackground);
		expect(CARET_WORKBENCH_COLORS["button.background"]).toBe(CARET_DARK_ANCHORS.accent);
		expect(CARET_WORKBENCH_COLORS["foreground"]).toBe(CARET_DARK_ANCHORS.foreground);
	});

	it("carries chrome DARKER than the editor, which is what the reference does", () => {
		// The engine's default is the other way round; getting this backwards is
		// the single change that makes the shell read as upstream VS Code again.
		const luminance = (hex: string) => parseInt(hex.slice(1, 3), 16);
		expect(luminance(CARET_WORKBENCH_COLORS["sideBar.background"])).toBeLessThan(
			luminance(CARET_WORKBENCH_COLORS["editor.background"]),
		);
	});

	it("covers every variable the agent webview reads", () => {
		// Mirrors the `--caret-*` token layer Caret declares in CARET_TOKENS. A
		// missing key means that surface keeps the engine colour while the rest
		// changes.
		const required = [
			"editor.background",            // --caret-bg
			"sideBar.background",           // --caret-panel
			"editorWidget.background",      // --caret-panel-raised
			"input.background",             // --caret-input
			"foreground",                   // --caret-text
			"descriptionForeground",        // --caret-muted
			"panel.border",                 // --caret-border
			"input.border",                 // --caret-control-border
			"focusBorder",                  // --caret-focus
			"button.background",            // --caret-accent
			"button.foreground",            // --caret-accent-text
			"textLink.foreground",          // --caret-link
			"list.activeSelectionBackground",   // --caret-selected-bg
			"list.activeSelectionForeground",   // --caret-selected-fg
			"list.hoverBackground",         // --caret-hover-bg
		];
		for (const key of required) {
			expect(`${key}=${CARET_WORKBENCH_COLORS[key] ?? "MISSING"}`).not.toContain("MISSING");
		}
	});

	it("only emits well-formed colours", () => {
		for (const [key, value] of Object.entries(CARET_WORKBENCH_COLORS)) {
			expect(`${key}=${value}`).toMatch(new RegExp(`^[^=]+=${HEX.source}$`, "i"));
		}
	});

	it("keeps the dark title bar's inactive foreground at the reference's 60% white", () => {
		// Regression lock: this shipped as 36% (#F0F0F05C) while the reference
		// uses 60%, which made an unfocused window's title too dim. The mistake
		// was only found by scripts/cursor-parity-check.ts, so it is pinned here
		// where CI can see it without the reference installed.
		expect(CARET_WORKBENCH_COLORS["titleBar.inactiveForeground"]).toBe("#F0F0F099");
		expect(CARET_WORKBENCH_COLORS["titleBar.activeForeground"]).toBe("#F0F0F084");
	});

	it("ships the reference's light anchors too", () => {
		expect(CARET_LIGHT_ANCHORS).toEqual({
			editorBackground: "#FCFCFC",
			chromeBackground: "#F3F3F3",
			foreground: "#141414",
			accent: "#2778C1",
			accentHover: "#246AAB",
			accentText: "#FCFCFC",
			badge: "#F3F3F3",
		});
		expect(CARET_LIGHT_WORKBENCH_COLORS["editor.background"]).toBe(CARET_LIGHT_ANCHORS.editorBackground);
		expect(CARET_LIGHT_WORKBENCH_COLORS["sideBar.background"]).toBe(CARET_LIGHT_ANCHORS.chromeBackground);
		expect(CARET_LIGHT_WORKBENCH_COLORS["button.background"]).toBe(CARET_LIGHT_ANCHORS.accent);
	});

	it("keeps the chrome darker than the editor in light too, as the reference does", () => {
		// Both kinds share the relationship: sideBar #F3F3F3 is darker than
		// editor #FCFCFC. It is not mirrored, and the captured light window
		// agreed (sidebar ~237, editor ~245).
		const luminance = (hex: string) => parseInt(hex.slice(1, 3), 16);
		expect(luminance(CARET_LIGHT_WORKBENCH_COLORS["sideBar.background"])).toBeLessThan(
			luminance(CARET_LIGHT_WORKBENCH_COLORS["editor.background"]),
		);
	});

	it("covers the same keys in light as in dark so neither kind falls back", () => {
		expect(Object.keys(CARET_LIGHT_WORKBENCH_COLORS).sort()).toEqual(Object.keys(CARET_WORKBENCH_COLORS).sort());
		for (const [key, value] of Object.entries(CARET_LIGHT_WORKBENCH_COLORS)) {
			expect(`${key}=${value}`).toMatch(new RegExp(`^[^=]+=${HEX.source}$`, "i"));
		}
	});

	it("selects the palette from the Code-OSS theme kind", () => {
		expect(caretThemeKindFromVscode(VSCODE_COLOR_THEME_KIND.light)).toBe("light");
		expect(caretThemeKindFromVscode(VSCODE_COLOR_THEME_KIND.highContrastLight)).toBe("light");
		expect(caretThemeKindFromVscode(VSCODE_COLOR_THEME_KIND.dark)).toBe("dark");
		expect(caretThemeKindFromVscode(VSCODE_COLOR_THEME_KIND.highContrast)).toBe("high-contrast");
		expect(caretWorkbenchColors("light")).toBe(CARET_LIGHT_WORKBENCH_COLORS);
		expect(caretWorkbenchColors("dark")).toBe(CARET_WORKBENCH_COLORS);
		expect(caretWorkbenchColors("high-contrast")).toBe(CARET_HC_DARK_WORKBENCH_COLORS);
	});

	it("ships the reference's high contrast anchors", () => {
		// VS Code has built-in high-contrast themes, so this kind is reachable
		// on any machine with "Increase contrast" on.
		expect(CARET_HC_DARK_ANCHORS).toEqual({
			editorBackground: "#0A0A0A",
			chromeBackground: "#0A0A0A",
			foreground: "#F0F0F0",
			accent: "#434C5E",
			accentHover: "#4C566A",
			accentText: "#ECEFF4",
			badge: "#88C0D0",
		});
		expect(CARET_HC_DARK_WORKBENCH_COLORS["editor.background"]).toBe(CARET_HC_DARK_ANCHORS.editorBackground);
		expect(CARET_HC_DARK_WORKBENCH_COLORS["button.background"]).toBe(CARET_HC_DARK_ANCHORS.accent);
		expect(CARET_HC_DARK_WORKBENCH_COLORS["badge.foreground"]).toBe("#000000");
	});

	it("covers the same keys in high contrast as in dark, and keeps a visible focus ring", () => {
		expect(Object.keys(CARET_HC_DARK_WORKBENCH_COLORS).sort()).toEqual(Object.keys(CARET_WORKBENCH_COLORS).sort());
		for (const [key, value] of Object.entries(CARET_HC_DARK_WORKBENCH_COLORS)) {
			expect(`${key}=${value}`).toMatch(new RegExp(`^[^=]+=${HEX.source}$`, "i"));
		}
		// The reference sets focusBorder transparent; Caret requires a visible
		// perimeter, so this is a recorded deviation rather than a copy.
		const focus = CARET_HC_DARK_WORKBENCH_COLORS.focusBorder;
		const alpha = focus.length === 9 ? parseInt(focus.slice(7, 9), 16) : 0xff;
		expect(alpha).toBeGreaterThan(0);
	});

	it("recognises its own palettes so its footprint is not read as a user choice", () => {
		// The folderless Agents window can only write at global scope. On the
		// next run Caret must tell that value apart from a user's palette, or it
		// would stop repainting the chrome for good.
		expect(isCaretWorkbenchPalette({ ...CARET_WORKBENCH_COLORS })).toBe(true);
		expect(isCaretWorkbenchPalette({ ...CARET_LIGHT_WORKBENCH_COLORS })).toBe(true);
		expect(isCaretWorkbenchPalette({ ...CARET_HC_DARK_WORKBENCH_COLORS })).toBe(true);
		expect(isCaretWorkbenchPalette({ ...CARET_MIDNIGHT_WORKBENCH_COLORS })).toBe(true);
		expect(isCaretWorkbenchPalette({ ...CARET_LIGHT_COLORBLIND_WORKBENCH_COLORS })).toBe(true);
		expect(isCaretWorkbenchPalette({ "editor.background": "#101010" })).toBe(false);
		expect(isCaretWorkbenchPalette({ ...CARET_WORKBENCH_COLORS, "editor.background": "#101010" })).toBe(false);
		expect(isCaretWorkbenchPalette(undefined)).toBe(false);
		expect(isCaretWorkbenchPalette("dark")).toBe(false);
	});

	it("ships the reference's dark midnight palette", () => {
		expect(CARET_MIDNIGHT_ANCHORS).toEqual({
			editorBackground: "#1e2127",
			chromeBackground: "#191c22",
			foreground: "#7b88a1",
			accent: "#88c0d0",
			accentHover: "#98d5e7",
			accentText: "#191c22",
			badge: "#88c0d0",
		});
		expect(CARET_MIDNIGHT_WORKBENCH_COLORS["editor.background"]).toBe("#1e2127");
		expect(CARET_MIDNIGHT_WORKBENCH_COLORS["sideBar.background"]).toBe("#191c22");
		expect(CARET_MIDNIGHT_WORKBENCH_COLORS["button.background"]).toBe("#88c0d0");
		expect(Object.keys(CARET_MIDNIGHT_WORKBENCH_COLORS).sort()).toEqual(Object.keys(CARET_WORKBENCH_COLORS).sort());
	});

	it("derives light colorblind from light, differing only in the accent family", () => {
		// The reference's light-colorblind theme differs from cursor-light in
		// exactly four keys, so the rest must be identical rather than retyped.
		const changed = Object.keys(CARET_LIGHT_COLORBLIND_WORKBENCH_COLORS).filter(
			(key) => CARET_LIGHT_COLORBLIND_WORKBENCH_COLORS[key] !== CARET_LIGHT_WORKBENCH_COLORS[key],
		);
		expect(changed.sort()).toEqual([
			"button.background",
			"button.hoverBackground",
			"textLink.activeForeground",
			"textLink.foreground",
		]);
		expect(CARET_LIGHT_COLORBLIND_WORKBENCH_COLORS["button.background"]).toBe("#1F79C0");
		expect(CARET_LIGHT_COLORBLIND_WORKBENCH_COLORS["textLink.foreground"]).toBe("#0066AB");
	});

	it("picks midnight and colorblind by theme name, since they share a kind", () => {
		// Midnight is a dark theme and light colorblind is a light one, so the
		// kind alone cannot distinguish them from the base palettes.
		expect(caretThemeKindFor("Cursor Dark Midnight", VSCODE_COLOR_THEME_KIND.dark)).toBe("dark-midnight");
		expect(caretThemeKindFor("Cursor Light Colorblind (Beta)", VSCODE_COLOR_THEME_KIND.light)).toBe("light-colorblind");
		expect(caretThemeKindFor("Cursor Dark", VSCODE_COLOR_THEME_KIND.dark)).toBe("dark");
		expect(caretThemeKindFor("Cursor Light", VSCODE_COLOR_THEME_KIND.light)).toBe("light");
		expect(caretThemeKindFor("Default High Contrast", VSCODE_COLOR_THEME_KIND.highContrast)).toBe("high-contrast");
		// Unknown or missing names fall back to the kind.
		expect(caretThemeKindFor(undefined, VSCODE_COLOR_THEME_KIND.dark)).toBe("dark");
		expect(caretThemeKindFor("Some Other Theme", VSCODE_COLOR_THEME_KIND.light)).toBe("light");
	});

	it("keeps the unfocused chrome at the palette's own colour in every kind", () => {
		// The pinned engine's default themes define statusBar.inactiveBackground,
		// so an unset key showed the engine's colour (light leaked #FAFAFD) in an
		// unfocused window. The reference's themes do not define it, which keeps
		// their status bar at the active colour - so Caret must set it too.
		for (const [kind, palette] of [
			["dark", CARET_WORKBENCH_COLORS],
			["light", CARET_LIGHT_WORKBENCH_COLORS],
			["high-contrast", CARET_HC_DARK_WORKBENCH_COLORS],
			["dark-midnight", CARET_MIDNIGHT_WORKBENCH_COLORS],
			["light-colorblind", CARET_LIGHT_COLORBLIND_WORKBENCH_COLORS],
		] as const) {
			expect(`${kind}:${palette["statusBar.inactiveBackground"]}`).toBe(`${kind}:${palette["statusBar.background"]}`);
		}
	});
});

describe("Caret's own token scale", () => {
	/*
	 * These tokens used to live in the retired agent shell's stylesheet, where
	 * the only way to read one was to regex-match a webview's CSS string. The
	 * shell is on its way out; the scale is not, so it moved here and these
	 * tests pin the properties a caller now depends on.
	 */
	it("declares every token the workbench palette is mapped onto", () => {
		// The palette above is applied through workbench.colorCustomizations, so
		// each surface role has to name a real token or the override lands on a
		// variable nothing declares.
		const mapped = [
			"caret-bg", "caret-panel", "caret-panel-raised", "caret-input", "caret-text",
			"caret-muted", "caret-border", "caret-control-border", "caret-focus", "caret-accent",
			"caret-accent-text", "caret-link", "caret-selected-bg", "caret-selected-fg", "caret-hover-bg",
		];
		for (const token of mapped) expect(`${token}:${CARET_TOKENS[token] ?? "missing"}`).not.toEndWith(":missing");
	});

	it("declares the full spacing and radius steps the reference scale was measured for", () => {
		for (const step of [4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 44, 48]) {
			expect(`${step}:${CARET_TOKENS[`caret-space-${step}`]}`).toBe(`${step}:${step}px`);
		}
		for (const radius of ["xs", "sm", "md", "xl", "2xl", "3xl", "4xl", "full"]) {
			expect(`${radius}:${CARET_TOKENS[`caret-radius-${radius}`] ?? "missing"}`).not.toEndWith(":missing");
		}
	});

	it("renders the declaration block from the same map, in order", () => {
		// A renderer that hand-maintains its own block would drift from the map
		// the parity gate reads, which is exactly the failure the move fixes.
		const css = caretTokenCss();
		expect(css.startsWith(":root {")).toBe(true);
		expect(css.endsWith("}")).toBe(true);
		expect(css).toContain("color-scheme: light dark;");
		const names = [...css.matchAll(/--([a-z0-9-]+):/g)].map(match => match[1]!);
		expect(names).toEqual(Object.keys(CARET_TOKENS));
		// Every token appears exactly once, so no later declaration silently
		// overrides an earlier one.
		expect(new Set(names).size).toBe(names.length);
	});
});
