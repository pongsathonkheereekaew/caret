/** Caret's workbench palette.
 *
 * Why this file exists: Caret ships no colour theme of its own, so the
 * packaged app renders with whatever the pinned Code-OSS build defaults to
 * (currently the upstream "2026 Dark" theme: a near-black editor at
 * #121314 with lighter #191A1B chrome and a teal accent). That is why the
 * IDE reads as upstream VS Code rather than as this product's own surface.
 *
 * These values are anchored on the palette the reference product actually
 * ships, read from `theme-cursor/themes/cursor-dark-color-theme.json` in
 * Cursor 3.20.17 rather than eyeballed from a screenshot:
 *
 *   editor.background          #181818   (chrome is DARKER than the editor)
 *   sideBar/activityBar/status #141414
 *   foreground                 #F0F0F0
 *   button.background          #81A1C1   (muted nordic blue, not teal)
 *   badge.background           #88C0D0
 *   borders                    #F0F0F013 (translucent white, not solid grey)
 *
 * Caret authors its own palette rather than shipping the reference theme
 * file; the anchor values are measured and the few derived keys are marked
 * below. They are applied through `workbench.colorCustomizations` instead of
 * a contributed theme so the syntax colouring of the pinned build's default
 * theme is inherited rather than reimplemented.
 *
 * The agent webview reads the same Code-OSS theme variables through its
 * `--caret-*` token layer, so overriding the workbench colours here restyles
 * the agent surface and the IDE chrome together.
 */

/** Anchors measured from the reference product's own dark theme file. */
export const CARET_DARK_ANCHORS = {
	editorBackground: "#181818",
	chromeBackground: "#141414",
	foreground: "#F0F0F0",
	accent: "#81A1C1",
	accentHover: "#87A6C4",
	accentText: "#191C22",
	badge: "#88C0D0",
} as const;

/** Colour customisations applied to the workbench chrome.
 *
 * Only keys the workbench or the agent webview actually read are listed;
 * anything absent keeps the pinned build's own default, so syntax colouring
 * and less-visible surfaces stay consistent with the engine.
 */
export const CARET_WORKBENCH_COLORS: Readonly<Record<string, string>> = {
	// Surfaces
	"editor.background": CARET_DARK_ANCHORS.editorBackground,
	"editorGutter.background": CARET_DARK_ANCHORS.editorBackground,
	"sideBar.background": CARET_DARK_ANCHORS.chromeBackground,
	"sideBarSectionHeader.background": CARET_DARK_ANCHORS.chromeBackground,
	"activityBar.background": CARET_DARK_ANCHORS.chromeBackground,
	"statusBar.background": CARET_DARK_ANCHORS.chromeBackground,
	"statusBar.noFolderBackground": CARET_DARK_ANCHORS.chromeBackground,
	"titleBar.activeBackground": CARET_DARK_ANCHORS.chromeBackground,
	"titleBar.inactiveBackground": CARET_DARK_ANCHORS.chromeBackground,
	"panel.background": CARET_DARK_ANCHORS.chromeBackground,
	"editorWidget.background": CARET_DARK_ANCHORS.chromeBackground,
	"menu.background": CARET_DARK_ANCHORS.chromeBackground,
	"dropdown.background": CARET_DARK_ANCHORS.editorBackground,
	"editorGroupHeader.tabsBackground": CARET_DARK_ANCHORS.chromeBackground,
	"tab.activeBackground": CARET_DARK_ANCHORS.editorBackground,
	"tab.inactiveBackground": CARET_DARK_ANCHORS.chromeBackground,
	"terminal.background": CARET_DARK_ANCHORS.chromeBackground,

	// Text
	foreground: CARET_DARK_ANCHORS.foreground,
	"editor.foreground": CARET_DARK_ANCHORS.foreground,
	"icon.foreground": "#F0F0F0BD",
	"sideBar.foreground": "#F0F0F0BD",
	"activityBar.foreground": "#F0F0F0BD",
	"tab.activeForeground": CARET_DARK_ANCHORS.foreground,
	"tab.inactiveForeground": "#F0F0F05C",
	"statusBar.foreground": "#F0F0F099",
	// Inactive/unfocused states. The pinned engine's own default theme
	// ("Dark 2026") defines these, so leaving them unset would show the
	// engine's colours whenever a window loses focus - the reference's themes
	// do not define statusBar.inactiveBackground and therefore keep the status
	// bar at its active colour.
	"statusBar.inactiveBackground": CARET_DARK_ANCHORS.chromeBackground,
	"statusBar.inactiveForeground": "#F0F0F099",
	"activityBar.inactiveForeground": "#F0F0F0BD",
	"panelTitle.inactiveForeground": "#F0F0F0BD",
	"titleBar.activeForeground": "#F0F0F084",
	"titleBar.inactiveForeground": "#F0F0F099",
	"terminal.foreground": CARET_DARK_ANCHORS.foreground,
	"editorCursor.foreground": CARET_DARK_ANCHORS.foreground,
	"editorLineNumber.foreground": "#F0F0F05C",
	"editorLineNumber.activeForeground": CARET_DARK_ANCHORS.foreground,
	// Derived: the reference leaves this unset, but the agent webview reads it
	// for every muted label, so it is anchored on the reference's own 60% white
	// used by statusBar.foreground and input.placeholderForeground.
	descriptionForeground: "#F0F0F099",

	// Borders (translucent white in the reference, not a solid grey)
	"panel.border": "#F0F0F013",
	"sideBar.border": "#F0F0F013",
	"statusBar.border": "#F0F0F013",
	"titleBar.border": "#F0F0F013",
	"editorGroup.border": "#F0F0F013",
	"tab.border": "#F0F0F013",
	"menu.border": "#F0F0F013",
	"dropdown.border": "#F0F0F013",
	"editorWidget.border": "#F0F0F013",
	"input.border": "#F0F0F013",

	// Controls
	"button.background": CARET_DARK_ANCHORS.accent,
	"button.foreground": CARET_DARK_ANCHORS.accentText,
	"button.hoverBackground": CARET_DARK_ANCHORS.accentHover,
	"badge.background": CARET_DARK_ANCHORS.badge,
	"badge.foreground": CARET_DARK_ANCHORS.chromeBackground,
	"textLink.foreground": CARET_DARK_ANCHORS.accent,
	"textLink.activeForeground": CARET_DARK_ANCHORS.accentHover,
	"input.background": "#F0F0F00A",
	"input.foreground": CARET_DARK_ANCHORS.foreground,
	"input.placeholderForeground": "#F0F0F099",
	focusBorder: "#F0F0F026",
	"selection.background": "#F0F0F030",

	// Lists and editor selection
	"list.activeSelectionBackground": "#F0F0F01E",
	"list.activeSelectionForeground": CARET_DARK_ANCHORS.foreground,
	"list.inactiveSelectionBackground": "#F0F0F011",
	"list.focusBackground": "#F0F0F01E",
	"list.hoverBackground": "#F0F0F011",
	"editor.selectionBackground": "#40404099",
	"editor.lineHighlightBackground": "#262626",
	"scrollbarSlider.background": "#F0F0F011",
	"scrollbarSlider.hoverBackground": "#F0F0F01E",
	"scrollbarSlider.activeBackground": "#F0F0F01E",
};

/** Anchors measured from the reference product's own LIGHT theme file. */
export const CARET_LIGHT_ANCHORS = {
	editorBackground: "#FCFCFC",
	chromeBackground: "#F3F3F3",
	foreground: "#141414",
	accent: "#2778C1",
	accentHover: "#246AAB",
	accentText: "#FCFCFC",
	badge: "#F3F3F3",
} as const;

/** The same keys as CARET_WORKBENCH_COLORS, using the light theme's own
 * values. Cursor ships five themes (dark, dark-hc, dark-midnight, light,
 * light-colorblind); Caret matched only dark before, so a light-theme user saw
 * Caret's dark chrome forced over a light workbench. Values are read from
 * `theme-cursor/themes/cursor-light-color-theme.json`. Keys the reference does
 * not define are derived from its own border ratios and marked below. */
export const CARET_LIGHT_WORKBENCH_COLORS: Readonly<Record<string, string>> = {
	// Surfaces. The relationship is the same as dark: chrome (#F3F3F3) is
	// DARKER than the editor (#FCFCFC); it is not mirrored in light.
	"editor.background": CARET_LIGHT_ANCHORS.editorBackground,
	"editorGutter.background": CARET_LIGHT_ANCHORS.editorBackground,
	"sideBar.background": CARET_LIGHT_ANCHORS.chromeBackground,
	"sideBarSectionHeader.background": CARET_LIGHT_ANCHORS.chromeBackground,
	"activityBar.background": CARET_LIGHT_ANCHORS.chromeBackground,
	"statusBar.background": CARET_LIGHT_ANCHORS.chromeBackground,
	"statusBar.noFolderBackground": CARET_LIGHT_ANCHORS.chromeBackground,
	"titleBar.activeBackground": CARET_LIGHT_ANCHORS.chromeBackground,
	"titleBar.inactiveBackground": CARET_LIGHT_ANCHORS.chromeBackground,
	"panel.background": CARET_LIGHT_ANCHORS.chromeBackground,
	"editorWidget.background": CARET_LIGHT_ANCHORS.chromeBackground,
	"menu.background": CARET_LIGHT_ANCHORS.chromeBackground,
	"dropdown.background": CARET_LIGHT_ANCHORS.editorBackground,
	"editorGroupHeader.tabsBackground": CARET_LIGHT_ANCHORS.chromeBackground,
	"tab.activeBackground": CARET_LIGHT_ANCHORS.editorBackground,
	"tab.inactiveBackground": CARET_LIGHT_ANCHORS.chromeBackground,
	"terminal.background": CARET_LIGHT_ANCHORS.chromeBackground,

	// Text
	foreground: CARET_LIGHT_ANCHORS.foreground,
	"editor.foreground": CARET_LIGHT_ANCHORS.foreground,
	"icon.foreground": "#14141480",
	"sideBar.foreground": "#141414BD",
	"activityBar.foreground": "#141414BD",
	"tab.activeForeground": CARET_LIGHT_ANCHORS.foreground,
	"tab.inactiveForeground": "#141414BD",
	"statusBar.foreground": "#14141499",
	// See the dark palette: without these the engine's light default theme
	// ("Light 2026") leaks #FAFAFD into an unfocused status bar.
	"statusBar.inactiveBackground": CARET_LIGHT_ANCHORS.chromeBackground,
	"statusBar.inactiveForeground": "#14141499",
	"activityBar.inactiveForeground": "#141414BD",
	"panelTitle.inactiveForeground": "#141414BD",
	"titleBar.activeForeground": "#141414A8",
	"titleBar.inactiveForeground": "#14141480",
	"terminal.foreground": CARET_LIGHT_ANCHORS.foreground,
	"editorCursor.foreground": CARET_LIGHT_ANCHORS.foreground,
	"editorLineNumber.foreground": "#1414145C",
	"editorLineNumber.activeForeground": "#141414BD",
	descriptionForeground: "#141414BD",

	// Borders (the reference's own 8%/20%/25% black over its light chrome)
	"panel.border": "#14141414",
	"sideBar.border": "#14141414",
	"statusBar.border": "#14141414",
	"titleBar.border": "#14141414",
	"editorGroup.border": "#14141414",
	"tab.border": "#1414141F",
	// Derived: the reference sets only menu.separatorBackground; reuse the
	// shared hairline so menus do not keep the engine's light grey.
	"menu.border": "#14141414",
	"dropdown.border": "#14141414",
	"editorWidget.border": "#14141414",
	"input.border": "#14141433",

	// Controls
	"button.background": CARET_LIGHT_ANCHORS.accent,
	"button.foreground": CARET_LIGHT_ANCHORS.accentText,
	"button.hoverBackground": CARET_LIGHT_ANCHORS.accentHover,
	"badge.background": CARET_LIGHT_ANCHORS.badge,
	"badge.foreground": "#141414A8",
	"textLink.foreground": "#0064B0",
	"textLink.activeForeground": "#0064B0",
	"input.background": CARET_LIGHT_ANCHORS.editorBackground,
	"input.foreground": CARET_LIGHT_ANCHORS.foreground,
	"input.placeholderForeground": "#1414145C",
	focusBorder: "#14141433",
	"selection.background": "#14141414",

	// Lists and editor selection
	"list.activeSelectionBackground": "#14141414",
	"list.activeSelectionForeground": "#141414",
	"list.inactiveSelectionBackground": "#14141414",
	"list.focusBackground": "#14141424",
	"list.hoverBackground": "#14141414",
	"editor.selectionBackground": "#14141414",
	"editor.lineHighlightBackground": "#EAEAEA",
	"scrollbarSlider.background": "#14141424",
	"scrollbarSlider.hoverBackground": "#14141433",
	"scrollbarSlider.activeBackground": "#14141433",
};

export type CaretThemeKind = "dark" | "light" | "high-contrast" | "dark-midnight" | "light-colorblind";

/** Anchors from the reference's own dark-midnight theme. */
export const CARET_MIDNIGHT_ANCHORS = {
	editorBackground: "#1e2127",
	chromeBackground: "#191c22",
	foreground: "#7b88a1",
	accent: "#88c0d0",
	accentHover: "#98d5e7",
	accentText: "#191c22",
	badge: "#88c0d0",
} as const;

/** Cursor Dark Midnight, the reference's fourth chrome palette. Read from
 * `theme-cursor/themes/cursor-dark-midnight-color-theme.json`. */
export const CARET_MIDNIGHT_WORKBENCH_COLORS: Readonly<Record<string, string>> = {
	// Surfaces
	"editor.background": CARET_MIDNIGHT_ANCHORS.editorBackground,
	"editorGutter.background": CARET_MIDNIGHT_ANCHORS.editorBackground,
	"sideBar.background": CARET_MIDNIGHT_ANCHORS.chromeBackground,
	"sideBarSectionHeader.background": CARET_MIDNIGHT_ANCHORS.chromeBackground,
	"activityBar.background": CARET_MIDNIGHT_ANCHORS.chromeBackground,
	"statusBar.background": CARET_MIDNIGHT_ANCHORS.chromeBackground,
	"statusBar.noFolderBackground": CARET_MIDNIGHT_ANCHORS.chromeBackground,
	"titleBar.activeBackground": CARET_MIDNIGHT_ANCHORS.chromeBackground,
	"titleBar.inactiveBackground": CARET_MIDNIGHT_ANCHORS.chromeBackground,
	"panel.background": CARET_MIDNIGHT_ANCHORS.chromeBackground,
	"editorWidget.background": CARET_MIDNIGHT_ANCHORS.chromeBackground,
	"menu.background": CARET_MIDNIGHT_ANCHORS.chromeBackground,
	"dropdown.background": CARET_MIDNIGHT_ANCHORS.chromeBackground,
	"editorGroupHeader.tabsBackground": CARET_MIDNIGHT_ANCHORS.chromeBackground,
	"tab.activeBackground": CARET_MIDNIGHT_ANCHORS.editorBackground,
	"tab.inactiveBackground": CARET_MIDNIGHT_ANCHORS.chromeBackground,
	"terminal.background": CARET_MIDNIGHT_ANCHORS.chromeBackground,

	// Text
	foreground: CARET_MIDNIGHT_ANCHORS.foreground,
	"editor.foreground": CARET_MIDNIGHT_ANCHORS.foreground,
	// Derived: the reference leaves icon.foreground unset.
	"icon.foreground": "#7c818e",
	"sideBar.foreground": "#7c818e",
	"activityBar.foreground": CARET_MIDNIGHT_ANCHORS.foreground,
	"tab.activeForeground": "#d8dee9",
	"tab.inactiveForeground": "#4b5163",
	"statusBar.foreground": "#4b5163",
	"statusBar.inactiveBackground": CARET_MIDNIGHT_ANCHORS.chromeBackground,
	"statusBar.inactiveForeground": "#4b5163",
	"activityBar.inactiveForeground": "#7b88a1",
	// The reference's midnight theme defines this one itself.
	"panelTitle.inactiveForeground": "#7b88a1",
	"titleBar.activeForeground": "#4b5163",
	"titleBar.inactiveForeground": "#7b88a199",
	"terminal.foreground": "#d8dee9",
	"editorCursor.foreground": "#d8dee9",
	"editorLineNumber.foreground": "#4c566a",
	"editorLineNumber.activeForeground": "#687692",
	// Derived: the reference leaves descriptionForeground unset; reuse its own
	// sidebar foreground so muted labels stay readable but secondary.
	descriptionForeground: "#7c818e",

	// Borders
	"panel.border": "#ffffff0d",
	"sideBar.border": "#ffffff0d",
	"statusBar.border": "#ffffff0d",
	"titleBar.border": "#ffffff0d",
	"editorGroup.border": "#ffffff0d",
	"tab.border": "#ffffff0d",
	// Derived: the reference sets only the forms above.
	"menu.border": "#ffffff0d",
	"dropdown.border": "#272c36",
	"editorWidget.border": "#ffffff0d",
	"input.border": "#272c36",

	// Controls
	"button.background": CARET_MIDNIGHT_ANCHORS.accent,
	"button.foreground": CARET_MIDNIGHT_ANCHORS.accentText,
	"button.hoverBackground": CARET_MIDNIGHT_ANCHORS.accentHover,
	"badge.background": CARET_MIDNIGHT_ANCHORS.badge,
	"badge.foreground": "#1d2128",
	"textLink.foreground": "#8fbcbb",
	"textLink.activeForeground": "#8fbcbb",
	"input.background": "#272c3655",
	"input.foreground": "#d8dee9",
	"input.placeholderForeground": "#d8dee999",
	// Derived (accessibility): the reference sets focusBorder fully transparent.
	// Caret requires a visible perimeter, so the theme's accent is used.
	focusBorder: "#88c0d066",
	"selection.background": "#88c0d033",

	// Lists and editor selection
	"list.activeSelectionBackground": "#21242b",
	"list.activeSelectionForeground": "#eceff4",
	"list.inactiveSelectionBackground": "#21242b",
	"list.focusBackground": "#434c5e",
	"list.hoverBackground": "#272c3699",
	"editor.selectionBackground": "#434c5e99",
	"editor.lineHighlightBackground": "#434c5e33",
	"scrollbarSlider.background": "#434c5e55",
	"scrollbarSlider.hoverBackground": "#434c5e55",
	"scrollbarSlider.activeBackground": "#434c5e55",
};

/** Cursor Light Colorblind (Beta). Compared against `cursor-light`, that theme
 * differs in exactly four keys - the accent family and its links - so this is
 * derived from the light palette rather than duplicated. Verified against
 * `theme-cursor/themes/cursor-light-colorblind-color-theme.json`. */
export const CARET_LIGHT_COLORBLIND_WORKBENCH_COLORS: Readonly<Record<string, string>> = {
	...CARET_LIGHT_WORKBENCH_COLORS,
	"button.background": "#1F79C0",
	"button.hoverBackground": "#1D6BAA",
	"textLink.foreground": "#0066AB",
	"textLink.activeForeground": "#0066AB",
};

/** The palette to write for the workbench's current kind. */
export function caretWorkbenchColors(kind: CaretThemeKind): Readonly<Record<string, string>> {
	if (kind === "light") return CARET_LIGHT_WORKBENCH_COLORS;
	if (kind === "high-contrast") return CARET_HC_DARK_WORKBENCH_COLORS;
	if (kind === "dark-midnight") return CARET_MIDNIGHT_WORKBENCH_COLORS;
	if (kind === "light-colorblind") return CARET_LIGHT_COLORBLIND_WORKBENCH_COLORS;
	return CARET_WORKBENCH_COLORS;
}

/** Anchors measured from the reference product's own HIGH CONTRAST dark theme.
 * VS Code ships built-in high-contrast themes, so this kind is reachable on
 * any machine with "Increase contrast" enabled; before this Caret rendered its
 * plain dark chrome there instead of the reference's. */
export const CARET_HC_DARK_ANCHORS = {
	editorBackground: "#0A0A0A",
	chromeBackground: "#0A0A0A",
	foreground: "#F0F0F0",
	accent: "#434C5E",
	accentHover: "#4C566A",
	accentText: "#ECEFF4",
	badge: "#88C0D0",
} as const;

/** The same keys as CARET_WORKBENCH_COLORS, read from
 * `theme-cursor/themes/cursor-dark-hc-color-theme.json`.
 *
 * Two deliberate departures from that file, both for accessibility:
 * the reference sets focusBorder to fully transparent (relying on other
 * indicators) and statusBar.border to nothing, while Caret's own rules require
 * a visible focus perimeter and borders that do not depend on shadow. Both are
 * marked below and are recorded in the D20 deviations table. */
export const CARET_HC_DARK_WORKBENCH_COLORS: Readonly<Record<string, string>> = {
	// Surfaces (the reference uses one background for chrome and editor here)
	"editor.background": CARET_HC_DARK_ANCHORS.editorBackground,
	"editorGutter.background": CARET_HC_DARK_ANCHORS.editorBackground,
	"sideBar.background": CARET_HC_DARK_ANCHORS.chromeBackground,
	"sideBarSectionHeader.background": CARET_HC_DARK_ANCHORS.chromeBackground,
	"activityBar.background": CARET_HC_DARK_ANCHORS.chromeBackground,
	"statusBar.background": CARET_HC_DARK_ANCHORS.chromeBackground,
	"statusBar.noFolderBackground": CARET_HC_DARK_ANCHORS.chromeBackground,
	"titleBar.activeBackground": CARET_HC_DARK_ANCHORS.chromeBackground,
	"titleBar.inactiveBackground": CARET_HC_DARK_ANCHORS.chromeBackground,
	"panel.background": CARET_HC_DARK_ANCHORS.chromeBackground,
	"editorWidget.background": CARET_HC_DARK_ANCHORS.chromeBackground,
	"menu.background": CARET_HC_DARK_ANCHORS.chromeBackground,
	"dropdown.background": CARET_HC_DARK_ANCHORS.chromeBackground,
	"editorGroupHeader.tabsBackground": CARET_HC_DARK_ANCHORS.chromeBackground,
	"tab.activeBackground": CARET_HC_DARK_ANCHORS.chromeBackground,
	"tab.inactiveBackground": CARET_HC_DARK_ANCHORS.chromeBackground,
	"terminal.background": CARET_HC_DARK_ANCHORS.chromeBackground,

	// Text
	foreground: CARET_HC_DARK_ANCHORS.foreground,
	"editor.foreground": CARET_HC_DARK_ANCHORS.foreground,
	// Derived: the reference leaves icon.foreground unset and paints the
	// activity bar at full strength, so icons follow that.
	"icon.foreground": "#F0F0F0",
	"sideBar.foreground": "#F0F0F0BD",
	"activityBar.foreground": "#F0F0F0",
	"tab.activeForeground": "#F0F0F0",
	"tab.inactiveForeground": "#F0F0F099",
	"statusBar.foreground": "#F0F0F0",
	"statusBar.inactiveBackground": CARET_HC_DARK_ANCHORS.chromeBackground,
	"statusBar.inactiveForeground": "#F0F0F0",
	"activityBar.inactiveForeground": "#F0F0F0",
	// The reference's high contrast theme defines this one itself.
	"panelTitle.inactiveForeground": "#F0F0F0BD",
	"titleBar.activeForeground": "#F0F0F0",
	"titleBar.inactiveForeground": "#F0F0F0BD",
	"terminal.foreground": CARET_HC_DARK_ANCHORS.foreground,
	"editorCursor.foreground": CARET_HC_DARK_ANCHORS.foreground,
	"editorLineNumber.foreground": "#F0F0F099",
	"editorLineNumber.activeForeground": "#F0F0F0",
	// Derived: the reference leaves descriptionForeground unset; reuse the
	// 60% white it uses for other muted foregrounds.
	descriptionForeground: "#F0F0F099",

	// Borders
	"panel.border": "#F0F0F01a",
	"sideBar.border": "#F0F0F01a",
	// Derived (accessibility): the reference makes this border transparent.
	"statusBar.border": "#F0F0F01a",
	"titleBar.border": "#F0F0F01a",
	"editorGroup.border": "#F0F0F01a",
	"tab.border": "#F0F0F01a",
	// Derived: the reference sets only menu.separatorBackground.
	"menu.border": "#F0F0F01a",
	"dropdown.border": "#2A2A2A",
	// Derived from editorWidget.resizeBorder, which the reference sets solid.
	"editorWidget.border": "#F0F0F01a",
	"input.border": "#2A2A2A",

	// Controls
	"button.background": CARET_HC_DARK_ANCHORS.accent,
	"button.foreground": CARET_HC_DARK_ANCHORS.accentText,
	"button.hoverBackground": CARET_HC_DARK_ANCHORS.accentHover,
	"badge.background": CARET_HC_DARK_ANCHORS.badge,
	"badge.foreground": "#000000",
	// Derived: the reference ships no link colour for this theme; use its own
	// list.highlightForeground so links stay distinguishable.
	"textLink.foreground": "#88C0D0",
	"textLink.activeForeground": "#88C0D0",
	"input.background": "#2A2A2A55",
	"input.foreground": "#F0F0F0",
	"input.placeholderForeground": "#F0F0F099",
	// Derived (accessibility): the reference sets focusBorder fully transparent.
	// Caret requires a visible focus perimeter, so a 40% white ring is used.
	focusBorder: "#F0F0F066",
	"selection.background": "#F0F0F033",

	// Lists and editor selection
	"list.activeSelectionBackground": "#434C5E",
	"list.activeSelectionForeground": "#ECEFF4",
	"list.inactiveSelectionBackground": "#0A0A0A",
	"list.focusBackground": "#434C5E",
	"list.hoverBackground": "#2A2A2A99",
	"editor.selectionBackground": "#40404099",
	"editor.lineHighlightBackground": "#434C5E44",
	"scrollbarSlider.background": "#40404055",
	"scrollbarSlider.hoverBackground": "#40404055",
	"scrollbarSlider.activeBackground": "#40404055",
};

/** VS Code's ColorThemeKind enum, without importing `vscode` into this pure
 * module. The reference ships a high-contrast dark theme but no high-contrast
 * light one, so highContrastLight keeps the light palette. */
export const VSCODE_COLOR_THEME_KIND = {
	light: 1,
	dark: 2,
	highContrast: 3,
	highContrastLight: 4,
} as const;

export function caretThemeKindFromVscode(kind: number): CaretThemeKind {
	if (kind === VSCODE_COLOR_THEME_KIND.highContrast) return "high-contrast";
	if (kind === VSCODE_COLOR_THEME_KIND.light || kind === VSCODE_COLOR_THEME_KIND.highContrastLight) return "light";
	return "dark";
}

/** Pick the palette from the workbench's theme name plus kind.
 *
 * The two variant themes carry the same ColorThemeKind as their base (midnight
 * is a dark theme, light colorblind is a light one), so the active
 * `workbench.colorTheme` name is the only signal that distinguishes them. The
 * match is a documented name heuristic, not an API contract; an unrecognised
 * name falls through to the kind. */
export function caretThemeKindFor(themeName: string | undefined, kind: number): CaretThemeKind {
	const name = (themeName ?? "").toLowerCase();
	if (name.includes("midnight")) return "dark-midnight";
	if (name.includes("colorblind") || name.includes("color blind")) return "light-colorblind";
	return caretThemeKindFromVscode(kind);
}

function carriesEveryKey(candidate: Record<string, unknown>, reference: Readonly<Record<string, string>>): boolean {
	for (const [key, value] of Object.entries(reference)) {
		if (candidate[key] !== value) return false;
	}
	return true;
}

/** True when a stored `workbench.colorCustomizations` is one of Caret's own
 * palettes rather than a palette the user wrote.
 *
 * Why this matters: the Agents window can open with no folder attached, where
 * a workspace-scope write throws and the palette has to land at global scope.
 * Without this check the next activation would read that global value back,
 * mistake Caret's own footprint for the user's choice, and stop repainting. */
export function isCaretWorkbenchPalette(value: unknown): boolean {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const candidate = value as Record<string, unknown>;
	return carriesEveryKey(candidate, CARET_WORKBENCH_COLORS)
		|| carriesEveryKey(candidate, CARET_LIGHT_WORKBENCH_COLORS)
		|| carriesEveryKey(candidate, CARET_HC_DARK_WORKBENCH_COLORS)
		|| carriesEveryKey(candidate, CARET_MIDNIGHT_WORKBENCH_COLORS)
		|| carriesEveryKey(candidate, CARET_LIGHT_COLORBLIND_WORKBENCH_COLORS);
}

/** Caret's own `--caret-*` token scale, named without the leading dashes.
 *
 * Why this file holds it: these values are the layout and type knowledge the
 * reference product was measured for, so they belong with the palettes rather
 * than inside whatever surface happens to render them. They lived in the
 * retired agent shell's stylesheet, which meant `check:cursor-parity` could
 * only read them by regex-matching a webview's CSS string, and any surface
 * that wanted them had to import the shell. The shell is gone; the scale
 * stays, and it is now the single source both the gate and any renderer read.
 *
 * They are declared as `--<name>` custom properties by `caretTokenCss()`.
 */
export const CARET_TOKENS: Readonly<Record<string, string>> = {
	// Surface roles. The `var(--vscode-*, fallback)` form keeps one token layer
	// over the workbench palette above, so both follow the same theme.
	"caret-bg": "var(--vscode-editor-background, #202124)",
	"caret-panel": "var(--vscode-sideBar-background, #252526)",
	"caret-panel-raised": "var(--vscode-editorWidget-background, #2d2d30)",
	"caret-input": "var(--vscode-input-background, #313131)",
	"caret-text": "var(--vscode-foreground, #e7e7e7)",
	"caret-muted": "var(--vscode-descriptionForeground, #a8a8a8)",
	"caret-border": "var(--vscode-panel-border, #3d3d40)",
	"caret-control-border": "var(--vscode-input-border, var(--vscode-contrastBorder, #3d3d40))",
	"caret-focus": "var(--vscode-focusBorder, #6cb6ff)",
	"caret-accent": "var(--vscode-button-background, #0e639c)",
	"caret-accent-text": "var(--vscode-button-foreground, #fff)",
	"caret-link": "var(--vscode-textLink-foreground, #6cb6ff)",
	"caret-selected-bg": "var(--vscode-list-activeSelectionBackground, #094771)",
	"caret-selected-fg": "var(--vscode-list-activeSelectionForeground, #fff)",
	"caret-hover-bg": "var(--vscode-list-hoverBackground, #2a2d2e)",
	"caret-danger": "var(--vscode-errorForeground, #f48771)",
	"caret-warning": "var(--vscode-editorWarning-foreground, #cca700)",
	"caret-success": "var(--vscode-testing-iconPassed, #73c991)",

	// Type scale. Cursor's UI roles: metadata xs/sm, sidebar sm, controls base,
	// transcript lg.
	"caret-font-xs": "11px",
	"caret-font-sm": "12px",
	"caret-font-base": "13px",
	"caret-font-lg": "14px",
	"caret-lh-xs": "14px",
	"caret-lh-sm": "16px",
	"caret-lh-base": "18px",
	"caret-lh-lg": "22px",
	"caret-height-xs": "20px",
	"caret-height-sm": "24px",
	"caret-height-base": "28px",
	"caret-height-lg": "32px",

	// Sidebar row height. The reference's own agent CSS sets
	// `--ui-sidebar-menu-button-min-height` and `--ui-tray-row-min-height` to
	// `--cursor-height-base` (28px), but its rendered row BOX measures 30px:
	// the "New Chat" row's highlight fill spans y48..77 of a 1073px window and
	// the sidebar's text-row pitch measures ~30.7px over ~20 rows. A min-height
	// of 28 with zero padding cannot produce that, so the rendered box is what
	// a user sees (hover height, list rhythm) and Caret matches the box. Set
	// this back to 28px to reproduce only the token; `check:cursor-parity`
	// asserts both numbers so that choice stays visible.
	"caret-row": "30px",
	// Reference `--ui-sidebar-action-icon-size` = spacing-3-25 = 13px.
	"caret-sidebar-icon": "13px",

	"caret-space-4": "4px",
	"caret-space-6": "6px",
	"caret-space-8": "8px",
	"caret-space-10": "10px",
	"caret-space-12": "12px",
	"caret-space-16": "16px",
	"caret-space-20": "20px",
	"caret-space-24": "24px",
	"caret-space-28": "28px",
	"caret-space-32": "32px",
	"caret-space-40": "40px",
	"caret-space-44": "44px",
	"caret-space-48": "48px",

	"caret-radius-xs": "2px",
	"caret-radius-sm": "4px",
	"caret-radius-md": "6px",
	"caret-radius": "8px",
	"caret-radius-xl": "12px",
	"caret-radius-2xl": "14px",
	"caret-radius-3xl": "16px",
	"caret-radius-4xl": "18px",
	"caret-radius-full": "9999px",

	// Control radius = the reference's radius-base (6). A composer is not one
	// radius in the reference: compact is radius-full, dynamic island is
	// radius-3xl (16), and expanded - a multi-line composer with a toolbar,
	// which is what Caret's is - is radius-4xl (18). Caret used 10px then 12px,
	// neither of which is a composer radius in the reference's scale.
	"caret-control-radius": "6px",
	"caret-composer-radius": "18px",
	// Reference `--prompt-input-editor-min-height` = spacing-9 = 36px and
	// `--prompt-input-editor-max-height` = 200px.
	"caret-composer-editor-min": "36px",
	"caret-composer-editor-max": "200px",

	// Composer surface. The reference paints the prompt input with
	// `--prompt-input-container-bg` = `--cursor-bg-input-surface` =
	// color-mix(in srgb, var(--cursor-base) 6%, transparent): one 6% step above
	// the page, not a raised panel. Measured in the reference's live light
	// window the card reads #FCFCFC (the same value as editor.background) on a
	// page that reads #F5F5F6, and its own token
	// `--prompt-input-container-shadow` is none. Caret painted the card with
	// the chrome colour (#F3F3F3), one step BELOW the page: the opposite
	// direction from the reference.
	"caret-composer-surface": "color-mix(in srgb, #fff 6%, var(--caret-bg))",

	// Transcript / composer column. Measured directly: with the SAME 1710px
	// window as the reference, the reference's empty-draft prompt-input card
	// spans x679..1286 = 608px (its 1px border included), centred in the main
	// pane. The 437px Caret shipped came from a proportional guess (41.8% of
	// the pane) off a 1224px render, and a same-size render disproves it:
	// Caret's own card is 397px at both 1224px and 1710px windows, i.e. the
	// column is fixed, not proportional, and Caret's number was simply short.
	// Still open: whether the reference's 608 is itself fixed or 41.8% of the
	// pane (that reading gives 639 in Caret's pane). 608 is the only value
	// measured on the reference at a like-for-like window size.
	"caret-transcript-column": "608px",
	"caret-composer-column": "608px",
	"caret-composer-column-outer": "calc(var(--caret-composer-column) + 2 * var(--caret-gutter))",

	"caret-sidebar": "180px",
	"caret-panel-w": "360px",
	"caret-panel-h": "40vh",
	"caret-gutter": "24px",
	// Lane reserved for the floating connection / mode cluster in a task
	// header. The cluster is positioned over the header row, so the row must
	// stop before it or the resource links underneath become unclickable.
	"caret-top-cluster": "124px",
	"caret-elevate-1": "0 2px 8px rgb(0 0 0 / .32)",
	"caret-elevate-2": "0 12px 36px rgb(0 0 0 / .24)",

	// Motion. These must equal DEFAULT_MOTION_TOKENS (ui-a11y.ts) or a surface
	// animates with one timing before the first host snapshot and a different
	// one after. The values are the reference product's own motion scale
	// (`--cursor-duration-*` / `--cursor-easing-out-cubic`); tests pin them.
	"caret-motion-instant": "50ms",
	"caret-motion-feedback": "100ms",
	"caret-motion-surface-in": "150ms",
	"caret-motion-surface-out": "100ms",
	"caret-motion-drawer-in": "200ms",
	"caret-motion-drawer-out": "150ms",
	"caret-motion-curve": "cubic-bezier(0.215, 0.61, 0.355, 1)",
};

/** The `:root` custom-property block for `CARET_TOKENS`, in declaration order.
 *
 * Order is preserved because later declarations of the same property win in
 * CSS; keeping the authoring order means a re-rendered block is byte-identical
 * to the one the values were measured against.
 */
export function caretTokenCss(): string {
	const declarations = Object.entries(CARET_TOKENS).map(([name, value]) => `\t--${name}: ${value};`);
	return `:root {\n\tcolor-scheme: light dark;\n${declarations.join("\n")}\n}`;
}
