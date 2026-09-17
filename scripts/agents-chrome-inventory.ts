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
 *   bun scripts/agents-chrome-inventory.ts capture <debugPort> [--write <file>] [--empty-draft]
 *       Read the running Caret window over CDP, print its inventory, diff it.
 *       `--empty-draft` clicks the window's own new-chat control first, so the
 *       capture is taken in the state the reference capture was taken in.
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

/**
 * Chrome controls the Agents window draws, read from the live workbench DOM.
 *
 * Only what a user can actually see and press: the reference side is an
 * accessibility tree of the *rendered* window, so an element with no client
 * rect (a hidden panel action, a collapsed find widget) or `aria-hidden` must
 * not enter this side, or the comparison reports a difference between a visible
 * control and an invisible one.
 */
const DOM_QUERY = [
	"(() => {",
	"  const out = [];",
	"  const selector = '[role=button], button, [role=tab], [role=combobox], [role=textbox], input, [role=separator]';",
	"  for (const element of document.querySelectorAll(selector)) {",
	"    if (!element.getClientRects().length) continue;",
	"    if (element.getAttribute('aria-hidden') === 'true') continue;",
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

async function pageSocketUrl(port: number): Promise<string> {
	const response = await fetch(`http://127.0.0.1:${port}/json/list`);
	const targets = await response.json() as { type: string; url: string; webSocketDebuggerUrl?: string }[];
	// The Agents window is the sessions workbench (`.../sessions.html`), a plain
	// window is the normal workbench (`.../workbench.html`); both are pages here.
	const wanted = targets.filter(target => target.type === "page" && /workbench|sessions/.test(target.url));
	const page = wanted[0] ?? targets.find(target => target.type === "page");
	if (!page?.webSocketDebuggerUrl) throw new Error(`No workbench page on port ${port}`);
	return page.webSocketDebuggerUrl;
}

async function captureFromPort(port: number): Promise<string> {
	return await evaluate(await pageSocketUrl(port), DOM_QUERY);
}

async function evaluateOnPage(port: number, expression: string): Promise<string> {
	return await evaluate(await pageSocketUrl(port), expression);
}

/** Evaluate one expression in the page and return its string result. */
async function evaluate(webSocketDebuggerUrl: string, expression: string): Promise<string> {
	const socket = new WebSocket(webSocketDebuggerUrl);
	return await new Promise<string>((resolveReply, reject) => {
		const timer = setTimeout(() => reject(new Error("CDP evaluate timed out")), 15_000);
		socket.addEventListener("open", () => socket.send(JSON.stringify({
			id: 1,
			method: "Runtime.evaluate",
			params: { expression, returnByValue: true, awaitPromise: true },
		})));
		socket.addEventListener("message", event => {
			const message = JSON.parse(String(event.data)) as { id?: number; result?: { result?: { value?: string } } };
			if (message.id !== 1) return;
			clearTimeout(timer);
			socket.close();
			resolveReply(message.result?.result?.value ?? "");
		});
		socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP socket error")); });
	});
}

/**
 * Click the window's own new-chat control, so a capture can be taken in the
 * state the reference capture was taken in (an empty draft). Matched on the
 * visible text a user reads, never on an internal id.
 */
const NEW_CHAT_CLICK = [
	"(() => {",
	"  const wanted = /^new (chat|session)$/i;",
	"  for (const element of document.querySelectorAll('[role=button], button, a')) {",
	"    if (!element.getClientRects().length) continue;",
	"    const text = (element.getAttribute('aria-label') || element.textContent || '').trim();",
	"    if (wanted.test(text)) { element.click(); return 'clicked:' + text; }",
	"  }",
	"  return 'not-found';",
	"})()",
].join("\n");

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
	if (process.argv.includes("--empty-draft")) {
		const outcome = await evaluateOnPage(port, NEW_CHAT_CLICK);
		process.stdout.write(`new-chat click: ${outcome}\n`);
		await Bun.sleep(1_500);
	}
	const dump = await captureFromPort(port);
	const caret = chromeControlsFromTree(dump);
	const writeAt = process.argv.indexOf("--write");
	// The file gets the normalised inventory, not the raw DOM text, so
	// `compare <file>` on it reproduces exactly what this run reported.
	if (writeAt > 0) await Bun.write(process.argv[writeAt + 1]!, `${formatInventory(caret)}\n`);
	process.exitCode = report(reference, caret);
} else {
	process.stderr.write("usage: bun scripts/agents-chrome-inventory.ts reference | compare <file> | capture <debugPort> [--write <file>]\n");
	process.exitCode = 2;
}
