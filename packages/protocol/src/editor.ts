/**
 * Native editor bridge contracts.
 *
 * The Mac extension owns the text model and its undo stack.  The host may ask
 * for a serializable snapshot and may submit a guarded text transaction, but
 * it never writes the file system behind the editor's back.
 */

export const CARET_EDITOR_PROTOCOL_VERSION = 1 as const;

export type EditorErrorCode =
	| "invalid_request"
	| "path_outside_workspace"
	| "unsupported_document"
	| "document_not_found"
	| "document_closed"
	| "document_replaced"
	| "stale_document"
	| "hash_mismatch"
	| "invalid_edit"
	| "apply_rejected"
	| "apply_race"
	| "already_exists"
	| "destination_exists"
	| "workspace_unavailable"
	| "bridge_disposed";

/** True for VS Code untitled buffers (`untitled:Untitled-1`). Never realpath these. */
export function isUntitledEditorPath(path: string): boolean {
	return path.startsWith("untitled:");
}

export interface EditorPosition {
	readonly line: number;
	readonly character: number;
}

export interface EditorRange {
	readonly start: EditorPosition;
	readonly end: EditorPosition;
}

export interface EditorTextEdit {
	readonly range: EditorRange;
	readonly text: string;
}

/**
 * An opaque per-document-incarnation handle.  A handle is returned by read
 * and inventory and must be echoed by a write.  It prevents a path that was
 * closed and subsequently re-opened from being mistaken for the same model.
 */
export interface EditorDocumentHandle {
	readonly id: string;
	readonly uri: string;
}

export interface EditorDocumentSnapshot {
	readonly handle: EditorDocumentHandle;
	readonly path: string;
	readonly uri: string;
	readonly workspaceRoot: string;
	readonly text: string;
	readonly documentVersion: number;
	readonly sha256: string;
	readonly dirty: boolean;
	readonly isUntitled: boolean;
	readonly languageId: string;
	readonly encoding: string;
}

export interface EditorReadRequest {
	readonly protocolVersion: typeof CARET_EDITOR_PROTOCOL_VERSION;
	readonly requestId: string;
	readonly kind: "read";
	readonly path: string;
}

export interface EditorApplyRequest {
	readonly protocolVersion: typeof CARET_EDITOR_PROTOCOL_VERSION;
	readonly requestId: string;
	readonly kind: "apply";
	readonly path: string;
	readonly handle: EditorDocumentHandle;
	readonly expectedVersion: number;
	readonly expectedHash: string;
	readonly edits: readonly EditorTextEdit[];
}

export interface EditorInventoryRequest {
	readonly protocolVersion: typeof CARET_EDITOR_PROTOCOL_VERSION;
	readonly requestId: string;
	readonly kind: "inventory";
	/** Include clean documents as well as dirty documents. Defaults to true. */
	readonly includeClean?: boolean;
}

export interface EditorCreateRequest {
	readonly protocolVersion: typeof CARET_EDITOR_PROTOCOL_VERSION;
	readonly requestId: string;
	readonly kind: "create";
	readonly path: string;
	/** Applied as an unsaved buffer after createFile opens the document. */
	readonly content?: string;
	/** Must be absent or false; create never clobbers. */
	readonly overwrite?: false;
}

export interface EditorDeleteRequest {
	readonly protocolVersion: typeof CARET_EDITOR_PROTOCOL_VERSION;
	readonly requestId: string;
	readonly kind: "delete";
	readonly path: string;
	readonly handle: EditorDocumentHandle;
	readonly expectedVersion: number;
	readonly expectedHash: string;
}

export interface EditorMoveRequest {
	readonly protocolVersion: typeof CARET_EDITOR_PROTOCOL_VERSION;
	readonly requestId: string;
	readonly kind: "move";
	readonly path: string;
	readonly destination: string;
	readonly handle: EditorDocumentHandle;
	readonly expectedVersion: number;
	readonly expectedHash: string;
	/** Must be absent or false; never overwrite a dirty destination. */
	readonly overwrite?: false;
}

export type EditorRequest =
	| EditorReadRequest
	| EditorApplyRequest
	| EditorInventoryRequest
	| EditorCreateRequest
	| EditorDeleteRequest
	| EditorMoveRequest;

export interface EditorReadResult {
	readonly kind: "read";
	readonly requestId: string;
	readonly document: EditorDocumentSnapshot;
}

export interface EditorApplyResult {
	readonly kind: "apply";
	readonly requestId: string;
	readonly document: Omit<EditorDocumentSnapshot, "text">;
	/** WorkspaceEdit is intentionally used so the native undo stack remains available. */
	readonly undoPreserved: true;
	/** Always false: the bridge never calls TextDocument.save(). */
	readonly saved: false;
}

export interface EditorInventoryResult {
	readonly kind: "inventory";
	readonly requestId: string;
	readonly workspaceRoots: readonly string[];
	readonly documents: readonly EditorDocumentSnapshot[];
	readonly dirtyCount: number;
	readonly generatedAt: string;
}

export interface EditorCreateResult {
	readonly kind: "create";
	readonly requestId: string;
	readonly document: EditorDocumentSnapshot;
	readonly undoPreserved: true;
	/** Content, if any, is left unsaved. createFile itself may have created an empty disk file. */
	readonly saved: false;
}

export interface EditorDeleteResult {
	readonly kind: "delete";
	readonly requestId: string;
	readonly path: string;
	readonly uri: string;
}

export interface EditorMoveResult {
	readonly kind: "move";
	readonly requestId: string;
	readonly document: EditorDocumentSnapshot;
	readonly undoPreserved: true;
	readonly saved: false;
}

export interface EditorErrorResult {
	readonly kind: "error";
	readonly requestId?: string;
	readonly error: {
		readonly code: EditorErrorCode;
		readonly message: string;
		readonly current?: Omit<EditorDocumentSnapshot, "text">;
		/** True only when VS Code accepted an edit but the postcondition changed. */
		readonly mayHaveApplied?: boolean;
	};
}

export type EditorResponse =
	| EditorReadResult
	| EditorApplyResult
	| EditorInventoryResult
	| EditorCreateResult
	| EditorDeleteResult
	| EditorMoveResult
	| EditorErrorResult;

