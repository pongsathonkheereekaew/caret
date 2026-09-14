import { mock } from "bun:test";
import { relative } from "node:path";

/*
 * One shared `vscode` stub.
 *
 * `mock.module` is process-wide in Bun, so two test files each registering
 * their own `vscode` mock overwrite each other and the module under test can
 * end up bound to the wrong one. Both behavioral test files therefore install
 * the same superset stub and read the same recordings.
 */

export interface StubDimensions {
	columns: number;
	rows: number;
}

export interface StubPty {
	onDidWrite(listener: (value: string) => void): { dispose(): void };
	onDidClose(listener: (value: number | void) => void): { dispose(): void };
	open(dimensions?: StubDimensions): void;
	close(): void;
	handleInput?(data: string): void;
	setDimensions?(dimensions: StubDimensions): void;
}

export interface StubTerminal {
	readonly name: string;
	readonly options: { name: string; pty: StubPty };
	showCount: number;
	disposed: boolean;
	show(): void;
	open(): void;
	dispose(): void;
}

export interface StubStatusItem {
	text: string;
	tooltip: string;
	command?: string;
	visible: boolean;
}

export interface StubState {
	readonly config: Map<string, unknown>;
	/** Values the user set at the global scope, as `inspect()` would report
	 * them. Used to prove Caret does not overwrite an explicit user choice. */
	readonly globalConfig: Map<string, unknown>;
	readonly commands: Map<string, (...args: any[]) => any>;
	readonly executed: { id: string; args: readonly unknown[] }[];
	readonly context: { key: string; value: unknown }[];
	readonly statusMessages: string[];
	readonly statusItems: StubStatusItem[];
	readonly views: { id: string; provider: { resolveWebviewView(view: unknown): unknown } }[];
	readonly contentProviders: Map<string, { provideTextDocumentContent(uri: unknown): Promise<string> }>;
	readonly posted: unknown[];
	readonly files: Map<string, string>;
	readonly directories: Set<string>;
	readonly terminals: StubTerminal[];
	readonly codeActions: { selector: unknown; provider: { provideCodeActions(document: any, range: any): any }; metadata: unknown }[];
	readonly codeLenses: { selector: unknown; provider: { provideCodeLenses(document: any): any; onDidChangeCodeLenses?(listener: () => void): { dispose(): void } } }[];
	readonly panels: { title: string; webview: { html: string } }[];
	readonly decorationTypes: { options: unknown }[];
	readonly decorations: { type: unknown; ranges: unknown[] }[];
	readonly logLines: { level: string; message: unknown }[];
	readonly appliedEdits: { replacements?: unknown[] }[];
	/** Active ColorThemeKind (1 light, 2 dark, ...). Mutable so a test can
	 * switch theme and drive onDidChangeActiveColorTheme. */
	themeKind: number;
	readonly themeChangeListeners: (() => unknown)[];
	/** When true, workspace-scope updates reject, as VS Code does with no
	 * folder attached. Used to exercise the folderless Agents window. */
	rejectWorkspaceWrites: boolean;
	activeEditor: any;
	activeTerminal: any;
	workspaceRoot: string | undefined;
	readonly documents: Map<string, { text: string; languageId?: string }>;
}

export const stubState: StubState = {
	config: new Map(),
	globalConfig: new Map(),
	commands: new Map(),
	executed: [],
	context: [],
	statusMessages: [],
	statusItems: [],
	views: [],
	contentProviders: new Map(),
	posted: [],
	files: new Map(),
	directories: new Set(),
	terminals: [],
	codeActions: [],
	codeLenses: [],
	panels: [],
	decorationTypes: [],
	decorations: [],
	logLines: [],
	appliedEdits: [],
	themeKind: 2,
	themeChangeListeners: [],
	rejectWorkspaceWrites: false,
	activeEditor: undefined,
	activeTerminal: undefined,
	workspaceRoot: undefined,
	documents: new Map(),
};

/** Clears per-test recordings and the active editor so state cannot leak. */
export function resetVscodeStub(): void {
	stubState.commands.clear();
	stubState.executed.length = 0;
	stubState.context.length = 0;
	stubState.statusMessages.length = 0;
	stubState.statusItems.length = 0;
	stubState.views.length = 0;
	stubState.codeActions.length = 0;
	stubState.codeLenses.length = 0;
	stubState.contentProviders.clear();
	stubState.posted.length = 0;
	stubState.activeEditor = undefined;
	stubState.activeTerminal = undefined;
	stubState.terminals.length = 0;
	stubState.panels.length = 0;
	stubState.decorationTypes.length = 0;
	stubState.decorations.length = 0;
	stubState.logLines.length = 0;
	stubState.appliedEdits.length = 0;
	stubState.themeKind = 2;
	stubState.themeChangeListeners.length = 0;
	stubState.rejectWorkspaceWrites = false;
}

/** Switch the stubbed active theme kind and fire the registered listeners, as
 * VS Code does when the user changes theme. */
export function fireActiveColorThemeChange(kind: number): void {
	stubState.themeKind = kind;
	for (const listener of [...stubState.themeChangeListeners]) listener();
}

export function stubUri(value: string): any {
	const scheme = value.includes(":") ? value.slice(0, value.indexOf(":")) : "file";
	const fsPath = scheme === "file" ? value.replace(/^file:\/\//, "") : "";
	const path = fsPath || value;
	return { scheme, path, fsPath, toString: () => (scheme === "file" ? `file://${fsPath}` : value) };
}

/** `caret-review:` style URIs keep their raw spelling so a parse/toString round
 * trip returns the same document id the native diff asked for. */
const rawUris = new Map<string, string>();

export function createVscodeStub(): unknown {
	const disposable = () => ({ dispose() {} });
	const uriFile = (value: string) => stubUri(`file://${value}`);
	const makeTerminal = (options: { name: string; pty: StubPty }): StubTerminal => {
		const terminal: StubTerminal = {
			name: options.name,
			options,
			showCount: 0,
			disposed: false,
			show() {
				terminal.showCount += 1;
			},
			open() {
				options.pty.open({ columns: 80, rows: 24 });
			},
			dispose() {
				if (terminal.disposed) return;
				terminal.disposed = true;
				options.pty.close();
			},
		};
		stubState.terminals.push(terminal);
		return terminal;
	};

	return {
		version: "1.138.0",
		Uri: {
			file: uriFile,
			parse: (value: string) => {
				const uri = stubUri(value);
				rawUris.set(uri.path, value);
				return uri;
			},
			joinPath: (base: any, ...parts: string[]) => stubUri(`file://${[base?.fsPath, ...parts].join("/")}`),
		},
		EventEmitter: class {
			readonly #listeners = new Set<(value: any) => void>();
			readonly event = (listener: (value: any) => void) => {
				this.#listeners.add(listener);
				return { dispose: () => this.#listeners.delete(listener) };
			};
			fire(value: any): void {
				for (const listener of [...this.#listeners]) listener(value);
			}
			dispose(): void {
				this.#listeners.clear();
			}
		},
		StatusBarAlignment: { Left: 1, Right: 2 },
		ViewColumn: { One: 1, Two: 2, Active: -1 },
		ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
		Range: class {
			readonly isEmpty: boolean;
			constructor(readonly start: any, readonly end: any) {
				this.isEmpty = start.line === end.line && start.character === end.character;
			}
		},
		Position: class {
			constructor(readonly line: number, readonly character: number) {}
		},
		// Code action surface: the extension builds real lightbulb entries, so
		// the stub records them as objects a test can inspect.
		CodeAction: class {
			command: { command: string; title: string } | undefined;
			constructor(readonly title: string, readonly kind?: unknown) {}
		},
		CodeActionKind: { QuickFix: { value: "quickfix" }, Refactor: { value: "refactor" } },
		// In-editor decisions: the extension returns real CodeLens objects, so
		// the stub records the range and command a test can inspect.
		CodeLens: class {
			constructor(readonly range: unknown, readonly command?: unknown) {}
		},
		Selection: class {
			readonly isEmpty: boolean;
			constructor(readonly start: any, readonly end: any) {
				this.isEmpty = start.line === end.line && start.character === end.character;
			}
		},
		WorkspaceEdit: class {
			readonly replacements: { uri: unknown; range: unknown; text: string }[] = [];
			replace(uri: unknown, range: unknown, text: string) { this.replacements.push({ uri, range, text }); }
			insert() {}
			delete() {}
			createFile() {}
			renameFile() {}
		},
		ThemeColor: class {
			constructor(readonly id: string) {}
		},
		TextEdit: { replace: (range: unknown, text: string) => ({ range, text }), insert: () => ({}), delete: () => ({}) },
		workspace: {
			isTrusted: true,
			name: "workspace",
			get rootPath() {
				return stubState.workspaceRoot;
			},
			workspaceFile: undefined,
			get workspaceFolders() {
				return stubState.workspaceRoot ? [{ uri: uriFile(stubState.workspaceRoot), name: "workspace", index: 0 }] : [];
			},
			fs: {
				createDirectory: async (uri: any) => {
					stubState.directories.add(uri.fsPath || uri.path);
				},
				writeFile: async (uri: any, bytes: Uint8Array) => {
					stubState.files.set(uri.fsPath || uri.path, new TextDecoder().decode(bytes));
				},
				readFile: async (uri: any) => new TextEncoder().encode(stubState.files.get(uri.fsPath || uri.path) ?? ""),
				stat: async (uri: any) => {
					const key = uri.fsPath || uri.path;
					if (!stubState.directories.has(key) && !stubState.files.has(key)) throw new Error("ENOENT");
					return { type: 1 };
				},
			},
			getConfiguration: (section?: string) => ({
				get: (key: string, fallback?: unknown) => {
					const full = section ? `${section}.${key}` : key;
					return stubState.config.has(full) ? stubState.config.get(full) : fallback;
				},
				update: async (key: string, value: unknown, scope?: number) => {
					if (scope === 2 && stubState.rejectWorkspaceWrites) {
						throw new Error(`Unable to write to Workspace Settings because no workspace is opened`);
					}
					const full = section ? `${section}.${key}` : key;
					// Global writes belong to the global scope; a workspace write
					// must not be visible as a global user choice.
					if (scope === 1) stubState.globalConfig.set(full, value);
					else stubState.config.set(full, value);
				},
				// The real API always provides inspect(); it is how the
				// extension tells a user's own choice from its own default.
				inspect: (key: string) => {
					const full = section ? `${section}.${key}` : key;
					return {
						key: full,
						defaultValue: undefined,
						globalValue: stubState.globalConfig.get(full),
						workspaceValue: stubState.config.get(full),
						workspaceFolderValue: undefined,
					};
				},
			}),
			asRelativePath: (uri: any) => (stubState.workspaceRoot ? relative(stubState.workspaceRoot, uri?.fsPath ?? "") : uri?.fsPath ?? ""),
			openTextDocument: async (uri: any) => {
				// VS Code returns the document the editor already holds, so an
				// unsaved buffer is what a citation must quote.
				if (stubState.activeEditor && stubState.activeEditor.document.uri.toString() === uri?.toString()) {
					return stubState.activeEditor.document;
				}
				const key = uri?.fsPath;
				const stored = stubState.documents.get(key);
				const text = stored?.text ?? stubState.files.get(key) ?? "";
				return {
					uri,
					fileName: key,
					languageId: stored?.languageId ?? "plaintext",
					version: 1,
					isDirty: false,
					save: async () => true,
					lineCount: text.split("\n").length,
					lineAt: (line: number) => ({ range: { end: { line, character: (text.split("\n")[line] ?? "").length } } }),
					getText: (range?: any) => (range ? text.split("\n").slice(range.start.line, range.end.line + 1).join("\n") : text),
					positionAt: (offset: number) => {
						const before = text.slice(0, offset).split("\n");
						return { line: before.length - 1, character: before.at(-1)?.length ?? 0 };
					},
				};
			},
			registerTextDocumentContentProvider: (scheme: string, provider: any) => {
				stubState.contentProviders.set(scheme, provider);
				return disposable();
			},
			onDidChangeConfiguration: () => disposable(),
			onDidChangeWorkspaceFolders: () => disposable(),
			onDidOpenTextDocument: () => disposable(),
			onDidCloseTextDocument: () => disposable(),
			onDidChangeTextDocument: () => disposable(),
			onDidSaveTextDocument: () => disposable(),
			applyEdit: async (edit: { replacements?: unknown[] }) => {
				stubState.appliedEdits.push(edit ?? {});
				return true;
			},
			textDocuments: [] as unknown[],
			findFiles: async () => [] as unknown[],
			createFileSystemWatcher: () => ({
				onDidChange: () => disposable(),
				onDidCreate: () => disposable(),
				onDidDelete: () => disposable(),
				dispose() {},
			}),
		},
		window: {
			get activeTextEditor() {
				return stubState.activeEditor;
			},
			get activeTerminal() {
				return stubState.activeTerminal;
			},
			visibleTextEditors: [] as unknown[],
			createTerminal: makeTerminal,
			createStatusBarItem: () => {
				const item: StubStatusItem & { show(): void; hide(): void; dispose(): void } = {
					text: "",
					tooltip: "",
					command: "",
					visible: false,
					show() {
						item.visible = true;
					},
					hide() {
						item.visible = false;
					},
					dispose() {},
				};
				stubState.statusItems.push(item);
				return item;
			},
			createTextEditorDecorationType: (options: unknown) => {
				const type = { options, dispose() {} };
				stubState.decorationTypes.push(type);
				return type;
			},
			registerWebviewViewProvider: (id: string, provider: any) => {
				stubState.views.push({ id, provider });
				return disposable();
			},
			registerCustomEditorProvider: () => disposable(),
			createWebviewPanel: (viewType: string, title: string) => {
				const webview = {
					html: "",
					options: {},
					cspSource: "",
					asWebviewUri: (uri: unknown) => uri,
					postMessage: async () => true,
					onDidReceiveMessage: () => disposable(),
				};
				const panel = {
					viewType,
					title,
					webview,
					onDidDispose: () => disposable(),
					reveal() {},
					dispose() {},
				};
				stubState.panels.push({ title, webview });
				return panel;
			},
			onDidChangeActiveTextEditor: () => disposable(),
			onDidChangeVisibleTextEditors: () => disposable(),
			onDidCloseTerminal: () => disposable(),
			onDidOpenTerminal: () => disposable(),
			get activeColorTheme() {
				return { kind: stubState.themeKind };
			},
			onDidChangeActiveColorTheme: (listener: () => unknown) => {
				stubState.themeChangeListeners.push(listener);
				return disposable();
			},
			tabGroups: { close: async () => true, all: [] as unknown[] },
			createOutputChannel: () => ({
				name: "Caret",
				trace: (message: unknown) => { stubState.logLines.push({ level: "trace", message }); },
				debug: (message: unknown) => { stubState.logLines.push({ level: "debug", message }); },
				info: (message: unknown) => { stubState.logLines.push({ level: "info", message }); },
				warn: (message: unknown) => { stubState.logLines.push({ level: "warn", message }); },
				error: (message: unknown) => { stubState.logLines.push({ level: "error", message }); },
				append() {},
				appendLine() {},
				replace() {},
				clear() {},
				show() {},
				hide() {},
				dispose() {},
			}),
			setStatusBarMessage: (value: string) => {
				stubState.statusMessages.push(value);
				return disposable();
			},
			showInformationMessage: async (value: string) => {
				stubState.statusMessages.push(value);
				return undefined;
			},
			showWarningMessage: async () => undefined,
			showErrorMessage: async () => undefined,
			showInputBox: async () => undefined,
			showQuickPick: async () => undefined,
			showSaveDialog: async () => undefined,
			showOpenDialog: async () => undefined,
			showTextDocument: async () => ({ document: {}, selection: {} }),
			withProgress: async (_options: unknown, task: any) => task({ report() {} }, { isCancellationRequested: false }),
		},
		commands: {
			registerCommand: (id: string, handler: (...args: any[]) => any) => {
				stubState.commands.set(id, handler);
				return disposable();
			},
			executeCommand: (id: string, ...args: unknown[]) => {
				if (id === "setContext") stubState.context.push({ key: String(args[0]), value: args[1] });
				stubState.executed.push({ id, args });
				return Promise.resolve(undefined);
			},
			getCommands: async () => [...stubState.commands.keys()],
		},
		env: { appName: "Caret", language: "en" },
		languages: {
			registerCodeActionsProvider: (selector: unknown, provider: { provideCodeActions(document: any, range: any): any }, metadata: unknown) => {
				stubState.codeActions.push({ selector, provider, metadata });
				return disposable();
			},
			registerCodeLensProvider: (selector: unknown, provider: { provideCodeLenses(document: any): any; onDidChangeCodeLenses?(listener: () => void): { dispose(): void } }) => {
				stubState.codeLenses.push({ selector, provider });
				return disposable();
			},
		},
		l10n: { t: (value: string) => value },
	};
}

/** Installs the stub for `vscode` and returns the exact object the module
 * under test will receive, so a test can override one dialog at a time. */
export function installVscodeStub(): any {
	const stub = createVscodeStub();
	mock.module("vscode", () => stub);
	return stub;
}
