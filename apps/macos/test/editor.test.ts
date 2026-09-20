import { existsSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import {
	CediaEditorService,
	evaluateEditorGuard,
	isPathWithinWorkspace,
	parseEditorRequest,
	sha256Text,
} from "../src/editor.ts";
import { CEDIA_EDITOR_PROTOCOL_VERSION } from "../../../packages/protocol/src/editor.ts";

const handle = { id: "doc-1", uri: "file:///workspace/project/app.ts" } as const;
const text = "const answer = 42;\n";

describe("Cedia editor bridge guard", () => {
	it("keeps workspace path boundaries exact", () => {
		expect(isPathWithinWorkspace("/workspace/project", "/workspace/project/app.ts")).toBe(true);
		expect(isPathWithinWorkspace("/workspace/project", "/workspace/project")).toBe(true);
		expect(isPathWithinWorkspace("/workspace/project", "/workspace/projected/app.ts")).toBe(false);
		expect(isPathWithinWorkspace("/workspace/project", "/workspace/other/app.ts")).toBe(false);
		expect(isPathWithinWorkspace("relative/project", "/workspace/project/app.ts")).toBe(false);
	});

	it("accepts an exact version/hash/handle and reports each stale reason", () => {
		const expected = {
			handle,
			path: "/workspace/project/app.ts",
			expectedVersion: 7,
			expectedHash: sha256Text(text),
		};
		const actual = {
			handleId: handle.id,
			handleUri: handle.uri,
			path: expected.path,
			documentVersion: 7,
			sha256: expected.expectedHash,
			closed: false,
		};
		expect(evaluateEditorGuard(actual, expected)).toEqual({ ok: true });
		expect(evaluateEditorGuard({ ...actual, documentVersion: 8 }, expected)).toEqual({ ok: false, code: "stale_document" });
		expect(evaluateEditorGuard({ ...actual, sha256: sha256Text("changed") }, expected)).toEqual({ ok: false, code: "hash_mismatch" });
		expect(evaluateEditorGuard({ ...actual, handleId: "doc-replaced" }, expected)).toEqual({ ok: false, code: "document_replaced" });
		// Closed takes precedence over the other stale signals so callers never
		// treat a disposed model as writable.
		expect(evaluateEditorGuard({ ...actual, closed: true, documentVersion: 8 }, expected)).toEqual({ ok: false, code: "document_closed" });
	});
});

describe("Cedia editor bridge request boundary", () => {
	it("parses serializable read, inventory and guarded apply requests", () => {
		expect(parseEditorRequest({ protocolVersion: CEDIA_EDITOR_PROTOCOL_VERSION, requestId: "r-1", kind: "read", path: "/workspace/project/app.ts" })).toEqual({
			protocolVersion: 1,
			requestId: "r-1",
			kind: "read",
			path: "/workspace/project/app.ts",
		});
		expect(parseEditorRequest({ protocolVersion: 1, requestId: "r-2", kind: "inventory", includeClean: false })).toEqual({
			protocolVersion: 1,
			requestId: "r-2",
			kind: "inventory",
			includeClean: false,
		});
		const request = parseEditorRequest({
			protocolVersion: 1,
			requestId: "r-3",
			kind: "apply",
			path: "/workspace/project/app.ts",
			handle,
			expectedVersion: 7,
			expectedHash: sha256Text(text).toUpperCase(),
			edits: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } }, text: "let" }],
		});
		expect(request).toMatchObject({ kind: "apply", expectedVersion: 7, expectedHash: sha256Text(text), handle });
	});

	it("rejects malformed or under-specified writes before vscode is involved", () => {
		const valid = {
			protocolVersion: 1,
			requestId: "r-1",
			kind: "apply",
			path: "/workspace/project/app.ts",
			handle,
			expectedVersion: 7,
			expectedHash: sha256Text(text),
			edits: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } }, text: "let" }],
		};
		expect(parseEditorRequest({ ...valid, expectedVersion: 0 })).toBeUndefined();
		expect(parseEditorRequest({ ...valid, expectedHash: "not-a-hash" })).toBeUndefined();
		expect(parseEditorRequest({ ...valid, handle: { id: "doc-1" } })).toBeUndefined();
		expect(parseEditorRequest({ ...valid, edits: [{ range: { start: { line: -1, character: 0 }, end: { line: 0, character: 0 } }, text: "x" }] })).toBeUndefined();
		expect(parseEditorRequest({ protocolVersion: 2, requestId: "r-1", kind: "read", path: "/workspace/project/app.ts" })).toBeUndefined();
	});

	it("parses create, delete and move and rejects overwrite", () => {
		expect(parseEditorRequest({
			protocolVersion: 1,
			requestId: "c-1",
			kind: "create",
			path: "/workspace/project/new.ts",
			content: "export {}\n",
		})).toMatchObject({ kind: "create", path: "/workspace/project/new.ts", content: "export {}\n" });
		expect(parseEditorRequest({
			protocolVersion: 1,
			requestId: "c-2",
			kind: "create",
			path: "/workspace/project/new.ts",
			overwrite: true,
		})).toBeUndefined();
		expect(parseEditorRequest({
			protocolVersion: 1,
			requestId: "d-1",
			kind: "delete",
			path: "/workspace/project/app.ts",
			handle,
			expectedVersion: 7,
			expectedHash: sha256Text(text),
		})).toMatchObject({ kind: "delete", handle });
		expect(parseEditorRequest({
			protocolVersion: 1,
			requestId: "m-1",
			kind: "move",
			path: "/workspace/project/app.ts",
			destination: "/workspace/project/renamed.ts",
			handle,
			expectedVersion: 7,
			expectedHash: sha256Text(text),
		})).toMatchObject({ kind: "move", destination: "/workspace/project/renamed.ts" });
		expect(parseEditorRequest({
			protocolVersion: 1,
			requestId: "m-2",
			kind: "move",
			path: "/workspace/project/app.ts",
			destination: "/workspace/project/renamed.ts",
			handle,
			expectedVersion: 7,
			expectedHash: sha256Text(text),
			overwrite: true,
		})).toBeUndefined();
	});
});



it("preserves editor open errors instead of advertising a missing file", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cedia-editor-open-")));
  const path = join(root, "fixture.txt"); writeFileSync(path, "disk");
  const api = { Uri: { file: (path: string) => ({ fsPath: path }) }, workspace: {
    onDidOpenTextDocument: () => ({ dispose() {} }), onDidCloseTextDocument: () => ({ dispose() {} }),
    openTextDocument: async () => { throw Object.assign(new Error("permission denied"), { code: "EACCES" }); },
  } } as unknown as typeof import("vscode");
  const editor = new CediaEditorService({ api, workspaceRoots: [root] });
  try {
    await expect(editor.read(path)).rejects.toMatchObject({ code: "unsupported_document" });
    await expect(editor.read(join(root, "missing.txt"))).rejects.toMatchObject({ code: "document_not_found" });
  } finally { editor.dispose(); rmSync(root, { recursive: true, force: true }); }
});

class Position {
	constructor(readonly line: number, readonly character: number) {}
	isEqual(other: Position) { return this.line === other.line && this.character === other.character; }
}
class Range {
	constructor(readonly start: Position, readonly end: Position) {}
}
class WorkspaceEdit {
	creates: Array<{ uri: { fsPath: string }; options?: { overwrite?: boolean } }> = [];
	deletes: Array<{ uri: { toString(): string; scheme: string; fsPath?: string } }> = [];
	renames: Array<{ oldUri: { fsPath: string }; newUri: { fsPath: string }; options?: { overwrite?: boolean } }> = [];
	replaces: Array<{ uri: { toString(): string }; range: Range; text: string }> = [];
	createFile(uri: { fsPath: string }, options?: { overwrite?: boolean }) { this.creates.push({ uri, options }); }
	deleteFile(uri: { toString(): string; scheme: string; fsPath?: string }) { this.deletes.push({ uri }); }
	renameFile(oldUri: { fsPath: string }, newUri: { fsPath: string }, options?: { overwrite?: boolean }) {
		this.renames.push({ oldUri, newUri, options });
	}
	replace(uri: { toString(): string }, range: Range, text: string) { this.replaces.push({ uri, range, text }); }
}

function makeDocument(init: {
	uri: { scheme: string; fsPath: string; path: string; toString(): string };
	fileName: string;
	text: string;
	version?: number;
	isUntitled?: boolean;
	isDirty?: boolean;
}) {
	const state = { text: init.text, version: init.version ?? 1, dirty: init.isDirty ?? false, closed: false, uri: init.uri, fileName: init.fileName };
	return {
		get uri() { return state.uri; },
		set uri(value: typeof init.uri) { state.uri = value; },
		get fileName() { return state.fileName; },
		set fileName(value: string) { state.fileName = value; },
		get isUntitled() { return init.isUntitled ?? state.uri.scheme === "untitled"; },
		get isDirty() { return state.dirty; },
		get isClosed() { return state.closed; },
		get version() { return state.version; },
		languageId: "plaintext",
		encoding: "utf8",
		eol: 1,
		getText: () => state.text,
		offsetAt: (position: Position) => {
			const lines = state.text.split("\n");
			let offset = 0;
			for (let line = 0; line < position.line; line += 1) offset += (lines[line] ?? "").length + 1;
			return offset + position.character;
		},
		validatePosition: (position: Position) => position,
		save: async () => { throw new Error("TextDocument.save must not be called"); },
		state,
	};
}

function fileUri(fsPath: string) {
	return { scheme: "file", fsPath, path: fsPath, toString: () => `file://${fsPath}` };
}

describe("Cedia editor create/delete/move/untitled", () => {
	it("inventories untitled buffers and snapshots them without realpath", async () => {
		const root = realpathSync(mkdtempSync(join(tmpdir(), "cedia-editor-untitled-")));
		const untitledUri = { scheme: "untitled", fsPath: "", path: "Untitled-1", toString: () => "untitled:Untitled-1" };
		const untitled = makeDocument({ uri: untitledUri, fileName: "Untitled-1", text: "scratch\n", isUntitled: true, isDirty: true, version: 2 });
		const api = {
			Uri: { file: fileUri },
			Position,
			Range,
			WorkspaceEdit,
			workspace: {
				textDocuments: [untitled],
				onDidOpenTextDocument: () => ({ dispose() {} }),
				onDidCloseTextDocument: () => ({ dispose() {} }),
				openTextDocument: async () => untitled,
				applyEdit: async () => true,
			},
		} as unknown as typeof import("vscode");
		const editor = new CediaEditorService({ api, workspaceRoots: [root] });
		try {
			const inventory = await editor.inventory();
			expect(inventory.documents).toHaveLength(1);
			expect(inventory.documents[0]).toMatchObject({ isUntitled: true, path: "untitled:Untitled-1", dirty: true });
			const snapshot = await editor.read("untitled:Untitled-1");
			expect(snapshot.text).toBe("scratch\n");
			expect(snapshot.isUntitled).toBe(true);
		} finally { editor.dispose(); rmSync(root, { recursive: true, force: true }); }
	});

	it("creates a missing workspace file then applies unsaved content without save", async () => {
		const root = realpathSync(mkdtempSync(join(tmpdir(), "cedia-editor-create-")));
		const createdPath = join(root, "created.ts");
		const docs: ReturnType<typeof makeDocument>[] = [];
		const api = {
			Uri: { file: fileUri },
			Position,
			Range,
			WorkspaceEdit,
			workspace: {
				get textDocuments() { return docs; },
				onDidOpenTextDocument: () => ({ dispose() {} }),
				onDidCloseTextDocument: () => ({ dispose() {} }),
				openTextDocument: async (uri: { fsPath: string }) => {
					const existing = docs.find(document => document.uri.fsPath === uri.fsPath);
					if (existing) return existing;
					const document = makeDocument({ uri: fileUri(uri.fsPath), fileName: uri.fsPath, text: existsSync(uri.fsPath) ? readFileSync(uri.fsPath, "utf8") : "" });
					docs.push(document);
					return document;
				},
				applyEdit: async (edit: WorkspaceEdit) => {
					for (const create of edit.creates) {
						if (existsSync(create.uri.fsPath) && create.options?.overwrite !== true) return false;
						writeFileSync(create.uri.fsPath, "");
					}
					for (const replace of edit.replaces) {
						const document = docs.find(item => item.uri.toString() === replace.uri.toString());
						if (!document) return false;
						document.state.text = replace.text;
						document.state.version += 1;
						document.state.dirty = true;
					}
					return true;
				},
			},
		} as unknown as typeof import("vscode");
		const editor = new CediaEditorService({ api, workspaceRoots: [root] });
		try {
			const created = await editor.create(createdPath, "export const value = 1;\n");
			expect(created.saved).toBe(false);
			expect(created.undoPreserved).toBe(true);
			expect(created.document.text).toBe("export const value = 1;\n");
			expect(created.document.dirty).toBe(true);
			expect(readFileSync(createdPath, "utf8")).toBe("");
			await expect(editor.create(createdPath, "nope\n")).rejects.toMatchObject({ code: "already_exists" });
		} finally { editor.dispose(); rmSync(root, { recursive: true, force: true }); }
	});

	it("deletes an open document through WorkspaceEdit and fails closed on a stale guard", async () => {
		const root = realpathSync(mkdtempSync(join(tmpdir(), "cedia-editor-delete-")));
		const target = join(root, "gone.ts"); writeFileSync(target, "keep\n");
		const document = makeDocument({ uri: fileUri(target), fileName: target, text: "keep\n", version: 3 });
		const docs = [document];
		const api = {
			Uri: { file: fileUri },
			Position,
			Range,
			WorkspaceEdit,
			workspace: {
				get textDocuments() { return docs; },
				onDidOpenTextDocument: () => ({ dispose() {} }),
				onDidCloseTextDocument: () => ({ dispose() {} }),
				openTextDocument: async () => document,
				applyEdit: async (edit: WorkspaceEdit) => {
					for (const item of edit.deletes) {
						if (item.uri.scheme === "file" && item.uri.fsPath) unlinkSync(item.uri.fsPath);
						document.state.closed = true;
					}
					return true;
				},
			},
		} as unknown as typeof import("vscode");
		const editor = new CediaEditorService({ api, workspaceRoots: [root] });
		try {
			const snapshot = await editor.read(target);
			await expect(editor.delete({
				path: target,
				handle: snapshot.handle,
				expectedVersion: 99,
				expectedHash: snapshot.sha256,
			})).rejects.toMatchObject({ code: "stale_document" });
			expect(existsSync(target)).toBe(true);
			const deleted = await editor.delete({
				path: target,
				handle: snapshot.handle,
				expectedVersion: snapshot.documentVersion,
				expectedHash: snapshot.sha256,
			});
			expect(deleted.kind).toBe("delete");
			expect(existsSync(target)).toBe(false);
		} finally { editor.dispose(); rmSync(root, { recursive: true, force: true }); }
	});

	it("renames an open document and refuses an existing destination", async () => {
		const root = realpathSync(mkdtempSync(join(tmpdir(), "cedia-editor-move-")));
		const from = join(root, "from.ts"); writeFileSync(from, "from\n");
		const dest = join(root, "to.ts"); writeFileSync(dest, "taken\n");
		const document = makeDocument({ uri: fileUri(from), fileName: from, text: "from\n", version: 4 });
		const docs = [document];
		const api = {
			Uri: { file: fileUri },
			Position,
			Range,
			WorkspaceEdit,
			workspace: {
				get textDocuments() { return docs; },
				onDidOpenTextDocument: () => ({ dispose() {} }),
				onDidCloseTextDocument: () => ({ dispose() {} }),
				openTextDocument: async (uri: { fsPath: string }) => {
					if (uri.fsPath === document.uri.fsPath) return document;
					return makeDocument({ uri: fileUri(uri.fsPath), fileName: uri.fsPath, text: readFileSync(uri.fsPath, "utf8") });
				},
				applyEdit: async (edit: WorkspaceEdit) => {
					for (const rename of edit.renames) {
						if (rename.options?.overwrite === true) return false;
						if (existsSync(rename.newUri.fsPath)) return false;
						renameSync(rename.oldUri.fsPath, rename.newUri.fsPath);
						document.uri = fileUri(rename.newUri.fsPath);
						document.fileName = rename.newUri.fsPath;
					}
					return true;
				},
			},
		} as unknown as typeof import("vscode");
		const editor = new CediaEditorService({ api, workspaceRoots: [root] });
		try {
			const snapshot = await editor.read(from);
			await expect(editor.move({
				path: from,
				destination: dest,
				handle: snapshot.handle,
				expectedVersion: snapshot.documentVersion,
				expectedHash: snapshot.sha256,
			})).rejects.toMatchObject({ code: "destination_exists" });
			expect(readFileSync(from, "utf8")).toBe("from\n");
			unlinkSync(dest);
			const moved = await editor.move({
				path: from,
				destination: dest,
				handle: snapshot.handle,
				expectedVersion: snapshot.documentVersion,
				expectedHash: snapshot.sha256,
			});
			expect(moved.saved).toBe(false);
			expect(moved.document.path).toBe(dest);
			expect(existsSync(from)).toBe(false);
			expect(readFileSync(dest, "utf8")).toBe("from\n");
		} finally { editor.dispose(); rmSync(root, { recursive: true, force: true }); }
	});

	it("closes untitled documents without deleteFile and honors the live-request gate", async () => {
		const root = realpathSync(mkdtempSync(join(tmpdir(), "cedia-editor-untitled-delete-")));
		const untitledUri = { scheme: "untitled", fsPath: "", path: "Untitled-1", toString: () => "untitled:Untitled-1" };
		const untitled = makeDocument({ uri: untitledUri, fileName: "Untitled-1", text: "scratch\n", isUntitled: true, isDirty: true, version: 2 });
		const closed: unknown[] = [];
		const deleted: unknown[] = [];
		let live = true;
		const api = {
			Uri: { file: fileUri },
			Position,
			Range,
			WorkspaceEdit,
			window: {
				tabGroups: {
					all: [{ tabs: [{ input: { uri: untitledUri } }] }],
					close: async (tab: unknown) => { closed.push(tab); untitled.state.closed = true; return true; },
				},
			},
			workspace: {
				textDocuments: [untitled],
				onDidOpenTextDocument: () => ({ dispose() {} }),
				onDidCloseTextDocument: () => ({ dispose() {} }),
				openTextDocument: async () => untitled,
				applyEdit: async (edit: WorkspaceEdit) => {
					deleted.push(...edit.deletes);
					return true;
				},
			},
		} as unknown as typeof import("vscode");
		const editor = new CediaEditorService({
			api,
			workspaceRoots: [root],
			beforeApply: async () => live,
		});
		try {
			const snapshot = await editor.read("untitled:Untitled-1");
			live = false;
			await expect(editor.delete({
				path: snapshot.path,
				handle: snapshot.handle,
				expectedVersion: snapshot.documentVersion,
				expectedHash: snapshot.sha256,
			})).rejects.toMatchObject({ code: "apply_rejected" });
			expect(closed).toHaveLength(0);
			live = true;
			const result = await editor.delete({
				path: snapshot.path,
				handle: snapshot.handle,
				expectedVersion: snapshot.documentVersion,
				expectedHash: snapshot.sha256,
			});
			expect(result.kind).toBe("delete");
			expect(closed).toHaveLength(1);
			expect(deleted).toEqual([]);
		} finally { editor.dispose(); rmSync(root, { recursive: true, force: true }); }
	});

	it("rejects moving an untitled document instead of writing a workspace path", async () => {
		const root = realpathSync(mkdtempSync(join(tmpdir(), "cedia-editor-untitled-move-")));
		const dest = join(root, "saved.ts");
		const untitledUri = { scheme: "untitled", fsPath: "", path: "Untitled-1", toString: () => "untitled:Untitled-1" };
		const untitled = makeDocument({ uri: untitledUri, fileName: "Untitled-1", text: "scratch\n", isUntitled: true, isDirty: true, version: 2 });
		const renamed: unknown[] = [];
		const api = {
			Uri: { file: fileUri },
			Position,
			Range,
			WorkspaceEdit,
			workspace: {
				textDocuments: [untitled],
				onDidOpenTextDocument: () => ({ dispose() {} }),
				onDidCloseTextDocument: () => ({ dispose() {} }),
				openTextDocument: async () => untitled,
				applyEdit: async (edit: WorkspaceEdit) => {
					renamed.push(...edit.renames);
					return true;
				},
			},
		} as unknown as typeof import("vscode");
		const editor = new CediaEditorService({ api, workspaceRoots: [root] });
		try {
			const snapshot = await editor.read("untitled:Untitled-1");
			await expect(editor.move({
				path: snapshot.path,
				destination: dest,
				handle: snapshot.handle,
				expectedVersion: snapshot.documentVersion,
				expectedHash: snapshot.sha256,
			})).rejects.toMatchObject({ code: "unsupported_document" });
			expect(renamed).toEqual([]);
			expect(existsSync(dest)).toBe(false);
		} finally { editor.dispose(); rmSync(root, { recursive: true, force: true }); }
	});
});

describe("Cedia editor bridge applied-edit report", () => {
	it("reports the geometry, the produced version, and the pre-edit text without saving", async () => {
		const root = realpathSync(mkdtempSync(join(tmpdir(), "cedia-editor-marks-")));
		const target = join(root, "app.ts");
		writeFileSync(target, "const answer = 41;\n");
		const document = makeDocument({ uri: fileUri(target), fileName: target, text: "const answer = 41;\n", version: 4 });
		const docs = [document];
		const api = {
			Uri: { file: fileUri },
			Position,
			Range,
			WorkspaceEdit,
			workspace: {
				get textDocuments() { return docs; },
				onDidOpenTextDocument: () => ({ dispose() {} }),
				onDidCloseTextDocument: () => ({ dispose() {} }),
				openTextDocument: async () => document,
				applyEdit: async (edit: WorkspaceEdit) => {
					for (const replace of edit.replaces) {
						// A partial replace, not a whole-document write: the bridge
						// edits one range inside the buffer.
						const lines = document.state.text.split("\n");
						const offsetAt = (position: Position) => {
							let offset = 0;
							for (let line = 0; line < position.line; line += 1) offset += (lines[line] ?? "").length + 1;
							return offset + position.character;
						};
						const start = offsetAt(replace.range.start);
						const end = offsetAt(replace.range.end);
						document.state.text = document.state.text.slice(0, start) + replace.text + document.state.text.slice(end);
						document.state.version += 1;
						document.state.dirty = true;
					}
					return true;
				},
			},
		} as unknown as typeof import("vscode");
		const seen: unknown[] = [];
		const editor = new CediaEditorService({ api, workspaceRoots: [root], afterApply: summary => { seen.push(summary); } });
		try {
			const snapshot = await editor.read(target);
			const applied = await editor.apply({
				path: target,
				handle: snapshot.handle,
				expectedVersion: snapshot.documentVersion,
				expectedHash: snapshot.sha256,
				edits: [{ range: { start: { line: 0, character: 15 }, end: { line: 0, character: 17 } }, text: "42" }],
			});
			expect(applied.kind).toBe("apply");
			// The report is what the editor marks are built from: the real range,
			// the version the edit produced, and the exact text to restore.
			expect(seen).toEqual([{
				path: target,
				uri: `file://${target}`,
				requestId: "",
				version: 5,
				textBefore: "const answer = 41;\n",
				edits: [{ range: { start: { line: 0, character: 15 }, end: { line: 0, character: 17 } }, text: "42" }],
			}]);
			// An apply is never a save: the change stays in the buffer for the user
			// to keep or take back.
			expect(document.state.dirty).toBe(true);
			expect(readFileSync(target, "utf8")).toBe("const answer = 41;\n");
		} finally { editor.dispose(); rmSync(root, { recursive: true, force: true }); }
	});

	it("reports nothing when the apply is rejected", async () => {
		const root = realpathSync(mkdtempSync(join(tmpdir(), "cedia-editor-marks-reject-")));
		const target = join(root, "app.ts");
		writeFileSync(target, "const answer = 41;\n");
		const document = makeDocument({ uri: fileUri(target), fileName: target, text: "const answer = 41;\n", version: 4 });
		const api = {
			Uri: { file: fileUri },
			Position,
			Range,
			WorkspaceEdit,
			workspace: {
				get textDocuments() { return [document]; },
				onDidOpenTextDocument: () => ({ dispose() {} }),
				onDidCloseTextDocument: () => ({ dispose() {} }),
				openTextDocument: async () => document,
				applyEdit: async () => true,
			},
		} as unknown as typeof import("vscode");
		const seen: unknown[] = [];
		const editor = new CediaEditorService({ api, workspaceRoots: [root], afterApply: summary => { seen.push(summary); } });
		try {
			const snapshot = await editor.read(target);
			await expect(editor.apply({
				path: target,
				handle: snapshot.handle,
				// Stale on purpose: the guard must fail before anything is applied.
				expectedVersion: snapshot.documentVersion + 1,
				expectedHash: snapshot.sha256,
				edits: [{ range: { start: { line: 0, character: 15 }, end: { line: 0, character: 17 } }, text: "42" }],
			})).rejects.toMatchObject({ code: "stale_document" });
			expect(seen).toEqual([]);
		} finally { editor.dispose(); rmSync(root, { recursive: true, force: true }); }
	});
});
