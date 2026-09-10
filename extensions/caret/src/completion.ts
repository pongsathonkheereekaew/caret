/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/** Endpoint-agnostic FIM client. llama.cpp `/infill` is the first backend. */
export interface FimClient {
	complete(prefix: string, suffix: string, signal: AbortSignal): Promise<string | null>;
}

interface InfillResponse {
	content?: string;
	truncated?: boolean;
}

export class LlamaServerFimClient implements FimClient {
	constructor(
		private readonly endpoint: string,
		private readonly timeoutMs = 1200,
	) { }

	async complete(prefix: string, suffix: string, signal: AbortSignal): Promise<string | null> {
		const controller = new AbortController();
		const onAbort = () => controller.abort();
		signal.addEventListener('abort', onAbort, { once: true });
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			const response = await fetch(`${this.endpoint}/infill`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					input_prefix: prefix,
					input_suffix: suffix,
					n_predict: 64,
					temperature: 0.1,
					cache_prompt: true,
				}),
				signal: controller.signal,
			});
			if (!response.ok) {
				return null;
			}
			const data = await response.json() as InfillResponse;
			const text = data.content ?? '';
			return text.length > 0 ? text : null;
		} catch {
			return null;
		} finally {
			clearTimeout(timer);
			signal.removeEventListener('abort', onAbort);
		}
	}
}

const MAX_PREFIX = 2000;
const MAX_SUFFIX = 500;

export class CaretTabProvider implements vscode.InlineCompletionItemProvider {
	private client: FimClient;
	private enabled = true;
	private snoozedUntil = 0;
	private readonly status: vscode.StatusBarItem;
	private snoozeTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(context: vscode.ExtensionContext) {
		this.client = this.buildClient();
		this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.status.command = 'caret.toggleTab';
		context.subscriptions.push(
			this.status,
			vscode.commands.registerCommand('caret.toggleTab', () => this.toggle()),
			vscode.commands.registerCommand('caret.snoozeTab', () => this.snooze(10 * 60 * 1000)),
			vscode.workspace.onDidChangeConfiguration((event) => {
				if (event.affectsConfiguration('caret.tab')) {
					this.client = this.buildClient();
					this.renderStatus();
				}
			}),
		);
		this.renderStatus();
	}

	private buildClient(): FimClient {
		const config = vscode.workspace.getConfiguration('caret.tab');
		return new LlamaServerFimClient(
			String(config.get('endpoint') ?? 'http://127.0.0.1:8080'),
			Number(config.get('timeoutMs') ?? 1200),
		);
	}

	private isActive(document: vscode.TextDocument): boolean {
		if (!this.enabled || Date.now() < this.snoozedUntil) {
			return false;
		}
		if (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled') {
			return false;
		}
		const config = vscode.workspace.getConfiguration('caret.tab');
		const disabled = config.get<string[]>('disabledLanguages') ?? [];
		return !disabled.includes(document.languageId);
	}

	private renderStatus(): void {
		const snoozed = Date.now() < this.snoozedUntil;
		this.status.text = snoozed ? '$(clock) Caret Tab: snoozed' : this.enabled ? '$(sparkle) Caret Tab' : '$(circle-slash) Caret Tab: off';
		this.status.tooltip = 'Toggle Caret Tab completion (caret.toggleTab)';
		this.status.show();
	}
	toggle(): void {
		this.enabled = !this.enabled;
		this.renderStatus();
	}

	snooze(durationMs: number): void {
		if (this.snoozeTimer) {
			clearTimeout(this.snoozeTimer);
		}
		this.snoozedUntil = Date.now() + durationMs;
		this.snoozeTimer = setTimeout(() => {
			this.snoozedUntil = 0;
			this.snoozeTimer = null;
			this.renderStatus();
		}, durationMs);
		this.renderStatus();
	}

	async provideInlineCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		_context: vscode.InlineCompletionContext,
		token: vscode.CancellationToken,
	): Promise<vscode.InlineCompletionItem[] | null> {
		if (!this.isActive(document)) {
			return null;
		}
		const versionAtRequest = document.version;
		const offset = document.offsetAt(position);
		const fullText = document.getText();
		const prefix = fullText.slice(Math.max(0, offset - MAX_PREFIX), offset);
		const suffix = fullText.slice(offset, offset + MAX_SUFFIX);
		const controller = new AbortController();
		const cancelListener = token.onCancellationRequested(() => controller.abort());
		let completion: string | null;
		try {
			completion = await this.client.complete(prefix, suffix, controller.signal);
		} finally {
			cancelListener.dispose();
			controller.abort();
		}
		if (completion === null) {
			return null;
		}
		// STALE GUARD (TAB-01): the buffer moved while we waited — discard.
		// A stale suggestion must never land on a newer buffer revision.
		if (document.version !== versionAtRequest || token.isCancellationRequested) {
			return null;
		}
		if (!document.validatePosition(position).isEqual(position)) {
			return null;
		}
		const item = new vscode.InlineCompletionItem(completion, new vscode.Range(position, position));
		return [item];
	}
	}
