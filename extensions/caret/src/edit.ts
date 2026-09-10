/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/** Proposal source: local instruct model. Raw text out, no side effects. */
export async function proposeEdit(
	endpoint: string,
	languageId: string,
	selectionText: string,
	instruction: string,
	signal: AbortSignal,
): Promise<string | null> {
	const controller = new AbortController();
	const onAbort = () => controller.abort();
	signal.addEventListener('abort', onAbort, { once: true });
	const timer = setTimeout(() => controller.abort(), 20000);
	try {
		const user = `Rewrite the SELECTED code per the INSTRUCTION. Output ONLY the replacement code, no explanations, no fences.\n`
			+ `Language: ${languageId}\nINSTRUCTION: ${instruction}\nSELECTED:\n${selectionText}`;
		const response = await fetch(`${endpoint}/v1/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				messages: [{ role: 'user', content: user }],
				n_predict: 256,
				temperature: 0.2,
				cache_prompt: true,
			}),
			signal: controller.signal,
		});
		if (!response.ok) {
			return null;
		}
		const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
		const text = (data.choices?.[0]?.message?.content ?? '').trim();
		return text.length > 0 ? text : null;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
		signal.removeEventListener('abort', onAbort);
	}
}

function fimEndpoint(): string {
	const config = vscode.workspace.getConfiguration('caret.tab');
	return String(config.get('endpoint') ?? 'http://127.0.0.1:8080');
}

interface PendingProposal {
	readonly documentUri: vscode.Uri;
	readonly range: vscode.Range;
	readonly versionAtProposal: number;
	readonly originalText: string;
	proposedText: string;
	originalDoc: vscode.TextDocument;
	proposedDoc: vscode.TextDocument;
}

let pending: PendingProposal | null = null;

async function closeProposal(): Promise<void> {
	if (!pending) {
		return;
	}
	pending = null;
	for (const tabGroup of vscode.window.tabGroups.all) {
		for (const tab of tabGroup.tabs) {
			const input = tab.input as { original?: vscode.Uri; modified?: vscode.Uri } | undefined;
			if (input && (input.modified?.scheme === 'caret-proposal' || input.original?.scheme === 'caret-proposal')) {
				await vscode.window.tabGroups.close(tab, true);
			}
		}
	}
}

async function showProposal(document: vscode.TextDocument, range: vscode.Range, proposedText: string): Promise<void> {
	await closeProposal();
	const versionAtProposal = document.version;
	const originalText = document.getText(range);
	const originalDoc = await vscode.workspace.openTextDocument({
		content: originalText,
		language: document.languageId,
	});
	const proposedDoc = await vscode.workspace.openTextDocument({
		content: proposedText,
		language: document.languageId,
	});
	pending = { documentUri: document.uri, range, versionAtProposal, originalText, proposedText, originalDoc, proposedDoc };
	await vscode.commands.executeCommand(
		'vscode.diff',
		originalDoc.uri,
		proposedDoc.uri,
		'Caret proposal: original ↔ proposed (Apply / Reject / Refine)',
		{ preview: true },
	);
}

/** EDIT-01/02: selection (or cursor) + instruction -> diff proposal. */
export async function inlineEditCommand(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		void vscode.window.showWarningMessage('Caret: open a file first.');
		return;
	}
	const selection = editor.selection;
	const selectionText = editor.document.getText(selection);
	const instruction = await vscode.window.showInputBox({
		prompt: selection.isEmpty
			? 'Generate code at cursor (EDIT-02). End with ? for a question instead of an edit.'
			: 'Edit instruction for the selection (EDIT-01). End with ? for a question instead of an edit.',
		placeHolder: 'e.g. convert to async/await',
	});
	if (!instruction) {
		return;
	}
	// PX-07: question mode answers, never edits until edit intent exists.
	if (instruction.trim().endsWith('?') && selectionText.length === 0) {
		void vscode.window.showInformationMessage('Caret: question mode without a selection answers in the Agents view — use Send to Agent.');
		await vscode.commands.executeCommand('caret.sendToAgent', instruction);
		return;
	}
	const targetRange = selection.isEmpty
		? new vscode.Range(selection.start, selection.start)
		: new vscode.Range(selection.start, selection.end);
	const anchorText = selection.isEmpty ? editor.document.lineAt(selection.start.line).text : selectionText;
	const controller = new AbortController();
	const proposed = await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: 'Caret: proposing edit…', cancellable: true },
		async (_progress, token) => {
			token.onCancellationRequested(() => controller.abort());
			return proposeEdit(fimEndpoint(), editor.document.languageId, anchorText, instruction, controller.signal);
		},
	);
	if (!proposed) {
		void vscode.window.showWarningMessage('Caret: no proposal (model unavailable or request cancelled).');
		return;
	}
	await showProposal(editor.document, targetRange, proposed);
}

/** EDIT-02 follow-up: refine the open proposal with another instruction. */
export async function refineProposalCommand(): Promise<void> {
	if (!pending) {
		void vscode.window.showWarningMessage('Caret: no open proposal to refine.');
		return;
	}
	const instruction = await vscode.window.showInputBox({ prompt: 'Refine the proposal', placeHolder: 'e.g. keep names, add null checks' });
	if (!instruction) {
		return;
	}
	const controller = new AbortController();
	const refined = await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: 'Caret: refining…', cancellable: true },
		async (_progress, token) => {
			token.onCancellationRequested(() => controller.abort());
			const doc = await vscode.workspace.openTextDocument(pending!.documentUri);
			return proposeEdit(fimEndpoint(), doc.languageId, pending!.proposedText, instruction, controller.signal);
		},
	);
	if (!refined) {
		void vscode.window.showWarningMessage('Caret: refinement failed.');
		return;
	}
	const doc = await vscode.workspace.openTextDocument(pending.documentUri);
	await showProposal(doc, pending.range, refined);
}

/** Apply = one atomic WorkspaceEdit (single undo stop) iff the buffer is
 *  still at the proposal version (F04 contract). Otherwise conflict UI. */
export async function applyProposalCommand(): Promise<void> {
	if (!pending) {
		void vscode.window.showWarningMessage('Caret: no open proposal to apply.');
		return;
	}
	const doc = await vscode.workspace.openTextDocument(pending.documentUri);
	if (doc.version !== pending.versionAtProposal || doc.getText(pending.range) !== pending.originalText) {
		const choice = await vscode.window.showWarningMessage(
			'Caret: the file changed since the proposal. Applying now could overwrite your edits.',
			{ modal: true },
			'Show fresh diff',
		);
		if (choice === 'Show fresh diff') {
			await showProposal(doc, pending.range, pending.proposedText);
		}
		return;
	}
	const edit = new vscode.WorkspaceEdit();
	if (pending.range.isEmpty) {
		edit.insert(pending.documentUri, pending.range.start, pending.proposedText);
	} else {
		edit.replace(pending.documentUri, pending.range, pending.proposedText);
	}
	const applied = await vscode.workspace.applyEdit(edit);
	await closeProposal();
	if (!applied) {
		void vscode.window.showWarningMessage('Caret: apply failed.');
	}
}

export async function rejectProposalCommand(): Promise<void> {
	await closeProposal();
	vscode.window.setStatusBarMessage('Caret: proposal rejected', 3000);
}

/** EDIT-04: propose a shell command; execute is always an explicit action. */
export async function generateCommandCommand(): Promise<void> {
	const goal = await vscode.window.showInputBox({ prompt: 'What should the shell command do?', placeHolder: 'e.g. find large files in this repo' });
	if (!goal) {
		return;
	}
	const controller = new AbortController();
	const proposal = await proposeEdit(
		fimEndpoint(), 'shell',
		process.platform === 'win32' ? 'Windows PowerShell context' : 'POSIX shell context',
		`Propose ONE shell command. First line: the command. Remaining lines: one-sentence explanation. Goal: ${goal}`,
		controller.signal,
	);
	if (!proposal) {
		void vscode.window.showWarningMessage('Caret: no command proposed.');
		return;
	}
	const lines = proposal.split('\n').filter((line) => line.trim().length > 0);
	const command = (lines[0] ?? '').trim();
	const choice = await vscode.window.showQuickPick(['Copy to clipboard', 'Run in new terminal', 'Cancel'], {
		title: command,
		placeHolder: lines.slice(1).join(' ').slice(0, 200),
	});
	if (choice === 'Copy to clipboard') {
		await vscode.env.clipboard.writeText(command);
	} else if (choice === 'Run in new terminal') {
		const terminal = vscode.window.createTerminal('Caret');
		terminal.show();
		terminal.sendText(command);
	}
}

export function registerEditCommands(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('caret.inlineEdit', () => inlineEditCommand()),
		vscode.commands.registerCommand('caret.refineProposal', () => refineProposalCommand()),
		vscode.commands.registerCommand('caret.applyProposal', () => applyProposalCommand()),
		vscode.commands.registerCommand('caret.rejectProposal', () => rejectProposalCommand()),
		vscode.commands.registerCommand('caret.generateCommand', () => generateCommandCommand()),
	);
}
