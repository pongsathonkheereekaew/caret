/** Terminal conformance report for the engines Cedia might ship.
 *
 * Why this exists: the terminal is xterm.js from the pinned Code-OSS base and nothing
 * in this repository has ever asserted what it does with the sequences Cedia's own
 * surfaces depend on. The corpus in `apps/macos/src/terminal-conformance.ts` states
 * those behaviours as "bytes in, screen out", so today's engine can be held still and
 * a candidate engine (the Ghostty VT core evaluated in
 * `docs/maintenance/evidence/terminal-vt-spike-2026-09-16/`) can be judged by the same
 * cases before anything is replaced.
 *
 * The xterm engine comes from the repository's dev dependency; the Ghostty engine is
 * optional - install `@coder/libghostty-vt-node` in a scratch directory to compare
 * (this repository does not depend on it).
 *
 * usage: bun scripts/terminal-conformance.ts [--engine=xterm|ghostty|both]
 */

import { TERMINAL_CONFORMANCE_CASES, runTerminalConformance, type TerminalConformanceResult } from "../apps/macos/src/terminal-conformance.ts";
import { createGhosttyEngine, createXtermEngine } from "./lib/terminal-engines.ts";

const requested = process.argv.find(argument => argument.startsWith("--engine="))?.slice("--engine=".length) ?? "both";

async function run(name: string, engine: Awaited<ReturnType<typeof createXtermEngine>>): Promise<{ failed: number; results: readonly TerminalConformanceResult[] }> {
	const results = await runTerminalConformance(engine);
	const failed = results.filter(result => result.required && !result.pass).length;
	console.log(`\n${name}`);
	for (const result of results) {
		const mark = result.pass ? "OK  " : result.required ? "FAIL" : "DIFF";
		console.log(`  ${mark} ${result.id}${result.pass ? "" : ` - ${result.detail}`}`);
	}
	console.log(`  ${results.filter(result => result.pass).length}/${results.length} cases match, ${failed} required failure(s)`);
	return { failed, results };
}

let failures = 0;
let ran = 0;

if (requested === "xterm" || requested === "both") {
	const xterm = await createXtermEngine();
	ran += 1;
	failures += (await run(`${xterm.name} (the engine the workbench ships)`, xterm)).failed;
}

if (requested === "ghostty" || requested === "both") {
	const ghostty = await createGhosttyEngine();
	if (ghostty) {
		ran += 1;
		const { failed } = await run(`${ghostty.name} (candidate)`, ghostty);
		// The candidate is judged by the same required cases, but a failure here is a
		// finding about the candidate, not about the engine the repository ships.
		console.log(`  candidate required failures: ${failed}`);
	} else if (requested === "ghostty") {
		failures += 1;
		console.log("\nlibghostty-vt: not installed (@coder/libghostty-vt-node is not a repository dependency)");
	} else {
		console.log("\nlibghostty-vt: not installed, skipped (xterm cases above are the repository's own gate)");
	}
}

console.log(`\nterminal-conformance: ${ran} engine(s), ${TERMINAL_CONFORMANCE_CASES.length} cases, ${failures} required failure(s)`);
process.exit(failures === 0 ? 0 : 1);
