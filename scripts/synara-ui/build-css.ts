/**
 * Compiles the vendored Synara surface's stylesheet.
 *
 * The port takes the reference's Tailwind v4 setup verbatim (see
 * `desktop/src/vs/sessions/contrib/home/browser/cediaUi/VENDORED.md`), but the workbench document
 * is not the reference's page: the reference owns its whole document, while Cedia's surface is one
 * region of the Agents window sharing a stylesheet with the IDE-derived chrome. A raw Tailwind
 * build therefore cannot ship - its preflight resets every element in the document - so this script
 * compiles the entry and then scopes what comes out.
 *
 * Three passes, in order:
 *
 *   1. the Tailwind CLI over `cediaUi/synaraTailwind.css`, scanning the vendored `.tsx` sources;
 *   2. every selector rewritten to sit under `[data-cedia-surface]`, with `:root`/`:host` becoming
 *      that element itself (the root carries the token sheet and the `dark` class) and also
 *      `[data-cedia-tokens]` (the token-only root the port sets on the region whose Cedia-owned
 *      chrome should read the reference's palette), and the emitted keyframe names prefixed so they
 *      cannot shadow the workbench's own animations;
 *   3. assertions that no rule escaped the surface and no global keyframe name remains.
 *
 * The result is checked in, the way the desktop patches themselves are: it is the bytes the shipped
 * app reads. `bun test apps/macos/test/synara-ui-css.test.ts` recompiles the sources and fails if
 * the two ever disagree.
 *
 * Usage: `bun scripts/synara-ui/build-css.ts [--check]`
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..", "..");
const surfaceDir = join(root, "desktop", "src", "vs", "sessions", "contrib", "home", "browser", "cediaUi");
const entry = join(surfaceDir, "synaraTailwind.css");
/** The checked-in artifact the sessions bundle imports. */
export const output = join(surfaceDir, "media", "cediaSynaraUi.css");
/** The vendored sources the artifact is compiled from, and the file that mounts the surface root. */
export const surfaceMount = join(surfaceDir, "cediaSynaraSurface.tsx");
const tailwindCli = join(root, "node_modules", "@tailwindcss", "cli", "dist", "index.mjs");
const scratch = join(root, "node_modules", ".cache", "cedia-synara-ui.css");

/** The attribute that scopes the ported surface; `probeSurface.tsx` sets it on the root. */
export const SURFACE_ATTRIBUTE = "data-cedia-surface";
const SURFACE = `[${SURFACE_ATTRIBUTE}]`;
/**
 * The attribute that scopes the *tokens* alone.
 *
 * The reference's token sheet is not a component style: it is the palette every part of its window
 * reads, including the parts the port keeps as workbench elements (the composer card, the chips).
 * Scoping it to `[data-cedia-surface]` would tie it to the vendored components' roots, and widening
 * *those* roots to the whole window is not an option - the same sheet carries Tailwind's preflight,
 * which would reset every workbench element inside the surface.
 *
 * So the token rules (the ones the compiler emits on `:root`/`:host`) match this attribute as well,
 * and the port sets it on the region whose Cedia-owned chrome should read the reference's palette.
 */
export const TOKENS_ATTRIBUTE = "data-cedia-tokens";
const TOKENS = `[${TOKENS_ATTRIBUTE}]`;
/** Keyframe names are global and the workbench already defines `pulse`, so ours cannot stay bare. */
const KEYFRAME_PREFIX = "cedia-synara-";

/**
 * Where a rule sits, which decides whether its selector is rewritten.
 *
 * `top` is the stylesheet or the body of a grouping at-rule (`@layer`, `@media`, `@supports`):
 * every selector there is new and needs the surface prefix. `style` is the body of a style rule,
 * which holds declarations and nested rules; a nested rule is already relative to its (scoped)
 * parent, so prefixing it would push the surface *below* the parent instead of above it.
 * `keyframes` holds keyframe selectors (`from`, `50%`), which name steps rather than elements.
 */
type Scope = "top" | "style" | "keyframes";

const KEYFRAMES_AT_RULE = /^@(-webkit-)?keyframes\b/;

/** Skips a comment, returning the index just past its end. */
function skipComment(css: string, index: number): number {
	const end = css.indexOf("*/", index + 2);
	return end === -1 ? css.length : end + 2;
}

/** Skips a quoted string, returning the index just past its closing quote. */
function skipString(css: string, index: number): number {
	const quote = css[index]!;
	for (let i = index + 1; i < css.length; i++) {
		if (css[i] === "\\") i++;
		else if (css[i] === quote) return i + 1;
	}
	return css.length;
}

/**
 * Walks the stylesheet and hands every rule prelude (the text between the last `{`, `}` or `;` and
 * a `{`) to `visitor`, together with the scope it sits in.
 *
 * Quotes are only honoured inside a declaration (`: … 'text' …`), never in a selector: Tailwind
 * escapes the quotes inside an arbitrary-variant class name (`[class*=\'size-\']`), and a selector
 * is not a string context, so reading one there as the delimiter of a string swallows the rest of
 * the stylesheet. An unclosed block at the end of the file is reported rather than returned, so a
 * desync of any other kind fails the build instead of producing a half-scoped stylesheet.
 */
function eachRulePrelude(css: string, visitor: (prelude: string, scope: Scope) => string | undefined): string {
	const out: string[] = [];
	const scopes: Scope[] = ["top"];
	let preludeStart = 0;
	let index = 0;
	const scope = () => scopes[scopes.length - 1]!;

	while (index < css.length) {
		const character = css[index]!;
		if (character === "/" && css[index + 1] === "*") {
			index = skipComment(css, index);
			continue;
		}
		if ((character === '"' || character === "'") && scope() === "style" && css.slice(preludeStart, index).includes(":")) {
			index = skipString(css, index);
			continue;
		}
		if (character === "{") {
			const prelude = css.slice(preludeStart, index);
			const replacement = visitor(prelude, scope());
			if (replacement === undefined) return "\u0000"; // the visitor rejected the stylesheet
			out.push(replacement, "{");
			const trimmed = prelude.trimStart();
			scopes.push(
				trimmed.startsWith("@")
					? (KEYFRAMES_AT_RULE.test(trimmed) ? "keyframes" : scope())
					: "style",
			);
			index++;
			preludeStart = index;
			continue;
		}
		if (character === "}" || character === ";") {
			out.push(css.slice(preludeStart, index), character);
			index++;
			preludeStart = index;
			if (character === "}" && scopes.length > 1) scopes.pop();
			continue;
		}
		index++;
	}
	if (scopes.length > 1) throw new Error("Synara surface CSS scan ended inside an unclosed block");
	out.push(css.slice(preludeStart));
	return out.join("");
}

/** Splits a selector list on top-level commas, leaving commas inside `:is()`, `[...]` and quotes. */
function splitSelectorList(list: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let quote = "";
	let start = 0;
	for (let i = 0; i < list.length; i++) {
		const character = list[i]!;
		if (quote) {
			if (character === "\\") i++;
			else if (character === quote) quote = "";
			continue;
		}
		if (character === '"' || character === "'") quote = character;
		else if (character === "(" || character === "[") depth++;
		else if (character === ")" || character === "]") depth--;
		else if (character === "," && depth === 0) {
			parts.push(list.slice(start, i));
			start = i + 1;
		}
	}
	parts.push(list.slice(start));
	return parts;
}

/**
 * Rewrites one selector so everything it matches is inside the surface.
 *
 * `:root`/`:host` are the token sheet's selectors and become the surface root itself, so the
 * tokens land on the element the ported components render under. A bare `*` is preflight's "every
 * element" and keeps the root in its match, because the root is an element of the surface too and
 * box-sizing is the declaration that has to reach it.
 */
function scopeSelector(selector: string): string {
	const trimmed = selector.trim();
	if (trimmed === "") return selector;
	if (trimmed === "*") return `${SURFACE}, ${SURFACE} *`;
	const root_ = /^:(root|host)\b/.exec(trimmed);
	if (root_) {
		const rest = trimmed.slice(root_[0].length);
		return `${SURFACE}${rest}, ${TOKENS}${rest}`;
	}
	return `${SURFACE} ${trimmed}`;
}

/**
 * Rewrites every selector in a compiled stylesheet to sit under the surface.
 *
 * Declarations never end in `{`, so the `;` and `}` branches copy them through unexamined, and an
 * at-rule prelude is always left alone.
 */
export function scopeCss(css: string): string {
	return eachRulePrelude(css, (prelude, scope) => {
		if (prelude.trimStart().startsWith("@")) return prelude;
		if (scope !== "top") return prelude;
		// Keep the prelude's own indentation and newlines: the artifact is checked in and read by
		// people, and a rule that starts mid-line after `@layer theme {` is needlessly hard to review.
		const indent = /^\s*/.exec(prelude)![0];
		const body = prelude.slice(indent.length);
		// `:root, :host` is one rule with two spellings of the same element once scoped.
		return `${indent}${[...new Set(splitSelectorList(body).map(scopeSelector))].join(",")} `;
	});
}

/**
 * Prefixes the names of every keyframe animation the compile emits.
 *
 * Tailwind names its animations for the effect (`pulse`, `spin`, `skeleton`), and one of those
 * names is already the workbench's. A keyframe that redefines an existing name overrides it for the
 * whole document, which reaches the IDE window's chrome, so the names are rewritten here along with
 * the animation values that reference them.
 */
export function prefixKeyframes(css: string): string {
	const names = new Set<string>();
	for (const match of css.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)/g)) names.add(match[1]!);
	if (names.size === 0) return css;

	const renamed = (name: string) => `${KEYFRAME_PREFIX}${name}`;
	// Longest first: `spin-stepped` must not be rewritten as `spin` plus a suffix.
	const alternation = [...names]
		.sort((a, b) => b.length - a.length)
		.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.join("|");
	const reference = new RegExp(`\\b(${alternation})\\b`, "g");

	// The references Tailwind emits live in animation values: its theme variables
	// (`--animate-<name>: <name> 2s ...`) and the `animation`/`animation-name` declarations that
	// read them.
	return css
		.replace(/@((?:-webkit-)?keyframes)\s+([\w-]+)/g, (_, atRule: string, name: string) => `@${atRule} ${renamed(name)}`)
		.replace(
			/(--animate-[\w-]+\s*:\s*[^;}]+)|(animation(?:-name)?\s*:\s*[^;}]+)/g,
			value => value.replace(reference, name => renamed(name)),
		);
}

/** Compile the entry and return the artifact's full contents. */
export function compile(): string {
	mkdirSync(join(root, "node_modules", ".cache"), { recursive: true });
	execFileSync(process.execPath, [tailwindCli, "-i", entry, "-o", scratch], { stdio: ["ignore", "ignore", "inherit"] });

	const banner = [
		"/*!-------------------------------------------------------------------------------",
		" * Generated by `bun scripts/synara-ui/build-css.ts` - do not edit by hand.",
		" *",
		" * The reference's Tailwind surface, compiled and scoped to `[data-cedia-surface]`.",
		" * Source, provenance and the MIT notice: `cediaUi/VENDORED.md`.",
		" *-----------------------------------------------------------------------------*/",
		"",
	].join("\n");

	// The compiler's own output ends with a newline; adding another would leave a blank line at the
	// end of a checked-in file, which the patch stack records as a whitespace error.
	return `${banner}${prefixKeyframes(scopeCss(readFileSync(scratch, "utf8"))).replace(/\n+$/, "")}\n`;
}

/** Fails when anything in the artifact reaches past the surface. */
export function guard(css: string): void {
	let rejected: string | undefined;
	eachRulePrelude(css, (prelude, scope) => {
		// Keyframe steps (`from`, `50%`) name progress, not elements.
		if (prelude.trimStart().startsWith("@") || scope === "keyframes") return prelude;
		for (const selector of splitSelectorList(prelude)) {
			const trimmed = selector.trim();
			// `&` is a nested rule: it is relative to a parent this scan already accepted. A nested
			// selector written without `&` would not be - it is a descendant of the parent, and this
			// scan would have to rewrite it - so it counts as a leak here.
			if (trimmed.startsWith(SURFACE) || trimmed.startsWith(TOKENS) || trimmed.startsWith("&")) continue;
			rejected ??= trimmed;
		}
		return prelude;
	});
	if (rejected) {
		throw new Error(
			`Synara surface CSS leaks outside [${SURFACE_ATTRIBUTE}]/[${TOKENS_ATTRIBUTE}]: ${rejected}`,
		);
	}

	if (/:root\b|:host\b/.test(css)) throw new Error("Synara surface CSS still binds tokens to the document root");

	const unprefixed = [...css.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)/g)]
		.map(match => match[1]!)
		.filter(name => !name.startsWith(KEYFRAME_PREFIX));
	if (unprefixed.length > 0) throw new Error(`Synara surface CSS leaves global keyframe names: ${unprefixed.join(", ")}`);
}

if (import.meta.main) {
	const css = compile();
	guard(css);
	if (process.argv.includes("--check")) {
		const current = (() => {
			try {
				return readFileSync(output, "utf8");
			} catch {
				return "";
			}
		})();
		if (current !== css) {
			console.error("cediaUi/media/cediaSynaraUi.css is stale; run `bun scripts/synara-ui/build-css.ts`");
			process.exit(1);
		}
		console.log(`cediaUi/media/cediaSynaraUi.css is up to date (${css.length} bytes)`);
	} else {
		writeFileSync(output, css);
		console.log(`Synara surface CSS written (${css.length} bytes) -> ${output.slice(root.length + 1)}`);
	}
}
