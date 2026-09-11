import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { CaretTabProvider } from './completion';
import { registerEditCommands } from './edit';
import { registerSearchCommands } from './search';
import { TcpDaemonClient } from './tcp-client';
import { PendingQueue } from './queue';

const log = vscode.window.createOutputChannel('Caret');

interface RpcResponse {
	id?: number;
	ok?: boolean;
	result?: unknown;
	error?: string;
	event?: string;
	[key: string]: unknown;
}

class DaemonClient {
	private proc: cp.ChildProcess | null = null;
	private nextId = 1;
	private readonly pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
	private buffer = '';

	constructor(
		private readonly onNotification: (msg: RpcResponse) => void,
		private readonly onExit: (code: string) => void,
	) { }

	start(bunPath: string, serverPath: string, env: NodeJS.ProcessEnv): void {
		this.proc = cp.spawn(bunPath, ['run', serverPath], { env, stdio: ['pipe', 'pipe', 'pipe'] });
		this.proc.stdout?.on('data', (chunk: Buffer) => this.ingest(chunk.toString('utf8')));
		this.proc.stderr?.on('data', (chunk: Buffer) => log.appendLine(`[daemon:stderr] ${chunk.toString('utf8').slice(0, 300)}`));
		this.proc.on('exit', (code) => {
			this.proc = null;
			this.onExit(`exit:${String(code)}`);
			for (const [, waiter] of this.pending) {
				waiter.reject(new Error('daemon exited'));
			}
			this.pending.clear();
		});
	}

	private ingest(text: string): void {
		this.buffer += text;
		let index = this.buffer.indexOf('\n');
		while (index >= 0) {
			const line = this.buffer.slice(0, index).trim();
			this.buffer = this.buffer.slice(index + 1);
			index = this.buffer.indexOf('\n');
			if (!line) {
				continue;
			}
			let msg: RpcResponse;
			try {
				msg = JSON.parse(line) as RpcResponse;
			} catch {
				log.appendLine(`[daemon] non-json: ${line.slice(0, 200)}`);
				continue;
			}
			if (typeof msg.id === 'number' && ('ok' in msg)) {
				const waiter = this.pending.get(msg.id);
				if (!waiter) {
					continue;
				}
				this.pending.delete(msg.id);
				if (msg.ok) {
					waiter.resolve(msg.result);
				} else {
					waiter.reject(new Error(String(msg.error ?? 'unknown daemon error')));
				}
			} else if (msg.event) {
				this.onNotification(msg);
			}
		}
	}

	request(method: string, params: unknown): Promise<unknown> {
		if (!this.proc?.stdin) {
			return Promise.reject(new Error('daemon not running'));
		}
		const id = this.nextId++;
		return new Promise<unknown>((resolve, reject) => {
			this.pending.set(id, { resolve, reject });
			this.proc?.stdin?.write(`${JSON.stringify({ id, method, params })}\n`);
		});
	}

	/** Soft stop: ask the process to exit; rejects every in-flight RPC. */
	stop(): void {
		const waiters = [...this.pending.values()];
		this.pending.clear();
		for (const waiter of waiters) {
			waiter.reject(new Error('daemon stopped'));
		}
		this.proc?.kill();
		this.proc = null;
	}
}

function resolveDaemon(): { bun: string; server: string } {
	const ext = vscode.extensions.getExtension('caret.caret');
	const extensionPath = ext?.extensionPath ?? __dirname;
	const forkRoot = path.resolve(extensionPath, '..', '..');
	const daemonDir = process.env['CARET_DAEMON_DIR']
		?? path.join(forkRoot, '..', 'upstream-synara', 'apps', 'caret-daemon');
	const home = os.homedir();
	const bunCandidates = [
		process.env['CARET_BUN'],
		path.join(home, '.bun', 'bin', 'bun'),
		'bun',
	].filter((candidate): candidate is string => !!candidate);
	const server = path.join(daemonDir, 'src', 'server.ts');
	if (!fs.existsSync(server)) {
		throw new Error(`caret daemon not found at ${server} (set CARET_DAEMON_DIR)`);
	}
	for (const bun of bunCandidates) {
		try {
			if (bun === 'bun' || fs.existsSync(bun)) {
				return { bun, server };
			}
		} catch {
			continue;
		}
	}
	throw new Error('bun runtime not found (install bun 1.4.2 or set CARET_BUN)');
}

function nonce(): string {
	return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

class CaretViewProvider implements vscode.WebviewViewProvider {
	private view: vscode.WebviewView | null = null;
	private daemon: DaemonClient | null = null;
	private pendingPrefill: string | null = null;
	private sessionOn = false;
	private readonly queue = new PendingQueue();
	private sending = false;
	/** Throttle reconnect/warning spam into the status line. */
	private lastWarnAt = 0;
	private lastWarnText = '';

	constructor(private readonly context: vscode.ExtensionContext) { }
	resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		view.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
		};
		view.webview.html = this.html(view.webview);
		view.webview.onDidReceiveMessage((message: { command?: string; [key: string]: unknown }) => {
			void this.onUiMessage(message).catch((error: Error) => this.post({ type: 'error', text: error.message }));
		});
		if (this.pendingPrefill) {
			const text = this.pendingPrefill;
			this.pendingPrefill = null;
			view.webview.postMessage({ type: 'prefill', text });
		}
	}
	prefill(text: string): void {
		this.pendingPrefill = text;
		this.view?.webview.postMessage({ type: 'prefill', text });
		void vscode.commands.executeCommand('caretComposer.focus');
	}

	private post(message: unknown): void {
		this.view?.webview.postMessage(message);
	}

	private tcp: TcpDaemonClient | null = null;
	private endpointBar: vscode.StatusBarItem | null = null;


	private endpoints(): Array<{ name: string; host: string; port: number; token: string }> {
		return this.context.globalState.get<Array<{ name: string; host: string; port: number; token: string }>>('caret.endpoints', []);
	}

	private activeEndpoint(): { name: string; host: string; port: number; token: string } | null {
		const name = this.context.globalState.get<string>('caret.activeEndpoint', '');
		return this.endpoints().find((entry) => entry.name === name) ?? null;
	}

	refreshEndpointStatus(): void {
		if (!this.endpointBar) {
			this.endpointBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
			this.endpointBar.command = 'caret.switchEndpoint';
			this.context.subscriptions.push(this.endpointBar);
		}
		const active = this.activeEndpoint();
		this.endpointBar.text = active ? `$(plug) ${active.name}` : '$(plug) local';
		this.endpointBar.tooltip = 'Switch daemon endpoint (caret.switchEndpoint)';
		this.endpointBar.show();
	}

	/** Switch endpoint (null = local stdio). Sessions live per daemon, so switching resets. */
	async useEndpoint(name: string | null): Promise<void> {
		this.tcp?.close();
		this.tcp = null;
		if (this.daemon) {
			this.daemon.stop();
			this.daemon = null;
		}
		this.sessionOn = false;
		await this.context.globalState.update('caret.activeEndpoint', name ?? '');
		this.refreshEndpointStatus();
		this.post({ type: 'status', text: name ? `endpoint: ${name}` : 'endpoint: local stdio' });
	}

	async addEndpointFlow(): Promise<void> {
		const how = await vscode.window.showQuickPick(['Manual host/port/token', 'Read pairing file'], { placeHolder: 'Add daemon endpoint' });
		if (!how) {
			return;
		}
		let host = '127.0.0.1';
		let port = 0;
		let token = '';
		if (how.startsWith('Read')) {
			const picked = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, filters: { Token: ['token'] } });
			const file = picked?.[0]?.fsPath ?? '';
			if (!file) {
				return;
			}
			try {
				token = fs.readFileSync(file, 'utf8').trim();
			} catch {
				void vscode.window.showWarningMessage('Caret: cannot read pairing file.');
				return;
			}
			const match = /caret-pairing-(\d+)\.token/.exec(file);
			port = match ? Number(match[1]) : 0;
		} else {
			host = await vscode.window.showInputBox({ prompt: 'Daemon host', value: '127.0.0.1' }) ?? '';
			const portText = await vscode.window.showInputBox({ prompt: 'Daemon port' }) ?? '';
			port = Number(portText);
			token = await vscode.window.showInputBox({ prompt: 'Pairing token', password: true }) ?? '';
		}
		if (!host || !port || !token) {
			void vscode.window.showWarningMessage('Caret: host, port, and token are all required.');
			return;
		}
		const name = `${host}:${port}`;
		const kept = this.endpoints().filter((entry) => entry.name !== name);
		kept.push({ name, host, port, token });
		await this.context.globalState.update('caret.endpoints', kept);
		await this.useEndpoint(name);
	}

	async switchEndpointFlow(): Promise<void> {
		const names = ['Local stdio', ...this.endpoints().map((entry) => entry.name)];
		const picked = await vscode.window.showQuickPick(names, { placeHolder: 'Daemon endpoint' });
		if (!picked) {
			return;
		}
		await this.useEndpoint(picked === 'Local stdio' ? null : picked);
		await this.ensureSession().catch((error: Error) => this.post({ type: 'status', text: error.message }));
	}

	private async ensureDaemon(): Promise<{ request(method: string, params: unknown): Promise<unknown> }> {
		const endpoint = this.activeEndpoint();
		if (endpoint) {
			if (!this.tcp) {
				const client = new TcpDaemonClient(
					(msg) => this.onDaemonNotification(msg),
					() => {
						this.tcp = null;
						this.sessionOn = false;
						this.post({ type: 'status', text: 'endpoint closed' });
					},
				);
				await client.connect(endpoint.host, endpoint.port, endpoint.token);
				this.tcp = client;
			}
			return this.tcp;
		}
		if (this.daemon) {
			return this.daemon;
		}
		const { bun, server } = resolveDaemon();
		const client = new DaemonClient(
			(msg) => this.onDaemonNotification(msg),
			(code) => {
				this.daemon = null;
				this.sessionOn = false;
				this.post({ type: 'status', text: `daemon ${code}` });
			},
		);
		client.start(bun, server, {
			...process.env,
			CARET_JOURNAL: path.join(os.tmpdir(), 'caret-daemon-journal.jsonl'),
		});
		log.appendLine(`[caret] daemon: ${bun} run ${server}`);
		this.daemon = client;
		return client;
	}

	private async ensureSession(): Promise<void> {
		if (this.sessionOn) {
			return;
		}
		const folder = vscode.workspace.workspaceFolders?.[0];
		if (!folder) {
			throw new Error('open a folder first — the slice runs against the open workspace');
		}
		const repoDir = folder.uri.fsPath;
		// Isolated runs need a real git checkout (worktree add). Fail loud
		// here so Send never looks like a no-op on an empty /tmp folder.
		try {
			cp.execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
				cwd: repoDir,
				encoding: 'utf8',
				timeout: 3000,
			});
		} catch {
			throw new Error(`folder is not a git repo — run: git -C ${repoDir} init && git -C ${repoDir} commit --allow-empty -m init`);
		}
		this.post({ type: 'status', text: 'starting session… (Codex may take a few seconds)' });
		const daemon = await this.ensureDaemon();
		const started = await daemon.request('session.start', {
			repoDir,
			runId: `ui-${Date.now()}`,
		}) as { threadId?: string };
		this.sessionOn = true;
		this.post({ type: 'status', text: `session live (${String(started.threadId ?? '').slice(0, 18)}…)` });
		await this.refreshSessions();
	}

	private async refreshSessions(query = ''): Promise<void> {
		try {
			const daemon = await this.ensureDaemon();
			const listed = await daemon.request('session.list', { query }) as Array<{
				threadId?: string;
				title?: string;
				goal?: string;
				live?: boolean;
				current?: boolean;
				pinned?: boolean;
			}>;
			this.post({ type: 'sessions', items: Array.isArray(listed) ? listed : [] });
		} catch {
			this.post({ type: 'sessions', items: [] });
		}
	}

	private onDaemonNotification(msg: RpcResponse): void {
		if (msg.event === 'approval.requested') {
			this.post({
				type: 'approval',
				requestId: String(msg.requestId ?? ''),
				requestType: String(msg.requestType ?? 'unknown'),
				detail: String(msg.detail ?? '').slice(0, 500),
			});
		}
		if (msg.event === 'engine') {
			const label = String(msg.type ?? 'event');
			if (/unmapped|rateLimits|settingsUpdated|stateChanged/i.test(label)) {
				return;
			}
			let detail = String(msg.detail ?? '');
			if (detail.startsWith('{') || detail.startsWith('(')) {
				detail = '';
			}
			const kind = String(msg.kind ?? 'info');
			const warn =
				kind === 'warn' ||
				/warning|reconnect/i.test(label) ||
				/reconnecting|waiting for network/i.test(detail);
			const fail = kind === 'failed' || /error/i.test(label);
			this.post({
				type: 'tool',
				kind: warn ? 'warn' : kind,
				label,
				detail,
			});
			if (warn || fail) {
				const text = detail || label;
				const now = Date.now();
				if (text !== this.lastWarnText || now - this.lastWarnAt > 3000) {
					this.lastWarnAt = now;
					this.lastWarnText = text;
					this.post({ type: 'status', text: fail ? `engine error — ${text}` : `engine warning — ${text}` });
				}
			}
		}
		if (msg.event === 'plan') {
			this.post({
				type: 'plan',
				title: String(msg.title ?? ''),
				tasks: Array.isArray(msg.tasks) ? msg.tasks : [],
			});
		}
		if (msg.event === 'index.progress') {
			this.post({ type: 'indexStatus', status: msg.status ?? {} });
		}
	}

	private postQueue(): void {
		this.post({ type: 'queue', items: this.queue.list() });
	}

	private async refreshArtifacts(): Promise<void> {
		const daemon = this.daemon ?? this.tcp;
		if (!daemon || !this.sessionOn) {
			this.post({ type: 'artifacts', runId: '', revision: '', items: [] });
			return;
		}
		const listed = await daemon.request('run.artifacts', {}) as {
			runId?: string;
			revision?: string;
			items?: unknown[];
		};
		this.post({
			type: 'artifacts',
			runId: String(listed.runId ?? ''),
			revision: String(listed.revision ?? ''),
			items: Array.isArray(listed.items) ? listed.items : [],
		});
	}

	/**
	 * Prefer turn.cancel (unblocks hung turn.send) then session.stop.
	 * Kill the local stdio daemon only if both stall — e.g. Codex reconnect
	 * with no interrupt response.
	 */
	private async softStop(
		daemon: { request(method: string, params: unknown): Promise<unknown> },
	): Promise<void> {
		try {
			await Promise.race([
				daemon.request('turn.cancel', {}),
				new Promise((_, reject) => setTimeout(() => reject(new Error('cancel timeout')), 800)),
			]).catch(() => undefined);
			await Promise.race([
				daemon.request('session.stop', {}),
				new Promise((_, reject) => setTimeout(() => reject(new Error('stop timeout')), 1500)),
			]);
		} catch {
			this.killLocalDaemon();
		}
	}

	/**
	 * Kill the local stdio daemon hard. Fallback when softStop cannot
	 * interrupt a wedged engine / dead child.
	 */
	private killLocalDaemon(): void {
		this.sending = false;
		this.sessionOn = false;
		this.queue.clear();
		this.postQueue();
		if (this.daemon) {
			this.daemon.stop();
			this.daemon = null;
		}
		this.tcp?.close();
		this.tcp = null;
	}

	/** Run one turn, then drain FIFO queue. A failed turn keeps the
	 *  remainder queued (operator resumes with Send); Stop clears. */
	private async runTurn(first: string): Promise<void> {
		const daemon = await this.ensureDaemon();
		await this.ensureSession();
		let text: string | null = first;
		this.sending = true;
		let aborted = false;
		try {
			while (text !== null) {
				this.post({ type: 'user', text });
				this.post({ type: 'status', text: 'turn running…' });
				try {
					const t0 = Date.now();
					const done = await daemon.request('turn.send', { input: text }) as { state?: string };
					this.post({ type: 'turn', state: String(done.state ?? 'completed'), ms: Date.now() - t0 });
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					if (/turn cancelled/i.test(message)) {
						this.queue.clear();
						this.postQueue();
						this.post({ type: 'status', text: 'turn cancelled' });
						aborted = true;
					} else {
						this.post({ type: 'status', text: `turn failed — queue held: ${message}` });
						aborted = true;
					}
					break;
				}
				text = this.queue.takeNext();
				this.postQueue();
			}
		} finally {
			this.sending = false;
		}
		if (!aborted && this.queue.size === 0) {
			this.post({ type: 'status', text: 'turn done — Review or Reject' });
			await this.refreshArtifacts().catch(() => undefined);
		}
	}

	private async onUiMessage(message: { command?: string; [key: string]: unknown }): Promise<void> {
		const daemon = await this.ensureDaemon();
		switch (message.command) {
			case 'send': {
				const text = String(message.text ?? '').trim();
				if (!text) {
					return;
				}
				if (this.sending) {
					try {
						const at = this.queue.enqueue(text);
						this.post({ type: 'status', text: `queued #${at} (turn running)` });
						this.postQueue();
					} catch (error) {
						this.post({ type: 'status', text: error instanceof Error ? error.message : String(error) });
					}
					return;
				}
				await this.runTurn(text);
				break;
			}
			case 'dequeue': {
				const index = Number(message.index ?? -1);
				try {
					const dropped = this.queue.removeAt(index);
					this.post({ type: 'status', text: `dropped queued #${index + 1}: ${dropped.slice(0, 60)}` });
					this.postQueue();
				} catch (error) {
					this.post({ type: 'status', text: error instanceof Error ? error.message : String(error) });
				}
				break;
			}
			case 'queueMove': {
				try {
					this.queue.move(Number(message.from), Number(message.to));
					this.postQueue();
				} catch (error) {
					this.post({ type: 'status', text: error instanceof Error ? error.message : String(error) });
				}
				break;
			}
			case 'queueEdit': {
				const index = Number(message.index ?? -1);
				const current = this.queue.list()[index];
				const next = await vscode.window.showInputBox({ prompt: 'Edit queued prompt', value: current ?? '' });
				if (next === undefined) {
					break;
				}
				try {
					this.queue.replace(index, next);
					this.postQueue();
				} catch (error) {
					this.post({ type: 'status', text: error instanceof Error ? error.message : String(error) });
				}
				break;
			}
			case 'sessions': {
				await this.refreshSessions(String(message.text ?? ''));
				break;
			}
			case 'sessionSelect': {
				const id = String(message.session ?? '');
				const selected = await daemon.request('session.select', { session: id }) as { live?: boolean };
				this.sessionOn = Boolean(selected.live);
				this.post({ type: 'status', text: selected.live ? `switched to ${id.slice(0, 24)}…` : `selected stopped session ${id.slice(0, 18)}… — New to run` });
				await this.refreshSessions();
				try {
					const plan = await daemon.request('plan.get', {}) as { title?: string; tasks?: unknown };
					this.post({ type: 'plan', title: String(plan.title ?? ''), tasks: Array.isArray(plan.tasks) ? plan.tasks : [] });
				} catch {
					this.post({ type: 'plan', title: '', tasks: [] });
				}
				break;
			}
			case 'sessionRename': {
				const title = await vscode.window.showInputBox({ prompt: 'Rename session', value: String(message.title ?? '') });
				if (!title) {
					break;
				}
				await daemon.request('session.rename', { title, session: String(message.session ?? '') });
				await this.refreshSessions();
				break;
			}
			case 'sessionPin': {
				await daemon.request('session.pin', { pinned: message.pinned !== false, session: String(message.session ?? '') });
				await this.refreshSessions();
				break;
			}
			case 'sessionArchive': {
				await daemon.request('session.archive', { archived: true, session: String(message.session ?? '') });
				await this.refreshSessions();
				break;
			}
			case 'sessionForget': {
				try {
					await daemon.request('session.forget', { session: String(message.session ?? '') });
					await this.refreshSessions();
				} catch (error) {
					this.post({ type: 'status', text: error instanceof Error ? error.message : String(error) });
				}
				break;
			}
			case 'stop': {
				const n = this.queue.clear();
				this.postQueue();
				await this.softStop(daemon);
				this.sessionOn = false;
				this.sending = false;
				this.post({ type: 'reset' });
				this.post({ type: 'status', text: n > 0 ? `stopped, dropped ${n} queued` : 'stopped' });
				await this.refreshSessions();
				break;
			}
			case 'answer': {
				await daemon.request('approval.answer', {
					requestId: String(message.requestId ?? ''),
					answer: message.answer === 'accept' ? 'accept' : 'decline',
				});
				this.post({ type: 'status', text: `approval ${String(message.answer)} sent` });
				break;
			}
			case 'review': {
				const reviewed = await daemon.request('run.review', {}) as { diff?: string };
				const doc = await vscode.workspace.openTextDocument({
					content: String(reviewed.diff ?? '(empty diff)'),
					language: 'diff',
				});
				await vscode.window.showTextDocument(doc, { preview: true });
				break;
			}
			case 'reject': {
				try {
					const rejected = await daemon.request('run.reject', {}) as { reversed?: boolean };
					if (rejected.reversed) {
						this.post({ type: 'status', text: 'run changes reversed in the isolated worktree' });
					} else {
						this.post({
							type: 'status',
							text: 'nothing to reverse on this session — Reject before New; main-folder files stay until Bring Back/delete',
						});
					}
				} catch (error) {
					this.post({ type: 'status', text: `reject failed: ${error instanceof Error ? error.message : String(error)}` });
				}
				break;
			}
			case 'bringBack': {
				const brought = await daemon.request('run.bringBack', {}) as { brought?: boolean };
				this.post({ type: 'status', text: brought.brought ? 'brought back onto the main checkout' : 'bring-back refused — resolve conflicts first' });
				break;
			}
			case 'new': {
				this.post({ type: 'status', text: 'starting new session…' });
				this.post({ type: 'reset' });
				await this.softStop(daemon);
				this.sessionOn = false;
				this.sending = false;
				this.queue.clear();
				this.postQueue();
				try {
					await this.ensureSession();
					this.post({ type: 'status', text: 'new session ready — type a goal and Send' });
				} catch (error) {
					this.post({ type: 'status', text: error instanceof Error ? error.message : String(error) });
				}
				break;
			}
			case 'runs': {
				await this.listRuns();
				break;
			}
			case 'steer': {
				const input = await vscode.window.showInputBox({ prompt: 'Steer the live turn' });
				if (!input) {
					break;
				}
				await daemon.request('turn.steer', { input });
				this.post({ type: 'status', text: 'steer sent — lands at the next turn boundary' });
				break;
			}
			case 'export': {
				const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: 'Export run here' });
				if (!picked || picked.length === 0) {
					break;
				}
				await this.ensureSession();
				const done = await daemon.request('run.export', { dir: picked[0].fsPath }) as { path?: string; files?: number; events?: number };
				this.post({ type: 'status', text: `exported ${String(done.files ?? 0)} files, ${String(done.events ?? 0)} events → ${String(done.path ?? '')}` });
				break;
			}
			case 'artifacts': {
				await this.ensureSession();
				await this.refreshArtifacts();
				break;
			}
			case 'openArtifact': {
				const abs = String(message.absPath ?? '');
				const kind = String(message.kind ?? 'file');
				if (!abs) {
					break;
				}
				const uri = vscode.Uri.file(abs);
				if (kind === 'image' || kind === 'video') {
					await vscode.commands.executeCommand('vscode.open', uri);
				} else {
					await vscode.window.showTextDocument(uri, { preview: true });
				}
				this.post({ type: 'status', text: `opened ${kind} ${abs.split('/').pop() ?? abs}` });
				break;
			}
			case 'docsFetch': {
				const url = String(message.url ?? '').trim();
				if (!url) {
					this.post({ type: 'status', text: 'docs URL required — Caret has no @Docs index (unverified vs Cursor)' });
					break;
				}
				const done = await daemon.request('docs.fetch', { url }) as {
					url?: string;
					cached?: boolean;
					bytes?: number;
					truncated?: boolean;
					fetchedAt?: string;
				};
				this.post({
					type: 'status',
					text: `${done.cached ? 'cached' : 'fetched'} ${String(done.bytes ?? 0)}B${done.truncated ? ' truncated' : ''} ${String(done.url ?? url)}`,
				});
				const listed = await daemon.request('docs.list', {}) as { items?: unknown[] };
				this.post({ type: 'docs', items: Array.isArray(listed.items) ? listed.items : [] });
				break;
			}
			case 'docsList': {
				const listed = await daemon.request('docs.list', {}) as { items?: unknown[] };
				this.post({ type: 'docs', items: Array.isArray(listed.items) ? listed.items : [] });
				break;
			}
			case 'docsRefresh': {
				const url = String(message.url ?? '').trim();
				await daemon.request('docs.refresh', { url });
				const listed = await daemon.request('docs.list', {}) as { items?: unknown[] };
				this.post({ type: 'docs', items: Array.isArray(listed.items) ? listed.items : [] });
				this.post({ type: 'status', text: `refreshed ${url}` });
				break;
			}
			case 'docsOpen': {
				const url = String(message.url ?? '').trim();
				const rec = await daemon.request('docs.get', { url }) as { text?: string; stale?: boolean };
				const doc = await vscode.workspace.openTextDocument({
					content: `<!-- ${url}${rec.stale ? ' stale' : ''} -->\n${String(rec.text ?? '')}`,
					language: 'markdown',
				});
				await vscode.window.showTextDocument(doc, { preview: true });
				break;
			}
			case 'find': {
				const query = String(message.text ?? '').trim();
				const type = String(message.filter ?? '').trim();
				if (type === 'semantic') {
					try {
						const found = await daemon.request('code.search', { query, limit: 10 }) as {
							hits?: Array<{ id?: string; snippet?: string; score?: number }>;
						};
						this.post({
							type: 'searchHits',
							query,
							hits: (found.hits ?? []).map((hit) => ({
								type: 'code',
								snippet: `${String(hit.id ?? '')} — ${String(hit.snippet ?? '')}`,
							})),
						});
					} catch (error) {
						this.post({ type: 'status', text: error instanceof Error ? error.message : String(error) });
						this.post({ type: 'searchHits', query, hits: [] });
					}
					break;
				}
				const found = await daemon.request('chat.search', {
					query,
					limit: 20,
					...(type ? { types: [type] } : {}),
				}) as { hits?: Array<{ t?: string; type?: string; snippet?: string; score?: number }> };
				this.post({ type: 'searchHits', query, hits: found.hits ?? [] });
				break;
			}
			case 'indexStatus': {
				const status = await daemon.request('index.status', {});
				this.post({ type: 'indexStatus', status });
				break;
			}
			case 'indexRebuild': {
				const started = await daemon.request('index.rebuild', {});
				this.post({ type: 'indexStatus', status: (started as { status?: unknown }).status ?? {} });
				break;
			}
			case 'indexPause': {
				const status = await daemon.request('index.pause', {});
				this.post({ type: 'indexStatus', status });
				break;
			}
			case 'indexResume': {
				const started = await daemon.request('index.resume', {});
				this.post({ type: 'indexStatus', status: (started as { status?: unknown }).status ?? {} });
				break;
			}
		}
	}

	/** Picker over Caret-owned isolated runs (M4 tail). Lists the open
	 *  repo's runs; Remove is guarded daemon-side (dirty/main/foreign/live
	 *  refuse). Review/bring-back stay on the live session in the composer. */
	async listRuns(): Promise<void> {
		const daemon = await this.ensureDaemon();
		await this.ensureSession();
		const listed = await daemon.request('run.list', {}) as { runs?: string[] };
		const runs = listed.runs ?? [];
		if (runs.length === 0) {
			this.post({ type: 'status', text: 'no isolated runs for this folder' });
			return;
		}
		const picked = await vscode.window.showQuickPick(
			runs.map((dir) => ({ label: String(dir.split('/').pop()), description: dir, dir })),
			{ placeHolder: 'Caret isolated runs — pick one to remove' },
		);
		if (!picked) {
			return;
		}
		const confirm = await vscode.window.showWarningMessage(
			`Remove isolated run ${picked.label}? Clean runs only; dirty ones refuse.`,
			{ modal: true },
			'Remove',
		);
		if (confirm !== 'Remove') {
			return;
		}
		try {
			const done = await daemon.request('run.remove', { worktreeDir: picked.dir }) as { removed?: boolean };
			this.post({ type: 'status', text: done.removed ? `removed ${picked.label}` : `${picked.label} has unreviewed changes — Review or Reject first` });
		} catch (error) {
			this.post({ type: 'status', text: `remove refused: ${error instanceof Error ? error.message : String(error)}` });
		}
	}

	private html(webview: vscode.Webview): string {
		const scriptNonce = nonce();
		const styleNonce = nonce();
		return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${styleNonce}'; script-src 'nonce-${scriptNonce}';">
<style nonce="${styleNonce}">
body { font-family: var(--vscode-font-family); padding: 10px; }
:root {
	/* Caret agent tokens (blueprint §13 roles; Synara token NAMESPACE
	 * studied, not imported — engine + Codex-styled skins stay theirs).
	 * Values resolve from the active VS Code theme TODAY (real, adaptive);
	 * frozen Cursor-3.19 measurements replace them when reference lands. */
	--agent-sidebar-width: 256px;
	--agent-font-ui: 13px;
	--agent-font-meta: 11px;
	--agent-sidebar-width: 208px;
	--agent-composer-min-height: 110px;
	--agent-radius-control: 4px;
	--agent-radius-card: 8px;
	--agent-radius-composer: 10px;
	--agent-transition-fast: 120ms;
	--agent-transition-pane: 180ms;
	--agent-surface-base: var(--vscode-editor-background);
	--agent-surface-raised: var(--vscode-sideBar-background);
	--agent-surface-hover: var(--vscode-list-hoverBackground);
	--agent-surface-selected: var(--vscode-list-activeSelectionBackground);
	--agent-border-subtle: var(--vscode-panel-border);
	--agent-border-strong: var(--vscode-focusBorder);
	--agent-text-primary: var(--vscode-editor-foreground);
	--agent-text-secondary: var(--vscode-descriptionForeground);
	--agent-text-disabled: var(--vscode-disabledForeground);
	--agent-focus-ring: var(--vscode-focusBorder);
	--agent-success: var(--vscode-testing-iconPassed);
	--agent-warning: var(--vscode-editorWarning-foreground);
	--agent-error: var(--vscode-editorError-foreground);
	--agent-info: var(--vscode-editorInfo-foreground);
	--agent-diff-added: var(--vscode-diffEditor-insertedTextBackground);
	--agent-diff-removed: var(--vscode-diffEditor-removedTextBackground);
}
#transcript { margin: 8px 0; font-size: 12px; }
#transcript.compact-done .tool-done { display: none; }
.msg { border: 1px solid var(--agent-border-subtle); border-radius: var(--agent-radius-card); padding: 6px 8px; margin: 6px 0; white-space: pre-wrap; }
.tool { font-size: var(--agent-font-meta); color: var(--agent-text-secondary); }
.tool-failed { border-color: var(--agent-error); color: var(--agent-text-primary); }
.tool-warn { border-color: var(--agent-warning); color: var(--agent-text-primary); }
.tool-done { color: var(--agent-text-disabled); }
.user { background: var(--vscode-textBlockQuote-background); }
.approval { border-color: var(--agent-warning); }
.approval .detail { color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family); font-size: 11px; }
.row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; align-items: center; }
button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; padding: 5px 12px; cursor: pointer; }
button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
#prompt { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: var(--agent-radius-composer); padding: 6px; font-family: inherit; font-size: var(--agent-font-ui); min-height: var(--agent-composer-min-height); }
#status { color: var(--agent-text-secondary); font-size: var(--agent-font-meta); min-height: 16px; }
#find { flex: 1; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: var(--agent-radius-control); padding: 4px 8px; font-family: inherit; font-size: var(--agent-font-meta); }
#findHits { margin: 4px 0 8px; font-size: var(--agent-font-meta); }
.find-hit { border: 1px solid var(--agent-border-subtle); border-radius: var(--agent-radius-control); padding: 4px 8px; margin: 4px 0; cursor: pointer; color: var(--agent-text-secondary); }
.find-hit:hover { background: var(--agent-surface-hover); }
.msg.jump-target { border-color: var(--agent-border-strong); }
#sessions, #todos, #queue, #artifacts, #docs { margin: 6px 0; }
.session.current { border-color: var(--agent-border-strong); }
.todo-done { color: var(--agent-text-disabled); text-decoration: line-through; }
.tiny { font-size: 11px; padding: 2px 8px; }

</style>
</head>
<body>
<div id="status">Caret ready — open a folder, type a goal, Send.</div>
<div class="row">
<input id="find" type="search" placeholder="Search this chat" />
<select id="findType">
<option value="">all types</option>
<option value="turn.completed">turns</option>
<option value="request.resolved">approvals</option>
<option value="semantic">files (semantic)</option>
</select>
<button id="findGo" class="secondary">Find</button>
</div>
<div id="findHits"></div>
<div class="row">
<textarea id="prompt" rows="3" placeholder="Goal for the agent, e.g. create hello.txt with hello"></textarea>
</div>
<div class="row">
<button id="send">Send</button>
<button id="stop" class="secondary">Stop</button>
<button id="compact" class="secondary">Compact</button>
<button id="review" class="secondary">Review</button>
<button id="reject" class="secondary">Reject</button>
<button id="bringBack">Bring Back</button>
<button id="new" class="secondary">New</button>
<button id="runs" class="secondary">Runs…</button>
<button id="steer" class="secondary">Steer…</button>
<button id="export" class="secondary">Export…</button>
<button id="artifactsGo" class="secondary">Artifacts</button>
</div>
<div class="row">
<input id="sessionFilter" type="search" placeholder="Filter sessions" />
<button id="sessionsGo" class="secondary">Sessions</button>
</div>
<div id="sessions"></div>
<div id="artifacts"></div>
<div class="row">
<input id="docUrl" type="url" placeholder="https://… explicit docs URL (not @Docs)" />
<button id="docsFetch" class="secondary">Fetch docs</button>
<button id="docsList" class="secondary">Cached docs</button>
</div>
<div id="docs"></div>
<div class="row">
<span id="indexStatus">Index: idle</span>
<button id="indexRebuild" class="secondary tiny">Rebuild index</button>
<button id="indexPause" class="secondary tiny">Pause</button>
<button id="indexResume" class="secondary tiny">Resume</button>
</div>
<div id="todos"></div>
<div id="transcript"></div>
<div id="queue"></div>
<script nonce="${scriptNonce}">
const vscode = acquireVsCodeApi();
const transcript = document.getElementById('transcript');
const status = document.getElementById('status');
const prompt = document.getElementById('prompt');
const findHits = document.getElementById('findHits');
function add(cls, text) {
	const div = document.createElement('div');
	div.className = 'msg ' + cls;
	div.textContent = text;
	transcript.appendChild(div);
	div.scrollIntoView(false);
}
function card(requestId, requestType, detail) {
	const div = document.createElement('div');
	div.className = 'msg approval';
	const head = document.createElement('div');
	head.textContent = 'Approval: ' + requestType;
	const body = document.createElement('div');
	body.className = 'detail';
	body.textContent = detail;
	const row = document.createElement('div');
	row.className = 'row';
	const ok = document.createElement('button');
	ok.textContent = 'Accept';
	ok.onclick = () => { vscode.postMessage({ command: 'answer', requestId, answer: 'accept' }); div.remove(); };
	const no = document.createElement('button');
	no.textContent = 'Decline';
	no.className = 'secondary';
	no.onclick = () => { vscode.postMessage({ command: 'answer', requestId, answer: 'decline' }); div.remove(); };
	row.appendChild(ok);
	row.appendChild(no);
	div.appendChild(head);
	div.appendChild(body);
	div.appendChild(row);
	transcript.appendChild(div);
	div.scrollIntoView(false);
}
function trow(kind, label, detail) {
	const div = document.createElement('div');
	div.className = 'msg tool tool-' + kind;
	const mark = kind === 'failed' ? '✕ ' : kind === 'warn' ? '! ' : kind === 'done' ? '✓ ' : kind === 'start' ? '▶ ' : '• ';
	div.textContent = mark + label + (detail ? ' — ' + detail : '');
	transcript.appendChild(div);
	div.scrollIntoView(false);
}
document.getElementById('send').onclick = () => { vscode.postMessage({ command: 'send', text: prompt.value }); prompt.value = ''; };
document.getElementById('review').onclick = () => vscode.postMessage({ command: 'review' });
document.getElementById('reject').onclick = () => vscode.postMessage({ command: 'reject' });
document.getElementById('bringBack').onclick = () => vscode.postMessage({ command: 'bringBack' });
document.getElementById('new').onclick = () => vscode.postMessage({ command: 'new' });
document.getElementById('runs').onclick = () => vscode.postMessage({ command: 'runs' });
document.getElementById('steer').onclick = () => vscode.postMessage({ command: 'steer' });
document.getElementById('export').onclick = () => vscode.postMessage({ command: 'export' });
document.getElementById('artifactsGo').onclick = () => vscode.postMessage({ command: 'artifacts' });
document.getElementById('docsFetch').onclick = () => {
	vscode.postMessage({ command: 'docsFetch', url: document.getElementById('docUrl').value });
};
document.getElementById('docsList').onclick = () => vscode.postMessage({ command: 'docsList' });
document.getElementById('stop').onclick = () => vscode.postMessage({ command: 'stop' });
function runFind() {
	const box = document.getElementById('find');
	const type = document.getElementById('findType');
	vscode.postMessage({ command: 'find', text: box.value, filter: type.value });
}
document.getElementById('findGo').onclick = () => runFind();
document.getElementById('find').addEventListener('keydown', (event) => {
	if (event.key === 'Enter') { event.preventDefault(); runFind(); }
});
document.getElementById('sessionsGo').onclick = () => {
	const box = document.getElementById('sessionFilter');
	vscode.postMessage({ command: 'sessions', text: box.value });
};
document.getElementById('sessionFilter').addEventListener('keydown', (event) => {
	if (event.key === 'Enter') {
		event.preventDefault();
		vscode.postMessage({ command: 'sessions', text: event.target.value });
	}
});
document.getElementById('indexRebuild').onclick = () => vscode.postMessage({ command: 'indexRebuild' });
document.getElementById('indexPause').onclick = () => vscode.postMessage({ command: 'indexPause' });
document.getElementById('indexResume').onclick = () => vscode.postMessage({ command: 'indexResume' });
function renderDocs(items) {
	const box = document.getElementById('docs');
	box.textContent = '';
	if (!items || items.length === 0) {
		const empty = document.createElement('div');
		empty.className = 'msg tool';
		empty.textContent = 'No cached docs — paste an explicit URL. Legacy Cursor @Docs is not claimed.';
		box.appendChild(empty);
		return;
	}
	items.forEach((item) => {
		const div = document.createElement('div');
		div.className = 'msg';
		div.textContent = (item.url || '') + ' · ' + (item.bytes || 0) + 'B' + (item.truncated ? ' truncated' : '');
		const open = document.createElement('button');
		open.className = 'secondary tiny';
		open.textContent = 'Open';
		open.onclick = () => vscode.postMessage({ command: 'docsOpen', url: item.url });
		const refresh = document.createElement('button');
		refresh.className = 'secondary tiny';
		refresh.textContent = 'Refresh';
		refresh.onclick = () => vscode.postMessage({ command: 'docsRefresh', url: item.url });
		div.appendChild(open);
		div.appendChild(refresh);
		box.appendChild(div);
	});
}
function renderArtifacts(runId, revision, items) {
	const box = document.getElementById('artifacts');
	box.textContent = '';
	if (!items || items.length === 0) {
		if (runId) {
			const empty = document.createElement('div');
			empty.className = 'msg tool';
			empty.textContent = 'No artifacts for ' + runId.slice(0, 18) + '…';
			box.appendChild(empty);
		}
		return;
	}
	const head = document.createElement('div');
	head.className = 'msg tool';
	head.textContent = 'Artifacts · ' + items.length + ' · ' + (revision || '').slice(0, 40);
	box.appendChild(head);
	items.forEach((item) => {
		const div = document.createElement('div');
		div.className = 'msg';
		div.textContent = item.kind + ' · ' + (item.path || item.title || '');
		const open = document.createElement('button');
		open.className = 'secondary tiny';
		open.textContent = 'Open';
		open.onclick = () => vscode.postMessage({ command: 'openArtifact', absPath: item.absPath, kind: item.kind });
		div.appendChild(open);
		box.appendChild(div);
	});
}
function renderHits(query, hits) {
	findHits.textContent = '';
	if (!query) return;
	if (!hits || hits.length === 0) {
		const empty = document.createElement('div');
		empty.className = 'find-hit';
		empty.textContent = 'No matches for "' + query + '"';
		findHits.appendChild(empty);
		return;
	}
	hits.forEach((hit) => {
		const div = document.createElement('div');
		div.className = 'find-hit';
		div.textContent = (hit.type || 'event') + ' — ' + (hit.snippet || '');
		div.onclick = () => {
			const needle = (hit.snippet || '').replace(/^…/, '').replace(/…$/, '');
			const rows = transcript.querySelectorAll('.msg');
			let found = null;
			rows.forEach((row) => { row.classList.remove('jump-target'); });
			rows.forEach((row) => {
				if (!found && needle && row.textContent && row.textContent.indexOf(needle.slice(0, 40)) >= 0) found = row;
			});
			if (found) {
				found.classList.add('jump-target');
				found.scrollIntoView({ block: 'center' });
			} else {
				status.textContent = 'hit is in the journal, not this view';
			}
		};
		findHits.appendChild(div);
	});
}
document.getElementById('compact').onclick = (event) => {
	const box = document.getElementById('transcript');
	const on = box.classList.toggle('compact-done');
	event.target.textContent = on ? 'Expand' : 'Compact';
};
function renderQueue(items) {
	const box = document.getElementById('queue');
	box.textContent = '';
	items.forEach((text, i) => {
		const div = document.createElement('div');
		div.className = 'msg';
		div.textContent = 'Queued #' + (i + 1) + ': ' + text;
		const up = document.createElement('button');
		up.className = 'secondary tiny';
		up.textContent = 'Up';
		up.disabled = i === 0;
		up.onclick = () => vscode.postMessage({ command: 'queueMove', from: i, to: i - 1 });
		const down = document.createElement('button');
		down.className = 'secondary tiny';
		down.textContent = 'Down';
		down.disabled = i === items.length - 1;
		down.onclick = () => vscode.postMessage({ command: 'queueMove', from: i, to: i + 1 });
		const edit = document.createElement('button');
		edit.className = 'secondary tiny';
		edit.textContent = 'Edit';
		edit.onclick = () => vscode.postMessage({ command: 'queueEdit', index: i });
		const drop = document.createElement('button');
		drop.className = 'secondary tiny';
		drop.textContent = 'Drop';
		drop.onclick = () => vscode.postMessage({ command: 'dequeue', index: i });
		div.appendChild(up);
		div.appendChild(down);
		div.appendChild(edit);
		div.appendChild(drop);
		box.appendChild(div);
	});
}
function renderSessions(items) {
	const box = document.getElementById('sessions');
	box.textContent = '';
	(items || []).forEach((item) => {
		const div = document.createElement('div');
		div.className = 'msg session' + (item.current ? ' current' : '');
		div.textContent = (item.pinned ? '★ ' : '') + (item.title || item.goal || item.threadId || 'session') + (item.live ? ' · live' : ' · stopped');
		const open = document.createElement('button');
		open.className = 'tiny';
		open.textContent = 'Open';
		open.onclick = () => vscode.postMessage({ command: 'sessionSelect', session: item.threadId });
		const rename = document.createElement('button');
		rename.className = 'secondary tiny';
		rename.textContent = 'Rename';
		rename.onclick = () => vscode.postMessage({ command: 'sessionRename', session: item.threadId, title: item.title || '' });
		const pin = document.createElement('button');
		pin.className = 'secondary tiny';
		pin.textContent = item.pinned ? 'Unpin' : 'Pin';
		pin.onclick = () => vscode.postMessage({ command: 'sessionPin', session: item.threadId, pinned: !item.pinned });
		const arch = document.createElement('button');
		arch.className = 'secondary tiny';
		arch.textContent = 'Archive';
		arch.onclick = () => vscode.postMessage({ command: 'sessionArchive', session: item.threadId });
		const forget = document.createElement('button');
		forget.className = 'secondary tiny';
		forget.textContent = 'Delete';
		forget.onclick = () => vscode.postMessage({ command: 'sessionForget', session: item.threadId });
		div.appendChild(open);
		div.appendChild(rename);
		div.appendChild(pin);
		div.appendChild(arch);
		div.appendChild(forget);
		box.appendChild(div);
	});
}
function renderPlan(title, tasks) {
	const box = document.getElementById('todos');
	box.textContent = '';
	if (!tasks || tasks.length === 0) return;
	const head = document.createElement('div');
	head.className = 'msg';
	head.textContent = 'Todos' + (title ? ' — ' + title : '');
	box.appendChild(head);
	tasks.forEach((task) => {
		const div = document.createElement('div');
		div.className = 'msg tool' + (task.done ? ' todo-done' : '');
		div.textContent = (task.done ? '✓ ' : '○ ') + (task.title || '');
		box.appendChild(div);
	});
}
function renderIndexStatus(s) {
	const node = document.getElementById('indexStatus');
	const phase = s.phase || 'idle';
	const files = Number(s.filesTotal || 0);
	const chunks = Number(s.chunksTotal || 0);
	const progress = phase === 'scanning'
		? ' · scanning files'
		: phase === 'embedding'
			? ' · ' + Number(s.chunksDone || 0) + '/' + chunks + ' chunks'
			: phase === 'ready'
				? ' · ' + files + ' files, ' + chunks + ' chunks'
				: '';
	const fails = Array.isArray(s.failures) ? s.failures.length : 0;
	node.textContent = 'Index: ' + phase + progress + (fails ? ' · ' + fails + ' file errors' : '') + (s.error ? ' — ' + s.error : '');
}
window.addEventListener('message', (event) => {
	const m = event.data;
	if (m.type === 'status') status.textContent = m.text;
	else if (m.type === 'user') add('user', 'You: ' + m.text);
	else if (m.type === 'turn') add('', 'Turn: ' + m.state + (typeof m.ms === 'number' ? ' (' + Math.round(m.ms / 1000) + 's)' : ''));
	else if (m.type === 'approval') card(m.requestId, m.requestType, m.detail);
	else if (m.type === 'prefill') { prompt.value = m.text; prompt.focus(); }
	else if (m.type === 'queue') renderQueue(m.items || []);
	else if (m.type === 'sessions') renderSessions(m.items || []);
	else if (m.type === 'plan') renderPlan(m.title || '', m.tasks || []);
	else if (m.type === 'indexStatus') renderIndexStatus(m.status || {});
	else if (m.type === 'tool') trow(m.kind || 'info', m.label || 'event', m.detail || '');
	else if (m.type === 'artifacts') renderArtifacts(m.runId || '', m.revision || '', m.items || []);
	else if (m.type === 'docs') renderDocs(m.items || []);
	else if (m.type === 'searchHits') renderHits(m.query || '', m.hits || []);
	else if (m.type === 'reset') {
		transcript.textContent = '';
		findHits.textContent = '';
		renderQueue([]);
		renderPlan('', []);
		renderArtifacts('', '', []);
		renderDocs([]);
		const compact = document.getElementById('compact');
		if (compact) compact.textContent = 'Compact';
		transcript.classList.remove('compact-done');
	}
});
</script>
</body>
</html>`;
	}
}

export function activate(context: vscode.ExtensionContext): void {
	const viewProvider = new CaretViewProvider(context);
	registerEditCommands(context);
	registerSearchCommands(context);
	const tabProvider = new CaretTabProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('caretComposer', viewProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
		vscode.languages.registerInlineCompletionItemProvider({ pattern: '**' }, tabProvider),
		vscode.commands.registerCommand('caret.reviewRun', async () => {
			const doc = await vscode.workspace.openTextDocument({ content: '(use the Agents view Review button with a live session)', language: 'markdown' });
			await vscode.window.showTextDocument(doc, { preview: true });
		}),
		vscode.commands.registerCommand('caret.rejectRun', async () => {
			void vscode.window.showInformationMessage('Use the Reject button in the Caret Agents view.');
		}),
		vscode.commands.registerCommand('caret.listRuns', () => viewProvider.listRuns()),
		vscode.commands.registerCommand('caret.addEndpoint', () => viewProvider.addEndpointFlow()),
		vscode.commands.registerCommand('caret.switchEndpoint', () => viewProvider.switchEndpointFlow()),
		vscode.commands.registerCommand('caret.sendToAgent', async (preset?: string) => {
			const editor = vscode.window.activeTextEditor;
			const selection = editor && !editor.selection.isEmpty
				? editor.document.getText(editor.selection)
				: '';
			const instruction = typeof preset === 'string' && preset.length > 0
				? preset
				: await vscode.window.showInputBox({ prompt: 'Instruction for the agent' });
			if (!instruction) {
				return;
			}
			const file = editor ? vscode.workspace.asRelativePath(editor.document.uri) : '(no file)';
		viewProvider.prefill(`${instruction}\n\nContext: ${file}${selection ? `\n\`\`\`\n${selection}\n\`\`\`` : ''}`);
		}),
	);
	log.appendLine('[caret] extension active');
	viewProvider.refreshEndpointStatus();
}

export function deactivate(): void { }
