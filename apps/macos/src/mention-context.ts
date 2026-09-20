/** D05 @ context picker rows. Path references only — host file upload is not advertised. */

export type MentionKind = "file" | "folder" | "selection" | "logs" | "artifacts" | "session";
export type MentionAction = "insert" | "attach_path" | "open_work_tab" | "unavailable";

export interface MentionRow {
	readonly id: string;
	readonly kind: MentionKind;
	readonly label: string;
	readonly insert?: string;
	readonly enabled: boolean;
	readonly reason?: string;
	readonly action: MentionAction;
}

export const MENTION_UPLOAD_REASON = "Inserts a path reference. Host file upload is not advertised.";
export const MENTION_NO_SELECTION_REASON = "No editor selection in this window.";
export const MENTION_LOGS_REASON = "OMP interaction log is in the Terminal tab. This is not a user PTY.";

const FILE_LIMIT = 8;
const FOLDER_LIMIT = 4;
const SESSION_LIMIT = 6;
const ARTIFACT_LIMIT = 4;
const SELECTION_PREVIEW_MAX = 80;

export function mentionRows(input: {
	readonly query?: string;
	readonly sessions?: readonly { readonly id: string; readonly title?: string }[];
	readonly files?: readonly { readonly path: string }[];
	readonly artifacts?: readonly { readonly sha256: string; readonly name: string }[];
	readonly hasSelection?: boolean;
	readonly selectionPreview?: string;
	readonly uploadAdvertised?: boolean;
}): readonly MentionRow[] {
	const needle = (input.query ?? "").trim().toLowerCase();
	const selection = selectionRow(input.hasSelection === true, input.selectionPreview);
	const logs = logsRow();
	const fileReason = input.uploadAdvertised !== true ? MENTION_UPLOAD_REASON : undefined;
	const files = (input.files ?? [])
		.filter((file) => matches(needle, file.path))
		.slice(0, FILE_LIMIT)
		.map((file): MentionRow => ({
			id: file.path,
			kind: "file",
			label: file.path,
			insert: `@${file.path}`,
			enabled: true,
			reason: fileReason,
			action: "attach_path",
		}));
	const folders = folderRows(input.files ?? [], needle, fileReason);
	const sessions = (input.sessions ?? [])
		.filter((session) => matches(needle, session.title, session.id))
		.slice(0, SESSION_LIMIT)
		.map((session): MentionRow => {
			const title = session.title || session.id;
			return {
				id: session.id,
				kind: "session",
				label: title,
				insert: `@${title}`,
				enabled: true,
				action: "insert",
			};
		});
	const artifacts = (input.artifacts ?? [])
		.filter((artifact) => matches(needle, artifact.name))
		.slice(0, ARTIFACT_LIMIT)
		.map((artifact): MentionRow => ({
			id: artifact.sha256,
			kind: "artifacts",
			label: artifact.name,
			insert: `@${artifact.name}`,
			enabled: true,
			action: "insert",
		}));
	const stubs = [selection, logs].filter((row) => stubMatches(needle, row, input.selectionPreview));
	return [...stubs, ...folders, ...files, ...sessions, ...artifacts];
}

function folderRows(files: readonly { readonly path: string }[], needle: string, reason?: string): MentionRow[] {
	const dirs = new Set<string>();
	for (const file of files) {
		const parts = file.path.replace(/\\/g, "/").split("/").filter(Boolean);
		let acc = "";
		for (let i = 0; i < parts.length - 1; i++) {
			acc = acc ? `${acc}/${parts[i]}` : parts[i];
			dirs.add(acc);
		}
	}
	return [...dirs]
		.filter((dir) => matches(needle, dir))
		.slice(0, FOLDER_LIMIT)
		.map((dir): MentionRow => ({
			id: dir,
			kind: "folder",
			label: dir,
			insert: `@${dir}`,
			enabled: true,
			reason,
			action: "attach_path",
		}));
}

function selectionRow(hasSelection: boolean, preview: string | undefined): MentionRow {
	if (hasSelection) {
		return {
			id: "selection",
			kind: "selection",
			label: "Selection",
			insert: truncatePreview(preview ?? ""),
			enabled: true,
			action: "insert",
		};
	}
	return {
		id: "selection",
		kind: "selection",
		label: "Selection",
		enabled: false,
		reason: MENTION_NO_SELECTION_REASON,
		action: "unavailable",
	};
}

function logsRow(): MentionRow {
	return {
		id: "terminal",
		kind: "logs",
		label: "Logs",
		enabled: true,
		reason: MENTION_LOGS_REASON,
		action: "open_work_tab",
	};
}

function matches(needle: string, ...parts: Array<string | undefined>): boolean {
	if (!needle) return true;
	return parts.some((part) => part != null && part.toLowerCase().includes(needle));
}

function stubMatches(needle: string, row: MentionRow, selectionPreview: string | undefined): boolean {
	if (!needle) return true;
	if (row.kind === "selection") return matches(needle, row.label, row.insert, selectionPreview);
	return matches(needle, row.label, row.id);
}

function truncatePreview(value: string): string {
	const trimmed = value.trim();
	return trimmed.length <= SELECTION_PREVIEW_MAX ? trimmed : trimmed.slice(0, SELECTION_PREVIEW_MAX);
}
