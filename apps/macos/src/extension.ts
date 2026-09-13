import { activateRestrictedWorkspace } from "./restricted.ts";
import { showArtifacts } from "./artifacts.ts";
/*
 * Caret's Mac extension boundary.
 *
 * This extension talks to the Caret host over its authenticated HTTP API.  It
 * intentionally has no OMP process launcher: OMP belongs to the host and the
 * host descriptor is the only way this client discovers a running session.
 */

import * as vscode from "vscode";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { CaretHostClient, HostDescriptorError, HostHttpError, HostRequestTimeoutError } from "./api.ts";
import { parseWebviewMessage, type NativeAction, type WebviewMessage } from "./messages.ts";
import { createInitialTaskState, parseCaretUiRequest, reduceTaskState, type LoginProviderOption, type ModelOption, type TaskState } from "./state.ts";
import { createTaskWebviewHtml } from "./webview.ts";
import { CaretEditorService } from "./editor.ts";
import { RPC_COMMAND_TYPES } from "../../../packages/omp-adapter/src/types.ts";
import QRCode from "qrcode";
import { OmpTerminalViews } from "./terminal.ts";
import type { Json, Project, Session } from "../../../packages/protocol/src/index.ts";

const HOST_REQUEST_TIMEOUT_MS = 15_000;
const EVENT_PAGE_LIMIT = 200;
const POLL_INTERVAL_MS = 1_200;

function extensionNonce(): string {
	return randomBytes(18).toString("base64").replace(/[^a-zA-Z0-9]/g, "");
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function asArray<T>(value: unknown, key: string): T[] {
	if (Array.isArray(value)) return value as T[];
	if (value && typeof value === "object" && Array.isArray((value as Record<string, unknown>)[key])) return (value as Record<string, unknown>)[key] as T[];
	return [];
}

function workspacePath(): string | undefined {
	const folder = vscode.workspace.workspaceFolders?.[0];
	return folder?.uri?.fsPath;
}

function descriptorStateDir(context: vscode.ExtensionContext): string {
	const configured = String(vscode.workspace.getConfiguration("caret").get("hostStateDir", "")).trim();
	return resolve(configured || join(homedir(), "Library", "Application Support", "Caret", "host"));
}

function hostSetupMessage(stateDir: string): string {
	return `Caret host is offline. Configure caret.hostNodePath and caret.hostScriptPath, then start the host (state: ${stateDir}).`;
}

class HostSetupRequiredError extends Error {
	readonly code = "host-not-running";
	constructor(message: string) {
		super(message);
		this.name = "HostSetupRequiredError";
	}
}

interface HostProcessOptions {
	readonly extensionPath: string;
	readonly stateDir: string;
	readonly config: vscode.WorkspaceConfiguration;
}

/** Starts only the configured Caret host helper, never OMP itself. */
class ConfiguredHostProcess {
	readonly #extensionPath: string;
	readonly #stateDir: string;
	readonly #config: vscode.WorkspaceConfiguration;
	#child: ChildProcess | undefined;

	constructor(options: HostProcessOptions) {
		this.#extensionPath = options.extensionPath;
		this.#stateDir = options.stateDir;
		this.#config = options.config;
	}

	async start(): Promise<void> {
		const bundledNode = join(this.#extensionPath, "runtime/node/bin/node");
		const bundledScript = join(this.#extensionPath, "runtime/host/cli.js");
		const nodePath = String(this.#config.get("hostNodePath", "")).trim() || (existsSync(bundledNode) ? bundledNode : "");
		const scriptPath = String(this.#config.get("hostScriptPath", "")).trim() || (existsSync(bundledScript) ? bundledScript : "");
		if (!nodePath || !scriptPath) throw new HostSetupRequiredError(hostSetupMessage(this.#stateDir));
		if (this.#child && this.#child.exitCode === null) return;
		let child: ChildProcess;
		try {
			child = spawn(nodePath, [scriptPath, "ensure"], {
				cwd: workspacePath(),
				env: { ...process.env, CARET_STATE_DIR: this.#stateDir },
				stdio: "ignore",
				detached: true,
			});
		} catch (error) {
			throw new HostSetupRequiredError(`Cannot start Caret host helper: ${errorMessage(error)}`);
		}
		this.#child = child;
		child.unref();
	}
}

function cloneStateForWebview(state: TaskState): unknown {
	// State contains only JSON-compatible values by construction. Cloning here
	// prevents a future extension-side mutation from crossing the webview API.
	return JSON.parse(JSON.stringify(state));
}

function normalizeProject(value: unknown): Project | undefined {
	if (!value || typeof value !== "object") return undefined;
	const item = value as Record<string, unknown>;
	if (typeof item.id !== "string" || typeof item.path !== "string") return undefined;
	return item as unknown as Project;
}

function normalizeSession(value: unknown): Session | undefined {
	if (!value || typeof value !== "object") return undefined;
	const item = value as Record<string, unknown>;
	if (typeof item.id !== "string" || typeof item.projectId !== "string" || typeof item.incarnation !== "string") return undefined;
	return item as unknown as Session;
}

function normalizeModels(value: unknown): ModelOption[] {
	if (value && typeof value === "object" && !Array.isArray(value) && "data" in value) {
		return normalizeModels((value as Record<string, unknown>).data);
	}
	const raw = asArray<Record<string, unknown>>(value, "models");
	return raw.flatMap((item): ModelOption[] => {
		const id = typeof item.id === "string" ? item.id : typeof item.modelId === "string" ? item.modelId : undefined;
		if (!id) return [];
		const provider = typeof item.provider === "string" ? item.provider : undefined;
		return [{ ...item, id, provider, label: typeof item.label === "string" ? item.label : provider ? `${provider} / ${id}` : id, available: item.available !== false }];
	});
}

function normalizeLoginProviders(value: unknown): LoginProviderOption[] {
	if (value && typeof value === "object" && !Array.isArray(value) && "data" in value) {
		return normalizeLoginProviders((value as Record<string, unknown>).data);
	}
	const raw = asArray<Record<string, unknown>>(value, "providers");
	return raw.flatMap((item): LoginProviderOption[] => {
		const id = typeof item.id === "string" ? item.id : undefined;
		if (!id) return [];
		return [{
			id,
			name: typeof item.name === "string" ? item.name : id,
			available: item.available !== false,
			authenticated: item.authenticated === true,
		}];
	});
}

function commandId(): string {
	try { return randomUUID(); } catch { return `caret-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
}

/** One host connection and one webview projection per extension instance. */
export class CaretTaskViewProvider {
	readonly #context: vscode.ExtensionContext;
	readonly #stateDir: string;
	readonly #hostTimeoutMs: number;
	readonly #hostProcess: ConfiguredHostProcess;
	#view: vscode.WebviewView | undefined;
	#panel: vscode.WebviewPanel | undefined;
	#client: CaretHostClient | undefined;
	#state: TaskState = createInitialTaskState();
	#pollTimer: ReturnType<typeof setInterval> | undefined;
	#polling = false;
	#navigationEpoch = 0;
	#searchEpoch = 0;
	readonly #editor = new CaretEditorService({ api: vscode, beforeApply: async requestId => {
		if (!requestId || !this.#client || this.#disposed) return false;
		try { return (await this.#client.editorRequestValid(this.#editorId, requestId)).valid; } catch { return false; }
	} });
	readonly #editorId = randomUUID();
	#editorPolling = false;
	readonly #terminals = new OmpTerminalViews(async (sessionId, incarnation, command, payload) => {
		const client = await this.ensureClient();
		const result = await client.sendCommand(sessionId, { commandId: commandId(), incarnation, command, payload });
		if (result.status !== "completed") throw new Error(result.error ?? "Input outcome is unknown; input was not repeated");
	});
	#disposed = false;

	constructor(context: vscode.ExtensionContext) {
		this.#context = context;
		this.#stateDir = descriptorStateDir(context);
		const config = vscode.workspace.getConfiguration("caret");
		const configuredTimeout = Number(config.get("hostRequestTimeoutMs", HOST_REQUEST_TIMEOUT_MS));
		this.#hostTimeoutMs = Number.isSafeInteger(configuredTimeout) && configuredTimeout >= 1_000 && configuredTimeout <= 2_147_483_647 ? configuredTimeout : HOST_REQUEST_TIMEOUT_MS;
		this.#hostProcess = new ConfiguredHostProcess({ stateDir: this.#stateDir, config, extensionPath: context.extensionPath });
	}

	resolveWebviewView(view: vscode.WebviewView): void {
		this.#view = view;
		this.configureWebview(view.webview);
		void this.refresh().catch(error => this.reportError(error));
	}

	private configureWebview(webview: vscode.Webview): void {
		webview.options = {
			enableScripts: true,
			localResourceRoots: [this.#context.extensionUri],
		};
		webview.html = createTaskWebviewHtml(webview, extensionNonce());
		webview.onDidReceiveMessage((value: unknown) => {
			const message = parseWebviewMessage(value);
			if (!message) {
				this.reportError(new Error("Caret ignored an invalid webview message"));
				return;
			}
			void this.handleMessage(message).catch(error => this.reportError(error));
		}, undefined, this.#context.subscriptions);
		this.postSnapshot();
	}

	openAgentsWindow(): void {
		void vscode.commands.executeCommand("workbench.action.closeSidebar");
		void vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
		if (this.#panel) {
			this.#panel.reveal(vscode.ViewColumn.One, false);
			return;
		}
		const panel = vscode.window.createWebviewPanel("caretAgents", "Caret", vscode.ViewColumn.One, {
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [this.#context.extensionUri],
		});
		this.#panel = panel;
		this.configureWebview(panel.webview);
		panel.onDidDispose(() => { if (this.#panel === panel) this.#panel = undefined; }, undefined, this.#context.subscriptions);
	}

	focusComposer(): void {
		this.openAgentsWindow();
		this.post({ type: "focus_composer" });
	}

	refreshNow(): Promise<void> {
		return this.refresh();
	}

	prefill(text: string): void {
		this.post({ type: "prefill", text });
		this.focusComposer();
	}

	private post(message: unknown): void {
		for (const target of [this.#view?.webview, this.#panel?.webview]) {
			if (target) void target.postMessage(message);
		}
	}

	private postSnapshot(): void {
		this.post({ type: "snapshot", state: cloneStateForWebview(this.#state) });
	}

	private setState(action: Parameters<typeof reduceTaskState>[1]): void {
		this.#state = reduceTaskState(this.#state, action);
		this.postSnapshot();
	}

	private reportError(error: unknown): void {
		const message = errorMessage(error);
		const offline = error instanceof HostSetupRequiredError || error instanceof HostDescriptorError || error instanceof TypeError || error instanceof HostRequestTimeoutError || (error instanceof HostHttpError && error.status >= 500);
		this.setState({ type: "connection", status: offline ? "offline" : "unknown", error: message, markUnknown: true });
		this.post({ type: "error", text: message, status: offline ? "offline" : "unknown" });
	}

	private async ensureClient(): Promise<CaretHostClient> {
		if (this.#client) {
			try {
				await this.#client.health();
				if (this.#state.connection !== "connected" && this.#state.connection !== "running") this.setState({ type: "connection", status: "connected" });
				return this.#client;
			} catch { this.#client = undefined; }
		}
		this.setState({ type: "connection", status: "connecting" });
		try {
			this.#client = await CaretHostClient.fromStateDir(this.#stateDir, { timeoutMs: this.#hostTimeoutMs, requirePrivateMode: true });
			await this.#client.health();
		} catch (firstError) {
			this.#client = undefined;
			await this.#hostProcess.start();
			const deadline = Date.now() + 7_000;
			let lastError: unknown = firstError;
			while (Date.now() < deadline) {
				try {
					this.#client = await CaretHostClient.fromStateDir(this.#stateDir, { timeoutMs: this.#hostTimeoutMs, requirePrivateMode: true });
					await this.#client.health();
					break;
				} catch (error) {
					this.#client = undefined;
					lastError = error;
					await new Promise(resolve => setTimeout(resolve, 150));
				}
			}
			if (!this.#client) throw new HostSetupRequiredError(`${hostSetupMessage(this.#stateDir)} ${errorMessage(lastError)}`);
		}
		this.setState({ type: "connection", status: "connected", error: undefined });
		this.startPolling();
		return this.#client;
	}

	private startPolling(): void {
		if (this.#pollTimer) return;
		this.#pollTimer = setInterval(() => { void this.pullEvents(); void this.pollEditor(); }, POLL_INTERVAL_MS);
	}

	private async pollEditor(): Promise<void> {
		if (this.#editorPolling || !this.#client || this.#disposed) return;
		this.#editorPolling = true;
		const client = this.#client;
		try {
			await client.registerEditor(this.#editorId, (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath));
			const requests = await client.editorRequests(this.#editorId);
			for (const request of requests) {
				if (this.#disposed) break;
				const response = await this.#editor.handleRequest(request);
				await client.editorResponse(this.#editorId, response);
			}
		} catch { /* Never repeat delivered edits after a lost response. The host records timeout/unknown. */ }
		finally { this.#editorPolling = false; }
	}

	private async pullEvents(): Promise<void> {
		if (this.#polling || !this.#client || !this.#state.session) return;
		this.#polling = true;
		const sessionId = this.#state.session.id;
		const epoch = this.#navigationEpoch;
		const current = () => epoch === this.#navigationEpoch && this.#state.session?.id === sessionId;
		try {
			const latestValue = await this.#client.getSession(sessionId);
			if (!current()) return;
			const latest = normalizeSession(latestValue);
			if (latest && latest.incarnation !== this.#state.session.incarnation) {
				const projects = this.#state.projects;
				const sessions = this.#state.sessions.map(item => item.id === latest.id ? latest : item);
				this.#state = reduceTaskState(this.#state, { type: "reset", project: this.#state.project, session: latest });
				this.#state = { ...this.#state, projects, sessions };
				this.postSnapshot();
			} else if (latest) {
				this.setState({ type: "session", session: latest });
			}
			const activeSession = this.#state.session;
			if (!activeSession) return;
			const page = await this.#client.getEvents(sessionId, this.#state.cursor, EVENT_PAGE_LIMIT);
			if (!current()) return;
			for (const event of page.events) this.#terminals.ingest(event);
			this.setState({ type: "events", page });
			const commands = await this.#client.getCommands(activeSession.id, { limit: EVENT_PAGE_LIMIT });
			if (!current()) return;
			for (const command of commands) this.setState({ type: "command_result", command });
			const pending = await this.#client.getPendingUi(activeSession.id);
			if (!current()) return;
			const requests = pending.flatMap(item => {
				const parsed = parseCaretUiRequest(item);
				return parsed ? [parsed] : [];
			});
			this.setState({ type: "ui_sync", requests });
			if (page.events.length > 0 || commands.length > 0) this.setState({ type: "connection", status: activeSession.status === "running" ? "running" : "connected", error: undefined });
		} catch (error) {
			if (!current()) return;
			this.#client = undefined;
			this.setState({ type: "connection", status: "offline", error: errorMessage(error), markUnknown: true });
			this.post({ type: "error", text: `Caret host disconnected: ${errorMessage(error)}`, status: "offline" });
		} finally {
			this.#polling = false;
		}
	}

	private async refresh(): Promise<void> {
		const client = await this.ensureClient();
		const projectsValue = await client.listProjects();
		const projects = asArray<unknown>(projectsValue, "projects").map(normalizeProject).filter((value): value is Project => value !== undefined);
		this.setState({ type: "projects", projects });
		let project = this.#state.project;
		const currentWorkspace = workspacePath();
		if (!project && currentWorkspace) project = projects.find(item => item.path === currentWorkspace) ?? null;
		if (!project && projects.length === 1) project = projects[0] ?? null;
		if (project) {
			this.setState({ type: "projects", projects });
			const sameProject = this.#state.project?.id === project.id;
			const sameSession = this.#state.session?.projectId === project.id;
			if (!sameProject || !sameSession) {
				this.#state = reduceTaskState(this.#state, { type: "reset", project, session: sameSession ? this.#state.session : null });
				this.postSnapshot();
			} else if (!this.#state.project) {
				this.#state = { ...this.#state, project };
				this.postSnapshot();
			}
			await this.loadProjectSessions(client, project);
		}
		await this.pullEvents();
		if (this.#state.session) await this.getLoginProviders().catch(() => {});
	}

	private async loadProjectSessions(client: CaretHostClient, project: Project): Promise<void> {
		const sessionsValue = await client.listSessions(project.id);
		const sessions = asArray<unknown>(sessionsValue, "sessions").map(normalizeSession).filter((value): value is Session => value !== undefined);
		this.setState({ type: "sessions", sessions });
		if (this.#state.session && !sessions.some(item => item.id === this.#state.session?.id)) {
			this.setState({ type: "session", session: null });
		}
	}

	private async ensureProject(client: CaretHostClient): Promise<Project> {
		if (this.#state.project) return this.#state.project;
		const path = workspacePath();
		if (!path) throw new Error("Open a folder before starting a Caret task, or choose New task.");
		const projectsValue = await client.listProjects();
		const projects = asArray<unknown>(projectsValue, "projects").map(normalizeProject).filter((value): value is Project => value !== undefined);
		let project = projects.find(item => item.path === path);
		if (!project) project = await client.createProject(path, path.split(/[\\/]/).pop() || undefined);
		this.setState({ type: "projects", projects: projects.some(item => item.id === project!.id) ? projects : [...projects, project] });
		this.#state = reduceTaskState(this.#state, { type: "session", session: null });
		this.#state = { ...this.#state, project };
		this.postSnapshot();
		return project;
	}

	private async ensureSession(client: CaretHostClient): Promise<Session> {
		const project = await this.ensureProject(client);
		if (this.#state.session && this.#state.session.projectId === project.id) {
			const session = normalizeSession(await client.startSession(this.#state.session.id));
			if (!session) throw new Error("Caret host returned an invalid session");
			this.setState({ type: "session", session });
			return session;
		}
		const createdValue = await client.createSession({ projectId: project.id, workspaceMode: "local" });
		const created = normalizeSession(createdValue);
		if (!created) throw new Error("Caret host returned an invalid session");
		const startedValue = await client.startSession(created.id);
		const session = normalizeSession(startedValue) ?? created;
		this.setState({ type: "session", session });
		this.setState({ type: "connection", status: session.status === "running" ? "running" : "connected", error: undefined });
		return session;
	}

	private async sendCommand(command: string, payload: Record<string, Json>): Promise<void> {
		const client = await this.ensureClient();
		const session = await this.ensureSession(client);
		const id = commandId();
		this.setState({ type: "command_created", command: { commandId: id, incarnation: session.incarnation, command, payload } });
		this.setState({ type: "connection", status: "running", error: undefined });
		try {
			const result = await client.sendCommand(session.id, { commandId: id, incarnation: session.incarnation, command, payload });
			this.setState({ type: "command_result", command: result });
			if (result.status === "outcome_unknown") this.setState({ type: "connection", status: "unknown", error: "Command outcome is unknown; inspect command status before retrying." });
			else await this.pullEvents();
		} catch (error) {
			this.setState({ type: "command_status", commandId: id, status: "unknown", error: errorMessage(error) });
			this.setState({ type: "connection", status: "unknown", error: `Command ${id} may have reached the host; it was not replayed.` });
			throw error;
		}
	}

	private async answerUi(token: string, answer: string | boolean | { cancelled: true; timedOut?: boolean }): Promise<void> {
		const client = await this.ensureClient();
		const session = await this.ensureSession(client);
		const id = commandId();
		this.setState({ type: "command_created", command: { commandId: id, incarnation: session.incarnation, command: "ui_response", payload: { token, answer: answer as Json } } });
		try {
			const result = await client.sendUiResponse(session.id, { commandId: id, incarnation: session.incarnation, token, answer });
			if (result) this.setState({ type: "command_result", command: result });
			this.setState({ type: "ui_resolved", token });
		} catch (error) {
			this.setState({ type: "command_status", commandId: id, status: "unknown", error: errorMessage(error) });
			throw error;
		}
	}

	async newTaskFlow(): Promise<void> {
		this.#navigationEpoch++;
		const client = await this.ensureClient();
		let path = workspacePath();
		const picked = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: "Use folder for Caret task" });
		if (!picked?.[0]) return;
		path = picked[0].fsPath;
		if (!path) throw new Error("Choose a folder to create a Caret task.");
		const existingProjects = asArray<Project>(await client.listProjects(), "projects");
		const projectValue = existingProjects.find(project => project.path === path) ?? await client.createProject(path, path.split(/[\\/]/).pop() || undefined);
		const project = normalizeProject(projectValue);
		if (!project) throw new Error("Caret host returned an invalid project");
		const mode = await vscode.window.showQuickPick([{ label: "Local folder", mode: "local" as const, description: "Work in this folder" }, { label: "New worktree", mode: "worktree" as const, description: "Copy the current Git working state into a task branch" }], { title: "Task workspace" });
		if (!mode) return;
		const sessionValue = await client.createSession({ projectId: project.id, workspaceMode: mode.mode });
		const created = normalizeSession(sessionValue);
		if (!created) throw new Error("Caret host returned an invalid session");
		const previousProjects = this.#state.projects;
		this.#state = reduceTaskState(createInitialTaskState(), { type: "session", session: created });
		this.#state = { ...this.#state, project, projects: [...previousProjects.filter(item => item.id !== project.id), project], sessions: [created], connection: "connecting" };
		this.postSnapshot();
		const epoch = this.#navigationEpoch;
		const startedValue = await client.startSession(created.id);
		if (epoch !== this.#navigationEpoch || this.#state.session?.id !== created.id) return;
		this.setState({ type: "session", session: normalizeSession(startedValue) ?? created });
		await this.pullEvents();
	}

	private async selectProject(id: string): Promise<void> {
		this.#navigationEpoch++;
		const project = this.#state.projects.find(item => item.id === id);
		if (!project) return;
		const client = await this.ensureClient();
		const projects = this.#state.projects;
		this.#state = reduceTaskState(this.#state, { type: "reset", project, session: null });
		this.#state = { ...this.#state, projects };
		this.postSnapshot();
		await this.loadProjectSessions(client, project);
	}

	private async selectSession(id: string): Promise<void> {
		this.#navigationEpoch++;
		const sessionSummary = this.#state.sessions.find(item => item.id === id);
		if (!sessionSummary) return;
		const client = await this.ensureClient();
		const sessionValue = await client.getSession(id);
		const session = normalizeSession(sessionValue) ?? sessionSummary;
		const projects = this.#state.projects;
		const sessions = this.#state.sessions;
		this.#state = reduceTaskState(this.#state, { type: "reset", project: this.#state.projects.find(item => item.id === session.projectId) ?? this.#state.project, session });
		this.#state = { ...this.#state, projects, sessions };
		this.postSnapshot();
		await this.pullEvents();
	}

	private async selectModel(modelId: string, provider?: string): Promise<void> {
		const model = this.#state.models.find(item => item.id === modelId);
		const actualProvider = provider ?? model?.provider;
		if (!actualProvider) throw new Error("Model provider is unavailable; refresh the model list first.");
		await this.sendCommand("set_model", { provider: actualProvider, modelId });
		this.setState({ type: "models", models: this.#state.models, selectedModel: modelId });
	}

	private async getModels(): Promise<void> {
		const client = await this.ensureClient();
		const session = await this.ensureSession(client);
		const id = commandId();
		this.setState({ type: "command_created", command: { commandId: id, incarnation: session.incarnation, command: "get_available_models", payload: {} } });
			const result = await client.sendCommand(session.id, { commandId: id, incarnation: session.incarnation, command: "get_available_models", payload: {} });
		this.setState({ type: "command_result", command: result });
		const models = normalizeModels(result.result ?? result.ack);
		this.setState({ type: "models", models, selectedModel: this.#state.selectedModel });
	}

	private async getLoginProviders(): Promise<void> {
		const client = await this.ensureClient();
		const session = await this.ensureSession(client);
		const id = commandId();
		this.setState({ type: "command_created", command: { commandId: id, incarnation: session.incarnation, command: "get_login_providers", payload: {} } });
		const result = await client.sendCommand(session.id, { commandId: id, incarnation: session.incarnation, command: "get_login_providers", payload: {} });
		this.setState({ type: "command_result", command: result });
		this.setState({ type: "login_providers", providers: normalizeLoginProviders(result.result ?? result.ack) });
	}

	private async startLogin(providerId: string): Promise<void> {
		await this.sendCommand("login", { providerId });
		await this.getLoginProviders().catch(() => {});
		await this.pullEvents();
	}

	private async openLoginUrl(url: string): Promise<void> {
		await vscode.env.openExternal(vscode.Uri.parse(url));
	}

	async nativeAction(action: NativeAction): Promise<void> {
		const cwd = this.#state.session?.cwd ?? this.#state.project?.path ?? workspacePath();
		if ((action === "files" || action === "diff") && cwd && workspacePath() !== cwd) {
			await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(cwd), { forceNewWindow: true });
			return;
		}
		switch (action) {
			case "files": await vscode.commands.executeCommand("workbench.view.explorer"); break;
			case "diff": await vscode.commands.executeCommand("workbench.view.scm"); break;
			case "terminal": {
				const terminal = vscode.window.createTerminal({ name: "Caret", cwd }); terminal.show(); break;
			}
			case "settings": await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:caret.caret"); break;
		}
	}

	async pairDevice(): Promise<void> {
		const name = await vscode.window.showInputBox({ title: "Pair an iPhone with this Mac", prompt: "Name this device. It can control Caret tasks until revoked.", value: "My iPhone", ignoreFocusOut: true });
		if (!name?.trim()) return;
		const client = await this.ensureClient();
		const offer = await client.pairDevice(name.trim());
		const code = await QRCode.toDataURL(JSON.stringify(offer), { width: 320, margin: 2 });
		const panel = vscode.window.createWebviewPanel("caretPairing", "Pair iPhone", vscode.ViewColumn.Active, {});
		panel.webview.html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';"><style>body{font-family:system-ui;padding:32px;color:var(--vscode-foreground);background:var(--vscode-editor-background)}img{max-width:100%}p{max-width:40em}</style></head><body><h1>Connect your iPhone</h1><p>Scan this private QR code in Caret on your iPhone. Keep it private: it grants control of this Mac’s Caret tasks.</p><img alt="Private Caret pairing QR code" src="${code}"><p>Revoke access anytime with Caret: Manage Devices. Close this tab after pairing.</p></body></html>`;
	}

	async manageDevices(): Promise<void> {
		const client = await this.ensureClient();
		const devices = (await client.listDevices()).filter(device => device.role !== "owner" && !device.revokedAt);
		const selected = await vscode.window.showQuickPick(devices.map(device => ({ label: device.name, description: "Revoke access", id: device.id })), { title: "Caret devices" });
		if (selected) { await client.revokeDevice(selected.id); void vscode.window.showInformationMessage(`Revoked ${selected.label}`); }
	}

	async ompControls(): Promise<void> {
		const selected = await vscode.window.showQuickPick(RPC_COMMAND_TYPES.map(command => ({ label: command })), { title: "OMP controls", placeHolder: "Run a control on the current OMP session" });
		if (!selected) return;
		const raw = await vscode.window.showInputBox({ title: `OMP: ${selected.label}`, prompt: "JSON parameters for this pinned OMP control", value: "{}", validateInput: value => { try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? null : "Enter a JSON object"; } catch { return "Enter valid JSON"; } } });
		if (raw === undefined) return;
		await this.sendCommand(selected.label, JSON.parse(raw));
	}

	async taskActions(): Promise<void> {
		const session = this.#state.session;
		const action = await vscode.window.showQuickPick(["New task", ...(session ? ["Show interaction terminal", "Artifacts", "Rename task", session.pinned ? "Unpin task" : "Pin task", session.archived ? "Restore task" : "Archive task", ...(session.status === "recovery_required" ? ["Reconcile task"] : [])] : []), "OMP controls", "Open browser", "Pair iPhone", "Manage devices"], { title: "Caret" });
		if (action === "New task") return this.newTaskFlow();
		if (action === "OMP controls") return this.ompControls();
		if (action === "Pair iPhone") return this.pairDevice();
		if (action === "Manage devices") return this.manageDevices();
		if (action === "Open browser") { await vscode.commands.executeCommand("workbench.action.browser.open"); return; }
		if (!session || !action) return;
		if (action === "Show interaction terminal") {
			if (!this.#terminals.show(session.id, session.incarnation)) void vscode.window.showInformationMessage("This task has no interaction terminal yet.");
			return;
		}
		const client = await this.ensureClient();
		if (action === "Artifacts") { await showArtifacts(client, session.id, join(this.#context.globalStorageUri.fsPath, "artifacts")); return; }
		if (action === "Rename task") {
			const title = await vscode.window.showInputBox({ title: "Task name", value: session.title });
			if (title?.trim()) await client.patchSession(session.id, { title: title.trim() });
		} else if (action === "Reconcile task") {
			const confirmed = await vscode.window.showWarningMessage("Previous work may have changed files before the connection was lost. Inspect the workspace before resuming. Caret will not repeat the old command.", { modal: true }, "I inspected the outcome — resume");
			if (confirmed) await client.reconcileSession(session.id);
		} else if (action.includes("pin task") || action === "Pin task") await client.patchSession(session.id, { pinned: !session.pinned });
		else if (action === "Archive task" || action === "Restore task") await client.patchSession(session.id, { archived: !session.archived });
		await this.refresh();
	}

	private async handleMessage(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case "send_prompt": await this.sendCommand("prompt", { message: message.text }); break;
			case "steer": await this.sendCommand("steer", { message: message.text }); break;
			case "follow_up": await this.sendCommand("follow_up", { message: message.text }); break;
			case "stop": {
				if (!this.#client || !this.#state.session) return;
				await this.sendCommand("abort", {});
				this.setState({ type: "connection", status: "connected", error: undefined });
				await this.pullEvents();
				break;
			}
			case "new_task": await this.newTaskFlow(); break;
			case "task_actions": await this.taskActions(); break;
			case "select_project": await this.selectProject(message.projectId); break;
			case "select_session": await this.selectSession(message.sessionId); break;
			case "search": {
				const query = message.query.trim().toLowerCase();
				const searchEpoch = ++this.#searchEpoch;
				const navigationEpoch = this.#navigationEpoch;
				const client = await this.ensureClient();
				const sessions = await client.listSessions(this.#state.project?.id);
				if (searchEpoch !== this.#searchEpoch || navigationEpoch !== this.#navigationEpoch) break;
				this.setState({ type: "sessions", sessions: sessions.filter(item => `${item.title} ${item.id}`.toLowerCase().includes(query)) });
				break;
			}
			case "refresh": await this.refresh(); break;
			case "load_more": {
				if (!this.#client || !this.#state.session || this.#state.cursor <= 0) return;
				// The host cursor is forward-only; replay is requested by the host's
				// event page contract when it exposes older pages in a later revision.
				await this.pullEvents();
				break;
			}
			case "get_models": await this.getModels(); break;
			case "get_login_providers": await this.getLoginProviders(); break;
			case "start_login": await this.startLogin(message.providerId); break;
			case "open_login_url": await this.openLoginUrl(message.url); break;
			case "select_model": await this.selectModel(message.modelId, message.provider); break;
			case "ui_answer": await this.answerUi(message.token, message.answer); break;
			case "ui_cancel": await this.answerUi(message.token, { cancelled: true }); break;
			case "native_action": await this.nativeAction(message.action); break;
			case "rename_session": {
				if (!this.#client || !this.#state.session) return;
				const updated = await this.#client.patchSession(this.#state.session.id, { title: message.title });
				const session = normalizeSession(updated); if (session) this.setState({ type: "session", session });
				break;
			}
			case "archive_session": {
				if (!this.#client || !this.#state.session) return;
				await this.#client.patchSession(this.#state.session.id, { archived: true });
				this.setState({ type: "session", session: null });
				break;
			}
			case "pin_session": {
				if (!this.#client || !this.#state.session) return;
				await this.#client.patchSession(this.#state.session.id, { pinned: message.pinned });
				break;
			}
		}
	}

	dispose(): void {
		this.#disposed = true;
		this.#editor.dispose();
		this.#terminals.dispose();
		if (this.#pollTimer) clearInterval(this.#pollTimer);
		this.#pollTimer = undefined;
		this.#client = undefined;
	}
}

export function activate(context: vscode.ExtensionContext): void {
	if (!vscode.workspace.isTrusted) {
		activateRestrictedWorkspace(vscode, context, () => activate(context));
		return;
	}
	const provider = new CaretTaskViewProvider(context);
	context.subscriptions.push(
		provider,
		vscode.window.registerWebviewViewProvider("caretComposer", provider, { webviewOptions: { retainContextWhenHidden: true } }),
		vscode.commands.registerCommand("caret.openComposer", () => provider.focusComposer()),
		vscode.commands.registerCommand("caret.openTask", () => provider.openAgentsWindow()),
		vscode.commands.registerCommand("caret.newTask", () => provider.newTaskFlow()),
		vscode.commands.registerCommand("caret.refresh", () => provider.refreshNow()),
		vscode.commands.registerCommand("caret.openFiles", () => provider.nativeAction("files")),
		vscode.commands.registerCommand("caret.showDiff", () => provider.nativeAction("diff")),
		vscode.commands.registerCommand("caret.openTerminal", () => provider.nativeAction("terminal")),
		vscode.commands.registerCommand("caret.openSettings", () => vscode.commands.executeCommand("workbench.action.openSettings", "@ext:caret.caret")),
		vscode.commands.registerCommand("caret.searchTasks", () => provider.focusComposer()),
		vscode.commands.registerCommand("caret.pairDevice", () => provider.pairDevice()),
		vscode.commands.registerCommand("caret.manageDevices", () => provider.manageDevices()),
		vscode.commands.registerCommand("caret.ompControls", () => provider.ompControls()),
		vscode.commands.registerCommand("caret.taskActions", () => provider.taskActions()),
	);
	if (vscode.workspace.getConfiguration("caret").get("openTasksOnStartup", true)) provider.openAgentsWindow();
}

export function deactivate(): void { }
