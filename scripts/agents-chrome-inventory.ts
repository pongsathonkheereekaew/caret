#!/usr/bin/env bun
/** AX/DOM comparison for the Agents window, step 1 of the acceptance check.
 *
 *   bun scripts/agents-chrome-inventory.ts reference
 *       Print the reference's control inventory, parsed from the captured
 *       Cursor accessibility tree.
 *
 *   bun scripts/agents-chrome-inventory.ts compare <file>
 *       Diff a captured Caret tree against the reference. Non-zero exit while
 *       any control the reference has is missing from Caret.
 *
 *   bun scripts/agents-chrome-inventory.ts capture <debugPort> [--write <file>]
 *       Read the running Caret window over CDP, print its inventory, diff it.
 *
 * The reference capture is the same kind of tree the Caret side can be captured
 * as (Computer Use, `@oai/sky` get_app_state), which keeps both sides in one
 * vocabulary. The CDP mode exists because it needs no human at the keyboard and
 * can therefore run on every build.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	chromeControlsFromTree,
	diffChrome,
	formatInventory,
	type ChromeControl,
} from "./lib/agents-chrome-inventory.ts";

const root = resolve(import.meta.dir, "..");
const REFERENCE = join(root, "docs/maintenance/evidence/cursor-agents-ax-2026-09-14/cursor-agents-ax-tree.txt");

/** Chrome controls the Agents window draws, read from the live workbench DOM. */
const DOM_QUERY = [
	"(() => {",
	"  const out = [];",
	"  const selector = '[role=button], button, [role=tab], [role=combobox], [role=textbox], input, [role=separator]';",
	"  for (const element of document.querySelectorAll(selector)) {",
	"    const explicit = element.getAttribute('role');",
	"    const tag = element.tagName.toLowerCase();",
	"    const kind = explicit === 'combobox' ? 'combo box'",
	"      : explicit === 'textbox' || tag === 'input' ? 'text entry area'",
	"      : explicit === 'separator' ? 'splitter'",
	"      : element.getAttribute('aria-haspopup') ? 'pop up button'",
	"      : 'button';",
	"    const label = element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('placeholder') || element.textContent || '';",
	"    const trimmed = label.trim().replace(/\\s+/g, ' ');",
	"    if (trimmed) out.push(kind + '\\t' + trimmed);",
	"  }",
	"  return out.join('\\n');",
	"})()",
].join("\n");

async function captureFromPort(port: number): Promise<string> {
	const response = await fetch(`http://127.0.0.1:${port}/json/list`);
	const targets = await response.json() as { type: string; url: string; webSocketDebuggerUrl?: string }[];
	const page = targets.find(target => target.type === "page" && target.url.includes("workbench")) ?? targets.find(target => target.type === "page");
	if (!page?.webSocketDebuggerUrl) throw new Error(`No workbench page on port ${port}`);
	const socket = new WebSocket(page.webSocketDebuggerUrl);
	return await new Promise<string>((resolveReply, reject) => {
		const timer = setTimeout(() => reject(new Error("CDP evaluate timed out")), 15_000);
		socket.addEventListener("open", () => socket.send(JSON.stringify({
			id: 1,
			method: "Runtime.evaluate",
			params: { expression: DOM_QUERY, returnByValue: true, awaitPromise: true },
		})));
		socket.addEventListener("message", event => {
			const message = JSON.parse(String(event.data)) as { id?: number; result?: { result?: { value?: string } } };
			if (message.id !== 1) return;
			clearTimeout(timer);
			socket.close();
			resolveReply(message.result?.result?.value ?? "");
		});
		socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error(`CDP socket error on port ${port}`)); });
	});
}

function report(reference: readonly ChromeControl[], caret: readonly ChromeControl[]): number {
	const diff = diffChrome(reference, caret);
	const write = (title: string, controls: readonly ChromeControl[]) => {
		process.stdout.write(`\n${title} (${controls.length})\n`);
		for (const line of formatInventory(controls).split("\n")) if (line) process.stdout.write(`  ${line}\n`);
	};
	process.stdout.write(`reference controls: ${reference.length}, caret controls: ${caret.length}\n`);
	process.stdout.write(`shared: ${diff.shared.length}\n`);
	write("missing from Caret (parity failures)", diff.missing);
	write("Caret-only (informational, section 4)", diff.extra);
	return diff.missing.length === 0 ? 0 : 1;
}

const [command, argument] = process.argv.slice(2);
const reference = chromeControlsFromTree(readFileSync(REFERENCE, "utf8"));

if (command === "reference") {
	process.stdout.write(`${formatInventory(reference)}\n`);
} else if (command === "compare") {
	if (!argument) throw new Error("compare needs a captured tree file");
	process.exitCode = report(reference, chromeControlsFromTree(readFileSync(argument, "utf8")));
} else if (command === "capture") {
	const port = Number(argument);
	if (!Number.isInteger(port)) throw new Error("capture needs the debug port the window was launched with");
	const dump = await captureFromPort(port);
	const writeAt = process.argv.indexOf("--write");
	if (writeAt > 0) await Bun.write(process.argv[writeAt + 1]!, dump);
	process.exitCode = report(reference, chromeControlsFromTree(dump));
} else {
	process.stderr.write("usage: bun scripts/agents-chrome-inventory.ts reference | compare <file> | capture <debugPort> [--write <file>]\n");
	process.exitCode = 2;
}
