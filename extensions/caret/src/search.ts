/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * SEARCH-01/04: exact search over workspace roots with Caret ignore hierarchy.
 * No index, no embeddings, no network. Semantic retrieval is a separate track.
 *
 * Ignore precedence (first match wins, later files override earlier):
 *   1. parent `.caretignore` files from filesystem root down to workspace root
 *   2. workspace root `.caretignore` (native; created by `caret.initIgnore`)
 *   3. imported `.cursorignore` (read-only provenance, never written)
 *   4. user global `~/.caret/ignore`
 * Exclusion here hides results only — it never grants tool permissions
 * (SEARCH-05: ignore policy and sandbox policy are separate systems).
 */

const log = vscode.window.createOutputChannel('Caret Search');

function resolveRipgrep(): string {
	const candidates = [
		process.env['CARET_RG'],
		path.join(vscode.env.appRoot, '..', 'node_modules', '@vscode', 'ripgrep', 'bin', 'rg'),
		path.join(vscode.env.appRoot, 'node_modules.asar.unpacked', '@vscode', 'ripgrep', 'bin', 'rg'),
		'rg',
	].filter((candidate): candidate is string => !!candidate);
	for (const candidate of candidates) {
		if (candidate === 'rg') {
			return candidate;
		}
		try {
			if (fs.existsSync(candidate)) {
				return candidate;
			}
		} catch {
			continue;
		}
	}
	return 'rg';
}

/** Collect applicable ignore files bottom-up (parents first for precedence). */
export function collectIgnoreFiles(workspaceRoot: string): { caret: string[]; cursor: string[]; global: string[] } {
	const caret: string[] = [];
	const cursor: string[] = [];
	let dir = path.resolve(workspaceRoot);
	const seen = new Set<string>();
	while (true) {
		const caretFile = path.join(dir, '.caretignore');
		const cursorFile = path.join(dir, '.cursorignore');
		try {
			if (fs.statSync(caretFile).isFile() && !seen.has(caretFile)) {
				caret.unshift(caretFile);
				seen.add(caretFile);
			}
		} catch { /* absent — not an error */ }
		try {
			if (fs.statSync(cursorFile).isFile() && !seen.has(cursorFile)) {
				cursor.unshift(cursorFile);
				seen.add(cursorFile);
			}
		} catch { /* absent — not an error */ }
		const parent = path.dirname(dir);
		if (parent === dir) {
			break;
		}
		dir = parent;
	}
	const globalFile = path.join(os.homedir(), '.caret', 'ignore');
	let global: string[] = [];
	try {
		if (fs.statSync(globalFile).isFile()) {
			global = [globalFile];
		}
	} catch { /* absent — not an error */ }
	return { caret, cursor, global };
}

export interface SearchHit {
	readonly file: string;
	readonly line: number;
	readonly column: number;
	readonly snippet: string;
}

interface RgMessage {
	type?: string;
	data?: {
		path?: { text?: string };
		line_number?: number;
		submatches?: Array<{ start: number; end: number; match: { text?: string } }>;
		lines?: { text?: string };
		error?: string;
	};
}

/** Run one bounded exact search. Rejects on spawn failure, resolves hits + warnings. */
export function searchExact(
	workspaceRoot: string,
	pattern: string,
	options?: { literal?: boolean; maxHits?: number; timeoutMs?: number },
): Promise<{ hits: SearchHit[]; warnings: string[] }> {
	const ignore = collectIgnoreFiles(workspaceRoot);
	return new Promise((resolve) => {
		const args = [
			'--json',
			'--max-count', '5',
			'--max-columns', '300',
			...(options?.literal === false ? ['--regexp'] : ['--fixed-strings']),
			...ignore.caret.flatMap((file) => ['--ignore-file', file]),
			...ignore.cursor.flatMap((file) => ['--ignore-file', file]),
			...ignore.global.flatMap((file) => ['--ignore-file', file]),
			'--', pattern, workspaceRoot,
		];
		const child = cp.spawn(resolveRipgrep(), args, { timeout: options?.timeoutMs ?? 15000 });
		const hits: SearchHit[] = [];
		const warnings: string[] = [];
		const maxHits = options?.maxHits ?? 100;
		let stdout = '';
		child.stdout?.on('data', (chunk: Buffer) => {
			stdout += chunk.toString('utf8');
			let index = stdout.indexOf('\n');
			while (index >= 0 && hits.length < maxHits) {
				const line = stdout.slice(0, index).trim();
				stdout = stdout.slice(index + 1);
				index = stdout.indexOf('\n');
				if (!line) {
					continue;
				}
				try {
					const msg = JSON.parse(line) as RgMessage;
					if (msg.type === 'match' && msg.data?.path?.text && msg.data.line_number) {
						hits.push({
							file: msg.data.path.text,
							line: msg.data.line_number,
							column: (msg.data.submatches?.[0]?.start ?? 0) + 1,
							snippet: (msg.data.lines?.text ?? '').trim().slice(0, 160),
						});
					} else if (msg.type === 'stderr' || msg.data?.error) {
						warnings.push(String(msg.data?.error ?? line).slice(0, 200));
					}
				} catch {
					continue;
				}
			}
		});
		child.on('error', (error: Error) => {
			warnings.push(`search backend unavailable: ${error.message.slice(0, 150)}`);
			resolve({ hits, warnings });
		});
		child.on('close', () => resolve({ hits, warnings }));
	});
}

export async function searchExactCommand(): Promise<void> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		void vscode.window.showWarningMessage('Caret: open a folder to search.');
		return;
	}
	const pattern = await vscode.window.showInputBox({
		prompt: 'Exact search (literal; ripgrep regex via caret.searchRegexp)',
		placeHolder: 'e.g. respondToRequest',
	});
	if (!pattern) {
		return;
	}
	const ignore = collectIgnoreFiles(folder.uri.fsPath);
	log.appendLine(`[search] roots=${folder.uri.fsPath} caretignore=${ignore.caret.length} cursorignore=${ignore.cursor.length} global=${ignore.global.length}`);
	const { hits, warnings } = await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: 'Caret: searching…', cancellable: true },
		async () => searchExact(folder.uri.fsPath, pattern),
	);
	for (const warning of warnings.slice(0, 3)) {
		log.appendLine(`[search] warning: ${warning}`);
	}
	if (hits.length === 0) {
		void vscode.window.showInformationMessage(`Caret: no matches for "${pattern}".`);
		return;
	}
	const picked = await vscode.window.showQuickPick(
		hits.map((hit) => ({
			label: `${path.relative(folder.uri.fsPath, hit.file)}:${hit.line}`,
			description: hit.snippet,
			hit,
		})),
		{ title: `${hits.length} matches — Enter jumps (cancellation-safe)`, matchOnDescription: true },
	);
	if (!picked) {
		return;
	}
	const doc = await vscode.workspace.openTextDocument(picked.hit.file);
	const editor = await vscode.window.showTextDocument(doc, { preview: true });
	const position = new vscode.Position(Math.max(0, picked.hit.line - 1), Math.max(0, picked.hit.column - 1));
	editor.selection = new vscode.Selection(position, position);
	editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
}

export function registerSearchCommands(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('caret.searchExact', () => searchExactCommand()),
		vscode.commands.registerCommand('caret.initIgnore', async () => {
			const folder = vscode.workspace.workspaceFolders?.[0];
			if (!folder) {
				void vscode.window.showWarningMessage('Caret: open a folder first.');
				return;
			}
			const target = path.join(folder.uri.fsPath, '.caretignore');
			if (fs.existsSync(target)) {
				void vscode.window.showInformationMessage('Caret: .caretignore already exists.');
				return;
			}
			fs.writeFileSync(target, '# Caret ignore: exact search + context packaging skip these.\n# (Never a permission grant — sandbox policy is separate.)\nnode_modules/\n.git/\nout/\ndist/\n*.log\n');
			const doc = await vscode.workspace.openTextDocument(target);
			await vscode.window.showTextDocument(doc, { preview: true });
		}),
	);
}
