/** Real-app acceptance fixture for Caret's agent-edit marks.
 *
 * The flagship Cursor-class affordance is: OMP applies an edit through the
 * guarded editor bridge, Caret marks the region it produced *in the real
 * editor*, and the user keeps it (save) or takes it back (restore the exact
 * pre-edit text). Every link but the final one was already proven by tests;
 * this fixture closes the last gap by driving a zero-cost scripted model into
 * the packaged app's own editor and asserting the buffer, not a mock.
 *
 * It starts its own host (so it holds the same EditorConnections the app
 * registers into), its own OpenAI-compatible fixture model, and the packaged
 * Caret app against a private profile. No paid inference: the model is a
 * local scripted server.
 *
 * Usage:
 *   CARET_OMP_BINARY=<abs omp> bun scripts/ide-native-agent-mark-smoke.ts [--app <path>]
 *
 * Stages are operator/CUA-gated with marker files in the fixture dir:
 *   ready     - operator has the workspace + fixture file open in Caret
 *   reverted  - operator ran "Caret: Take Back the Caret Edit"
 */
import { createServer } from "node:http";
import { mkdir, writeFile, readFile, access, rm, realpath } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { startHostServer } from "../apps/host/src/server.ts";
import { attestOmpRuntime } from "./lib/omp-runtime-integrity.ts";
import type { Json } from "../packages/protocol/src/index.ts";

const root = resolve(import.meta.dir, "..");
const executable = process.env.CARET_OMP_BINARY ?? join(root, "dist/omp-standalone/omp");
const attestation = attestOmpRuntime(root, executable);

const appIndex = process.argv.indexOf("--app");
const app = appIndex >= 0
	? process.argv[appIndex + 1]!
	: join(root, `VSCode-darwin-${process.arch}`, "Caret.app", "Contents", "MacOS", "Caret");

const check = (condition: unknown, message: string): void => { if (!condition) throw new Error(message); };

const EDIT_PROMPT = "Edit the fixture file";
const READ_PROMPT = "Read the fixture file again";
const BEFORE_SNIPPET = "Hello, ${name}!";
const AFTER_SNIPPET = "Welcome back.";

// A fixed fixture path keeps the operator commands reproducible; a previous run
// is removed so the workspace always starts from the committed baseline. macOS
// `/tmp` is a symlink to `/private/tmp`, and OMP's workspace guard compares the
// canonical path against the session cwd, so the fixture root must be canonical
// from the start or every read/edit is refused as "outside this workspace".
const logical = "/tmp/caret-agent-mark";
await rm(logical, { recursive: true, force: true });
await mkdir(logical, { recursive: true });
const dir = await realpath(logical);
const workspace = join(dir, "workspace");
const sourceDir = join(workspace, "src");
await mkdir(sourceDir, { recursive: true });
const path = join(sourceDir, "greet.ts");
const baseline = [
	"export function greet(name: string): string {",
	"\treturn `Hello, ${name}!`;",
	"}",
	"",
].join("\n");
await writeFile(path, baseline);
execFileSync("git", ["init", "-q"], { cwd: workspace });
execFileSync("git", ["add", "."], { cwd: workspace });
execFileSync("git", ["-c", "user.email=caret@example.test", "-c", "user.name=Caret", "commit", "-qm", "baseline"], { cwd: workspace });

let requests = 0;
let modelFailure: unknown;
const model = createServer(async (req, res) => {
	try {
		check(req.method === "POST" && req.url === "/v1/chat/completions", "Unexpected model route");
		let body = "";
		for await (const chunk of req) { body += String(chunk); check(body.length < 2_000_000, "Model body limit"); }
		const input = JSON.parse(body);
		check(input.model === "mark-fixture" && input.stream, "Wrong fixture model");
		requests += 1;
		check(requests <= 8, "Unexpected model loop");
		const messages: { role?: string }[] = Array.isArray(input.messages) ? input.messages : [];
		let lastUser = -1;
		for (let i = messages.length - 1; i >= 0; i -= 1) if (messages[i]?.role === "user") { lastUser = i; break; }
		const turn = messages.slice(lastUser + 1);
		const toolResults = turn.filter(message => message.role === "tool");
		const promptJson = JSON.stringify(messages[lastUser] ?? {});
		const step = toolResults.length;
		const read = { name: "read", arguments: JSON.stringify({ path }) };
		const edit = { name: "edit", arguments: JSON.stringify({ path, old_string: BEFORE_SNIPPET, new_string: `${BEFORE_SNIPPET} ${AFTER_SNIPPET}` }) };
		let tool: typeof read | undefined;
		let finish = false;
		if (promptJson.includes(EDIT_PROMPT)) {
			if (step === 0) tool = read;
			else if (step === 1) tool = edit;
			else if (step === 2) tool = read;
			else {
				check(JSON.stringify(toolResults[2]).includes(AFTER_SNIPPET), "The guarded edit was not visible in the editor buffer");
				finish = true;
			}
		} else if (promptJson.includes(READ_PROMPT)) {
			if (step === 0) tool = read;
			else {
				const text = JSON.stringify(toolResults[0]);
				check(text.includes(BEFORE_SNIPPET), "Take-back did not restore the pre-edit text in the buffer");
				check(!text.includes(AFTER_SNIPPET), "Take-back left the applied edit in the buffer");
				finish = true;
			}
		} else {
			finish = true;
		}
		const delta = finish ? { role: "assistant", content: "Fixture complete." }
			: { role: "assistant", tool_calls: [{ index: 0, id: `mark-${requests}`, type: "function", function: tool }] };
		const frame = (value: unknown, reason: string | null) => ({ id: `mark-${requests}`, object: "chat.completion.chunk", created: 0, model: "mark-fixture", choices: [{ index: 0, delta: value, finish_reason: reason }] });
		res.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
		res.end([frame(delta, null), frame({}, finish ? "stop" : "tool_calls"), "[DONE]"].map(value => `data: ${typeof value === "string" ? value : JSON.stringify(value)}\n\n`).join(""));
	} catch (error) { modelFailure = error; res.writeHead(500); res.end("Fixture rejected request"); }
});
await new Promise<void>(resolve => model.listen(0, "127.0.0.1", resolve));
const address = model.address();
if (!address || typeof address === "string") throw new Error("No fixture port");
await writeFile(join(dir, "models.yml"), `providers:\n  caret-fixture:\n    baseUrl: http://127.0.0.1:${address.port}/v1\n    auth: none\n    api: openai-completions\n    models:\n      - id: mark-fixture\n        name: Caret local mark fixture\n        reasoning: false\n        input: [text]\n        cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0}\n        contextWindow: 128000\n        maxTokens: 4096\n`);

const stateDir = join(dir, "host");
const server = await startHostServer({
	stateDir,
	ompExecutable: executable,
	editorBridge: true,
	ompEnv: { PATH: "/usr/bin:/bin", HOME: dir, PI_CODING_AGENT_DIR: dir, PI_EDIT_VARIANT: "replace", PI_NOTIFICATIONS: "off", TERM: "xterm-256color" },
	ompArgs: ["--no-skills", "--no-rules", "--no-extensions"],
});
const host = server.host;

const profile = join(dir, "profile");
await mkdir(join(profile, "User"), { recursive: true });
await writeFile(join(profile, "User", "settings.json"), JSON.stringify({
	"caret.hostStateDir": stateDir,
	"security.workspace.trust.enabled": false,
	"window.startupEditor": "none",
	"update.mode": "none",
	"telemetry.telemetryLevel": "off",
	"extensions.autoCheckUpdates": false,
}, null, 2));

const launch = (args: string[]): void => {
	const child = spawn(app, [`--user-data-dir=${profile}`, "--password-store=basic", "--use-inmemory-secretstorage", ...args], { detached: true, stdio: "ignore" });
	child.unref();
};

const waitFor = async (what: string, predicate: () => boolean | Promise<boolean>, ms: number): Promise<void> => {
	const deadline = performance.now() + ms;
	while (performance.now() < deadline) {
		if (await predicate()) return;
		await new Promise(resolve => setTimeout(resolve, 250));
	}
	throw new Error(`Timed out waiting for ${what}; fixture retained at ${dir}`);
};
const waitMarker = (name: string, ms = 10 * 60_000) => waitFor(`the ${name} marker`, async () => {
	try { await access(join(dir, name)); return true; } catch { return false; }
}, ms);

/** The operator decides Keep or Take Back; both paths are graded. */
const waitForDecision = async (): Promise<"kept" | "reverted"> => {
	await waitFor("the keep/take-back marker", async () => {
		for (const name of ["kept", "reverted"]) {
			try { await access(join(dir, name)); return true; } catch { /* try the other */ }
		}
		return false;
	}, 10 * 60_000);
	try { await access(join(dir, "kept")); return "kept"; } catch { return "reverted"; }
};

let serial = 0;
let approvals = 0;
try {
	const project = host.store.createProject({ path: workspace });
	const session = await host.startSession(host.createSession(project.id).id);
	const command = (name: string, payload: Record<string, Json>) =>
		host.command(session.id, "fixture-owner", { commandId: `mark-${++serial}`, incarnation: session.incarnation, command: name, payload });
	for (const [name, payload] of [
		["set_model", { provider: "caret-fixture", modelId: "mark-fixture" }],
		["set_auto_retry", { enabled: false }],
		["set_auto_compaction", { enabled: false }],
	] as const) check((await command(name, payload)).status === "completed", `Setup ${name} failed`);

	const run = async (message: string): Promise<void> => {
		const prompt = await command("prompt", { message });
		const deadline = performance.now() + 90_000;
		while (performance.now() < deadline && host.store.getCommand(session.id, prompt.commandId)?.status !== "completed") {
			if (modelFailure) throw modelFailure;
			for (const pending of host.pendingUi(session.id) as { token: string; request: { method: string } }[]) {
				check(pending.request.method === "confirm", "Unexpected fixture approval");
				approvals += 1;
				await host.respond(session.id, "fixture-owner", { commandId: `approve-${approvals}`, incarnation: session.incarnation, token: pending.token, answer: true });
			}
			await new Promise(resolve => setTimeout(resolve, 20));
		}
		check(!modelFailure, String(modelFailure));
		check(host.store.getCommand(session.id, prompt.commandId)?.status === "completed", "The agent turn did not complete");
		check(await readFile(path, "utf8") === baseline, "Caret wrote behind the editor: the file on disk changed");
	};

	launch([workspace]);
	console.log(JSON.stringify({ stage: "prepare", fixture: dir, workspace, stateDir, profile, app, path,
		instructions: "Wait for Caret to open the fixture workspace, then open src/greet.ts so a mark can be painted. Create the 'ready' marker." }));
	await waitFor("the Caret editor connection", () => server.editors.hasConnection(workspace), 120_000);
	launch(["--goto", `${path}:1`]);
	await waitMarker("ready");

	await run(EDIT_PROMPT);
	check(approvals === 1, `Expected exactly one guarded apply approval, saw ${approvals}`);
	console.log(JSON.stringify({ stage: "verify-mark", fixture: dir,
		instructions: "The editor now holds the Caret-applied edit (unsaved). Optionally run 'Caret: Review the Caret Edit'. Then EITHER run 'Caret: Keep the Caret Edit' and create the 'kept' marker, OR run 'Caret: Take Back the Caret Edit' and create the 'reverted' marker." }));
	const decision = await waitForDecision();
	const checks = [
		"agent-edit-applied-through-the-packaged-apps-editor-bridge",
		"edit-visible-in-the-editor-buffer-not-on-disk",
		"single-guarded-apply-approval",
		"disk-untouched-by-apply",
	];
	if (decision === "kept") {
		// "Kept" means saved: this is the only path where the edit reaches disk.
		await waitFor("the kept edit to reach disk", async () => (await readFile(path, "utf8")).includes(AFTER_SNIPPET), 20_000);
		checks.push("keep-saves-the-edit-to-disk");
	} else {
		await run(READ_PROMPT);
		check(await readFile(path, "utf8") === baseline, "Take-back saved the file, but take-back must never save");
		checks.push("take-back-restores-exact-pre-edit-buffer", "take-back-never-saves");
	}

	const receipt = {
		capturedAt: new Date().toISOString(),
		realPackagedAppEditor: true,
		scriptedModelOnly: true,
		paidModelCalls: 0,
		modelRequests: requests,
		approvals,
		decision,
		app,
		workspace,
		...attestation,
		checks: [
			...checks,
		],
	};
	const evidence = join(root, "docs/maintenance/evidence/ide-native-agent-mark-2026-09-14");
	await mkdir(evidence, { recursive: true });
	const receiptPath = join(evidence, "receipt.json");
	// The machine-checked fields are rewritten on every run; the hand-written
	// observation blocks are preserved so re-running cannot silently drop the
	// accessibility evidence that a screenshot cannot carry.
	const preserved: Record<string, unknown> = {};
	try {
		const previous = JSON.parse(await readFile(receiptPath, "utf8")) as Record<string, unknown>;
		for (const key of ["runtimeObservation", "keepRuntimeObservation", "reviewDiff", "codeLens", "codeLensStaleness", "markRegion", "markPixels", "staleTakeBackRefusal", "keybindings", "decisions", "notVerified"]) {
			if (previous[key] !== undefined) preserved[key] = previous[key];
		}
	} catch { /* first run writes the machine fields only */ }
	await writeFile(receiptPath, `${JSON.stringify({ ...receipt, ...preserved }, null, 2)}\n`);
	console.log(JSON.stringify(receipt));
} finally {
	await server.close();
	await new Promise<void>(resolve => model.close(() => resolve()));
}
