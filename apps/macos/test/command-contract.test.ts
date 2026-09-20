import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Every stock Code-OSS command id the extension executes must exist in the
 * pinned checkout.
 *
 * `ide-native-command-ids.test.ts` covers the ids Cedia owns. The stock ids -
 * `workbench.*`, `vscode.*`, `git.*` - were only ever checked by hand, and a
 * wrong one fails silently: the rejection lands in a catch and the feature
 * simply does nothing. `cediaDock.focus` shipped dead that way for a while, so
 * the check belongs in a test rather than in a reviewer's memory.
 *
 * Ids the engine *generates* are verified structurally instead: a view focus
 * command is `<declared view id>.focus`, and a container reveal is
 * `workbench.view.extension.<declared container id>` - which is exactly the
 * string `api/browser/viewsExtensionPoint.ts` builds from the contributed id.
 */

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "..", "src");
const root = join(here, "..", "..", "..");
const coreDir = join(root, "desktop", "src", "vs");
const gitDir = join(root, "desktop", "extensions", "git", "src");

const manifest = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as {
	readonly contributes: {
		readonly viewsContainers: Record<string, readonly { readonly id: string }[]>;
		readonly views: Record<string, readonly { readonly id: string }[]>;
	};
};

const sources = readdirSync(srcDir)
	.filter(entry => entry.endsWith(".ts"))
	.map(entry => readFileSync(join(srcDir, entry), "utf8"));
const workbenchSource = readFileSync(join(srcDir, "workbench-mode.ts"), "utf8");

/** `executeCommand("<id>")` calls, in any extension source. */
function literalExecutions(source: string): string[] {
	return [...source.matchAll(/executeCommand\("([^"]+)"/g)].map(match => match[1]!);
}

/** Command ids inside a `for (const command of [...])` list. */
function commandLists(source: string): string[] {
	return [...source.matchAll(/for \(const command of \[([^\]]*)\]\)/g)]
		.flatMap(match => [...match[1]!.matchAll(/"([^"]+)"/g)].map(item => item[1]!));
}

/** Every quoted string inside one exported function body. The chrome command
 * lists are built there, so their ids never appear in a literal call. */
function idsInFunction(source: string, name: string): string[] {
	const start = source.indexOf(`export function ${name}(`);
	if (start < 0) throw new Error(`command-contract: ${name} is gone from workbench-mode.ts`);
	const end = source.indexOf("\n}", start);
	if (end < 0) throw new Error(`command-contract: ${name} is not terminated`);
	return [...source.slice(start, end).matchAll(/"([A-Za-z0-9_.]+)"/g)].map(match => match[1]!);
}

const executed = [...new Set([
	...sources.flatMap(literalExecutions),
	...sources.flatMap(commandLists),
	...idsInFunction(workbenchSource, "agentsChromeCommands"),
	...idsInFunction(workbenchSource, "ideChromeCommands"),
])];

const declaredViewIds = new Set(Object.values(manifest.contributes.views).flat().map(view => view.id));
const declaredContainerIds = new Set(Object.values(manifest.contributes.viewsContainers).flat().map(container => container.id));

const viewFocusIds = executed.filter(id => id.endsWith(".focus"));
const containerRevealIds = executed.filter(id => id.startsWith("workbench.view.extension."));
const generatedIds = new Set([...viewFocusIds, ...containerRevealIds]);
const gitIds = executed.filter(id => id.startsWith("git.") && !generatedIds.has(id));
const coreIds = executed.filter(id => !generatedIds.has(id) && !gitIds.includes(id));

function* walk(directory: string): Generator<string> {
	for (const entry of readdirSync(directory)) {
		const full = join(directory, entry);
		if (statSync(full).isDirectory()) yield* walk(full);
		else if (entry.endsWith(".ts")) yield full;
	}
}

/** The ids that appear as a quoted literal somewhere under `directory`. */
function foundIn(directory: string, ids: readonly string[]): Set<string> {
	if (!existsSync(directory)) throw new Error(`command-contract: ${directory} is missing; the pinned desktop checkout is required`);
	const found = new Set<string>();
	if (!ids.length) return found;
	const needles = ids.map(id => `'${id}'`);
	let usedFallback = false;
	try {
		const output = execFileSync("rg", [
			"-o", "-N", "--no-filename", "--no-messages", "-F",
			...needles.flatMap(needle => ["-e", needle]),
			directory,
		], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
		for (const match of output.matchAll(/'([^']+)'/g)) found.add(match[1]!);
		return found;
	} catch (error) {
		// A missing rg is the only reason to walk the tree by hand; a plain
		// "no match" exit must stay an empty result so a real miss fails below.
		if ((error as { code?: string }).code !== "ENOENT") return found;
		usedFallback = true;
	}
	if (!usedFallback) return found;
	for (const file of walk(directory)) {
		const text = readFileSync(file, "utf8");
		needles.forEach((needle, index) => { if (text.includes(needle)) found.add(ids[index]!); });
	}
	return found;
}

describe("stock command contract", () => {
	it("collects a real set of ids, so the scanner cannot pass on nothing", () => {
		expect(executed.length).toBeGreaterThan(12);
		expect(gitIds.length).toBeGreaterThan(0);
		expect(coreIds.length).toBeGreaterThan(8);
	});

	it("only uses generated ids for views and containers the manifest declares", () => {
		for (const id of viewFocusIds) {
			const view = id.slice(0, -".focus".length);
			expect(`${id}: ${declaredViewIds.has(view)}`).toBe(`${id}: true`);
		}
		for (const id of containerRevealIds) {
			const container = id.slice("workbench.view.extension.".length);
			expect(`${id}: ${declaredContainerIds.has(container)}`).toBe(`${id}: true`);
		}
	});

	it("exists in the pinned checkout, so no executed id is dead", () => {
		const found = new Set([...foundIn(coreDir, coreIds), ...foundIn(gitDir, gitIds)]);
		expect([...coreIds, ...gitIds].filter(id => !found.has(id))).toEqual([]);
	});
});
