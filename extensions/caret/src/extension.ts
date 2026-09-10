import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { CaretTabProvider } from './completion';
import { registerEditCommands } from './edit';
import { registerSearchCommands } from './search';

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

	stop(): void {
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

	private ensureDaemon(): DaemonClient {
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
		const daemon = this.ensureDaemon();
		const started = await daemon.request('session.start', {
			repoDir: folder.uri.fsPath,
			runId: `ui-${Date.now()}`,
		}) as { threadId?: string };
		this.sessionOn = true;
		this.post({ type: 'status', text: `session live (${String(started.threadId ?? '').slice(0, 18)}…)` });
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
	}

	private async onUiMessage(message: { command?: string; [key: string]: unknown }): Promise<void> {
		const daemon = this.ensureDaemon();
		switch (message.command) {
			case 'send': {
				const text = String(message.text ?? '').trim();
				if (!text) {
					return;
				}
				await this.ensureSession();
				this.post({ type: 'user', text });
				this.post({ type: 'status', text: 'turn running…' });
				const done = await daemon.request('turn.send', { input: text }) as { state?: string };
				this.post({ type: 'turn', state: String(done.state ?? 'completed') });
				this.post({ type: 'status', text: 'turn done — Review or Reject' });
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
				const rejected = await daemon.request('run.reject', {}) as { reversed?: boolean };
				this.post({ type: 'status', text: rejected.reversed ? 'run changes reversed' : 'nothing to reverse' });
				break;
			}
			case 'bringBack': {
				const brought = await daemon.request('run.bringBack', {}) as { brought?: boolean };
				this.post({ type: 'status', text: brought.brought ? 'brought back onto the main checkout' : 'bring-back refused — resolve conflicts first' });
				break;
			}
			case 'new': {
				try {
					await daemon.request('session.stop', {});
				} catch {
					// no live session — start fresh below
				}
				this.sessionOn = false;
				await this.ensureSession();
				break;
			}
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
#transcript { margin: 8px 0; font-size: 12px; }
.msg { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 6px 8px; margin: 6px 0; white-space: pre-wrap; }
.user { background: var(--vscode-textBlockQuote-background); }
.approval { border-color: var(--vscode-editorWarning-foreground); }
.approval .detail { color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family); font-size: 11px; }
.row { display: flex; gap: 6px; margin-top: 6px; }
button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; padding: 5px 12px; cursor: pointer; }
button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
#prompt { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 6px; font-family: inherit; }
#status { color: var(--vscode-descriptionForeground); font-size: 11px; min-height: 16px; }
</style>
</head>
<body>
<div id="status">Caret ready — open a folder, type a goal, Send.</div>
<div class="row">
<textarea id="prompt" rows="3" placeholder="Goal for the agent, e.g. create hello.txt with hello"></textarea>
</div>
<div class="row">
<button id="send">Send</button>
<button id="review" class="secondary">Review</button>
<button id="reject" class="secondary">Reject</button>
<button id="bringBack">Bring Back</button>
<button id="new" class="secondary">New</button>
</div>
<div id="transcript"></div>
<script nonce="${scriptNonce}">
const vscode = acquireVsCodeApi();
const transcript = document.getElementById('transcript');
const status = document.getElementById('status');
const prompt = document.getElementById('prompt');
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
document.getElementById('send').onclick = () => { vscode.postMessage({ command: 'send', text: prompt.value }); prompt.value = ''; };
document.getElementById('review').onclick = () => vscode.postMessage({ command: 'review' });
document.getElementById('reject').onclick = () => vscode.postMessage({ command: 'reject' });
document.getElementById('bringBack').onclick = () => vscode.postMessage({ command: 'bringBack' });
document.getElementById('new').onclick = () => vscode.postMessage({ command: 'new' });
window.addEventListener('message', (event) => {
	const m = event.data;
	if (m.type === 'status') status.textContent = m.text;
	else if (m.type === 'user') add('user', 'You: ' + m.text);
	else if (m.type === 'turn') add('', 'Turn: ' + m.state);
	else if (m.type === 'approval') card(m.requestId, m.requestType, m.detail);
	else if (m.type === 'prefill') { prompt.value = m.text; prompt.focus(); }
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
}

export function deactivate(): void { }
