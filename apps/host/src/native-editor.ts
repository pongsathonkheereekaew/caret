import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import type { EditorDocumentHandle, EditorDocumentSnapshot } from "../../../packages/protocol/src/editor.ts";
import { isUntitledEditorPath } from "../../../packages/protocol/src/editor.ts";
import { EditorConnections } from "./editors.ts";
import { applyNativeDisk } from "./native-disk.ts";
import { workspacePath } from "./workspaces.ts";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

function sameEditorPath(requested: string, document: EditorDocumentSnapshot): boolean {
  return document.path === requested || document.uri === requested || document.handle.uri === requested;
}

function parseHandle(value: unknown): EditorDocumentHandle {
  if (!record(value) || typeof value.id !== "string" || typeof value.uri !== "string") throw new Error("Invalid native editor handle");
  return { id: value.id, uri: value.uri };
}

function parseGuard(input: Record<string, unknown>): { handle: EditorDocumentHandle; expectedVersion: number; expectedHash: string } {
  const handle = parseHandle(input.handle);
  if (!Number.isSafeInteger(input.expectedVersion) || typeof input.expectedHash !== "string" || !/^[a-f0-9]{64}$/i.test(input.expectedHash)) {
    throw new Error("Invalid guarded native editor request");
  }
  return { handle, expectedVersion: input.expectedVersion as number, expectedHash: (input.expectedHash as string).toLowerCase() };
}

/** Per-OMP-incarnation native file bridge. A disconnected known buffer never silently becomes a disk file. */
export class NativeEditorBridge {
  readonly #editors: EditorConnections;
  readonly #cwd: string;
  readonly #knownPaths = new Set<string>();
  readonly #aliases = new Map<string, string>();
  constructor(editors: EditorConnections, cwd: string) { this.#editors = editors; this.#cwd = cwd; }

  async handle(input: unknown, signal: AbortSignal): Promise<unknown> {
    if (!record(input) || typeof input.path !== "string") throw new Error("Invalid native editor request");
    if (input.kind === "apply_disk") return this.#applyDisk(input, signal);
    if (input.kind === "snapshot") {
      return {
        document: await this.snapshot(input.path, signal),
        editorWorkspace: this.#editors.hasConnection(this.#cwd) || this.#editors.hasRegisteredWorkspace(this.#cwd),
      };
    }
    if (input.kind === "create") return this.#create(input, signal);
    if (input.kind === "delete") return this.#mutate(input, signal, "delete");
    if (input.kind === "move") return this.#mutate(input, signal, "move");
    if (input.kind !== "apply" || typeof input.content !== "string" || Buffer.byteLength(input.content) > 8 * 1024 * 1024) {
      throw new Error("Invalid guarded native editor apply");
    }
    const guard = parseGuard(input);
    const path = this.#identity(input.path).canonical;
    if (!this.#knownPaths.has(path)) throw new Error("Read an editor snapshot before applying native edits");
    const current = await this.#read(path, signal);
    if (!current || current.handle.id !== guard.handle.id || current.handle.uri !== guard.handle.uri
      || current.documentVersion !== guard.expectedVersion || current.sha256 !== guard.expectedHash) throw new Error("Editor changed after the native edit snapshot; read again before editing");
    const lines = current.text.split("\n");
    const result = await this.#editors.request(this.#cwd, {
      kind: "apply", path, handle: guard.handle, expectedVersion: guard.expectedVersion, expectedHash: guard.expectedHash,
      edits: [{ range: { start: { line: 0, character: 0 }, end: { line: lines.length - 1, character: lines.at(-1)!.length } }, text: input.content }],
    }, signal);
    if (result.kind === "error") throw new Error(`${result.error.code}: ${result.error.message}${result.error.mayHaveApplied ? "; outcome may have applied, inspect before retrying" : ""}`);
    if (result.kind !== "apply" || result.saved !== false || result.undoPreserved !== true || result.document.sha256 !== hash(input.content as string)
      || !sameEditorPath(path, { ...result.document, text: input.content as string, sha256: result.document.sha256 })
      || result.document.handle.id !== guard.handle.id || result.document.handle.uri !== guard.handle.uri
      || !Number.isSafeInteger(result.document.documentVersion) || result.document.documentVersion < current.documentVersion) throw new Error("Native editor apply outcome is unknown; inspect the buffer before retrying");
    return { text: input.content, document: result.document, saved: false, undoPreserved: true };
  }

  /**
   * Apply a guarded disk change only for a workspace that has never been
   * registered by this editor bridge incarnation. The ownership check and the
   * complete native transaction are synchronous so registration/disconnect
   * cannot interleave with the check or the write.
   */
  #applyDisk(input: Record<string, unknown>, signal: AbortSignal): unknown {
    if (signal.aborted) throw new Error("Native disk apply cancelled");
    if (typeof input.expectedCanonicalPath !== "string" || typeof input.expectedText !== "string" || typeof input.content !== "string") throw new Error("Invalid native disk apply");
    // The synchronous disk helper validates the original alias and canonical target.
    const canonical = input.expectedCanonicalPath;
    if (this.#editors.hasRegisteredWorkspace(this.#cwd)) throw new Error("Headless disk apply is disabled after an editor workspace was registered");
    if (this.#knownPaths.has(canonical)) throw new Error("Headless disk apply is disabled for a known native editor path");
    return applyNativeDisk({ cwd: this.#cwd, path: input.path as string, expectedCanonicalPath: input.expectedCanonicalPath,
      expectedText: input.expectedText, content: input.content });
  }

  async snapshot(path: string, signal: AbortSignal): Promise<EditorDocumentSnapshot | null> {
    const { lexical, canonical } = this.#identity(path);
    path = canonical;
    if (!this.#editors.hasConnection(this.#cwd)) {
      if (this.#knownPaths.has(path)) throw new Error("Editor snapshot owner disconnected; reopen the task editor before changing this file");
      // A task that never used a native buffer retains OMP's headless disk IO.
      return null;
    }
    if (!this.#knownPaths.has(path) && this.#knownPaths.size >= 8192) throw new Error("Native editor snapshot capacity reached");
    const known = this.#knownPaths.has(path);
    if (!this.#aliases.has(lexical) && this.#aliases.size >= 8192) throw new Error("Native editor alias capacity reached");
    this.#aliases.set(lexical, canonical);
    this.#knownPaths.add(path);
    const document = await this.#read(path, signal);
    if (!document && known) throw new Error("Previously opened editor document is unavailable; inspect it before retrying");
    if (!document && !known) { this.#knownPaths.delete(path); this.#aliases.delete(lexical); }
    if (document) {
      this.#knownPaths.add(document.path);
      this.#knownPaths.add(document.uri);
    }
    return document;
  }

  async #create(input: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
    if (typeof input.content !== "undefined" && (typeof input.content !== "string" || Buffer.byteLength(input.content) > 8 * 1024 * 1024)) {
      throw new Error("Invalid native editor create");
    }
    const path = this.#identity(input.path as string).canonical;
    const result = await this.#editors.request(this.#cwd, { kind: "create", path, ...(typeof input.content === "string" ? { content: input.content } : {}) }, signal);
    if (result.kind === "error") throw new Error(`${result.error.code}: ${result.error.message}${result.error.mayHaveApplied ? "; outcome may have applied, inspect before retrying" : ""}`);
    if (result.kind !== "create" || result.saved !== false || result.undoPreserved !== true || !sameEditorPath(path, result.document)) {
      throw new Error("Native editor create outcome is unknown; inspect before retrying");
    }
    this.#knownPaths.add(path);
    this.#knownPaths.add(result.document.path);
    return { document: result.document, saved: false, undoPreserved: true };
  }

  async #mutate(input: Record<string, unknown>, signal: AbortSignal, kind: "delete" | "move"): Promise<unknown> {
    const guard = parseGuard(input);
    const path = this.#identity(input.path as string).canonical;
    if (!this.#knownPaths.has(path)) throw new Error("Read an editor snapshot before applying native edits");
    const current = await this.#read(path, signal);
    if (!current || current.handle.id !== guard.handle.id || current.handle.uri !== guard.handle.uri
      || current.documentVersion !== guard.expectedVersion || current.sha256 !== guard.expectedHash) throw new Error("Editor changed after the native edit snapshot; read again before editing");
    if (kind === "move" && (isUntitledEditorPath(path) || isUntitledEditorPath(String(input.destination ?? "")))) {
      throw new Error("Untitled documents must be created at a workspace path before move");
    }
    const destination = kind === "move" ? this.#identity(String(input.destination)).canonical : undefined;
    if (kind === "move" && (typeof input.destination !== "string" || !destination)) throw new Error("Invalid native editor move");
    const result = await this.#editors.request(this.#cwd, {
      kind, path, handle: guard.handle, expectedVersion: guard.expectedVersion, expectedHash: guard.expectedHash,
      ...(destination ? { destination } : {}),
    }, signal);
    if (result.kind === "error") throw new Error(`${result.error.code}: ${result.error.message}${result.error.mayHaveApplied ? "; outcome may have applied, inspect before retrying" : ""}`);
    if (kind === "delete") {
      if (result.kind !== "delete" || (result.path !== path && result.uri !== path && result.uri !== current.uri)) {
        throw new Error("Native editor delete outcome is unknown; inspect before retrying");
      }
      this.#knownPaths.delete(path);
      return { deleted: true, path: result.path, uri: result.uri };
    }
    if (result.kind !== "move" || result.saved !== false || result.undoPreserved !== true || result.document.path !== destination) {
      throw new Error("Native editor move outcome is unknown; inspect the buffer before retrying");
    }
    this.#knownPaths.delete(path);
    this.#knownPaths.add(result.document.path);
    return { document: result.document, saved: false, undoPreserved: true };
  }

  #identity(input: string): { lexical: string; canonical: string } {
    if (isUntitledEditorPath(input)) {
      const previous = this.#aliases.get(input);
      if (previous && previous !== input) throw new Error("Editor path changed its target; inspect before retrying");
      return { lexical: input, canonical: input };
    }
    const lexical = workspacePath(this.#cwd, input);
    let ancestor = lexical;
    while (!existsSync(ancestor)) ancestor = dirname(ancestor);
    const canonical = resolve(realpathSync(ancestor), relative(ancestor, lexical));
    const previous = this.#aliases.get(lexical);
    if (previous && previous !== canonical) throw new Error("Editor path changed its target; inspect before retrying");
    return { lexical, canonical };
  }

  async #read(path: string, signal: AbortSignal): Promise<EditorDocumentSnapshot | null> {
    const response = await this.#editors.request(this.#cwd, { kind: "read", path }, signal);
    if (response.kind === "error") {
      if (response.error.code === "document_not_found") return null;
      throw new Error(`${response.error.code}: ${response.error.message}`);
    }
    if (response.kind !== "read" || typeof response.document?.text !== "string" || !sameEditorPath(path, response.document)
      || !Number.isSafeInteger(response.document.documentVersion) || !response.document.handle?.id || !response.document.handle.uri
      || Buffer.byteLength(response.document.text) > 8 * 1024 * 1024 || hash(response.document.text) !== response.document.sha256) throw new Error("Invalid native editor snapshot");
    return response.document;
  }
}
