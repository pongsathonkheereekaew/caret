import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { CARET_LIGHT_WORKBENCH_COLORS, CARET_WORKBENCH_COLORS } from "../src/caret-theme.ts";
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

async function activateAndSettle(themeKind = 2, rejectWorkspaceWrites = false, workspaceFileUri: any = undefined): Promise<void> {
	resetVscodeStub();
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
		expect(stubState.views.map(view => view.id)).toEqual(["caretComposer", "caretComposerDock"]);
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

	it("paints the workbench with Caret's own chrome, not the engine's teal default", async () => {
		await activateAndSettle();
		const colors = stubState.config.get("workbench.colorCustomizations") as Record<string, string> | undefined;
		expect(colors).toBeTruthy();
		// Anchors read from the reference product's own dark theme.
		expect(colors!["editor.background"]).toBe("#181818");
		expect(colors!["sideBar.background"]).toBe("#141414");
		expect(colors!["button.background"]).toBe("#81A1C1");
		// The engine default this replaces: a near-black editor with lighter,
		// teal-accented chrome. None of it may survive in the palette.
		expect(Object.values(colors!)).not.toContain("#121314");
		expect(Object.values(colors!)).not.toContain("#191A1B");
		expect(Object.values(colors!)).not.toContain("#297AA0");
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

	it("uses the reference's light chrome when the workbench theme is light", async () => {
		// Cursor ships light and dark chrome. Forcing the dark anchors over a
		// light workbench was the parity gap this covers.
		await activateAndSettle(1);
		const colors = stubState.config.get("workbench.colorCustomizations") as Record<string, string> | undefined;
		expect(colors).toBeTruthy();
		expect(colors!["editor.background"]).toBe("#FCFCFC");
		expect(colors!["sideBar.background"]).toBe("#F3F3F3");
		expect(colors!["button.background"]).toBe("#2778C1");
	});

	it("uses the reference's high contrast chrome for a high contrast theme", async () => {
		// VS Code ships high-contrast themes, so this kind is reachable whenever
		// "Increase contrast" is on; previously it got Caret's plain dark chrome.
		await activateAndSettle(3);
		const colors = stubState.config.get("workbench.colorCustomizations") as Record<string, string> | undefined;
		expect(colors).toBeTruthy();
		expect(colors!["editor.background"]).toBe("#0A0A0A");
		expect(colors!["button.background"]).toBe("#434C5E");
		expect(colors!["badge.foreground"]).toBe("#000000");
	});

	it("picks the variant palette by theme name when the kind is shared", async () => {
		// Dark midnight is a dark theme and light colorblind a light one, so the
		// active theme name is the only thing that tells them from the bases.
		stubState.config.set("workbench.colorTheme", "Cursor Dark Midnight");
		await activateAndSettle(2);
		let colors = stubState.config.get("workbench.colorCustomizations") as Record<string, string>;
		expect(colors["editor.background"]).toBe("#1e2127");
		expect(colors["sideBar.background"]).toBe("#191c22");
		stubState.config.set("workbench.colorTheme", "Cursor Light Colorblind (Beta)");
		await activateAndSettle(1);
		colors = stubState.config.get("workbench.colorCustomizations") as Record<string, string>;
		expect(colors["editor.background"]).toBe("#FCFCFC");
		expect(colors["button.background"]).toBe("#1F79C0");
		stubState.config.delete("workbench.colorTheme");
	});

	it("repaints the chrome when the user switches theme kind", async () => {
		await activateAndSettle();
		expect((stubState.config.get("workbench.colorCustomizations") as Record<string, string>)["sideBar.background"]).toBe("#141414");
		fireActiveColorThemeChange(1);
		await new Promise(resolve => setTimeout(resolve, 20));
		expect((stubState.config.get("workbench.colorCustomizations") as Record<string, string>)["sideBar.background"]).toBe("#F3F3F3");
		fireActiveColorThemeChange(2);
		await new Promise(resolve => setTimeout(resolve, 20));
		expect((stubState.config.get("workbench.colorCustomizations") as Record<string, string>)["sideBar.background"]).toBe("#141414");
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

	it("refreshes its own global palette instead of mistaking it for a user choice", async () => {
		// A folderless Agents window can only write colours at global scope. That
		// value is Caret's own footprint, so after the theme kind changes the
		// chrome must still be repainted instead of the write being skipped.
		stubState.globalConfig.set("workbench.colorCustomizations", { ...CARET_WORKBENCH_COLORS });
		await activateAndSettle(1, true);
		expect(stubState.globalConfig.get("workbench.colorCustomizations")).toEqual({ ...CARET_LIGHT_WORKBENCH_COLORS });
		stubState.globalConfig.delete("workbench.colorCustomizations");
	});

	it("themes the folderless Agents window, which is the first screen", async () => {
		// Without the global fallback this window keeps the engine's colours,
		// and no folder is attached on a first run.
		await activateAndSettle(2, true);
		expect(stubState.globalConfig.get("workbench.colorCustomizations")).toEqual({ ...CARET_WORKBENCH_COLORS });
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
			"caret.openTask",
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

	it("keeps the Caret title when the Agents window has no folder to write into", async () => {
		// The first Agents screen can open with no folder attached, where every
		// workspace-scope write rejects. The window then showed the raw shell
		// document name ("window.caret-shell") in its title bar, which reads as
		// an internal Code-OSS file instead of the product.
		await activateAndSettle(2, true, { fsPath: "/tmp/caret-agents.code-workspace", path: "/tmp/caret-agents.code-workspace" });
		// A rejected workspace write is retried at the global scope, which the
		// stub records separately from workspace-scope values.
		expect(stubState.globalConfig.get("window.title")).toBe("New task — Caret");
		expect(stubState.globalConfig.get("workbench.editor.editorActionsLocation")).toBe("hidden");
		// The palette uses the same fallback, so a folderless first screen is
		// not left with the engine's colours either.
		expect(stubState.globalConfig.get("workbench.colorCustomizations")).toBeTruthy();
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
});
