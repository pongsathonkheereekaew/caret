import { describe, expect, it } from "bun:test";
import {
	CEDIA_DARK_ANCHORS,
	CEDIA_HC_DARK_ANCHORS,
	CEDIA_HC_DARK_WORKBENCH_COLORS,
	CEDIA_LIGHT_ANCHORS,
	CEDIA_LIGHT_COLORBLIND_WORKBENCH_COLORS,
	CEDIA_LIGHT_WORKBENCH_COLORS,
	CEDIA_MIDNIGHT_ANCHORS,
	CEDIA_MIDNIGHT_WORKBENCH_COLORS,
	CEDIA_TOKENS,
	CEDIA_WORKBENCH_COLORS,
	VSCODE_COLOR_THEME_KIND,
	cediaTokenCss,
	cediaThemeKindFromVscode,
	cediaThemeKindFor,
	cediaWorkbenchColors,
	isCediaWorkbenchPalette,
} from "../src/cedia-theme.ts";

/*
 * The palette is the one part of the shell a vision model has to judge, so the
 * values are pinned here instead: anchors are the measured ones from the
 * reference product's own theme file, and every key the agent webview reads
 * through its `--cedia-*` token layer must be present or the dock silently
 * falls back to the engine's palette.
 */

const HEX = /#[0-9a-f]{6}(?:[0-9a-f]{2})?/i;

describe("cedia workbench palette", () => {
	it("uses the measured anchor values", () => {
		expect(CEDIA_DARK_ANCHORS).toEqual({
			editorBackground: "#181818",
			chromeBackground: "#141414",
			foreground: "#F0F0F0",
			accent: "#81A1C1",
			accentHover: "#87A6C4",
			accentText: "#191C22",
			badge: "#88C0D0",
		});
		expect(CEDIA_WORKBENCH_COLORS["editor.background"]).toBe(CEDIA_DARK_ANCHORS.editorBackground);
		expect(CEDIA_WORKBENCH_COLORS["sideBar.background"]).toBe(CEDIA_DARK_ANCHORS.chromeBackground);
		expect(CEDIA_WORKBENCH_COLORS["statusBar.background"]).toBe(CEDIA_DARK_ANCHORS.chromeBackground);
		expect(CEDIA_WORKBENCH_COLORS["button.background"]).toBe(CEDIA_DARK_ANCHORS.accent);
		expect(CEDIA_WORKBENCH_COLORS["foreground"]).toBe(CEDIA_DARK_ANCHORS.foreground);
	});

	it("carries chrome DARKER than the editor, which is what the reference does", () => {
		// The engine's default is the other way round; getting this backwards is
		// the single change that makes the shell read as upstream VS Code again.
		const luminance = (hex: string) => parseInt(hex.slice(1, 3), 16);
		expect(luminance(CEDIA_WORKBENCH_COLORS["sideBar.background"])).toBeLessThan(
			luminance(CEDIA_WORKBENCH_COLORS["editor.background"]),
		);
	});

	it("covers every variable the agent webview reads", () => {
		// Mirrors the `--cedia-*` token layer Cedia declares in CEDIA_TOKENS. A
		// missing key means that surface keeps the engine colour while the rest
		// changes.
		const required = [
			"editor.background",            // --cedia-bg
			"sideBar.background",           // --cedia-panel
			"editorWidget.background",      // --cedia-panel-raised
			"input.background",             // --cedia-input
			"foreground",                   // --cedia-text
			"descriptionForeground",        // --cedia-muted
			"panel.border",                 // --cedia-border
			"input.border",                 // --cedia-control-border
			"focusBorder",                  // --cedia-focus
			"button.background",            // --cedia-accent
			"button.foreground",            // --cedia-accent-text
			"textLink.foreground",          // --cedia-link
			"list.activeSelectionBackground",   // --cedia-selected-bg
			"list.activeSelectionForeground",   // --cedia-selected-fg
			"list.hoverBackground",         // --cedia-hover-bg
		];
		for (const key of required) {
			expect(`${key}=${CEDIA_WORKBENCH_COLORS[key] ?? "MISSING"}`).not.toContain("MISSING");
		}
	});

	it("only emits well-formed colours", () => {
		for (const [key, value] of Object.entries(CEDIA_WORKBENCH_COLORS)) {
			expect(`${key}=${value}`).toMatch(new RegExp(`^[^=]+=${HEX.source}$`, "i"));
		}
	});

	it("keeps the dark title bar's inactive foreground at the reference's 60% white", () => {
		// Regression lock: this shipped as 36% (#F0F0F05C) while the reference
		// uses 60%, which made an unfocused window's title too dim. The mistake
		// was only found by an external gate (retired 2026-09-20), so it is pinned here
		// where CI can see it without the reference installed.
		expect(CEDIA_WORKBENCH_COLORS["titleBar.inactiveForeground"]).toBe("#F0F0F099");
		expect(CEDIA_WORKBENCH_COLORS["titleBar.activeForeground"]).toBe("#F0F0F084");
	});

	it("ships the reference's light anchors too", () => {
		expect(CEDIA_LIGHT_ANCHORS).toEqual({
			editorBackground: "#FCFCFC",
			chromeBackground: "#F3F3F3",
			foreground: "#141414",
			accent: "#2778C1",
			accentHover: "#246AAB",
			accentText: "#FCFCFC",
			badge: "#F3F3F3",
		});
		expect(CEDIA_LIGHT_WORKBENCH_COLORS["editor.background"]).toBe(CEDIA_LIGHT_ANCHORS.editorBackground);
		expect(CEDIA_LIGHT_WORKBENCH_COLORS["sideBar.background"]).toBe(CEDIA_LIGHT_ANCHORS.chromeBackground);
		expect(CEDIA_LIGHT_WORKBENCH_COLORS["button.background"]).toBe(CEDIA_LIGHT_ANCHORS.accent);
	});

	it("keeps the chrome darker than the editor in light too, as the reference does", () => {
		// Both kinds share the relationship: sideBar #F3F3F3 is darker than
		// editor #FCFCFC. It is not mirrored, and the captured light window
		// agreed (sidebar ~237, editor ~245).
		const luminance = (hex: string) => parseInt(hex.slice(1, 3), 16);
		expect(luminance(CEDIA_LIGHT_WORKBENCH_COLORS["sideBar.background"])).toBeLessThan(
			luminance(CEDIA_LIGHT_WORKBENCH_COLORS["editor.background"]),
		);
	});

	it("covers the same keys in light as in dark so neither kind falls back", () => {
		expect(Object.keys(CEDIA_LIGHT_WORKBENCH_COLORS).sort()).toEqual(Object.keys(CEDIA_WORKBENCH_COLORS).sort());
		for (const [key, value] of Object.entries(CEDIA_LIGHT_WORKBENCH_COLORS)) {
			expect(`${key}=${value}`).toMatch(new RegExp(`^[^=]+=${HEX.source}$`, "i"));
		}
	});

	it("selects the palette from the Code-OSS theme kind", () => {
		expect(cediaThemeKindFromVscode(VSCODE_COLOR_THEME_KIND.light)).toBe("light");
		expect(cediaThemeKindFromVscode(VSCODE_COLOR_THEME_KIND.highContrastLight)).toBe("light");
		expect(cediaThemeKindFromVscode(VSCODE_COLOR_THEME_KIND.dark)).toBe("dark");
		expect(cediaThemeKindFromVscode(VSCODE_COLOR_THEME_KIND.highContrast)).toBe("high-contrast");
		expect(cediaWorkbenchColors("light")).toBe(CEDIA_LIGHT_WORKBENCH_COLORS);
		expect(cediaWorkbenchColors("dark")).toBe(CEDIA_WORKBENCH_COLORS);
		expect(cediaWorkbenchColors("high-contrast")).toBe(CEDIA_HC_DARK_WORKBENCH_COLORS);
	});

	it("ships the reference's high contrast anchors", () => {
		// VS Code has built-in high-contrast themes, so this kind is reachable
		// on any machine with "Increase contrast" on.
		expect(CEDIA_HC_DARK_ANCHORS).toEqual({
			editorBackground: "#0A0A0A",
			chromeBackground: "#0A0A0A",
			foreground: "#F0F0F0",
			accent: "#434C5E",
			accentHover: "#4C566A",
			accentText: "#ECEFF4",
			badge: "#88C0D0",
		});
		expect(CEDIA_HC_DARK_WORKBENCH_COLORS["editor.background"]).toBe(CEDIA_HC_DARK_ANCHORS.editorBackground);
		expect(CEDIA_HC_DARK_WORKBENCH_COLORS["button.background"]).toBe(CEDIA_HC_DARK_ANCHORS.accent);
		expect(CEDIA_HC_DARK_WORKBENCH_COLORS["badge.foreground"]).toBe("#000000");
	});

	it("covers the same keys in high contrast as in dark, and keeps a visible focus ring", () => {
		expect(Object.keys(CEDIA_HC_DARK_WORKBENCH_COLORS).sort()).toEqual(Object.keys(CEDIA_WORKBENCH_COLORS).sort());
		for (const [key, value] of Object.entries(CEDIA_HC_DARK_WORKBENCH_COLORS)) {
			expect(`${key}=${value}`).toMatch(new RegExp(`^[^=]+=${HEX.source}$`, "i"));
		}
		// The reference sets focusBorder transparent; Cedia requires a visible
		// perimeter, so this is a recorded deviation rather than a copy.
		const focus = CEDIA_HC_DARK_WORKBENCH_COLORS.focusBorder;
		const alpha = focus.length === 9 ? parseInt(focus.slice(7, 9), 16) : 0xff;
		expect(alpha).toBeGreaterThan(0);
	});

	it("recognises its own palettes so its footprint is not read as a user choice", () => {
		// The folderless Agents window can only write at global scope. On the
		// next run Cedia must tell that value apart from a user's palette, or it
		// would stop repainting the chrome for good.
		expect(isCediaWorkbenchPalette({ ...CEDIA_WORKBENCH_COLORS })).toBe(true);
		expect(isCediaWorkbenchPalette({ ...CEDIA_LIGHT_WORKBENCH_COLORS })).toBe(true);
		expect(isCediaWorkbenchPalette({ ...CEDIA_HC_DARK_WORKBENCH_COLORS })).toBe(true);
		expect(isCediaWorkbenchPalette({ ...CEDIA_MIDNIGHT_WORKBENCH_COLORS })).toBe(true);
		expect(isCediaWorkbenchPalette({ ...CEDIA_LIGHT_COLORBLIND_WORKBENCH_COLORS })).toBe(true);
		expect(isCediaWorkbenchPalette({ "editor.background": "#101010" })).toBe(false);
		expect(isCediaWorkbenchPalette({ ...CEDIA_WORKBENCH_COLORS, "editor.background": "#101010" })).toBe(false);
		expect(isCediaWorkbenchPalette(undefined)).toBe(false);
		expect(isCediaWorkbenchPalette("dark")).toBe(false);
	});

	it("ships the reference's dark midnight palette", () => {
		expect(CEDIA_MIDNIGHT_ANCHORS).toEqual({
			editorBackground: "#1e2127",
			chromeBackground: "#191c22",
			foreground: "#7b88a1",
			accent: "#88c0d0",
			accentHover: "#98d5e7",
			accentText: "#191c22",
			badge: "#88c0d0",
		});
		expect(CEDIA_MIDNIGHT_WORKBENCH_COLORS["editor.background"]).toBe("#1e2127");
		expect(CEDIA_MIDNIGHT_WORKBENCH_COLORS["sideBar.background"]).toBe("#191c22");
		expect(CEDIA_MIDNIGHT_WORKBENCH_COLORS["button.background"]).toBe("#88c0d0");
		expect(Object.keys(CEDIA_MIDNIGHT_WORKBENCH_COLORS).sort()).toEqual(Object.keys(CEDIA_WORKBENCH_COLORS).sort());
	});

	it("derives light colorblind from light, differing only in the accent family", () => {
		// The reference's light-colorblind theme differs from cursor-light in
		// exactly four keys, so the rest must be identical rather than retyped.
		const changed = Object.keys(CEDIA_LIGHT_COLORBLIND_WORKBENCH_COLORS).filter(
			(key) => CEDIA_LIGHT_COLORBLIND_WORKBENCH_COLORS[key] !== CEDIA_LIGHT_WORKBENCH_COLORS[key],
		);
		expect(changed.sort()).toEqual([
			"button.background",
			"button.hoverBackground",
			"textLink.activeForeground",
			"textLink.foreground",
		]);
		expect(CEDIA_LIGHT_COLORBLIND_WORKBENCH_COLORS["button.background"]).toBe("#1F79C0");
		expect(CEDIA_LIGHT_COLORBLIND_WORKBENCH_COLORS["textLink.foreground"]).toBe("#0066AB");
	});

	it("picks midnight and colorblind by theme name, since they share a kind", () => {
		// Midnight is a dark theme and light colorblind is a light one, so the
		// kind alone cannot distinguish them from the base palettes.
		expect(cediaThemeKindFor("Cursor Dark Midnight", VSCODE_COLOR_THEME_KIND.dark)).toBe("dark-midnight");
		expect(cediaThemeKindFor("Cursor Light Colorblind (Beta)", VSCODE_COLOR_THEME_KIND.light)).toBe("light-colorblind");
		expect(cediaThemeKindFor("Cursor Dark", VSCODE_COLOR_THEME_KIND.dark)).toBe("dark");
		expect(cediaThemeKindFor("Cursor Light", VSCODE_COLOR_THEME_KIND.light)).toBe("light");
		expect(cediaThemeKindFor("Default High Contrast", VSCODE_COLOR_THEME_KIND.highContrast)).toBe("high-contrast");
		// Unknown or missing names fall back to the kind.
		expect(cediaThemeKindFor(undefined, VSCODE_COLOR_THEME_KIND.dark)).toBe("dark");
		expect(cediaThemeKindFor("Some Other Theme", VSCODE_COLOR_THEME_KIND.light)).toBe("light");
	});

	it("keeps the unfocused chrome at the palette's own colour in every kind", () => {
		// The pinned engine's default themes define statusBar.inactiveBackground,
		// so an unset key showed the engine's colour (light leaked #FAFAFD) in an
		// unfocused window. The reference's themes do not define it, which keeps
		// their status bar at the active colour - so Cedia must set it too.
		for (const [kind, palette] of [
			["dark", CEDIA_WORKBENCH_COLORS],
			["light", CEDIA_LIGHT_WORKBENCH_COLORS],
			["high-contrast", CEDIA_HC_DARK_WORKBENCH_COLORS],
			["dark-midnight", CEDIA_MIDNIGHT_WORKBENCH_COLORS],
			["light-colorblind", CEDIA_LIGHT_COLORBLIND_WORKBENCH_COLORS],
		] as const) {
			expect(`${kind}:${palette["statusBar.inactiveBackground"]}`).toBe(`${kind}:${palette["statusBar.background"]}`);
		}
	});
});

describe("Cedia's own token scale", () => {
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
			"cedia-bg", "cedia-panel", "cedia-panel-raised", "cedia-input", "cedia-text",
			"cedia-muted", "cedia-border", "cedia-control-border", "cedia-focus", "cedia-accent",
			"cedia-accent-text", "cedia-link", "cedia-selected-bg", "cedia-selected-fg", "cedia-hover-bg",
		];
		for (const token of mapped) expect(`${token}:${CEDIA_TOKENS[token] ?? "missing"}`).not.toEndWith(":missing");
	});

	it("declares the full spacing and radius steps the reference scale was measured for", () => {
		for (const step of [4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 44, 48]) {
			expect(`${step}:${CEDIA_TOKENS[`cedia-space-${step}`]}`).toBe(`${step}:${step}px`);
		}
		for (const radius of ["xs", "sm", "md", "xl", "2xl", "3xl", "4xl", "full"]) {
			expect(`${radius}:${CEDIA_TOKENS[`cedia-radius-${radius}`] ?? "missing"}`).not.toEndWith(":missing");
		}
	});

	it("renders the declaration block from the same map, in order", () => {
		// A renderer that hand-maintains its own block would drift from the map
		// the parity gate reads, which is exactly the failure the move fixes.
		const css = cediaTokenCss();
		expect(css.startsWith(":root {")).toBe(true);
		expect(css.endsWith("}")).toBe(true);
		expect(css).toContain("color-scheme: light dark;");
		const names = [...css.matchAll(/--([a-z0-9-]+):/g)].map(match => match[1]!);
		expect(names).toEqual(Object.keys(CEDIA_TOKENS));
		// Every token appears exactly once, so no later declaration silently
		// overrides an earlier one.
		expect(new Set(names).size).toBe(names.length);
	});
});
