import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { CARET_LIGHT_WORKBENCH_COLORS, CARET_WORKBENCH_COLORS } from "../src/caret-theme.ts";
import { CARET_OMP_MODEL_VENDOR } from "../src/chat-sessions-map.ts";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fireActiveColorThemeChange, installVscodeStub, resetVscodeStub, stubState, stubUri } from "./helpers/vscode-stub.ts";

/*
 * Behavioral coverage for the ide-native workbench surface.
 *
 * The other Mac tests assert that strings exist in `extension.ts`. This file
 * activates the real extension against a recorded `vscode` API and drives the
 * commands a Cursor-class IDE user reaches for, so "declared in the manifest"
 * cannot pass for "works". The host is deliberately unreachable:
 * `hostNodePath`/`hostScriptPath` are empty and the extension path carries no
 * `runtime/`, so `ConfiguredHostProcess.start()` throws before spawning and no
 * real host, OMP process, or user state directory is touched.
 */

const vscodeApi: any = installVscodeStub();

const tempRoot = mkdtempSync(join(tmpdir(), "caret-ide-native-"));
const workspace = join(tempRoot, "workspace");
mkdirSync(join(workspace, "src"), { recursive: true });
const sourceFile = join(workspace, "src", "greet.ts");
const sourceText = 'export function hello(name: string) {\n  return "hi " + name;\n}\n';
const diskText = sourceText.replace('"hi "', '"hello "');
// A tracked binary file, committed clean first so the later edits below are
// unstaged changes on both files.
const binaryFile = join(workspace, "assets", "logo.png");
mkdirSync(join(workspace, "assets"), { recursive: true });
writeFileSync(binaryFile, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x03]));
writeFileSync(sourceFile, sourceText);
execFileSync("git", ["init", "-q"], { cwd: workspace });
execFileSync("git", ["config", "user.email", "t@t.t"], { cwd: workspace });
execFileSync("git", ["config", "user.name", "t"], { cwd: workspace });
execFileSync("git", ["add", "-A"], { cwd: workspace });
execFileSync("git", ["commit", "-qm", "init"], { cwd: workspace });
// Leave unstaged changes so the review path has something real to open: a text
// hunk in greet.ts and a byte change in the binary file.
writeFileSync(sourceFile, diskText);
writeFileSync(binaryFile, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x04, 0x05, 0x06]));
const headText = execFileSync("git", ["-C", workspace, "show", "HEAD:src/greet.ts"], { encoding: "utf8" });

// A text file that is new and untracked: the diff must read as all-added from
// an empty original rather than Caret inventing an original.
const untrackedFile = join(workspace, "src", "new-file.ts");
writeFileSync(untrackedFile, "export const fresh = true;\n");

stubState.workspaceRoot = workspace;
stubState.documents.set(sourceFile, { text: diskText, languageId: "typescript" });
stubState.config.set("caret.hostStateDir", join(tempRoot, "hostState"));
stubState.config.set("caret.hostNodePath", "");
stubState.config.set("caret.hostScriptPath", "");

const extension: any = await import("../src/extension.ts");

function context(): any {
	return {
		extensionPath: join(tempRoot, "extension"),
		extensionUri: stubUri(`file://${join(tempRoot, "extension")}`),
		globalStorageUri: stubUri(`file://${join(tempRoot, "globalStorage", "caret.caret")}`),
		storageUri: stubUri(`file://${join(tempRoot, "workspaceStorage")}`),
		subscriptions: [],
		globalState: { get: (_key: string, fallback: unknown) => fallback, update: async () => {}, keys: () => [] },
		workspaceState: { get: (_key: string, fallback: unknown) => fallback, update: async () => {}, keys: () => [] },
		extension: { id: "caret.caret", packageJSON: { name: "caret", publisher: "caret", version: "0.1.0" } },
	};
}

/** Workbench appearance keys the extension writes. `resetVscodeStub` keeps the
 * config map (files set it once before the first activation), so a test would
 * otherwise start from whatever the previous test's mode switch left behind -
 * and the IDE snapshot is captured *from* these keys, so stale values leak into
 * the restored layout. Clearing them models a fresh window. */
const APPEARANCE_KEYS = [
	"workbench.activityBar.location",
	"workbench.statusBar.visible",
	"workbench.editor.showTabs",
	"workbench.editor.editorActionsLocation",
	"workbench.layoutControl.enabled",
	"workbench.colorCustomizations",
	"window.commandCenter",
	"window.title",
	"window.autoDetectColorScheme",
	"breadcrumbs.enabled",
];

async function activateAndSettle(themeKind = 2, rejectWorkspaceWrites = false, workspaceFileUri: any = undefined, installedExtensions: any[] = []): Promise<void> {
	resetVscodeStub();
	// After the reset, which clears the installed list along with the recordings.
	stubState.installedExtensions.push(...installedExtensions);
	stubState.workspaceFileUri = workspaceFileUri;
	// resetVscodeStub returns the theme to dark; callers that need light set it
	// here so the activation reads the intended kind.
	stubState.themeKind = themeKind;
	// The default Agents window can open with no folder attached, where
	// workspace-scope writes reject.
	stubState.rejectWorkspaceWrites = rejectWorkspaceWrites;
	for (const key of APPEARANCE_KEYS) stubState.config.delete(key);
	extension.activate(context());
	await new Promise(resolve => setTimeout(resolve, 60));
}

function resolveViews(): void {
	for (const entry of stubState.views) {
		entry.provider.resolveWebviewView({
			webview: {
				html: "",
				options: {},
				cspSource: "",
				asWebviewUri: (uri: unknown) => uri,
				postMessage: async (message: unknown) => {
					stubState.posted.push(message);
					return true;
				},
				onDidReceiveMessage: () => ({ dispose() {} }),
			},
			onDidDispose: () => ({ dispose() {} }),
			onDidChangeVisibility: () => ({ dispose() {} }),
			show() {},
		});
	}
}

/** The editor holds the current buffer, which may be unsaved: this is the text
 * an IDE-native citation must quote, not the file on disk. */
function openEditor(startLine: number, endLine: number): void {
	const lines = sourceText.split("\n");
	stubState.activeEditor = {
		document: {
			uri: stubUri(`file://${sourceFile}`),
			fileName: sourceFile,
			languageId: "typescript",
			getText: (range?: any) => (range ? lines.slice(range.start.line, range.end.line + 1).join("\n") : sourceText),
		},
		selection: {
			isEmpty: false,
			start: { line: startLine, character: 0 },
			end: { line: endLine, character: lines[endLine]!.length },
		},
	};
}

/** An editor holding a buffer that Caret just edited through the bridge: the
 * shape `recordAgentEdit` and the decoration helpers read off a real editor. */
function agentEditedEditor(version: number, text: string, onSave: () => void): any {
	const lines = text.split("\n");
	return {
		document: {
			uri: stubUri(`file://${sourceFile}`),
			fileName: sourceFile,
			languageId: "typescript",
			version,
			isDirty: true,
			lineCount: lines.length,
			lineAt: (line: number) => ({ range: { end: { line, character: (lines[line] ?? "").length } } }),
			getText: () => text,
			positionAt: (offset: number) => ({ line: 0, character: offset }),
			save: async () => { onSave(); return true; },
		},
		selection: { isEmpty: true, start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
		setDecorations: (type: unknown, ranges: unknown[]) => { stubState.decorations.push({ type, ranges }); },
	};
}

/** The provider is registered with the stub as a webview view provider, so the
 * editor-bridge entry point can be driven the way the bridge drives it. */
function provider(): any {
	return stubState.views.at(-1)!.provider;
}

const appliedEditSummary = {
	path: sourceFile,
	uri: `file://${sourceFile}`,
	requestId: "caret-edit-1",
	version: 2,
	textBefore: sourceText,
	edits: [{ range: { start: { line: 1, character: 9 }, end: { line: 1, character: 15 } }, text: "hello" }],
};

function lastSnapshotDraft(): string {
	for (const message of [...stubState.posted].reverse()) {
		const value = message as { type?: string; state?: { draft?: string } };
		if (value?.type === "snapshot" && typeof value.state?.draft === "string") return value.state.draft;
	}
	return "";
}

function prefills(): string[] {
	return stubState.posted
		.filter((message): message is { type: string; text: string } => (message as { type?: string }).type === "prefill")
		.map(message => message.text);
}

describe("ide-native workbench surface", () => {
	it("registers the editor, selection, review, and mode commands as real handlers", async () => {
		await activateAndSettle();
		for (const id of [
			"caret.inlineEdit",
			"caret.addSelectionToTask",
			"caret.addFileToTask",
			"caret.reviewInDiff",
			"caret.showAgents",
			"caret.showIde",
			"caret.showDiff",
			"caret.openTerminal",
			"caret.reviewAgentEdit",
		]) {
			expect(typeof stubState.commands.get(id)).toBe("function");
		}
		// One agent surface per window: the dock. The full-page shell view is retired.
		expect(stubState.views.map(view => view.id)).toEqual(["caretComposerDock"]);
		expect(stubState.contentProviders.has("caret-review")).toBe(true);
		expect(stubState.contentProviders.has("caret-agent-edit")).toBe(true);
	});

	it("registers a real handler for every command the manifest declares", async () => {
		await activateAndSettle();
		const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
			contributes: {
				commands: { command: string }[];
				menus: Record<string, { command: string }[]>;
			};
		};
		// A declared command with no handler is a palette entry that does
		// nothing: it appears, the user picks it, and no error is raised.
		const declared = manifest.contributes.commands.map(entry => entry.command);
		expect(declared.length).toBeGreaterThan(20);
		expect(declared.filter(id => typeof stubState.commands.get(id) !== "function")).toEqual([]);
		// Every menu entry must be wired to a command that is actually
		// registered, not merely declared, or the menu item is inert.
		const menuCommands = [...new Set(Object.values(manifest.contributes.menus).flat().map(entry => entry.command))];
		expect(menuCommands.length).toBeGreaterThan(5);
		for (const id of menuCommands) expect(`${id}: ${typeof stubState.commands.get(id)}`).toBe(`${id}: function`);
	});

	it("opens a plain IDE window on full chrome by default, keeping agents in their own window", async () => {
		await activateAndSettle();
		const startup = stubState.executed.map(entry => entry.id);
		// Native world (plan section 2): a plain window is an IDE window, so
		// startup must not strip Code-OSS chrome. The agent lives in the base
		// sessions window opened via caret.showAgents.
		expect(startup).not.toContain("workbench.action.closeSidebar");
		expect(startup).not.toContain("workbench.action.activityBarLocation.hide");
		expect(stubState.config.get("workbench.activityBar.location")).not.toBe("hidden");
		expect(stubState.config.get("workbench.statusBar.visible")).not.toBe(false);
		expect(stubState.config.get("workbench.editor.showTabs")).not.toBe("none");

		// ...and showIde is a safe no-op when the chrome was never stripped.
		stubState.executed.length = 0;
		await stubState.commands.get("caret.showIde")!();
		await new Promise(resolve => setTimeout(resolve, 20));
		expect(stubState.executed.map(entry => entry.id)).not.toContain("workbench.action.closeSidebar");
		expect(stubState.config.get("workbench.activityBar.location")).not.toBe("hidden");
		expect(stubState.config.get("workbench.statusBar.visible")).not.toBe(false);
	});

	it("keeps the user's own theme in the Agents window instead of painting its own", async () => {
		// The editor and the agent window are the same application, so one theme is
		// what a user expects in both. Caret's own palette here made the editor look
		// like it changed colour when it switched modes.
		await activateAndSettle();
		expect(stubState.config.get("workbench.colorCustomizations")).toBeUndefined();
		expect(stubState.globalConfig.get("workbench.colorCustomizations")).toBeUndefined();
	});

	it("leaves chrome colours alone when the user set their own", async () => {
		// The user's own palette sits at the global scope. Caret must not answer
		// with its own palette, and must not touch what the user wrote.
		stubState.globalConfig.set("workbench.colorCustomizations", { "editor.background": "#101010" });
		await activateAndSettle();
		expect(stubState.config.get("workbench.colorCustomizations")).toBeUndefined();
		expect(stubState.globalConfig.get("workbench.colorCustomizations")).toEqual({ "editor.background": "#101010" });
		stubState.globalConfig.delete("workbench.colorCustomizations");
	});

	it("leaves the theme alone when the theme kind changes", async () => {
		// A theme switch repaints the workbench; Caret adds nothing on top of it, so
		// the light/dark/high-contrast theme the user picked is the one that shows.
		await activateAndSettle();
		fireActiveColorThemeChange(1);
		await new Promise(resolve => setTimeout(resolve, 20));
		expect(stubState.config.get("workbench.colorCustomizations")).toBeUndefined();
		fireActiveColorThemeChange(2);
		await new Promise(resolve => setTimeout(resolve, 20));
		expect(stubState.config.get("workbench.colorCustomizations")).toBeUndefined();
		expect(stubState.globalConfig.get("workbench.colorCustomizations")).toBeUndefined();
	});

	it("follows the OS light/dark setting the way the reference does", async () => {
		// Cursor ships window.autoDetectColorScheme on, so its chrome follows
		// the desktop. Without this Caret's light palette is unreachable.
		await activateAndSettle();
		expect(stubState.config.get("window.autoDetectColorScheme")).toBe(true);
	});

	it("leaves the OS theme-following choice alone when the user set it", async () => {
		stubState.globalConfig.set("window.autoDetectColorScheme", false);
		await activateAndSettle();
		expect(stubState.config.get("window.autoDetectColorScheme")).toBeUndefined();
		stubState.globalConfig.delete("window.autoDetectColorScheme");
	});

	it("clears the palette Caret itself wrote, at the scope it wrote it", async () => {
		// Older builds wrote Caret's palette; leaving it behind would keep the window
		// wearing colours the user never chose. The check is Caret's whole signature,
		// so a user's own customisations are not mistaken for it.
		stubState.config.set("workbench.colorCustomizations", { ...CARET_WORKBENCH_COLORS });
		await activateAndSettle();
		expect(stubState.config.get("workbench.colorCustomizations")).toBeUndefined();
	});

	it("clears Caret's own palette from a folderless window's global scope", async () => {
		// This first screen can only write at global scope, which is where the
		// footprint of an older build lives.
		stubState.globalConfig.set("workbench.colorCustomizations", { ...CARET_WORKBENCH_COLORS });
		await activateAndSettle(2, true);
		expect(stubState.globalConfig.get("workbench.colorCustomizations")).toBeUndefined();
	});

	it("cites the real editor selection into the task draft", async () => {
		await activateAndSettle();
		resolveViews();
		openEditor(0, 1);
		await stubState.commands.get("caret.addSelectionToTask")!();
		const draft = lastSnapshotDraft();
		expect(draft).toContain("src/greet.ts#L1-L2");
		// The cited body is the unsaved buffer, not the file on disk.
		expect(draft).toContain('return "hi " + name;');
		expect(draft).not.toContain('"hello "');
		expect(prefills().at(-1)).toContain("src/greet.ts#L1-L2");
		expect(stubState.statusMessages.some(message => message.includes("src/greet.ts#L1-L2"))).toBe(true);
	});

	it("brings the agent dock forward with the real view focus command", async () => {
		await activateAndSettle();
		resolveViews();
		openEditor(0, 1);
		stubState.executed.length = 0;
		await stubState.commands.get("caret.addSelectionToTask")!();
		const commands = stubState.executed.map(entry => entry.id);
		// `caretDock` is the container, which registers no focus command; the view
		// is `caretComposerDock`, so that is what can actually be focused.
		expect(commands).toContain("caretComposerDock.focus");
		expect(commands).not.toContain("caretDock.focus");
	});

	it("cites a whole file when the Explorer passes a resource", async () => {
		await activateAndSettle();
		resolveViews();
		await stubState.commands.get("caret.addFileToTask")!(stubUri(`file://${sourceFile}`));
		const draft = lastSnapshotDraft();
		// No editor selection: the whole file is cited, not an invented range.
		expect(draft).toContain("src/greet.ts#L1-L4");
		expect(draft).toContain("export function hello(name: string) {");
	});

	it("keeps an inline edit instruction when the host is unreachable", async () => {
		await activateAndSettle();
		resolveViews();
		openEditor(1, 1);
		vscodeApi.window.showInputBox = async () => "add a retry with backoff";
		await expect(stubState.commands.get("caret.inlineEdit")!()).rejects.toBeDefined();
		// The promise rejects because dispatch needs the host, but the user's
		// instruction and the selection citation must already be in the draft.
		const draft = lastSnapshotDraft();
		expect(draft).toContain("Edit src/greet.ts#L2: add a retry with backoff");
		expect(draft).toContain('return "hi " + name;');
	});

	it("opens the review in the native diff editor with the Git original", async () => {
		await activateAndSettle();
		await stubState.commands.get("caret.reviewInDiff")!(stubUri(`file://${sourceFile}`));
		const diff = stubState.executed.find(entry => entry.id === "vscode.diff");
		expect(diff).toBeDefined();
		const original = diff!.args[0] as { toString(): string };
		expect(original.toString()).toBe("caret-review:/HEAD/src/greet.ts");
		expect(diff!.args[1]).toMatchObject({ scheme: "file", fsPath: sourceFile });
		const provider = stubState.contentProviders.get("caret-review")!;
		await expect(provider.provideTextDocumentContent(original)).resolves.toBe(headText);
	});

	it("renders a real status bar item that opens the task", async () => {
		await activateAndSettle();
		resolveViews();
		// refresh() reaches the host asynchronously; wait for the failure to land
		// before reading the rendered state.
		await new Promise(resolve => setTimeout(resolve, 80));
		const item = stubState.statusItems.at(-1)!;
		expect(item.command).toBe("caret.showAgents");
		expect(item.visible).toBe(true);
		// The host is unreachable in this harness, so the item must say so
		// instead of advertising a connection Caret does not have.
		expect(item.text).toContain("Caret");
		expect(item.text).toContain("offline");
		expect(item.tooltip).toContain("not reachable");
	});

	it("opens a real terminal for the terminal action", async () => {
		await activateAndSettle();
		await stubState.commands.get("caret.openTerminal")!();
		const terminal = stubState.terminals.at(-1);
		expect(terminal).toBeDefined();
		// A real Code-OSS terminal is created and revealed, not a webview stand-in.
		expect(terminal!.showCount).toBeGreaterThan(0);
		expect(terminal!.disposed).toBe(false);
	});

	it("opens an omp terminal for provider sign-in without touching task state", async () => {
		await activateAndSettle();
		await stubState.commands.get("caret.ompSignIn")!();
		const terminal = stubState.terminals.at(-1);
		expect(terminal).toBeDefined();
		expect(terminal!.name).toContain("OMP sign-in");
		expect(terminal!.showCount).toBeGreaterThan(0);
		// Plain `omp` on purpose: inherited environment means the same
		// credential store the user's own terminal logins and the host read.
		expect(terminal!.sentText).toEqual(["omp"]);
	});

	it("reveals the Explorer and keeps IDE chrome for the Files action", async () => {
		await activateAndSettle();
		stubState.executed.length = 0;
		await stubState.commands.get("caret.openFiles")!();
		// The chrome writes are deliberately not awaited by the mode switch (a
		// stalled settings write must not hang it), so let them land.
		await new Promise(resolve => setTimeout(resolve, 20));
		expect(stubState.executed.map(entry => entry.id)).toContain("workbench.view.explorer");
		// The Files action is a native navigation, not a chrome replacement.
		expect(stubState.config.get("workbench.activityBar.location")).toBe("default");
		expect(stubState.config.get("workbench.statusBar.visible")).toBe(true);
		expect(stubState.config.get("workbench.editor.showTabs")).toBe("multiple");
	});

	it("refuses a binary file instead of opening a text diff of bytes", async () => {
		await activateAndSettle();
		await stubState.commands.get("caret.reviewInDiff")!(stubUri(`file://${binaryFile}`));
		// Honesty: git reports this as binary, so no diff editor may open.
		expect(stubState.executed.some(entry => entry.id === "vscode.diff")).toBe(false);
		expect(stubState.statusMessages.some(message => message.toLowerCase().includes("binary"))).toBe(true);
	});

	it("opens an untracked text file as all-added from an empty original", async () => {
		await activateAndSettle();
		await stubState.commands.get("caret.reviewInDiff")!(stubUri(`file://${untrackedFile}`));
		const diff = stubState.executed.find(entry => entry.id === "vscode.diff");
		expect(diff).toBeDefined();
		const provider = stubState.contentProviders.get("caret-review")!;
		// An empty original is the honest answer for a path with no HEAD version;
		// Caret must not invent content for the left side.
		await expect(provider.provideTextDocumentContent(diff!.args[0])).resolves.toBe("");
	});

	it("opens the Changes view from the Diff action", async () => {
		await activateAndSettle();
		resolveViews();
		await stubState.commands.get("caret.showDiff")!();
		const latest = [...stubState.posted].reverse().find((message): message is { type: string; state: any } => (message as { type?: string }).type === "snapshot");
		expect(latest).toBeDefined();
		expect(latest!.state.workPanel.open).toBe(true);
		expect(latest!.state.workPanel.activeTab).toBe("changes");
	});

	it("refuses a review target outside the task workspace", async () => {
		await activateAndSettle();
		await stubState.commands.get("caret.reviewInDiff")!(stubUri("file:///tmp/outside-caret-review.ts"));
		expect(stubState.executed.some(entry => entry.id === "vscode.diff")).toBe(false);
		expect(stubState.statusMessages.some(message => message.includes("outside"))).toBe(true);
	});

	it("refuses a selection from an untitled document", async () => {
		await activateAndSettle();
		resolveViews();
		stubState.activeEditor = {
			document: { uri: stubUri("untitled:Untitled-1"), fileName: "Untitled-1", languageId: "plaintext", getText: () => "scratch" },
			selection: { isEmpty: false, start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
		};
		await stubState.commands.get("caret.addSelectionToTask")!();
		// The draft is untouched: an untitled buffer has no real path to cite, so
		// Caret explains instead of quoting invented content.
		expect(lastSnapshotDraft()).toBe("");
		expect(stubState.statusMessages.some(message => message.includes("workspace file"))).toBe(true);
	});

	it("keeps the task draft across an Agents and back to IDE switch", async () => {
		await activateAndSettle();
		resolveViews();
		openEditor(0, 1);
		await stubState.commands.get("caret.addSelectionToTask")!();
		const before = lastSnapshotDraft();
		expect(before).toContain("src/greet.ts#L1-L2");

		await stubState.commands.get("caret.showAgents")!();
		await new Promise(resolve => setTimeout(resolve, 20));
		expect(lastSnapshotDraft()).toBe(before);

		await stubState.commands.get("caret.showIde")!();
		await new Promise(resolve => setTimeout(resolve, 20));
		// Switching presentation must not mint a new session owner or drop text.
		expect(lastSnapshotDraft()).toBe(before);
	});

	it("invokes every palette command without a reachable host", async () => {
		await activateAndSettle();
		resolveViews();
		// Host-dependent commands (refresh, pairing, devices) are covered by their
		// own paths and intentionally excluded here: they wait on the host.
		const palette = [
			"caret.openComposer",
			"caret.showAgents",
			"caret.showIde",
			"caret.newTask",
			"caret.openFolder",
			"caret.skipToTask",
			"caret.openFiles",
			"caret.showDiff",
			"caret.openTerminal",
			"caret.openSettings",
			"caret.searchTasks",
			"caret.taskActions",
			"caret.ompControls",
			"caret.addSelectionToTask",
			"caret.addFileToTask",
			"caret.reviewInDiff",
			"caret.inlineEdit",
		];
		for (const id of palette) {
			const handler = stubState.commands.get(id);
			expect(typeof handler).toBe("function");
			// A palette entry that throws is a broken command, not a graceful
			// "nothing to do yet".
			let rejected: unknown;
			try {
				await Promise.resolve(handler!());
			} catch (error) {
				rejected = error;
			}
			expect(`${id}: ${rejected instanceof Error ? rejected.message : rejected ?? "ok"}`).toBe(`${id}: ok`);
		}
	});

	it("opens the native Agents window for showAgents and restores chrome for showIde", async () => {
		await activateAndSettle();
		await stubState.commands.get("caret.showAgents")!();
		await new Promise(resolve => setTimeout(resolve, 20));
		// The agent surface is the base sessions window (plan S1c), so
		// showAgents opens that window instead of stripping this one's chrome.
		expect(stubState.executed.map(entry => entry.id)).toContain("workbench.action.openAgentsWindow");
		expect(stubState.executed.map(entry => entry.id)).not.toContain("workbench.action.closeSidebar");

		stubState.executed.length = 0;
		await stubState.commands.get("caret.showIde")!();
		await new Promise(resolve => setTimeout(resolve, 20));
		// Nothing was stripped, so restore is a safe no-op that leaves the
		// chrome values alone instead of rewriting them.
		expect(stubState.executed.map(entry => entry.id)).not.toContain("workbench.action.closeSidebar");
		expect(stubState.config.get("workbench.activityBar.location")).not.toBe("hidden");
		expect(stubState.config.get("workbench.statusBar.visible")).not.toBe(false);
	});

	it("keeps the Agents window menu patch and the manifest digest in agreement", async () => {
		// The Agents window is the base sessions workbench, so its menu set is
		// owned by the sessions menubar contribution: Selection, Go and Terminal
		// must not be registered there. The patch and its digest are pinned here
		// so a rename or a re-apply cannot silently restore the editor menus.
		const fileName = "0008-caret-agents-window-menus.patch";
		const patchText = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", fileName), "utf8");
		for (const menu of ["MenuId.MenubarSelectionMenu", "Menus.GoMenu", "MenuId.MenubarTerminalMenu"]) {
			expect(patchText).toContain(`-	submenu: ${menu},`);
		}
		// The menu registration is removed, not merely hidden behind a context key.
		expect(patchText).not.toContain("when:");

		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		const entry = manifest.patches.find(item => item.file === fileName);
		expect(entry).toBeTruthy();
		expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
	});

	it("keeps the Agents window Cursor-chrome patch and the manifest digest in agreement", async () => {
		// S4 parity (CARET-PLAN section 3): the reference Agents window has no
		// "Sessions" sidebar title, no Run button in its header, and never names
		// another product in the composer's model picker. All three live in one
		// patch so a re-apply cannot quietly bring them back.
		const fileName = "0016-caret-agents-window-cursor-chrome.patch";
		const patchText = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", fileName), "utf8");
		// 1. The sidebar title is emptied: Cursor's sidebar starts at "New Chat".
		expect(patchText).toContain(`label.textContent = localize('sessionsHeader', "Sessions");`);
		expect(patchText).toContain("label.textContent = '';");
		// 2. The Run split button and its permanently disabled placeholder leave the
		// title bar. The capability stays reachable from the command palette and F5.
		expect(patchText).toContain("MenuRegistry.appendMenuItem(Menus.TitleBarCenterRight, {");
		expect(patchText).toContain(`tooltip: localize('runScriptNotAvailableTooltip', "Run Task is not available for this session type"),`);
		// 3. The sessions model picker declares itself a sessions-window picker, which
		// is what suppresses the core picker's Copilot setup state and its aria label.
		expect(patchText).toContain("isSessionsWindow: true,");
		// The patch must stay inside the Agents window bundle.
		expect(patchText).not.toContain("src/vs/workbench/");
		expect(patchText).toContain("a/src/vs/sessions/");

		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		const entry = manifest.patches.find(item => item.file === fileName);
		expect(entry).toBeTruthy();
		expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
	});

	it("keeps the Agents window app-panel and composer-voice patches in agreement with the manifest", async () => {
		// Section 3.2 of the plan names the right-hand panel's controls "Enter Full
		// Screen" and "Hide Apps" and the composer's microphone "Start voice input".
		// Each patch and its digest are pinned so a re-apply or a rename cannot
		// silently restore the base wording.
		const cases: readonly (readonly [string, readonly string[]])[] = [
			["0017-caret-agents-app-panel-chrome.patch", [
				`title: localize2('maximizeMainEditorPart', "Enter Full Screen"),`,
				`title: localize2('restoreMainEditorPart', "Exit Full Screen"),`,
				`title: localize2('closeMainEditorPart', "Hide Apps"),`,
				`title: localize2('closeEditorArea', "Hide Apps"),`,
				// The empty editor group's watermark is hidden for this window only.
				`.agent-sessions-workbench .part.editor .editor-group-container > .editor-group-watermark-wrapper > .editor-group-watermark`,
			]],
			["0018-caret-agents-composer-voice-copy.patch", [
				`const micLabel = localize('sessionsStt.dictate', "Start voice input");`,
			]],
		];

		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		for (const [fileName, needles] of cases) {
			const patchText = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", fileName), "utf8");
			for (const needle of needles) expect(patchText).toContain(needle);
			// Both patches must stay inside the Agents window.
			expect(patchText).not.toContain("src/vs/workbench/");
			expect(patchText).toContain("a/src/vs/sessions/");

			const entry = manifest.patches.find(item => item.file === fileName);
			expect(entry).toBeTruthy();
			expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
		}
	});

	it("places the customization entry points in the Agents sidebar, not the composer", async () => {
		// Section 3 of the plan lists `Customize` in the Agents sidebar. The base
		// already carries the switch between the two real placements, so Caret flips
		// that default instead of adding a second entry point. This is the one
		// Caret patch that touches src/vs/workbench/**; every consumer of the setting
		// lives under src/vs/sessions/**, so the IDE window is not affected.
		const fileName = "0019-caret-customize-in-sidebar.patch";
		const patchText = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", fileName), "utf8");
		expect(patchText).toContain("[ChatConfiguration.CustomizationEntryPoints]: {");
		expect(patchText).toContain(`-			default: product.quality !== 'stable',`);
		expect(patchText).toContain("+			default: false,");
		// Exactly one file, and it is the settings registry.
		expect(patchText.match(/^diff --git /gm)?.length).toBe(1);
		expect(patchText).toContain("chat.shared.contribution.ts");

		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		const entry = manifest.patches.find(item => item.file === fileName);
		expect(entry).toBeTruthy();
		expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
	});

	it("keeps the Agents window pet-unmount patch in agreement with the manifest", async () => {
		// The chat pet must not be mounted in the Agents window while the easter egg is
		// off: registering a host is what creates the pet, and unregistering only parks
		// it. All three gates live in src/vs/sessions/**, never in the shared chat widget.
		const fileName = "0020-caret-agents-pet-unmounted.patch";
		const patchText = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", fileName), "utf8");
		for (const needle of [
			`petHostPreferred: derived(this, reader => this._isVisibleObs.read(reader) && developerJoy.read(reader)),`,
			`this._register(autorun(reader => {`,
			`if (this.configurationService.getValue<boolean>(SESSIONS_DEVELOPER_JOY_ENABLED_SETTING) === true) {`,
			`SESSIONS_DEVELOPER_JOY_ENABLED_SETTING`,
		]) {
			expect(patchText).toContain(needle);
		}
		expect(patchText.match(/^diff --git /gm)?.length).toBe(3);
		expect(patchText).not.toContain("src/vs/workbench/");

		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		const entry = manifest.patches.find(item => item.file === fileName);
		expect(entry).toBeTruthy();
		expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
	});

	it("keeps the JSX configuration for Caret's React surfaces in agreement with the manifest", async () => {
		// The reference writes its agent UI in JSX. Caret's own surfaces can too, but only because
		// three things line up: the type-checker accepts `.tsx`, the bundler compiles JSX to the
		// automatic runtime, and that runtime is inlined for the renderer - a browser ESM context
		// cannot resolve `react/jsx-runtime` any more than it can `react`.
		const fileName = "0030-caret-jsx-for-react-surfaces.patch";
		const patchText = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", fileName), "utf8");
		for (const needle of [
			`"jsx": "react-jsx",`,
			`"./vs/**/*.tsx",`,
			// The diffing fixtures are deliberately malformed samples read as text; now that `.tsx`
			// is in the program they would be type-checked and fail on their missing packages.
			`"vs/editor/test/node/diffing/fixtures"`,
		]) {
			expect(patchText).toContain(needle);
		}
		expect(patchText.match(/^diff --git /gm)?.length).toBe(1);

		// The bundler half lives in 0028, which owns build/next/index.ts.
		const bundler = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "0028-caret-inline-react-in-client-bundles.patch"), "utf8");
		expect(bundler).toContain(`jsx: 'automatic'`);
		expect(bundler).toContain(`'react/jsx-runtime': 'node_modules/react/jsx-runtime.js'`);

		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		const entry = manifest.patches.find(item => item.file === fileName);
		expect(entry).toBeTruthy();
		expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
	});

	it("keeps the Agents window free of the account widget and the patch in agreement with the manifest", async () => {
		// The title bar's right layout carried an account control that could only ever draw a
		// Copilot-flavoured "signed out" avatar: this window is fed by the local host, there is no
		// sign-in provider in the fork, and the user read the leftover control as a Copilot login.
		const fileName = "0029-caret-agents-no-account-widget.patch";
		const patchText = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", fileName), "utf8");
		for (const needle of [
			`id: Menus.TitleBarRightLayout,`,
			`when: ContextKeyExpr.false(),`,
			`Caret: there is no account here`,
		]) {
			expect(patchText).toContain(needle);
		}
		// Scoped to the Sessions window's own contribution, which only the Agents window loads.
		expect(patchText.match(/^diff --git /gm)?.length).toBe(1);
		expect(patchText).toContain("src/vs/sessions/contrib/accountMenu/");
		expect(patchText).not.toContain("src/vs/workbench/");

		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		const entry = manifest.patches.find(item => item.file === fileName);
		expect(entry).toBeTruthy();
		expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
	});

	it("keeps the Agents window free of the remote-connections toggle and the patch in agreement with the manifest", async () => {
		// The same title-bar row also carried "Allow Remote Connections", whose command starts a
		// GitHub-authenticated dev tunnel - a flow this fork cannot finish. It sat next to the
		// Apps panel control as a second unexplained icon at the top right.
		const fileName = "0031-caret-agents-no-remote-connections.patch";
		const patchText = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", fileName), "utf8");
		for (const needle of [
			// The sessions-window gate the control used to be reachable through, and the false
			// expression that takes its place - the declaration and its view item stay for the
			// type checker and the base's wiring.
			`-			when: ContextKeyExpr.and(ChatContextKeys.enabled, IsSessionsWindowContext, IsAuxiliaryWindowContext.toNegated())`,
			`+			when: ContextKeyExpr.false()`,
			`Caret: a remote tunnel is a GitHub-authenticated capability`,
		]) {
			expect(patchText).toContain(needle);
		}
		// The tunnel toggle is a Sessions-window contribution; the IDE's own chat-input copy is
		// not touched by this patch.
		expect(patchText.match(/^diff --git /gm)?.length).toBe(1);
		expect(patchText).toContain("src/vs/sessions/contrib/tunnelHost/");
		expect(patchText).not.toContain("src/vs/workbench/");

		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		const entry = manifest.patches.find(item => item.file === fileName);
		expect(entry).toBeTruthy();
		expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
	});

	it("keeps the Agent Home utility patch in agreement with the manifest", async () => {
		// The empty Agent Home must show the reference's right utility area, not a bare
		// editor group, and it must stay scoped to the Sessions window.
		const fileName = "0021-caret-agent-home-utility.patch";
		const patchText = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", fileName), "utf8");
		for (const needle of [
			// Every one of the four entries is a pane of this panel: none of them opens its
			// surface somewhere else in the window, so the strip switches panes in place for
			// all four and the rail has a pane to mark for each.
			`hosted: 'changes'`,
			`hosted: 'file'`,
			// The strip entry and `+` share one path, and the entries never open a second
			// surface in the editor group.
			`hosted: 'browser'`,
			`hosted: 'terminal'`,
			// The two single-instance panes host the base's own surfaces: the changes view for
			// Changes, and the Files content the Files tab shows for File. Both are sized by the
			// pane itself, because the pane owns their element rather than a workbench part.
			`caret-apps-pane-changes`,
			`caret-apps-pane-files`,
			`this.instantiationService.createInstance(EmptyFileEditor, this.group)`,
			`this.instantiationService.createInstance(ChangesViewPane, {`,
			`new PaneView(container, { orientation: Orientation.VERTICAL })`,
			`layoutPanes: (width, height) => paneView.layout(height, width),`,
			// The panel names its own entries the way the reference window does, and the
			// pinned summary is a real control over the real active session, not decoration.
			// The reference's own strip wording and order: Changes · Browser · Terminal · File,
			// and the `+` control it calls "Open new tab menu".
			`localize('caret.agentHome.utility.review', "Changes")`,
			`"Open new tab menu"`,
			`export function mountAppsLauncherRail(`,
			`caret.agentHome.utility.toggleSummary`,
			`this.sessionsService.activeSession.read(reader)`,
			// Terminal is the entry the pane hosts itself - one tab per instance - by
			// attaching a real terminal instance to this pane instead of revealing the
			// bottom panel.
			`this.terminalService.createTerminal({})`,
			`attachToElement(container)`,
			`setVisible(active)`,
			`instance.onTitleChanged(`,
			// Instances live in a singleton the window owns, not in the pane, so a pane the
			// layout closes and re-creates does not take the tabs with it.
			`export const IAppsPanelModel = createDecorator<IAppsPanelModel>('caretAppsPanelModel');`,
			`tab.instance?.detachFromElement();`,
			// `+` is anchored to the button and shares the entries' path; Browser is hosted
			// here with the pane owning the overlay bounds.
			`this.contextMenuService.showContextMenu({`,
			`getAnchor: () => ({ x: anchor.left, y: anchor.bottom, width: anchor.width, height: anchor.height }),`,
			// A hosted browser tab carries its own address bar, so opening one is usable
			// immediately instead of depending on a dialog that can be dismissed.
			`caret-apps-browser-url`,
			`function normaliseUrl(value: string): string {`,
			// The address bar searches: a scheme or a bare host is a URL, anything else
			// goes to the engine. The placeholder promised this before the code did it.
			`const SEARCH_ENDPOINT = 'https://www.google.com/search?q=';`,
			`return \`${'${SEARCH_ENDPOINT}'}${'${encodeURIComponent(trimmed)}'}\`;`,
			// The bar completes what is typed: the list is filled from the engine through
			// the extension host (this window is subject to CORS), and a chosen row is
			// always a search rather than a host to open.
			`caret-apps-browser-suggest-row`,
			`executeCommand<string[]>('caret.browser.suggest', term)`,
			`function isSearchTerm(value: string): boolean {`,
			`function searchUrlFor(term: string): string {`,
			// The page this tab hosts is a native view above the window's DOM, so the list
			// only becomes visible if the page's own bounds give it room.
			`const overlayHeight = overlay && !overlay.hidden ? Math.round(overlay.getBoundingClientRect().height) : 0;`,
			`height: Math.max(0, Math.round(rect.height) - overlayHeight),`,
			`const input = this.browserViewService.getOrCreateLazy({ id: generateUuid() });`,
			// R2: the instance tab row is React's. The pane keeps each tab's body (a terminal
			// attaches an instance, a browser lays a native view over its own element) and the
			// strip's other controls, so both halves have to stay visible in the patch.
			`export function mountAppsTabStrip(`,
			`mountAppsTabStrip(this.tabsElement, {`,
			`private tabStrip: IAppsTabStripHandle | undefined;`,
			`this.tabStrip?.update(`,
			// The pinned summary is the same split: React owns the two spans, the pane keeps the
			// observable wiring, so no `textContent` write may creep back into the pane.
			`export function mountAppsSummary(`,
			`this.summaryView?.dispose();`,
			// The pin is window state, not pane state: a layout that re-creates the pane (collapsing
			// the editor area, or Agents -> IDE -> Agents) must not silently unpin the summary, so
			// the model owns the flag and the pane only mirrors it.
			`readonly summaryPinned: boolean;`,
			`toggleSummaryPinned(): void;`,
			`this.panelModel.toggleSummaryPinned();`,
			`private applySummaryPinned(): void {`,
			// Alignment: every control in the strip takes one size and one gap, so a browser tab
			// and a terminal tab cannot drift onto different baselines again.
			`--caret-apps-control-size: var(--caret-height-sm, 24px);`,
			`gap: var(--caret-apps-gap);`,
			// A hosted page is a native view whose model starts invisible, so opening a
			// browser tab has to show the active tab and only THEN push its bounds: the
			// pane's own layout may run before the view element has a real rect, and a
			// zero rect must not hide the tab the user just asked for.
			`private isEditorVisible = true;`,
			`this.isEditorVisible = visible;`,
			`const active = this.isEditorVisible && this.activeTabId === tab.id;`,
			`void model.setVisible(active).then(() => model.layout(bounds)).then(() => {`,
			`await model.loadURL(url).catch(() => undefined);`,
			// A DOM popup over the pane is behind the hosted page's native view, so the `+` menu
			// opens where the user cannot reach it once a browser tab exists. The page moves out
			// of the way while the menu is up and `applyActiveTab` puts it back on hide.
			`this.hideBrowserForPopup();`,
			`onHide: () => this.restoreAfterPopup(),`,
			// The strip is the reference's pane switcher and `+` is its instance opener: the rail
			// re-uses the pane that is open, the menu always adds one. Both go through one method so
			// the two halves cannot drift on what "Browser" means.
			`private runLauncher(launcher: IAppsLauncher, mode: 'reuse' | 'new'): void {`,
			`this.runLauncher(launcher, 'reuse');`,
			`() => this.runLauncher(launcher, 'new'),`,
			// Show Apps stays a command: the base only ships the hide half and this single-pane
			// group replaces the panel with a browser/file tab, but as a title-bar icon it was a
			// no-op - it can only close the panel when the Apps editor is the active editor, and
			// the reference's own control is `Hide Apps` in the panel header, not a title-bar icon.
			`static readonly ID = 'caret.agentHome.showApps';`,
			`It is a command only, deliberately:`,
			// Reference proportions measured from docs/caret-ui-reference-baseline.json.
			`const REFERENCE_SIDEBAR_WIDTH = 255;`,
			`const REFERENCE_UTILITY_SHARE = 0.225;`,
			// The utility surface is not closable, like the reference area.
			`EditorInputCapabilities.CannotClose`,
			// Sessions-window scoping.
			`IsSessionsWindowContext.getValue(contextKeyService)`,
		]) {
			expect(patchText).toContain(needle);
		}
		// Eight files: the utility input, pane, panel model, React card surface, contribution,
		// its CSS, the entry import, and the fork's `package.json` (React as a real
		// dependency rather than a transitive one). The React module and the pane changes are
		// bundled here rather than split out because 0021 CREATES those files, and a later
		// patch to a file another patch creates breaks that patch's own reverse-check.
		expect(patchText.match(/^diff --git /gm)?.length).toBe(8);
		expect(patchText).toContain("a/src/vs/sessions/");
		expect(patchText).not.toContain("src/vs/workbench/");
		// The reference sidebar ends at the Repositories section: it has no Getting
		// Started card and no profile/settings row, so neither may creep back in.
		expect(patchText).not.toContain("caret-agent-home-getting-started");
		expect(patchText).not.toContain("caret-agent-home-nav-profile");
		expect(patchText).not.toContain("workbench.action.openSettings");
		// Show Apps is not a title-bar entry any more: measured in the packaged app it did
		// nothing at all (the panel it would "open" is already in the group), and the
		// reference's title bar carries no such control.
		expect(patchText).not.toContain("Menus.TitleBarRightLayout");

		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		const entry = manifest.patches.find(item => item.file === fileName);
		expect(entry).toBeTruthy();
		expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
	});

	it("keeps the Agent Home chrome and navigation patch in agreement with the manifest", async () => {
		// Slice B1: the Agents Window title bar drops the wide Show Sessions pill, the
		// sidebar becomes the reference navigation, and both are scoped to the Sessions
		// workbench so the IDE window keeps its own chrome.
		const fileName = "0022-caret-agent-home-chrome-navigation.patch";
		const patchText = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", fileName), "utf8");
		for (const needle of [
			// Title bar: the sessions title-bar widget is no longer mounted.
			`registerWorkbenchContribution2(SessionsTitleBarContribution.ID`,
			// Sidebar rows, in the reference order, all bound to real commands.
			`label: localize('caret.nav.newChat', "New Chat"), iconId: Codicon.commentDiscussion.id, selected: true`,
			`label: localize('caret.nav.search', "Search"), iconId: Codicon.search.id, selected: false`,
			`label: localize('caret.nav.automations', "Automations"), iconId: Codicon.clock.id, selected: false`,
			`label: localize('caret.nav.customize', "Customize"), iconId: Codicon.tools.id, selected: false`,
			// R3: the sidebar is the same React surface the Apps panel is. The class keeps the
			// model (which rows exist, what they run, what the filter hides) and the module owns
			// the pixels, so a wording or order change is one object literal.
			`export function mountAgentHomeNav(`,
			`this.view = mountAgentHomeNav(this.domNode, this.buildModel(), {`,
			`private readonly runs = new Map<string, () => void>();`,
			// Real commands behind the rows and the sections.
			`const FIND_SESSIONS_COMMAND_ID = 'sessionsViewPane.find';`,
			// "New Project" is Caret's own add-project command, not the workbench's
			// open-folder one: the workbench command is what handed the folder to a
			// separate window instead of adding it here.
			`const ADD_PROJECT_COMMAND_ID = 'caret.project.add';`,
			`AUTOMATIONS_CUSTOM_VIEW_ID`,
			// The obsolete base controls are taken out of the DOM, not merely hidden.
			`'.agent-sessions-header-row', '.agent-sessions-customizations-section'`,
			// The repository filter is real: it toggles an input that hides the rows
			// that do not match, rather than an icon that does nothing.
			`localize('caret.nav.filterRepositories', "Filter Repositories")`,
			`className: 'caret-agent-home-nav-filter'`,
			`onFilterInput: (_sectionId, query) => {`,
			`hidden: needle.length > 0 && !folder.name.toLowerCase().includes(needle),`,
			// The utility surface draws the pane's only strip: the host group's own strip is
			// suppressed while this panel is the editor the group shows, so its entries and
			// its instance tabs always sit on one row.
			`.editor-group-container:has(> .editor-container .caret-apps-panel) > .title`,
			// The launcher cards are calibrated to the reference window measured at its
			// native size: 121x96 CSS per card with a 13px gap, i.e. a 255x205 grid. The
			// 148x120 in the geometry brief is that same capture resized to 2048 wide.
			`gap: 13px;`,
			`width: 255px;`,
			`height: 205px;`,
			// Reference column shares instead of fixed widths.
			`const REFERENCE_SIDEBAR_SHARE = 0.15625;`,
			`const REFERENCE_UTILITY_SHARE = 0.2251;`,
			// The project rows carry the reference's own right-click menu, in the
			// reference's order. The entries reach the Caret extension's project
			// commands, and a command that cannot run reports instead of doing nothing
			// (apps/macos/test/agent-home-project-menu.test.ts pins the other half of
			// that contract: every id here is a command the extension registers).
			`const CARET_PROJECT_COMMANDS = {`,
			`pin: 'caret.project.setPinned',`,
			`remove: 'caret.project.remove',`,
			`EventType.CONTEXT_MENU`,
			`attachSessionsListMenu`,
			`localize('caret.project.pin', "Pin Project")`,
			`localize('caret.project.reveal', "Reveal in Finder")`,
			`localize('caret.project.worktree', "Create Permanent Worktree")`,
			`localize('caret.project.actionFailed'`,
		]) {
			expect(patchText).toContain(needle);
		}
		// Four new files (the navigation, its React surface, its contribution and its stylesheet)
		// plus the two entry/registration files the chrome changes live in.
		expect(patchText.match(/^diff --git /gm)?.length).toBe(6);
		expect(patchText).toContain("a/src/vs/sessions/");
		expect(patchText).not.toContain("src/vs/workbench/");

		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		const entry = manifest.patches.find(item => item.file === fileName);
		expect(entry).toBeTruthy();
		expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
	});

	it("keeps the Agent Home composer starter patch in agreement with the manifest", async () => {
		// Slice C: the reference empty home lists starter rows under the composer card.
		// Caret already owns that surface - the new-session composer renders prompt
		// options and inserts the chosen prompt - but the base only ever shows them from
		// an onboarding tour behind a Copilot experiment flag, so the Agents window
		// showed none. This patch attaches the controller directly.
		const fileName = "0023-caret-agent-home-composer-starters.patch";
		const patchText = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", fileName), "utf8");
		for (const needle of [
			// The starters are the base's own set, exported instead of copied.
			`export function createStandardPromptOptions(): readonly INewSessionPromptOption[] {`,
			`const standardOptions = createStandardPromptOptions();`,
			// Attached to the composer's real prompt-option API.
			`composer.setPromptOptionsController?.(this._controller);`,
			`composer.refreshPromptOptions?.(CancellationToken.None);`,
			`composerService.activeComposer.read(reader)`,
			`{ kind: 'resolved', options: createStandardPromptOptions() }`,
			// Reference composer sizing and the starter placement below the card.
			`min-height: 104px;`,
			`flex-direction: column;`,
			`order: 2;`,
			`grid-template-columns: var(--vscode-spacing-size160) minmax(0, auto) minmax(0, 1fr);`,
			// Agents window only.
			`IsSessionsWindowContext.getValue(contextKeyService)`,
		]) {
			expect(patchText).toContain(needle);
		}
		// Three new files (the controller, its contribution and its stylesheet) plus the
		// exported starter set and the entry import.
		expect(patchText.match(/^diff --git /gm)?.length).toBe(5);
		expect(patchText).toContain("a/src/vs/sessions/");
		expect(patchText).not.toContain("src/vs/workbench/");

		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		const entry = manifest.patches.find(item => item.file === fileName);
		expect(entry).toBeTruthy();
		expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
	});

	it("keeps the Agent Home context-row patch in agreement with the manifest", async () => {
		// The reference puts a branch chip and a runtime chip beside the workspace
		// picker. Both read real state: the branch is the selected workspace folder's
		// git branch (the same value the base's own session actions read) and the
		// runtime chip only says "This Mac" while no remote agent host is connected.
		const fileName = "0024-caret-agent-home-context-row.patch";
		const patchText = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", fileName), "utf8");
		for (const needle of [
			`session?.workspace.get()?.folders[0]?.gitRepository?.branchName?.trim()`,
			`connectionsService.connections.some(connection => !connection.isAmbient && connection.connection !== undefined)`,
			`const COPY_SESSION_BRANCH_NAME_COMMAND_ID = 'sessionsViewPane.agentHost.copySessionBranchName';`,
			`this.commandService.executeCommand(COPY_SESSION_BRANCH_NAME_COMMAND_ID, session)`,
			// Chips are rebuilt when the composer rebuilds the row, and a guard stops the
			// re-render from feeding itself.
			`const observer = new MutationObserver(`,
			`if (row && !row.querySelector('.caret-agent-home-context-chip')) {`,
			// React owns the chips, like the rest of the Caret-authored Agent Home surfaces; the
			// contribution keeps the model, and the wrapper is `display: contents` so the chips
			// stay flex items of the composer's picker row.
			`export function mountAgentHomeContextRow(`,
			`agentHomeContextRowReact.tsx`,
			`host.style.display = 'contents';`,
			`const wrapper = append(row, $('span.caret-agent-home-context-chips'));`,
			// Agents window only.
			`IsSessionsWindowContext.getValue(contextKeyService)`,
		]) {
			expect(patchText).toContain(needle);
		}
		expect(patchText.match(/^diff --git /gm)?.length).toBe(5);
		expect(patchText).toContain("a/src/vs/sessions/");
		expect(patchText).not.toContain("src/vs/workbench/");

		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		const entry = manifest.patches.find(item => item.file === fileName);
		expect(entry).toBeTruthy();
		expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
	});

	it("keeps the Agents window title bar region placement patch in agreement with the manifest", async () => {
		// The reference keeps session navigation after the sidebar toggle in the left
		// section and "Open in VS Code" before the panel and layout toggles in the right
		// section. The toolbars are mounted into those sections in the sessions titlebar
		// part and ordered in its stylesheet, so both files carry the decision.
		const fileName = "0025-caret-agents-titlebar-regions.patch";
		const patchText = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", fileName), "utf8");
		for (const needle of [
			`append(this.leftContent, $('div.titlebar-actions-container.titlebar-center-nav-container'))`,
			`prepend(this.rightContent, $('div.titlebar-actions-container.titlebar-center-actions-container'))`,
			`.titlebar-left > .titlebar-center-nav-container {`,
			`.titlebar-right > .titlebar-center-actions-container {`,
			`.titlebar-right > .titlebar-session-actions-container {`,
			`.titlebar-right > .titlebar-right-layout-container {`,
			// The sidebar toggle keeps order 1 in the left section so navigation follows it.
			`order: 1;`,
			`order: 2;`,
		]) {
			expect(patchText).toContain(needle);
		}
		// Two files, both under the sessions workbench.
		expect(patchText.match(/^diff --git /gm)?.length).toBe(2);
		expect(patchText).toContain("a/src/vs/sessions/");
		expect(patchText).not.toContain("src/vs/workbench/");

		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		const entry = manifest.patches.find(item => item.file === fileName);
		expect(entry).toBeTruthy();
		expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
	});

	it("keeps the Agents window bottom-panel removal in agreement with the manifest", async () => {
		// The window's terminal is a tab in the Apps panel on the right, so the bottom
		// panel is leftover chrome: cmd+J could still open an empty strip. The patch
		// keeps the part in the layout bookkeeping but makes it impossible to show.
		const fileName = "0026-caret-agents-no-bottom-panel.patch";
		const patchText = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", fileName), "utf8");
		for (const needle of [
			`if (part === Parts.PANEL_PART) {`,
			`private setPanelHidden(hidden: boolean): void {`,
			`// Caret: this window has no bottom panel - the terminal is an Apps panel tab`,
			`this.partVisibility.panel = false;`,
		]) {
			expect(patchText).toContain(needle);
		}
		// One file, inside the sessions workbench: the IDE window keeps its panel.
		expect(patchText.match(/^diff --git /gm)?.length).toBe(1);
		expect(patchText).toContain("a/src/vs/sessions/");
		expect(patchText).not.toContain("src/vs/workbench/");

		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		const entry = manifest.patches.find(item => item.file === fileName);
		expect(entry).toBeTruthy();
		expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
	});

	it("only enables proposed APIs that the pinned product.json allows", async () => {
		// VS Code disables an extension outright when it declares a proposal the
		// product does not allow, so the two declarations are pinned together.
		const manifestPath = join(import.meta.dir, "..", "package.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { enabledApiProposals?: string[] };
		const proposals = manifest.enabledApiProposals ?? [];
		expect(proposals.length).toBeGreaterThan(0);

		const productPath = join(import.meta.dir, "..", "..", "..", "desktop", "product.json");
		if (!existsSync(productPath)) return; // Code-OSS checkout is ignored; skip when absent.
		const product = JSON.parse(readFileSync(productPath, "utf8")) as { extensionEnabledApiProposals?: Record<string, string[]> };
		const allowed = new Set(product.extensionEnabledApiProposals?.["caret.caret"] ?? []);
		for (const proposal of proposals) expect(allowed.has(proposal)).toBe(true);
	});

	it("declares Caret's participant as the window's default agent", async () => {
		// The base refuses every send that has no *default* agent for its location
		// (`sendRequest No default agent for location panel`) before the request can
		// reach any provider, and this fork ships no Copilot participant to be that
		// default. This declaration is therefore what makes the Agents composer able
		// to send at all, so it is pinned here together with the proposal that
		// unlocks it.
		const manifestPath = join(import.meta.dir, "..", "package.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
			enabledApiProposals?: string[];
			contributes: { chatParticipants: { id: string; isDefault?: boolean; modes?: string[] }[] };
		};
		const participant = manifest.contributes.chatParticipants.find(entry => entry.id === "caret.omp");
		expect(participant?.isDefault).toBe(true);
		// The composer decides the mode, so the default agent has to cover every
		// built-in one; otherwise the same send is rejected for its mode instead.
		expect(participant?.modes).toEqual(["ask", "edit", "agent"]);
		expect(manifest.enabledApiProposals).toContain("defaultChatParticipant");
	});

	it("gives a Caret request a model the pickers can resolve", async () => {
		// The extension host resolves a request's model by the identifier the
		// extension registered it under (`<vendor>/<model id>`), so the two
		// workbench projections of the OMP catalogue have to hand back that exact
		// string. The vendor lives in the extension package and in two base patches
		// that cannot import it, so all three are pinned here.
		const manifestPath = join(import.meta.dir, "..", "package.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { enabledApiProposals?: string[] };
		expect(manifest.enabledApiProposals).toContain("chatProvider");
		expect(CARET_OMP_MODEL_VENDOR).toBe("caret-omp");

		const root = join(import.meta.dir, "..", "..", "..");
		for (const fileName of ["0010-caret-sessions-bridge.patch", "0011-caret-sessions-model-picker.patch"]) {
			const patchText = readFileSync(join(root, "patches", "desktop", fileName), "utf8");
			expect(patchText).toContain(`const CARET_OMP_MODEL_VENDOR = '${CARET_OMP_MODEL_VENDOR}';`);
			expect(patchText).toContain("${CARET_OMP_MODEL_VENDOR}/${");
		}
	});

	it("offers Delete only where the Caret host can carry it out", async () => {
		// The sessions list's own `Delete...` item is gated on the session's
		// supportsDelete capability, so the bridge has to advertise it and have a
		// route to the host; the delete itself is the extension's, because it owns
		// the host connection and removes what the host wrote for the session.
		const root = join(import.meta.dir, "..", "..", "..");
		const bridge = readFileSync(join(root, "patches", "desktop", "0010-caret-sessions-bridge.patch"), "utf8");
		for (const needle of [
			"supportsDelete: true,",
			`const CARET_SESSION_DELETE_COMMAND = 'caret.session.delete';`,
			"await this.commandService.executeCommand(CARET_SESSION_DELETE_COMMAND, [...sessionIds]);",
		]) {
			expect(bridge).toContain(needle);
		}

		const extension = readFileSync(join(import.meta.dir, "..", "src", "extension.ts"), "utf8");
		expect(extension).toContain(`vscode.commands.registerCommand("caret.session.delete"`);
		expect(extension).toContain("await client.deleteSession(id);");

		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf8")) as { contributes: { commands: { command: string }[] } };
		expect(manifest.contributes.commands.some(entry => entry.command === "caret.session.delete")).toBe(true);
	});

	it("offers the same Delete in the dock's session menu", async () => {
		// The plan's item 24: delete used to be Agents-window-only, so the dock offered
		// Archive and no Delete even though the host route existed. Both surfaces now go
		// through the same extension path, and the dock's own item confirms first because
		// the host delete removes the record and the transcript it wrote.
		const shell = readFileSync(join(import.meta.dir, "..", "src", "webview.ts"), "utf8");
		expect(shell).toContain(`['Delete', 'delete']`);
		expect(shell).toContain(`else if (kind === 'delete') post({ type: 'delete_session', sessionId: sid });`);

		const messages = readFileSync(join(import.meta.dir, "..", "src", "messages.ts"), "utf8");
		expect(messages).toContain(`{ readonly type: "delete_session"; readonly sessionId?: string }`);
		expect(messages).toContain(`case "delete_session": {`);

		const extension = readFileSync(join(import.meta.dir, "..", "src", "extension.ts"), "utf8");
		expect(extension).toContain(`case "delete_session": {`);
		expect(extension).toContain("This action cannot be undone.");
		expect(extension).toContain("await this.deleteChatSessions([session.id]);");
	});
	it("keeps the Copilot-flavoured composer controls out of the Agents window", async () => {
		// Three plan chrome decisions: the tool picker, the permission picker and the
		// "Configure Custom Agents..." entry all describe Copilot-chat behaviour, and this
		// window runs on OMP. Each is scoped out with the sessions-window context key, so the
		// IDE window keeps it.
		const root = join(import.meta.dir, "..", "..", "..");
		const patchText = readFileSync(join(root, "patches", "desktop", "0033-caret-agents-no-copilot-composer-controls.patch"), "utf8");
		for (const needle of [
			"chatToolActions.ts",
			"chatExecuteActions.ts",
			"chatModeActions.ts",
			"Caret: this configures the base's tool set",
			"Caret: these levels (manual / allow all / autopilot)",
			"Caret: custom agents are a Copilot-chat concept",
		]) {
			expect(patchText).toContain(needle);
		}
		expect(patchText.match(/^\+.*IsSessionsWindowContext\.toNegated\(\)/gm)?.length).toBe(4);
		expect(patchText).not.toContain("src/vs/sessions/");

		const manifest = JSON.parse(readFileSync(join(root, "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		const entry = manifest.patches.find(item => item.file === "0033-caret-agents-no-copilot-composer-controls.patch");
		expect(entry).toBeTruthy();
		expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
	});

	it("does not start the base Agent Host in the Agents window", async () => {
		// The Agent Host utility process hosts the Copilot/Claude/Codex harnesses, and
		// S1 removed that layer; its node-side graph still requires Copilot services
		// that no longer exist (`agentHostCustomizationEnablementService depends on
		// copilotApiService which is NOT registered`), so a process started from the
		// window dies on boot, restarts five times and raises "The Agent Host failed to
		// start". The window must not prewarm it at all.
		const root = join(import.meta.dir, "..", "..", "..");
		const patchText = readFileSync(join(root, "patches", "desktop", "0032-caret-no-base-agent-host.patch"), "utf8");
		for (const needle of [
			"the window does not prewarm the base Agent Host",
			"does not start the agent host while enabled",
			"does not forward assignment context to a host that is never started",
		]) {
			expect(patchText).toContain(needle);
		}
		// The prewarm call itself is removed by the patch (a diff carries the old line),
		// so the source no longer starts the process anywhere.
		expect(patchText).toMatch(/^-\t\tthis\.agentHostService\.startAgentHost\(\);$/m);

		const manifest = JSON.parse(readFileSync(join(root, "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		const entry = manifest.patches.find(item => item.file === "0032-caret-no-base-agent-host.patch");
		expect(entry).toBeTruthy();
		expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
	});

	it("keeps the Caret title when the Agents window has no folder to write into", async () => {
		// The first Agents screen can open with no folder attached, where every
		// workspace-scope write rejects. The window then kept whatever the base
		// had put in the title bar, which reads as an internal Code-OSS window
		// instead of the product. (The shell document whose name used to show up
		// there is retired; the fallback is still the only thing that names a
		// folder-less window.)
		await activateAndSettle(2, true, { fsPath: "/tmp/caret-agents.code-workspace", path: "/tmp/caret-agents.code-workspace" });
		// A rejected workspace write is retried at the global scope, which the
		// stub records separately from workspace-scope values.
		expect(stubState.globalConfig.get("window.title")).toBe("New task — Caret");
		expect(stubState.globalConfig.get("workbench.editor.editorActionsLocation")).toBe("hidden");
		// Colours are not part of that fallback any more: this screen wears the theme
		// the user picked, the same one the IDE window wears.
		expect(stubState.globalConfig.get("workbench.colorCustomizations")).toBeUndefined();
	});

	it("hands the Agents window the theme and the extension that paints it", async () => {
		// The Agents window is a second workbench: it has its own extension enablement, which
		// switches off anything shipping code (every theme with a settings section of its own), and
		// it reads its settings from its own workspace file rather than from the agents profile's
		// settings.json. Without this carry it fell back to the stock theme and the two windows
		// disagreed on colour.
		stubState.config.set("workbench.colorTheme", "Catppuccin Frappé");
		stubState.config.set("workbench.preferredDarkColorTheme", "Catppuccin Mocha");
		stubState.config.set("extensions.supportAgentsWindow", { "someone.else": true });
		await activateAndSettle(2, false, undefined, [
			{ id: "Catppuccin.catppuccin-vsc", packageJSON: { contributes: { themes: [{ label: "Catppuccin Frappé", path: "./themes/frappe.json" }], configuration: {} } } },
			{ id: "someone.unrelated", packageJSON: { contributes: { themes: [{ label: "Unrelated Dark", path: "./dark.json" }] } } },
		]);
		const written = JSON.parse(stubState.files.get(join(tempRoot, "agent-sessions.code-workspace"))!) as { folders: unknown[]; settings: Record<string, unknown> };
		expect(written.settings["workbench.colorTheme"]).toBe("Catppuccin Frappé");
		expect(written.settings["workbench.preferredDarkColorTheme"]).toBe("Catppuccin Mocha");
		// The user's own entry survives, and the theme's provider is added by matching the label
		// the picker shows - Caret does not know the extension's name.
		expect(written.settings["extensions.supportAgentsWindow"]).toEqual({
			"someone.else": true,
			"catppuccin.catppuccin-vsc": true,
		});
		// The window's own defaults travel with the theme: the reference's sidebar has no
		// empty "Chats" group, so this window does not draw one.
		expect(written.settings["sessions.list.showEmptyDefaultGroups"]).toBe(false);
		expect(written.folders).toEqual([]);
		for (const key of ["workbench.colorTheme", "workbench.preferredDarkColorTheme", "extensions.supportAgentsWindow"]) stubState.config.delete(key);
	});

	it("cites the real terminal selection into the task draft", async () => {
		await activateAndSettle();
		resolveViews();
		stubState.activeTerminal = { name: "zsh", selection: "$ bun test\n1 fail\n  TypeError: boom\n" };
		await stubState.commands.get("caret.addTerminalSelectionToTask")!();
		const draft = lastSnapshotDraft();
		expect(draft).toContain("terminal:zsh");
		// The fenced body is the terminal's real selection, verbatim.
		expect(draft).toContain("TypeError: boom");
		expect(prefills().at(-1)).toContain("terminal:zsh");
		expect(stubState.statusMessages.some(message => message.includes("terminal:zsh"))).toBe(true);
	});

	it("refuses a terminal citation without a focused terminal or a selection", async () => {
		await activateAndSettle();
		resolveViews();
		stubState.activeTerminal = undefined;
		await stubState.commands.get("caret.addTerminalSelectionToTask")!();
		expect(stubState.statusMessages.some(message => message.includes("Focus a terminal first"))).toBe(true);
		expect(lastSnapshotDraft()).toBe("");

		stubState.statusMessages.length = 0;
		stubState.activeTerminal = { name: "zsh", selection: "   \n" };
		await stubState.commands.get("caret.addTerminalSelectionToTask")!();
		expect(stubState.statusMessages.some(message => message.includes("Select terminal output first"))).toBe(true);
		// A blank selection must not become an empty fence in the draft.
		expect(lastSnapshotDraft()).toBe("");
	});

	it("offers no code action while there is no real task surface", async () => {
		await activateAndSettle();
		resolveViews();
		const provider = stubState.codeActions.at(-1);
		expect(provider).toBeDefined();
		// No project, client, or session: the lightbulb must stay empty rather
		// than offer a command that would fail on invoke.
		const actions = provider!.provider.provideCodeActions(
			{ uri: stubUri(`file://${sourceFile}`) },
			{ isEmpty: false },
		);
		expect(actions).toEqual([]);
	});

	it("stages an Explain turn for the real selection before dispatch", async () => {
		await activateAndSettle();
		resolveViews();
		openEditor(0, 1);
		// Dispatch needs the host, so the promise rejects; the cited turn must
		// already be in the draft rather than being silently lost.
		await expect(stubState.commands.get("caret.explainSelection")!()).rejects.toBeDefined();
		const draft = lastSnapshotDraft();
		expect(draft).toContain("Explain what this selected code does");
		// The real path and line range, and the unsaved buffer as the body.
		expect(draft).toContain("(src/greet.ts#L1-L2)");
		expect(draft).toContain('return "hi " + name;');
		expect(draft).not.toContain('"hello "');
	});

	it("stages a Fix turn and refuses one without a selection", async () => {
		await activateAndSettle();
		resolveViews();
		openEditor(0, 1);
		await expect(stubState.commands.get("caret.fixSelection")!()).rejects.toBeDefined();
		expect(lastSnapshotDraft()).toContain("Find the defect in this selected code");

		// An empty selection is refused with a reason instead of being sent as a
		// whole-file citation or dropped without a word.
		stubState.statusMessages.length = 0;
		stubState.activeEditor = {
			document: { uri: stubUri(`file://${sourceFile}`), fileName: sourceFile, languageId: "typescript", getText: () => sourceText },
			selection: { isEmpty: true, start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
		};
		await stubState.commands.get("caret.explainSelection")!();
		expect(stubState.statusMessages.some(message => message.includes("Select the code first"))).toBe(true);
	});

	it("marks an edit Caret applied, then keeps it through the real command", async () => {
		await activateAndSettle();
		resolveViews();
		let saved = false;
		const editor = agentEditedEditor(2, diskText, () => { saved = true; });
		stubState.activeEditor = editor;
		vscodeApi.window.visibleTextEditors = [editor];
		stubState.context.length = 0;

		provider().recordAgentEdit(appliedEditSummary);

		// A real decoration type was created and one range was painted on the
		// editor that actually holds the edited buffer.
		expect(stubState.decorationTypes.length).toBeGreaterThan(0);
		expect(stubState.decorations.at(-1)!.ranges.length).toBe(1);
		// The menus learn that an edit is waiting, so the title buttons appear.
		expect(stubState.context.at(-1)).toEqual({ key: "caret.agentEditPending", value: true });
		expect(stubState.statusMessages.some(message => message.includes("changed by Caret"))).toBe(true);

		await stubState.commands.get("caret.keepAgentEdit")!();
		expect(saved).toBe(true);
		// Kept: the mark is gone and the buttons withdraw.
		expect(stubState.decorations.at(-1)!.ranges).toEqual([]);
		expect(stubState.context.at(-1)).toEqual({ key: "caret.agentEditPending", value: false });
	});

	it("takes a Caret edit back while the buffer still holds Caret's version", async () => {
		await activateAndSettle();
		resolveViews();
		let saved = false;
		const editor = agentEditedEditor(2, diskText, () => { saved = true; });
		stubState.activeEditor = editor;
		vscodeApi.window.visibleTextEditors = [editor];
		stubState.context.length = 0;
		provider().recordAgentEdit(appliedEditSummary);

		await stubState.commands.get("caret.revertAgentEdit")!();

		// The buffer is restored to the exact pre-edit text, and nothing was
		// written to disk: taking an edit back is not saving it.
		const applied = stubState.appliedEdits.at(-1) as { replacements?: { text: string }[] } | undefined;
		expect(applied?.replacements?.[0]?.text).toBe(sourceText);
		expect(saved).toBe(false);
		expect(stubState.context.at(-1)).toEqual({ key: "caret.agentEditPending", value: false });
	});

	it("refuses to take a Caret edit back once the buffer moved on", async () => {
		await activateAndSettle();
		resolveViews();
		const editor = agentEditedEditor(2, diskText, () => {});
		stubState.activeEditor = editor;
		vscodeApi.window.visibleTextEditors = [editor];
		provider().recordAgentEdit(appliedEditSummary);
		const before = stubState.appliedEdits.length;

		// Someone edited after Caret, so restoring the old text would take their
		// change with it. Caret declines and names Undo instead.
		editor.document.version = 3;
		await stubState.commands.get("caret.revertAgentEdit")!();

		expect(stubState.appliedEdits.length).toBe(before);
		expect(stubState.statusMessages.some(message => message.includes("Use Undo instead"))).toBe(true);
	});

	it("refuses keep and take-back when this file has no Caret edit waiting", async () => {
		await activateAndSettle();
		resolveViews();
		const editor = agentEditedEditor(1, sourceText, () => {});
		stubState.activeEditor = editor;
		vscodeApi.window.visibleTextEditors = [editor];

		await stubState.commands.get("caret.keepAgentEdit")!();
		expect(stubState.statusMessages.some(message => message.includes("no Caret edit waiting"))).toBe(true);

		stubState.statusMessages.length = 0;
		await stubState.commands.get("caret.revertAgentEdit")!();
		expect(stubState.statusMessages.some(message => message.includes("no Caret edit waiting"))).toBe(true);
	});

	it("opens a native diff of exactly what Caret changed", async () => {
		await activateAndSettle();
		resolveViews();
		const editor = agentEditedEditor(2, diskText, () => {});
		stubState.activeEditor = editor;
		vscodeApi.window.visibleTextEditors = [editor];
		stubState.executed.length = 0;
		provider().recordAgentEdit(appliedEditSummary);

		await stubState.commands.get("caret.reviewAgentEdit")!();

		// A real Code-OSS diff editor, titled so both sides are unambiguous, and
		// the read-only left side is the exact pre-edit text Caret recorded.
		const diff = stubState.executed.at(-1)!;
		expect(diff.id).toBe("vscode.diff");
		expect(String(diff.args[2])).toContain("(before Caret ↔ after Caret)");
		const content = await stubState.contentProviders.get("caret-agent-edit")!.provideTextDocumentContent(diff.args[0]);
		expect(content).toBe(sourceText);
	});

	it("refuses to review a Caret edit once the buffer moved on", async () => {
		await activateAndSettle();
		resolveViews();
		const editor = agentEditedEditor(2, diskText, () => {});
		stubState.activeEditor = editor;
		vscodeApi.window.visibleTextEditors = [editor];
		provider().recordAgentEdit(appliedEditSummary);
		stubState.executed.length = 0;

		// Someone changed the buffer after Caret, so a diff against the pre-edit
		// text would show their change as Caret's. Caret declines.
		editor.document.version = 3;
		await stubState.commands.get("caret.reviewAgentEdit")!();

		expect(stubState.executed.some(entry => entry.id === "vscode.diff")).toBe(false);
		expect(stubState.statusMessages.some(message => message.includes("would also show your own change"))).toBe(true);
	});

	it("refuses to review when this file has no Caret edit waiting", async () => {
		await activateAndSettle();
		resolveViews();
		const editor = agentEditedEditor(1, sourceText, () => {});
		stubState.activeEditor = editor;
		vscodeApi.window.visibleTextEditors = [editor];

		await stubState.commands.get("caret.reviewAgentEdit")!();
		expect(stubState.statusMessages.some(message => message.includes("no Caret edit waiting"))).toBe(true);
	});

	it("offers the two decisions on the change itself as in-editor lenses", async () => {
		await activateAndSettle();
		resolveViews();
		const editor = agentEditedEditor(2, diskText, () => {});
		stubState.activeEditor = editor;
		vscodeApi.window.visibleTextEditors = [editor];
		expect(stubState.codeLenses.length).toBe(1);
		expect(stubState.codeLenses[0]!.selector).toEqual({ scheme: "file" });
		const lensProvider = stubState.codeLenses[0]!.provider;
		// The engine caches lens results until onDidChangeCodeLenses fires, so the
		// provider must expose the event and fire it whenever pending state moves.
		let invalidations = 0;
		expect(typeof lensProvider.onDidChangeCodeLenses).toBe("function");
		lensProvider.onDidChangeCodeLenses!(() => { invalidations += 1; });

		// Nothing pending: no lens is advertised, so the editor never offers a
		// decision that would refuse.
		expect(lensProvider.provideCodeLenses(editor.document)).toEqual([]);

		provider().recordAgentEdit(appliedEditSummary);
		expect(invalidations).toBe(1);
		const lenses = lensProvider.provideCodeLenses(editor.document) as { range: { start: { line: number } }; command: { command: string; title: string } }[];
		expect(lenses.map(lens => lens.command.command)).toEqual(["caret.keepAgentEdit", "caret.revertAgentEdit"]);
		// The summary's edit lands on line 1, so the lenses sit on the change.
		expect(lenses.map(lens => lens.range.start.line)).toEqual([1, 1]);
		// The painted mark is the same changed line, not the edit's reported span.
		const painted = stubState.decorations.at(-1)!.ranges as { range: { start: { line: number } } }[];
		expect(painted.map(options => options.range.start.line)).toEqual([1]);
		// The first offer is reported on the Caret channel, so a real session can
		// prove the engine asked for the lenses even though a lens has no AX node.
		expect(stubState.logLines.filter(line => String(line.message).includes("agent edit lenses offered")).length).toBe(1);
		lensProvider.provideCodeLenses(editor.document);
		expect(stubState.logLines.filter(line => String(line.message).includes("agent edit lenses offered")).length).toBe(1);

		// One vocabulary: the lens titles are the manifest command titles, so a
		// rename cannot leave the editor showing a different name than the menu.
		const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
			contributes: { commands: { command: string; title: string }[] };
		};
		const titles = new Map(manifest.contributes.commands.map(entry => [entry.command, entry.title]));
		for (const lens of lenses) {
			const manifestTitle = titles.get(lens.command.command);
			expect(manifestTitle).toBeDefined();
			expect(lens.command.title).toBe(manifestTitle!);
		}

		// Keeping drops the pending record, so the lenses withdraw with the mark.
		await stubState.commands.get("caret.keepAgentEdit")!();
		expect(invalidations).toBe(2);
		expect(lensProvider.provideCodeLenses(editor.document)).toEqual([]);
	});

	it("keeps every Caret token the Agents window reads on the scale's own value", async () => {
		// The extension cannot write CSS into a workbench window, so the Agents window's stylesheet
		// reads a token with a literal fallback: `var(--caret-height-sm, 24px)`. That counts as
		// parity only while the fallback IS the token's value - otherwise the window keeps rendering
		// a number the parity gate no longer measures. Every such reference is checked here, so a
		// future edit cannot quietly pin the strip to a value the scale has moved past.
		const { CARET_TOKENS } = await import("../src/caret-theme.ts");
		const patchText = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "0021-caret-agent-home-utility.patch"), "utf8");
		const cssSection = patchText.slice(patchText.indexOf("agentHomeUtility.css"));
		const references = [...cssSection.matchAll(/var\(--(caret-[a-z0-9-]+),\s*([^)]+?)\)/g)];
		expect(references.length).toBeGreaterThanOrEqual(4);
		for (const [, token, fallback] of references) {
			expect(`${token} -> ${CARET_TOKENS[token!] ?? "missing from CARET_TOKENS"}`).toBe(`${token} -> ${fallback!.trim()}`);
		}
	});

	it("names the Agents window's add-tab control the way the reference does", () => {
		// The reference's `+` in the Agents window reads "Open new tab menu" (its own aria-label
		// in the glass bundle). The base hardcoded "Add Tab" for both windows, so the patch has
		// to branch on the sessions-window context and keep the base wording for the IDE.
		const fileName = "0027-caret-agents-open-new-tab-menu.patch";
		const patchText = readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", fileName), "utf8");
		expect(patchText).toContain(`localize('caret.openNewTabMenu', "Open new tab menu")`);
		expect(patchText).toContain("IsSessionsWindowContext.getValue(this.contextKeyService)");
		// The IDE branch survives: the base wording is still there for that window.
		expect(patchText).toContain(`localize('addTab', "Add Tab")`);
		// One of the few Caret patches that reaches into src/vs/workbench/**, which is only safe
		// because every decision is guarded by the sessions-window context key.
		expect(patchText).toContain("a/src/vs/workbench/browser/parts/editor/editorTabsControl.ts");

		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string; sha256: string }[] };
		const entry = manifest.patches.find(item => item.file === fileName);
		expect(entry).toBeTruthy();
		expect(createHash("sha256").update(patchText).digest("hex")).toBe(entry!.sha256);
	});

	it("retires no patch by leaving a stale file behind", () => {
		// The Apps-panel browser-visibility fix could not ship as its own later patch:
		// `prepare-desktop.ts` proves "already applied" by reverse-checking each patch,
		// and 0021 CREATES `agentHomeUtilityEditor.ts`, so a later edit to that file
		// makes 0021's own reverse-check fail by construction. The fix lives inside 0021
		// instead, and this pins that the retired patch file is really gone.
		const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "patches", "desktop", "manifest.json"), "utf8")) as { patches: { file: string }[] };
		expect(manifest.patches.map(entry => entry.file)).not.toContain("0027-caret-apps-panel-browser-visible.patch");
	});
});
