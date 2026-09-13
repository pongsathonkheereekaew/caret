/*
 * Caret's native editor bridge.
 *
 * The bridge deliberately owns no file-system writer.  Reads come from the
 * Code - OSS text model (so unsaved buffers are visible), and writes are
 * submitted as one WorkspaceEdit (so the native undo stack remains intact).
 * VS Code's extension API has no documentChanges/version-CAS field.  The
 * implementation therefore uses a synchronous preflight immediately before
 * applyEdit and verifies the postcondition afterwards; it does not claim a
 * stronger atomic guarantee than the API provides.
 */

import { createHash, randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type * as vscode from "vscode";
import { access } from "node:fs/promises";
import {
	CARET_EDITOR_PROTOCOL_VERSION,
	type EditorApplyRequest,
	type EditorApplyResult,
	type EditorCreateResult,
	type EditorDeleteResult,
	type EditorDocumentHandle,
	type EditorDocumentSnapshot,
	type EditorErrorCode,
	type EditorErrorResult,
	type EditorInventoryResult,
	type EditorMoveResult,
	type EditorReadResult,
	type EditorRequest,
	type EditorResponse,
	type EditorTextEdit,
	isUntitledEditorPath,
} from "../../../packages/protocol/src/editor.ts";

type VscodeApi = typeof import("vscode");
type TextDocument = vscode.TextDocument;
type Disposable = vscode.Disposable;

const MAX_REQUEST_ID_LENGTH = 256;
const MAX_PATH_LENGTH = 16_384;
const MAX_HANDLE_ID_LENGTH = 256;
const MAX_HANDLE_URI_LENGTH = 16_384;
const MAX_HASH_LENGTH = 64;
const MAX_EDITS = 10_000;
const MAX_EDIT_TEXT_LENGTH = 16 * 1024 * 1024;
const MAX_TOTAL_EDIT_TEXT_LENGTH = 64 * 1024 * 1024;

type EditorDocumentDescriptor = Omit<EditorDocumentSnapshot, "text">;

export interface EditorInventorySnapshot {
	readonly workspaceRoots: readonly string[];
	readonly documents: readonly EditorDocumentSnapshot[];
	readonly dirtyCount: number;
	readonly generatedAt: string;
}

export type EditorApplyInput = Pick<EditorApplyRequest, "path" | "handle" | "expectedVersion" | "expectedHash" | "edits">
	& Partial<Pick<EditorApplyRequest, "requestId">>;

export type EditorGuardInput = Pick<EditorApplyRequest, "path" | "handle" | "expectedVersion" | "expectedHash">;

export interface EditorServiceOptions {
	/** Revalidate a host delivery after waiting for the per-document queue. */
	readonly beforeApply?: (requestId: string | undefined) => Promise<boolean>;
	/** Injected only for tests/embedding; the default dynamically loads vscode. */
	readonly api?: VscodeApi;
	/** Absolute workspace roots. If omitted, roots come from vscode.workspace. */
	readonly workspaceRoots?: readonly string[];
}

export interface EditorGuardState {
	readonly handleId: string;
	readonly handleUri: string;
	readonly path: string;
	readonly documentVersion: number;
	readonly sha256: string;
	readonly closed: boolean;
}

export interface EditorGuardExpectation {
	readonly handle: EditorDocumentHandle;
	readonly path: string;
	readonly expectedVersion: number;
	readonly expectedHash: string;
}

export type EditorGuardFailure =
	| "document_closed"
	| "document_replaced"
	| "stale_document"
	| "hash_mismatch";

export type EditorGuardResult =
	| { readonly ok: true }
	| { readonly ok: false; readonly code: EditorGuardFailure };

/**
 * Pure precondition check used by the runtime and by contract tests.  Keep
 * the order stable: a closed model is never described as merely stale, and a
 * handle mismatch is never allowed to fall through to a path-only write.
 */
export function evaluateEditorGuard(actual: EditorGuardState, expected: EditorGuardExpectation): EditorGuardResult {
	if (actual.closed) return { ok: false, code: "document_closed" };
	if (
		actual.handleId !== expected.handle.id
		|| actual.handleUri !== expected.handle.uri
		|| actual.path !== expected.path
	) {
		return { ok: false, code: "document_replaced" };
	}
	if (actual.documentVersion !== expected.expectedVersion) return { ok: false, code: "stale_document" };
	if (actual.sha256.toLowerCase() !== expected.expectedHash.toLowerCase()) return { ok: false, code: "hash_mismatch" };
	return { ok: true };
}

/** Return true when candidate is root itself or a descendant of root. */
export function isPathWithinWorkspace(root: string, candidate: string): boolean {
	if (!isAbsolute(root) || !isAbsolute(candidate)) return false;
	const rootPath = resolve(root);
	const candidatePath = resolve(candidate);
	const rest = relative(rootPath, candidatePath);
	return rest === "" || (!rest.startsWith("..") && !isAbsolute(rest));
}

export function sha256Text(text: string): string {
	return createHash("sha256").update(text, "utf8").digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, maxLength: number): value is string {
	return typeof value === "string" && value.length > 0 && value.length <= maxLength && value.trim().length > 0;
}

function safeInteger(value: unknown, minimum = 0): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
}

function validHash(value: unknown): value is string {
	return typeof value === "string" && value.length === MAX_HASH_LENGTH && /^[0-9a-f]{64}$/iu.test(value);
}

function parsePosition(value: unknown): { readonly line: number; readonly character: number } | undefined {
	if (!isRecord(value) || !safeInteger(value.line) || !safeInteger(value.character)) return undefined;
	if (value.line > 10_000_000 || value.character > 10_000_000) return undefined;
	return { line: value.line, character: value.character };
}

function parseEdit(value: unknown): EditorTextEdit | undefined {
	if (!isRecord(value) || typeof value.text !== "string" || value.text.length > MAX_EDIT_TEXT_LENGTH) return undefined;
	const range = isRecord(value.range) ? value.range : undefined;
	const start = range ? parsePosition(range.start) : undefined;
	const end = range ? parsePosition(range.end) : undefined;
	if (!start || !end) return undefined;
	return { range: { start, end }, text: value.text };
}

function parseHandle(value: unknown): EditorDocumentHandle | undefined {
	if (!isRecord(value)) return undefined;
	if (!nonEmptyString(value.id, MAX_HANDLE_ID_LENGTH) || !nonEmptyString(value.uri, MAX_HANDLE_URI_LENGTH)) return undefined;
	return { id: value.id, uri: value.uri };
}

function parseRequestId(value: unknown): string | undefined {
	return nonEmptyString(value, MAX_REQUEST_ID_LENGTH) ? value : undefined;
}

/** Parse and clone one untrusted host request without importing vscode. */
export function parseEditorRequest(value: unknown): EditorRequest | undefined {
	if (!isRecord(value) || value.protocolVersion !== CARET_EDITOR_PROTOCOL_VERSION) return undefined;
	const requestId = parseRequestId(value.requestId);
	if (!requestId || typeof value.kind !== "string") return undefined;
	switch (value.kind) {
		case "read":
			return nonEmptyString(value.path, MAX_PATH_LENGTH)
				? { protocolVersion: CARET_EDITOR_PROTOCOL_VERSION, requestId, kind: "read", path: value.path }
				: undefined;
		case "inventory":
			return value.includeClean === undefined || typeof value.includeClean === "boolean"
				? {
					protocolVersion: CARET_EDITOR_PROTOCOL_VERSION,
					requestId,
					kind: "inventory",
					...(typeof value.includeClean === "boolean" ? { includeClean: value.includeClean } : {}),
				}
				: undefined;
		case "apply": {
			const handle = parseHandle(value.handle);
			if (
				!nonEmptyString(value.path, MAX_PATH_LENGTH)
				|| !handle
				|| !safeInteger(value.expectedVersion, 1)
				|| !validHash(value.expectedHash)
				|| !Array.isArray(value.edits)
				|| value.edits.length > MAX_EDITS
			) return undefined;
			const edits = value.edits.map(parseEdit);
			if (edits.some(edit => edit === undefined)) return undefined;
			if ((edits as EditorTextEdit[]).reduce((total, edit) => total + edit.text.length, 0) > MAX_TOTAL_EDIT_TEXT_LENGTH) return undefined;
			return {
				protocolVersion: CARET_EDITOR_PROTOCOL_VERSION,
				requestId,
				kind: "apply",
				path: value.path,
				handle,
				expectedVersion: value.expectedVersion,
				expectedHash: value.expectedHash.toLowerCase(),
				edits: edits as EditorTextEdit[],
			};
		}
		case "create": {
			if (!nonEmptyString(value.path, MAX_PATH_LENGTH)) return undefined;
			if (value.overwrite === true) return undefined;
			if (value.content !== undefined && (typeof value.content !== "string" || value.content.length > MAX_EDIT_TEXT_LENGTH)) return undefined;
			return {
				protocolVersion: CARET_EDITOR_PROTOCOL_VERSION,
				requestId,
				kind: "create",
				path: value.path,
				...(typeof value.content === "string" ? { content: value.content } : {}),
				...(value.overwrite === false ? { overwrite: false } : {}),
			};
		}
		case "delete": {
			const handle = parseHandle(value.handle);
			if (!nonEmptyString(value.path, MAX_PATH_LENGTH) || !handle || !safeInteger(value.expectedVersion, 1) || !validHash(value.expectedHash)) return undefined;
			return {
				protocolVersion: CARET_EDITOR_PROTOCOL_VERSION,
				requestId,
				kind: "delete",
				path: value.path,
				handle,
				expectedVersion: value.expectedVersion,
				expectedHash: value.expectedHash.toLowerCase(),
			};
		}
		case "move": {
			const handle = parseHandle(value.handle);
			if (
				!nonEmptyString(value.path, MAX_PATH_LENGTH)
				|| !nonEmptyString(value.destination, MAX_PATH_LENGTH)
				|| !handle
				|| !safeInteger(value.expectedVersion, 1)
				|| !validHash(value.expectedHash)
				|| value.overwrite === true
			) return undefined;
			return {
				protocolVersion: CARET_EDITOR_PROTOCOL_VERSION,
				requestId,
				kind: "move",
				path: value.path,
				destination: value.destination,
				handle,
				expectedVersion: value.expectedVersion,
				expectedHash: value.expectedHash.toLowerCase(),
				...(value.overwrite === false ? { overwrite: false } : {}),
			};
		}
		default:
			return undefined;
	}
}

export class EditorBridgeError extends Error {
	readonly code: EditorErrorCode;
	readonly current?: EditorDocumentDescriptor;
	readonly mayHaveApplied?: boolean;

	constructor(code: EditorErrorCode, message: string, options: { current?: EditorDocumentDescriptor; mayHaveApplied?: boolean } = {}) {
		super(message);
		this.name = "EditorBridgeError";
		this.code = code;
		this.current = options.current;
		this.mayHaveApplied = options.mayHaveApplied;
	}
}

interface WorkspaceRoot {
	readonly path: string;
}

interface DocumentBinding {
	readonly handle: EditorDocumentHandle;
	readonly document: TextDocument;
	readonly path: string;
	readonly workspaceRoot: string;
	readonly uri: string;
	closed: boolean;
	replaced: boolean;
}

function newId(prefix: string): string {
	try {
		return `${prefix}-${randomUUID()}`;
	} catch {
		return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
	}
}

function comparePosition(a: { readonly line: number; readonly character: number }, b: { readonly line: number; readonly character: number }): number {
	return a.line - b.line || a.character - b.character;
}

function normalizeLineEndings(value: string, eol: number): string {
	const lf = value.replace(/\r\n|\r|\n/g, "\n");
	return eol === 2 ? lf.replace(/\n/g, "\r\n") : lf;
}

function errorRequestId(value: unknown): string | undefined {
	return isRecord(value) ? parseRequestId(value.requestId) : undefined;
}

/**
 * A Code - OSS-backed editor service.  No method invokes TextDocument.save;
 * callers must explicitly use the native Save command when they want to
 * persist a dirty buffer.
 */
export class CaretEditorService {
	readonly #options: EditorServiceOptions;
	#api: VscodeApi | undefined;
	#apiPromise: Promise<VscodeApi> | undefined;
	#disposed = false;
	#closeSubscription: Disposable | undefined;
	#openSubscription: Disposable | undefined;
	readonly #bindingsByUri = new Map<string, DocumentBinding>();
	readonly #bindingsByHandle = new Map<string, DocumentBinding>();
	readonly #locks = new Map<string, Promise<void>>();

	constructor(options: EditorServiceOptions = {}) {
		this.#options = options;
		this.#api = options.api;
		if (this.#api) this.installLifecycleListeners(this.#api);
	}

	/** Stop listeners and prevent new bridge requests. */
	dispose(): void {
		if (this.#disposed) return;
		this.#disposed = true;
		this.#closeSubscription?.dispose();
		this.#openSubscription?.dispose();
		this.#closeSubscription = undefined;
		this.#openSubscription = undefined;
		this.#bindingsByUri.clear();
		this.#bindingsByHandle.clear();
	}

	private async api(): Promise<VscodeApi> {
		if (this.#disposed) throw new EditorBridgeError("bridge_disposed", "editor bridge is disposed");
		if (this.#api) return this.#api;
		if (!this.#apiPromise) this.#apiPromise = import("vscode");
		const api = await this.#apiPromise;
		this.#api = api;
		this.installLifecycleListeners(api);
		return api;
	}

	private installLifecycleListeners(api: VscodeApi): void {
		if (this.#closeSubscription || this.#openSubscription) return;
		this.#openSubscription = api.workspace.onDidOpenTextDocument(document => {
			const uri = document.uri.toString();
			const current = this.#bindingsByUri.get(uri);
			if (current && current.document !== document) {
				current.replaced = true;
				this.#bindingsByUri.delete(uri);
			}
		});
		this.#closeSubscription = api.workspace.onDidCloseTextDocument(document => {
			for (const binding of this.#bindingsByHandle.values()) {
				if (binding.document !== document) continue;
				binding.closed = true;
				if (this.#bindingsByUri.get(binding.uri) === binding) this.#bindingsByUri.delete(binding.uri);
			}
		});
	}

	private async roots(api: VscodeApi): Promise<WorkspaceRoot[]> {
		const configured = this.#options.workspaceRoots?.length
			? [...this.#options.workspaceRoots]
			: (api.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath);
		if (configured.length === 0) throw new EditorBridgeError("workspace_unavailable", "no workspace folder is open");
		const roots: WorkspaceRoot[] = [];
		for (const candidate of configured) {
			if (!nonEmptyString(candidate, MAX_PATH_LENGTH) || !isAbsolute(candidate)) continue;
			try {
				const path = await realpath(resolve(candidate));
				if (!roots.some(root => root.path === path)) roots.push({ path });
			} catch {
				// A workspace folder can disappear during shutdown. It is simply not
				// an eligible root for this request.
			}
		}
		if (roots.length === 0) throw new EditorBridgeError("workspace_unavailable", "workspace folders are unavailable");
		return roots;
	}

	private untitledMatches(document: TextDocument, input: string): boolean {
		if (!document.isUntitled && document.uri.scheme !== "untitled") return false;
		const uri = document.uri.toString();
		return input === uri || input === document.fileName || input === document.uri.path;
	}

	private findOpenDocument(api: VscodeApi, input: string): TextDocument | undefined {
		for (const document of api.workspace.textDocuments ?? []) {
			if (document.isClosed) continue;
			if (this.untitledMatches(document, input)) return document;
			if (document.uri.toString() === input) return document;
			if (document.uri.scheme === "file" && (document.uri.fsPath === input || document.fileName === input)) return document;
		}
		return undefined;
	}

	private async resolveExistingPath(api: VscodeApi, input: string): Promise<{ readonly path: string; readonly root: WorkspaceRoot }> {
		if (!nonEmptyString(input, MAX_PATH_LENGTH) || !isAbsolute(input) || input.includes("\0")) {
			throw new EditorBridgeError("path_outside_workspace", "editor path must be an absolute workspace path");
		}
		const roots = await this.roots(api);
		const lexical = resolve(input);
		const lexicalRoot = roots
			.filter(root => isPathWithinWorkspace(root.path, lexical))
			.sort((a, b) => b.path.length - a.path.length)[0];
		if (!lexicalRoot) throw new EditorBridgeError("path_outside_workspace", "editor path is outside the open workspace");
		let path: string;
		try {
			path = await realpath(lexical);
		} catch (error) {
			throw new EditorBridgeError((error as NodeJS.ErrnoException).code === "ENOENT" ? "document_not_found" : "unsupported_document", `editor document is unavailable: ${input}`, { mayHaveApplied: false });
		}
		if (!isPathWithinWorkspace(lexicalRoot.path, path)) {
			throw new EditorBridgeError("path_outside_workspace", "editor path resolves outside the open workspace");
		}
		return { path, root: lexicalRoot };
	}

	private async resolveWritablePath(api: VscodeApi, input: string): Promise<{ readonly path: string; readonly root: WorkspaceRoot; readonly exists: boolean }> {
		if (!nonEmptyString(input, MAX_PATH_LENGTH) || !isAbsolute(input) || input.includes("\0") || isUntitledEditorPath(input)) {
			throw new EditorBridgeError("path_outside_workspace", "editor path must be an absolute workspace path");
		}
		const roots = await this.roots(api);
		const lexical = resolve(input);
		const lexicalRoot = roots
			.filter(root => isPathWithinWorkspace(root.path, lexical))
			.sort((a, b) => b.path.length - a.path.length)[0];
		if (!lexicalRoot) throw new EditorBridgeError("path_outside_workspace", "editor path is outside the open workspace");
		try {
			const path = await realpath(lexical);
			if (!isPathWithinWorkspace(lexicalRoot.path, path)) {
				throw new EditorBridgeError("path_outside_workspace", "editor path resolves outside the open workspace");
			}
			return { path, root: lexicalRoot, exists: true };
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				throw new EditorBridgeError("unsupported_document", `editor path is unavailable: ${input}`, { mayHaveApplied: false });
			}
			return { path: lexical, root: lexicalRoot, exists: false };
		}
	}

	private async resolvePath(api: VscodeApi, input: string): Promise<{ readonly path: string; readonly root: WorkspaceRoot }> {
		return this.resolveExistingPath(api, input);
	}

	private async untitledTarget(api: VscodeApi, document: TextDocument): Promise<{ readonly path: string; readonly root: WorkspaceRoot }> {
		const roots = await this.roots(api);
		const root = roots[0];
		if (!root) throw new EditorBridgeError("workspace_unavailable", "no workspace folder is open");
		return { path: document.uri.toString(), root };
	}

	private async resolveRequestTarget(api: VscodeApi, input: string, handle?: EditorDocumentHandle): Promise<{ readonly path: string; readonly root: WorkspaceRoot; readonly untitled: boolean; readonly document?: TextDocument }> {
		if (handle) {
			const binding = this.#bindingsByHandle.get(handle.id);
			if (binding && !binding.closed && !binding.document.isClosed && (binding.document.isUntitled || binding.uri.startsWith("untitled:"))) {
				if (input !== binding.path && input !== binding.uri && input !== binding.document.fileName && input !== handle.uri) {
					throw new EditorBridgeError("document_replaced", "untitled document path does not match the handle");
				}
				return { path: binding.path, root: { path: binding.workspaceRoot }, untitled: true, document: binding.document };
			}
		}
		const open = this.findOpenDocument(api, input);
		if (open && (open.isUntitled || open.uri.scheme === "untitled" || isUntitledEditorPath(input))) {
			const target = await this.untitledTarget(api, open);
			return { ...target, untitled: true, document: open };
		}
		if (isUntitledEditorPath(input)) throw new EditorBridgeError("document_not_found", "untitled editor document is not open");
		const target = await this.resolveExistingPath(api, input);
		return { ...target, untitled: false };
	}

	private async assertDocument(api: VscodeApi, document: TextDocument, target: { readonly path: string; readonly root: WorkspaceRoot; readonly untitled?: boolean }): Promise<void> {
		if (document.isClosed) throw new EditorBridgeError("document_closed", "editor document is closed");
		if (document.isUntitled || document.uri.scheme === "untitled" || target.untitled) {
			if (!document.isUntitled && document.uri.scheme !== "untitled") {
				throw new EditorBridgeError("unsupported_document", "untitled request resolved to a saved document");
			}
			void api;
			return;
		}
		if (document.uri.scheme !== "file") {
			throw new EditorBridgeError("unsupported_document", "only file and untitled documents are supported");
		}
		let documentPath: string;
		try {
			documentPath = await realpath(resolve(document.fileName));
		} catch {
			documentPath = resolve(document.fileName);
		}
		if (!isPathWithinWorkspace(target.root.path, documentPath)) {
			throw new EditorBridgeError("path_outside_workspace", "editor document is outside the open workspace");
		}
		if (documentPath !== target.path) throw new EditorBridgeError("document_replaced", "the requested path resolves to another document");
		void api;
	}

	private bind(document: TextDocument, target: { readonly path: string; readonly root: WorkspaceRoot }): DocumentBinding {
		const uri = document.uri.toString();
		const current = this.#bindingsByUri.get(uri);
		if (current && current.document === document) return current;
		if (current) current.replaced = true;
		const handle: EditorDocumentHandle = { id: newId("caret-doc"), uri };
		const binding: DocumentBinding = {
			handle,
			document,
			path: target.path,
			workspaceRoot: target.root.path,
			uri,
			closed: false,
			replaced: false,
		};
		this.#bindingsByUri.set(uri, binding);
		this.#bindingsByHandle.set(handle.id, binding);
		return binding;
	}

	private descriptor(binding: DocumentBinding): EditorDocumentDescriptor {
		const document = binding.document;
		return {
			handle: binding.handle,
			path: binding.path,
			uri: binding.uri,
			workspaceRoot: binding.workspaceRoot,
			documentVersion: document.version,
			sha256: sha256Text(document.getText()),
			dirty: document.isDirty,
			isUntitled: document.isUntitled,
			languageId: document.languageId,
			encoding: document.encoding,
		};
	}

	private snapshot(binding: DocumentBinding): EditorDocumentSnapshot {
		return { ...this.descriptor(binding), text: binding.document.getText() };
	}

	private async readDocument(api: VscodeApi, path: string): Promise<EditorDocumentSnapshot> {
		const target = await this.resolveRequestTarget(api, path);
		let document = target.document;
		if (!document) {
			try {
				document = await api.workspace.openTextDocument(api.Uri.file(target.path));
			} catch {
				throw new EditorBridgeError("unsupported_document", `cannot open editor document: ${path}`, { mayHaveApplied: false });
			}
		}
		await this.assertDocument(api, document, target);
		return this.snapshot(this.bind(document, { path: target.path, root: target.root }));
	}

	/** Read current text-model content, including unsaved edits. */
	async read(path: string): Promise<EditorDocumentSnapshot> {
		return this.readDocument(await this.api(), path);
	}

	private bindingFor(request: EditorGuardInput, target: { readonly path: string; readonly root: WorkspaceRoot }): DocumentBinding {
		const binding = this.#bindingsByHandle.get(request.handle.id);
		if (!binding) throw new EditorBridgeError("document_replaced", "document handle is no longer valid");
		if (binding.closed || binding.document.isClosed) throw new EditorBridgeError("document_closed", "editor document is closed", { current: this.descriptor(binding) });
		if (binding.replaced || this.#bindingsByUri.get(binding.uri) !== binding) {
			throw new EditorBridgeError("document_replaced", "editor document was closed and replaced", { current: this.descriptor(binding) });
		}
		const guard = evaluateEditorGuard(
			{
				handleId: binding.handle.id,
				handleUri: binding.handle.uri,
				path: binding.path,
				documentVersion: binding.document.version,
				sha256: sha256Text(binding.document.getText()),
				closed: binding.closed || binding.document.isClosed,
			},
			{
				handle: request.handle,
				path: target.path,
				expectedVersion: request.expectedVersion,
				expectedHash: request.expectedHash,
			},
		);
		if (!guard.ok) {
			const current = this.descriptor(binding);
			throw new EditorBridgeError(guard.code, `editor document guard failed: ${guard.code}`, { current });
		}
		if (binding.workspaceRoot !== target.root.path) throw new EditorBridgeError("document_replaced", "editor workspace changed", { current: this.descriptor(binding) });
		return binding;
	}

	private async withLock<T>(key: string, action: () => Promise<T>): Promise<T> {
		const previous = this.#locks.get(key) ?? Promise.resolve();
		let release!: () => void;
		const current = new Promise<void>(resolveRelease => { release = resolveRelease; });
		const tail = previous.then(() => current);
		this.#locks.set(key, tail);
		await previous;
		try {
			return await action();
		} finally {
			release();
			if (this.#locks.get(key) === tail) this.#locks.delete(key);
		}
	}

	private async applyEdit(api: VscodeApi, edit: vscode.WorkspaceEdit, requestId?: string): Promise<boolean> {
		if (this.#options.beforeApply && !await this.#options.beforeApply(requestId)) {
			throw new EditorBridgeError("apply_rejected", "Editor request was cancelled or expired");
		}
		if (this.#disposed) throw new EditorBridgeError("bridge_disposed", "Editor bridge closed before apply");
		let invoked = false;
		try {
			const result = api.workspace.applyEdit(edit);
			invoked = true;
			return await result;
		} catch (error) {
			if (error instanceof EditorBridgeError) throw error;
			throw new EditorBridgeError("apply_rejected", "VS Code rejected the editor edit", { mayHaveApplied: invoked });
		}
	}

	private async closeUntitledWithoutSave(api: VscodeApi, document: TextDocument, requestId?: string): Promise<void> {
		if (this.#options.beforeApply && !await this.#options.beforeApply(requestId)) {
			throw new EditorBridgeError("apply_rejected", "Editor request was cancelled or expired");
		}
		if (this.#disposed) throw new EditorBridgeError("bridge_disposed", "Editor bridge closed before apply");
		const groups = api.window?.tabGroups?.all ?? [];
		for (const group of groups) {
			for (const tab of group.tabs ?? []) {
				const input = tab.input as { uri?: { toString(): string } } | undefined;
				if (!input?.uri || input.uri.toString() !== document.uri.toString()) continue;
				const closed = await api.window.tabGroups.close(tab);
				if (!closed) throw new EditorBridgeError("apply_rejected", "VS Code did not close the untitled document");
				return;
			}
		}
		throw new EditorBridgeError("unsupported_document", "untitled document has no tab to close without saving");
	}

	private async applyDocument(api: VscodeApi, request: EditorApplyInput): Promise<EditorApplyResult> {
		const target = await this.resolveRequestTarget(api, request.path, request.handle);
		// Handle lookup happens only after path validation, so a path outside the
		// current project cannot probe the bridge's open-document inventory.
		const known = this.#bindingsByHandle.get(request.handle.id);
		const lockKey = known?.uri ?? request.handle.uri;
		return this.withLock(lockKey, async () => {
			const binding = this.bindingFor(request, target);
			const document = binding.document;
			const originalText = document.getText();
			const edits = request.edits.map((item, index) => {
				if (comparePosition(item.range.start, item.range.end) > 0) {
					throw new EditorBridgeError("invalid_edit", `edit ${index} has a reversed range`);
				}
				const start = new api.Position(item.range.start.line, item.range.start.character);
				const end = new api.Position(item.range.end.line, item.range.end.character);
				const validStart = document.validatePosition(start);
				const validEnd = document.validatePosition(end);
				if (!validStart.isEqual(start) || !validEnd.isEqual(end)) {
					throw new EditorBridgeError("invalid_edit", `edit ${index} is outside the document`);
				}
				const startOffset = document.offsetAt(start);
				const endOffset = document.offsetAt(end);
				return {
					index,
					start,
					end,
					startOffset,
					endOffset,
					text: normalizeLineEndings(item.text, Number(document.eol)),
				};
			}).sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset || a.index - b.index);
			if (edits.reduce((total, item) => total + item.text.length, 0) > MAX_TOTAL_EDIT_TEXT_LENGTH) {
				throw new EditorBridgeError("invalid_edit", "editor edit payload is too large");
			}
			for (let index = 1; index < edits.length; index += 1) {
				const previous = edits[index - 1]!;
				const current = edits[index]!;
				if (current.startOffset < previous.endOffset || current.startOffset === previous.startOffset) {
					throw new EditorBridgeError("invalid_edit", "overlapping editor edits are not supported");
				}
			}
			if (edits.length === 0) throw new EditorBridgeError("invalid_edit", "at least one editor edit is required");
			let expectedText = originalText;
			for (let index = edits.length - 1; index >= 0; index -= 1) {
				const edit = edits[index]!;
				expectedText = expectedText.slice(0, edit.startOffset) + edit.text + expectedText.slice(edit.endOffset);
			}
			if (expectedText === originalText) throw new EditorBridgeError("invalid_edit", "editor edit does not change the document");

			if (this.#options.beforeApply && !await this.#options.beforeApply(request.requestId)) throw new EditorBridgeError("apply_rejected", "Editor request was cancelled or expired");
			if (this.#disposed) throw new EditorBridgeError("bridge_disposed", "Editor bridge closed before apply");
			// No await occurs between this final guard and applyEdit.  That closes
			// the JavaScript-level race window; native changes racing inside VS Code
			// are detected by the exact version/hash postcondition below.
			const finalGuard = evaluateEditorGuard(
				{
					handleId: binding.handle.id,
					handleUri: binding.handle.uri,
					path: binding.path,
					documentVersion: document.version,
					sha256: sha256Text(document.getText()),
					closed: binding.closed || document.isClosed,
				},
				{
					handle: request.handle,
					path: target.path,
					expectedVersion: request.expectedVersion,
					expectedHash: request.expectedHash,
				},
			);
			if (!finalGuard.ok) throw new EditorBridgeError(finalGuard.code, `editor document guard failed: ${finalGuard.code}`, { current: this.descriptor(binding) });

			const edit = new api.WorkspaceEdit();
			for (let index = edits.length - 1; index >= 0; index -= 1) {
				const item = edits[index]!;
				edit.replace(document.uri, new api.Range(item.start, item.end), item.text);
			}
			let invoked = false;
			let applied: boolean;
			try {
				const result = api.workspace.applyEdit(edit);
				invoked = true;
				applied = await result;
			} catch (error) {
				throw new EditorBridgeError("apply_rejected", "VS Code rejected the editor edit", { current: this.descriptor(binding), mayHaveApplied: invoked });
			}
			if (!applied) throw new EditorBridgeError("apply_rejected", "VS Code did not apply the editor edit", { current: this.descriptor(binding), mayHaveApplied: false });

			if (binding.closed || binding.replaced || document.isClosed || this.#bindingsByUri.get(binding.uri) !== binding) {
				throw new EditorBridgeError("apply_race", "editor document changed while the edit was being applied", { current: this.descriptor(binding), mayHaveApplied: true });
			}
			const afterText = document.getText();
			const afterVersion = document.version;
			if (afterVersion !== request.expectedVersion + 1 || afterText !== expectedText) {
				throw new EditorBridgeError("apply_race", "editor edit postcondition did not match the guarded request", { current: this.descriptor(binding), mayHaveApplied: true });
			}
			return {
				kind: "apply",
				requestId: request.requestId ?? newId("caret-edit"),
				document: this.descriptor(binding),
				undoPreserved: true,
				saved: false,
			};
		});
	}

	/** Apply a guarded WorkspaceEdit without saving the document. */
	async apply(input: EditorApplyInput): Promise<EditorApplyResult> {
		return this.applyDocument(await this.api(), input);
	}

	private async createDocument(api: VscodeApi, path: string, content: string | undefined, requestId: string): Promise<EditorCreateResult> {
		const target = await this.resolveWritablePath(api, path);
		if (target.exists) throw new EditorBridgeError("already_exists", "create would clobber an existing file");
		const open = this.findOpenDocument(api, target.path);
		if (open) throw new EditorBridgeError("already_exists", "create would clobber an open editor document");
		try {
			await access(target.path);
			throw new EditorBridgeError("already_exists", "create would clobber an existing path");
		} catch (error) {
			if (error instanceof EditorBridgeError) throw error;
		}
		const uri = api.Uri.file(target.path);
		const create = new api.WorkspaceEdit();
		create.createFile(uri, { overwrite: false, ignoreIfExists: false });
		if (!await this.applyEdit(api, create, requestId)) {
			throw new EditorBridgeError("apply_rejected", "VS Code did not create the editor file", { mayHaveApplied: false });
		}
		let document: TextDocument;
		try {
			document = await api.workspace.openTextDocument(uri);
		} catch {
			throw new EditorBridgeError("apply_race", "created editor document could not be opened", { mayHaveApplied: true });
		}
		await this.assertDocument(api, document, target);
		let binding = this.bind(document, { path: target.path, root: target.root });
		if (content !== undefined && content !== document.getText()) {
			const replace = new api.WorkspaceEdit();
			const current = document.getText();
			const lines = current.split("\n");
			const end = new api.Position(Math.max(0, lines.length - 1), (lines.at(-1) ?? "").length);
			replace.replace(document.uri, new api.Range(new api.Position(0, 0), end), content);
			if (!await this.applyEdit(api, replace, requestId)) {
				throw new EditorBridgeError("apply_rejected", "VS Code did not apply created file content", { current: this.descriptor(binding), mayHaveApplied: true });
			}
			if (document.getText() !== content) {
				throw new EditorBridgeError("apply_race", "created editor content postcondition did not match", { current: this.descriptor(binding), mayHaveApplied: true });
			}
			binding = this.bind(document, { path: target.path, root: target.root });
		}
		return {
			kind: "create",
			requestId,
			document: this.snapshot(binding),
			undoPreserved: true,
			saved: false,
		};
	}

	private async deleteDocument(api: VscodeApi, request: EditorGuardInput & { requestId: string }): Promise<EditorDeleteResult> {
		const target = await this.resolveRequestTarget(api, request.path, request.handle);
		const known = this.#bindingsByHandle.get(request.handle.id);
		const lockKey = known?.uri ?? request.handle.uri;
		return this.withLock(lockKey, async () => {
			const binding = this.bindingFor(request, { path: target.path, root: target.root });
			const document = binding.document;
			if (document.isUntitled || document.uri.scheme === "untitled") {
				await this.closeUntitledWithoutSave(api, document, request.requestId);
			} else {
				const edit = new api.WorkspaceEdit();
				edit.deleteFile(document.uri, { recursive: false, ignoreIfNotExists: false });
				if (!await this.applyEdit(api, edit, request.requestId)) {
					throw new EditorBridgeError("apply_rejected", "VS Code did not delete the editor document", { current: this.descriptor(binding), mayHaveApplied: false });
				}
			}
			binding.closed = true;
			if (this.#bindingsByUri.get(binding.uri) === binding) this.#bindingsByUri.delete(binding.uri);
			return { kind: "delete", requestId: request.requestId, path: binding.path, uri: binding.uri };
		});
	}

	private async moveDocument(
		api: VscodeApi,
		request: EditorGuardInput & { requestId: string; destination: string },
	): Promise<EditorMoveResult> {
		const target = await this.resolveRequestTarget(api, request.path, request.handle);
		const destination = await this.resolveWritablePath(api, request.destination);
		if (destination.exists) throw new EditorBridgeError("destination_exists", "move destination already exists");
		const destOpen = this.findOpenDocument(api, destination.path);
		if (destOpen) {
			if (destOpen.isDirty) throw new EditorBridgeError("destination_exists", "move would overwrite a dirty destination document");
			throw new EditorBridgeError("destination_exists", "move destination is already open");
		}
		const known = this.#bindingsByHandle.get(request.handle.id);
		const lockKey = known?.uri ?? request.handle.uri;
		return this.withLock(lockKey, async () => {
			const binding = this.bindingFor(request, { path: target.path, root: target.root });
			const document = binding.document;
			if (document.isUntitled || document.uri.scheme === "untitled") {
				throw new EditorBridgeError("unsupported_document", "untitled documents must be created at a workspace path before move");
			}
			const edit = new api.WorkspaceEdit();
			edit.renameFile(document.uri, api.Uri.file(destination.path), { overwrite: false, ignoreIfExists: false });
			if (!await this.applyEdit(api, edit, request.requestId)) {
				throw new EditorBridgeError("apply_rejected", "VS Code did not rename the editor document", { current: this.descriptor(binding), mayHaveApplied: false });
			}
			let moved = this.findOpenDocument(api, destination.path);
			if (!moved) {
				try {
					moved = await api.workspace.openTextDocument(api.Uri.file(destination.path));
				} catch {
					throw new EditorBridgeError("apply_race", "renamed editor document could not be opened", { mayHaveApplied: true });
				}
			}
			binding.closed = true;
			if (this.#bindingsByUri.get(binding.uri) === binding) this.#bindingsByUri.delete(binding.uri);
			const next = this.bind(moved, { path: destination.path, root: destination.root });
			return {
				kind: "move",
				requestId: request.requestId,
				document: this.snapshot(next),
				undoPreserved: true,
				saved: false,
			};
		});
	}

	async create(path: string, content?: string): Promise<EditorCreateResult> {
		return this.createDocument(await this.api(), path, content, newId("caret-create"));
	}

	async delete(input: EditorGuardInput & { requestId?: string }): Promise<EditorDeleteResult> {
		return this.deleteDocument(await this.api(), { ...input, requestId: input.requestId ?? newId("caret-delete") });
	}

	async move(input: EditorGuardInput & { destination: string; requestId?: string }): Promise<EditorMoveResult> {
		return this.moveDocument(await this.api(), { ...input, requestId: input.requestId ?? newId("caret-move") });
	}

	private async inventoryDocuments(api: VscodeApi, includeClean: boolean): Promise<EditorInventorySnapshot> {
		const roots = await this.roots(api);
		const documents: EditorDocumentSnapshot[] = [];
		for (const document of api.workspace.textDocuments) {
			if (document.isClosed) continue;
			if (document.isUntitled || document.uri.scheme === "untitled") {
				const binding = this.bind(document, { path: document.uri.toString(), root: roots[0]! });
				documents.push(this.snapshot(binding));
				continue;
			}
			if (document.uri.scheme !== "file" || !isAbsolute(document.fileName)) continue;
			let path: string;
			try {
				path = await realpath(resolve(document.fileName));
			} catch {
				continue;
			}
			const root = roots
				.filter(candidate => isPathWithinWorkspace(candidate.path, path))
				.sort((a, b) => b.path.length - a.path.length)[0];
			if (!root || (!includeClean && !document.isDirty)) continue;
			const binding = this.bind(document, { path, root });
			documents.push(this.snapshot(binding));
		}
		documents.sort((a, b) => a.path.localeCompare(b.path) || a.uri.localeCompare(b.uri));
		return {
			workspaceRoots: roots.map(root => root.path),
			documents,
			dirtyCount: documents.filter(document => document.dirty).length,
			generatedAt: new Date().toISOString(),
		};
	}

	/** Report open document versions/hashes and dirty-buffer state. */
	async inventory(includeClean = true): Promise<EditorInventorySnapshot> {
		return this.inventoryDocuments(await this.api(), includeClean);
	}

	private errorResponse(requestId: string | undefined, error: unknown): EditorErrorResult {
		if (error instanceof EditorBridgeError) {
			return {
				kind: "error",
				...(requestId ? { requestId } : {}),
				error: {
					code: error.code,
					message: error.message,
					...(error.current ? { current: error.current } : {}),
					...(error.mayHaveApplied !== undefined ? { mayHaveApplied: error.mayHaveApplied } : {}),
				},
			};
		}
		return {
			kind: "error",
			...(requestId ? { requestId } : {}),
			error: { code: "apply_rejected", message: error instanceof Error ? error.message : String(error) },
		};
	}

	/**
	 * Serializable host boundary.  The host may register this callback with
	 * its pending editor-request poll; no vscode object crosses that boundary.
	 */
	async handleRequest(value: unknown): Promise<EditorResponse> {
		const requestId = errorRequestId(value);
		const request = parseEditorRequest(value);
		if (!request) return this.errorResponse(requestId, new EditorBridgeError("invalid_request", "invalid editor bridge request"));
		try {
			if (request.kind === "read") {
				const document = await this.read(request.path);
				const result: EditorReadResult = { kind: "read", requestId: request.requestId, document };
				return result;
			}
			if (request.kind === "apply") return await this.apply(request);
			if (request.kind === "create") {
				const created = await this.createDocument(await this.api(), request.path, request.content, request.requestId);
				return created;
			}
			if (request.kind === "delete") return await this.delete(request);
			if (request.kind === "move") return await this.move(request);
			const inventory = await this.inventory(request.includeClean ?? true);
			const result: EditorInventoryResult = { kind: "inventory", requestId: request.requestId, ...inventory };
			return result;
		} catch (error) {
			return this.errorResponse(request.requestId, error);
		}
	}
}
