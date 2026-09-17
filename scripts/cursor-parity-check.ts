/** Objective Cursor-parity gate for Caret's workbench palettes.
 *
 * Why this exists: the palettes in `apps/macos/src/caret-theme.ts` were read by
 * hand out of the reference product's own theme files. A single mistyped hex is
 * invisible in a screenshot and only shows up as "close but not quite", which is
 * exactly the failure pixel parity is supposed to prevent. This script reads the
 * installed reference theme files and checks every key Caret defines against
 * them, so a wrong value is a failing check instead of a subtle difference.
 *
 * It checks only values Caret already declares; it does not copy the reference's
 * theme into the repository, and it does not require the reference to be
 * installed (CI skips with SKIP, not a pass).
 *
 * usage: bun scripts/cursor-parity-check.ts [--verbose]
 */

import { existsSync, readFileSync } from "node:fs";
import { DEFAULT_MOTION_TOKENS, MOTION_CURVE } from "../apps/macos/src/ui-a11y.ts";
import {
	CARET_TOKENS,
	CARET_HC_DARK_WORKBENCH_COLORS,
	CARET_LIGHT_COLORBLIND_WORKBENCH_COLORS,
	CARET_LIGHT_WORKBENCH_COLORS,
	CARET_MIDNIGHT_WORKBENCH_COLORS,
	CARET_WORKBENCH_COLORS,
} from "../apps/macos/src/caret-theme.ts";

const THEME_DIR =
	"/Applications/Cursor.app/Contents/Resources/app/extensions/theme-cursor/themes";

/** Reference theme file -> the Caret palette that mirrors it. */
const PAIRS: readonly (readonly [string, Readonly<Record<string, string>>, string])[] = [
	["cursor-dark-color-theme.json", CARET_WORKBENCH_COLORS, "dark"],
	["cursor-light-color-theme.json", CARET_LIGHT_WORKBENCH_COLORS, "light"],
	["cursor-dark-hc-color-theme.json", CARET_HC_DARK_WORKBENCH_COLORS, "high-contrast"],
	["cursor-dark-midnight-color-theme.json", CARET_MIDNIGHT_WORKBENCH_COLORS, "dark-midnight"],
	["cursor-light-colorblind-color-theme.json", CARET_LIGHT_COLORBLIND_WORKBENCH_COLORS, "light-colorblind"],
];

/** Keys Caret intentionally does not copy verbatim, with the reason. Anything
 * else that differs is a transcription bug, not a design decision. */
const DERIVED: Record<string, string> = {
	descriptionForeground: "the reference leaves it unset; derived from its muted foreground",
	"menu.border": "the reference sets only menu.separatorBackground",
	"editorWidget.border": "the reference leaves it unset",
	"icon.foreground": "the reference leaves it unset",
	"textLink.foreground": "the reference ships no link colour for this theme",
	"textLink.activeForeground": "the reference ships no link colour for this theme",
};

/** Deliberate accessibility overrides: a key the reference DOES define but
 * Caret must not copy. Listed per palette so an accidental change to one of
 * them is still a failure. These are recorded in the D20 deviations table. */
const ALLOWED_OVERRIDES: readonly (readonly [string, string, string])[] = [
	["high-contrast", "statusBar.border", "reference border is transparent; Caret needs a non-shadow separation"],
	["high-contrast", "focusBorder", "reference focus ring is transparent; Caret requires a visible perimeter"],
	["dark-midnight", "focusBorder", "reference focus ring is transparent; Caret requires a visible perimeter"],
];

const verbose = process.argv.includes("--verbose");

if (!existsSync(THEME_DIR)) {
	console.log("SKIP cursor-parity: the reference product is not installed at the expected path.");
	console.log(`  looked in ${THEME_DIR}`);
	console.log("  This is a skip, not a pass: Caret's palettes are unverified on this machine.");
} else {
	let mismatches = 0;
	let checked = 0;
	let derivedKeys = 0;

	for (const [file, palette, label] of PAIRS) {
		const path = `${THEME_DIR}/${file}`;
		if (!existsSync(path)) {
			console.log(`FAIL ${label}: reference theme file missing (${file})`);
			mismatches += 1;
			continue;
		}
		const reference = (JSON.parse(readFileSync(path, "utf8")) as { colors?: Record<string, string> }).colors ?? {};
		const lower = new Map(Object.entries(reference).map(([key, value]) => [key, value.toLowerCase()]));

		const wrong: string[] = [];
		const derived: string[] = [];
		const overridden: string[] = [];
		for (const [key, value] of Object.entries(palette)) {
			checked += 1;
			const expected = lower.get(key);
			if (expected === undefined) {
				// Not in the reference at all: Caret authored it.
				derived.push(key);
				derivedKeys += 1;
				continue;
			}
			if (expected === value.toLowerCase()) continue;
			const override = ALLOWED_OVERRIDES.find(([owner, owned]) => owner === label && owned === key);
			if (override) {
				overridden.push(`${key}: caret ${value} overrides reference ${reference[key]} - ${override[2]}`);
				continue;
			}
			wrong.push(`${key}: caret ${value} vs reference ${reference[key]}`);
		}

		if (wrong.length === 0) {
			const note = overridden.length > 0 ? `, ${overridden.length} deliberate override(s)` : "";
			console.log(`OK   ${label}: ${Object.keys(palette).length} keys, every shared value matches the reference${note}`);
			if (verbose) for (const line of overridden) console.log(`       override ${line}`);
		} else {
			console.log(`FAIL ${label}: ${wrong.length} value(s) differ from the reference`);
			for (const line of wrong) console.log(`       ${line}`);
			mismatches += wrong.length;
		}
		if (verbose && derived.length > 0) {
			for (const key of derived) {
				const reason = DERIVED[key] ?? DERIVED[key.split(".")[0]!] ?? "not present in the reference";
				console.log(`       derived ${key} - ${reason}`);
			}
		}
	}

	console.log(
		mismatches === 0
			? `cursor-parity: OK (${checked} keys checked, ${derivedKeys} authored by Caret, 0 mismatches)`
			: `cursor-parity: FAIL (${mismatches} mismatch(es) against the reference)`,
	);
	if (mismatches > 0) process.exitCode = 1;
}

/* ------------------------------------------------------------------ *
 * Shell tokens: the agent surface's own type/metric/radius/motion scale.
 *
 * The reference ships its agent design system as `--cursor-*` custom
 * properties inside the workbench bundle (405 of them), so the shell's scale
 * can be compared value-for-value instead of estimated from a screenshot.
 * ------------------------------------------------------------------ */

const WORKBENCH_BUNDLE =
	"/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js";

/** `--cursor-name: value` for every plain definition in the bundle. Later
 * definitions win, matching CSS. */
/** Two maps, because the bundle declares some tokens twice with different
 * intents: the global stylesheet block declares the scale, and component code
 * later re-declares the same custom property for one widget (for example a
 * checkbox setting "--cursor-radius-xs":"var(--cursor-radius-full)" inside a JS
 * object). A single last-wins map let such a widget override masquerade as the
 * scale, so stylesheet definitions are kept separately and first-wins. */
function referenceTokens(text: string): { scale: Map<string, string>; component: Map<string, string> } {
	const scale = new Map<string, string>();
	const component = new Map<string, string>();
	for (const match of text.matchAll(/--([a-z0-9-]+)\s*:\s*([^;}"']{1,80})/g)) {
		if (!scale.has(match[1]!)) scale.set(match[1]!, match[2]!.trim());
	}
	for (const match of text.matchAll(/--([a-z0-9-]+)"\s*:\s*"([^;"']{1,80})/g)) {
		component.set(match[1]!, match[2]!.trim());
	}
	return { scale, component };
}

/** Value of a Caret token as declared in `caret-theme.ts`. */
function caretToken(token: string): string | undefined {
	return CARET_TOKENS[token];
}

/** Follow `var(--x)` chains in the reference tokens until a literal value
 * appears, so `--ui-sidebar-action-icon-size` (which points at spacing-3-25)
 * can be compared as 13px. */
function resolveReference(lookup: (token: string) => string | undefined, token: string, depth = 0): string | undefined {
	if (depth > 8) return undefined;
	const value = lookup(token);
	if (value === undefined) return undefined;
	const reference = value.match(/^var\(\s*--([a-z0-9-]+)\s*(?:,[^)]*)?\)$/i);
	if (reference) return resolveReference(lookup, reference[1]!, depth + 1);
	return value;
}

if (!existsSync(WORKBENCH_BUNDLE)) {
	console.log("SKIP cursor-parity (shell tokens): the reference workbench bundle is not installed.");
} else {
	const { scale, component } = referenceTokens(readFileSync(WORKBENCH_BUNDLE, "utf8"));
	const lookup = (name: string): string | undefined => scale.get(name) ?? component.get(name);
	const tokens = { get: lookup, has: (n: string) => lookup(n) !== undefined, entries: () => scale.entries() };
	/** caret token -> reference token it must equal, or a resolved literal. */
	const shellPairs: readonly (readonly [string, string])[] = [
		["caret-font-xs", "cursor-font-size-xs"],
		["caret-font-sm", "cursor-font-size-sm"],
		["caret-font-base", "cursor-font-size-base"],
		["caret-font-lg", "cursor-font-size-lg"],
		["caret-lh-xs", "cursor-line-height-xs"],
		["caret-lh-sm", "cursor-line-height-sm"],
		["caret-lh-base", "cursor-line-height-base"],
		["caret-lh-lg", "cursor-line-height-lg"],
		["caret-height-xs", "cursor-height-xs"],
		["caret-height-sm", "cursor-height-sm"],
		["caret-height-base", "cursor-height-base"],
		["caret-height-lg", "cursor-height-lg"],
		["caret-radius-xs", "cursor-radius-xs"],
		["caret-radius-sm", "cursor-radius-sm"],
		["caret-radius-md", "cursor-radius-base"],
		["caret-radius", "cursor-radius-lg"],
		["caret-radius-xl", "cursor-radius-xl"],
		["caret-radius-2xl", "cursor-radius-2xl"],
		["caret-radius-3xl", "cursor-radius-3xl"],
		["caret-radius-4xl", "cursor-radius-4xl"],
		["caret-radius-full", "cursor-radius-full"],
		["caret-control-radius", "cursor-radius-base"],
	];

	let shellChecked = 0;
	const shellWrong: string[] = [];
	const shellOk: string[] = [];
	for (const [caret, reference] of shellPairs) {
		const expected = tokens.get(reference);
		const actual = caretToken(caret);
		if (expected === undefined || actual === undefined) {
			shellWrong.push(`${caret}: could not resolve (caret ${actual ?? "missing"} / reference ${expected ?? "missing"})`);
			continue;
		}
		shellChecked += 1;
		if (actual.toLowerCase() !== expected.toLowerCase()) {
			shellWrong.push(`${caret}: caret ${actual} vs reference ${reference} ${expected}`);
		} else shellOk.push(`${caret} = ${actual} (reference ${reference})`);
	}

	/** Caret motion token -> reference duration token, plus the shared curve. */
	const motionPairs: readonly (readonly [string, number, string])[] = [
		["instant", DEFAULT_MOTION_TOKENS.instant, "cursor-duration-instant"],
		["feedback", DEFAULT_MOTION_TOKENS.feedback, "cursor-duration-fast"],
		["surfaceIn", DEFAULT_MOTION_TOKENS.surfaceIn, "cursor-duration-normal"],
		["drawerIn", DEFAULT_MOTION_TOKENS.drawerIn, "cursor-duration-slow"],
	];
	let motionChecked = 0;
	for (const [name, value, reference] of motionPairs) {
		const expected = Number((tokens.get(reference) ?? "").replace("ms", ""));
		if (!Number.isFinite(expected)) {
			shellWrong.push(`motion.${name}: reference ${reference} not found`);
			continue;
		}
		motionChecked += 1;
		if (value !== expected) shellWrong.push(`motion.${name}: caret ${value}ms vs reference ${reference} ${expected}ms`);
		else shellOk.push(`motion.${name} = ${value}ms (reference ${reference})`);
	}
	shellChecked += motionChecked;

	const curve = tokens.get("cursor-easing-out-cubic");
	if (curve !== undefined) {
		shellChecked += 1;
		if (MOTION_CURVE.replace(/\s/g, "") !== curve.replace(/\s/g, "")) {
			shellWrong.push(`motion.curve: caret ${MOTION_CURVE} vs reference cursor-easing-out-cubic ${curve}`);
		} else shellOk.push(`motion.curve = ${MOTION_CURVE} (reference cursor-easing-out-cubic)`);
	}

	/* Component-level values the reference documents by name. These are the
	 * ones a token-by-token sweep misses, because Caret's own token names differ
	 * from the reference's component tokens. */
	const componentPairs: readonly (readonly [string, string, string])[] = [
		["caret-sidebar-icon", "ui-sidebar-action-icon-size", "sidebar action icon size"],
		["caret-composer-radius", "prompt-input-border-radius-expanded", "expanded prompt-input radius"],
		["caret-composer-editor-min", "prompt-input-editor-min-height", "prompt-input editor min-height"],
		["caret-composer-editor-max", "prompt-input-editor-max-height", "prompt-input editor max-height"],
	];
	/* The sidebar row is the one component where the reference's TOKEN and its
	 * RENDERED box disagree, so a token-vs-token comparison would be wrong.
	 * The reference's rule is `min-height: var(--ui-sidebar-menu-button-min-height)`
	 * = --cursor-height-base = 28px with zero row padding, but the rendered row
	 * box is 30px: the "New Chat" row's own highlight fill spans y48..77 of a
	 * 1073px window, and the sidebar's text-row pitch measures ~30.7px across
	 * ~20 rows. Caret matches the box, because the box is what a user sees
	 * (hover height, list rhythm). BOTH facts are asserted: the reference's
	 * token must still be 28px (or this gate should be re-measured), and Caret
	 * must render the measured 30px box. */
	const REFERENCE_ROW_BOX = "30px";
	const referenceRowToken = resolveReference(lookup, "cursor-height-base");
	const caretRowValue = caretToken("caret-row");
	shellChecked += 2;
	if (referenceRowToken !== "28px") {
		shellWrong.push(`caret-row: the reference's cursor-height-base is now ${referenceRowToken}, not the 28px the 30px measured row box was derived against - re-measure the reference's live sidebar before trusting REFERENCE_ROW_BOX`);
	} else if (caretRowValue === undefined) {
		shellWrong.push("caret-row: caret-row is missing from the shell CSS");
	} else if (caretRowValue.toLowerCase() !== REFERENCE_ROW_BOX) {
		shellWrong.push(`caret-row (sidebar row box): caret ${caretRowValue} vs reference measured box ${REFERENCE_ROW_BOX} (reference token cursor-height-base is ${referenceRowToken})`);
	} else {
		shellOk.push(`caret-row = ${caretRowValue} (reference measured row box; its min-height token is ${referenceRowToken})`);
	}
	for (const [caret, reference, what] of componentPairs) {
		const expected = resolveReference(lookup, reference);
		const actual = caretToken(caret);
		shellChecked += 1;
		if (expected === undefined || actual === undefined) {
			shellWrong.push(`${caret}: could not resolve (caret ${actual ?? "missing"} / reference ${reference})`);
			continue;
		}
		if (actual.toLowerCase() !== expected.toLowerCase()) {
			shellWrong.push(`${caret} (${what}): caret ${actual} vs reference ${reference} ${expected}`);
		} else shellOk.push(`${caret} = ${actual} (reference ${reference}, ${what})`);
	}

	/* Every spacing step Caret uses must exist in the reference's spacing scale,
	 * otherwise the shell is inventing gaps the reference does not have. */
	const spacingValues = new Set<string>();
	for (const [name, value] of scale) {
		if (/^cursor-spacing-(?!ne-)/.test(name)) spacingValues.add(value.toLowerCase());
	}
	for (const [token, value] of Object.entries(CARET_TOKENS)) {
		const match = token.match(/^caret-space-(\d+)$/);
		if (!match || !/^[\d.]+px$/.test(value)) continue;
		shellChecked += 1;
		if (!spacingValues.has(value.toLowerCase())) {
			shellWrong.push(`caret-space-${match[1]} = ${value}, not a value in the reference's spacing scale`);
		} else shellOk.push(`caret-space-${match[1]} = ${value} (in the reference's spacing scale)`);
	}

	if (shellWrong.length === 0) {
		console.log(`OK   shell tokens: ${shellChecked} of Caret's type/size/radius/motion tokens match the reference`);
		if (verbose) for (const line of shellOk) console.log(`       ${line}`);
	} else {
		console.log(`FAIL shell tokens: ${shellWrong.length} value(s) differ from the reference`);
		for (const line of shellWrong) console.log(`       ${line}`);
		process.exitCode = 1;
	}
}
