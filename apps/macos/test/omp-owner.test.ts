import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * "OMP is the single execution/transcript owner" is an ownership constraint,
 * not a behaviour: the Mac extension is allowed to start the Caret host helper
 * and nothing else. If the client could launch OMP itself there would be two
 * transcript owners, so this pins the boundary at the source that would have to
 * change for it to break.
 */

const here = dirname(fileURLToPath(import.meta.url));
const extensionSource = readFileSync(join(here, "../src/extension.ts"), "utf8");
const hostServiceSource = readFileSync(join(here, "../../host/src/service.ts"), "utf8");

describe("single execution owner", () => {
	it("starts only the host helper from the Mac extension", () => {
		expect(extensionSource).toContain('spawn(nodePath, [scriptPath, "ensure"]');
		expect(extensionSource).toContain('join(this.#extensionPath, "runtime/host/cli.js")');
		// The bundled Node is the helper's runtime, never an agent runtime.
		expect(extensionSource).toContain('join(this.#extensionPath, "runtime/node/bin/node")');
	});

	it("has no OMP launcher in the client", () => {
		expect(extensionSource).not.toMatch(/omp-standalone/);
		expect(extensionSource).not.toMatch(/CARET_OMP_BINARY|CARET_OMP_PATH/);
		expect(extensionSource).not.toMatch(/spawn\([^)]*omp/i);
		// The leading `\b` keeps the guard on the executable name: it still catches
		// `execFile("omp", …)` and `execFileAsync(ompPath, …)`, while the looser
		// `exec[A-Za-z]*\([^)]*omp` also flagged
		// `executeCommand("caretComposerDock.focus")` — a workbench command, not a
		// process — for the "omp" inside "Composer".
		expect(extensionSource).not.toMatch(/exec[A-Za-z]*\([^)]*\bomp/i);
	});

	it("launches the agent runtime from the host package instead", () => {
		// The host resolves the agent executable and starts it through the OMP
		// adapter, so it owns the process and therefore the transcript.
		expect(hostServiceSource).toContain("this.#options.ompExecutable");
		expect(hostServiceSource).toContain("OmpRpcClient.start(");
	});
});
